# Parameter Store移行設計書

## 概要

Terraform outputからAWS Parameter Storeへの移行により、アプリケーション設定の柔軟性とセキュリティを向上させる。

## 移行の背景

### 現在の課題

1. **Terraform output依存**: アプリケーション設定がTerraform outputに依存
2. **デプロイ時の結合**: インフラとアプリケーションのデプロイが密結合
3. **設定変更の困難**: 設定変更にTerraform再実行が必要
4. **セキュリティ**: 平文での設定値保存

### 移行後のメリット

1. **柔軟な設定管理**: Parameter Storeで動的な設定変更が可能
2. **セキュリティ向上**: KMS暗号化による設定値の保護
3. **デプロイの分離**: インフラとアプリケーションの独立デプロイ
4. **監査ログ**: CloudTrailによる設定変更の完全な追跡

## 設計原則

### Parameter Store設定

- **階層**: Standard階層のみ使用（実質無料）
- **タイプ**: すべてSecureString型で統一
- **暗号化**: AWS管理キー（`alias/aws/ssm`）のみ使用
- **カスタマー管理キー**: 絶対に使用しない（運用複雑化を避ける）

### 階層構造

```
/{project_name}/{environment}/
├── app/                        # アプリケーション設定
│   ├── records-api-url         # Lambda Function URL
│   └── admin-ui/               # Admin UI設定
│       ├── cognito-user-pool-id
│       ├── cognito-client-id
│       └── cognito-domain
├── infra/                      # インフラ情報
│   ├── dynamodb-table-name
│   ├── dynamodb-table-arn
│   └── s3-bucket-name
└── lambda/                     # Lambda関数情報
    ├── records-function-arn
    ├── fetch-function-arn
    └── maintenance-coordinator-arn
```

## 移行対象の分類

### Parameter Storeに移行

**Admin UI設定**:
- Cognito User Pool ID
- Cognito Client ID  
- Cognito Domain
- Records API URL

**Fetch Lambda設定**:
- Records Function URL
- Records Function ARN

**インフラ情報（必要に応じて）**:
- DynamoDB Table Name
- DynamoDB Table ARN

### Terraform outputのまま保持

**セキュリティ監査用**:
- IAMロールARN
- IAMポリシーARN

**運用監視用**:
- CloudWatch Logs Group名
- CloudWatch Logs Group ARN

**インフラ管理用**:
- Step Functions ARN
- VPC関連リソース

### 移行不要

**汎用ライブラリ**:
- dynamodb-client Lambda関数（汎用ライブラリのため外部設定不要）

## コスト分析

### Parameter Store Standard階層

- **標準スループット**: 1,000 TPS以下では完全無料
- **高スループット**: $0.05/10,000リクエスト（通常は不要）

### KMS暗号化

- **AWS管理キー**: 完全無料
- **カスタマー管理キー**: 月額$1 + API呼び出し料金（使用禁止）

### 実質的なコスト

通常の使用パターンでは**完全に無料**：
- Parameter Store Standard: 無料（1,000 TPS以下）
- AWS管理キー: 無料
- 月額固定費: $0

## セキュリティ設計

### 暗号化

- **保存時暗号化**: KMS SecureStringで全パラメータを暗号化
- **転送時暗号化**: HTTPS/TLS 1.2以上で通信
- **キー管理**: AWS管理キーのみ使用（運用負荷軽減）

### アクセス制御

**Admin UI用IAMポリシー**:
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:GetParameters", 
    "ssm:GetParametersByPath"
  ],
  "Resource": [
    "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/app/*"
  ]
}
```

**Fetch Lambda用IAMポリシー**:
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:GetParameters"
  ],
  "Resource": [
    "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/app/records-api-url",
    "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/lambda/records-function-arn"
  ]
}
```

### 監査ログ

- **CloudTrail**: 全Parameter Store操作を記録
- **ログ項目**: 誰が、いつ、どのパラメータを、どう変更したか
- **保存期間**: 90日間（デフォルト）

## 実装設計

### Terraformモジュール構造

```
terraform/modules/parameter-store/
├── main.tf           # Parameter Store リソース定義
├── variables.tf      # 入力変数定義
├── outputs.tf        # 出力値定義
├── iam.tf           # IAMポリシー定義
└── README.md        # モジュール説明書
```

### パラメータ定義例

```hcl
# Records Lambda Function URL
resource "aws_ssm_parameter" "app_records_api_url" {
  name  = "/${var.project_name}/${var.environment}/app/records-api-url"
  type  = "SecureString"
  tier  = "Standard"
  value = var.records_function_url

  description = "Records Lambda Function URL"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }
}
```

### IAMポリシー定義例

```hcl
# Admin UI用Parameter Store読み取りポリシー
resource "aws_iam_policy" "admin_ui_parameter_read" {
  name        = "${var.project_name}-${var.environment}-admin-ui-parameter-read"
  description = "Admin UI用Parameter Store読み取り権限"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${var.region}:*:parameter/${var.project_name}/${var.environment}/app/*"
        ]
      }
    ]
  })
}
```

## 移行手順

### フェーズ1: Parameter Storeモジュール作成

1. **Terraformモジュール作成**: `terraform/modules/parameter-store/`
2. **パラメータ定義**: 必要なパラメータをすべて定義
3. **IAMポリシー作成**: アクセス権限を最小権限で定義
4. **テスト**: 開発環境でモジュールをテスト

### フェーズ2: メインTerraform設定更新

1. **モジュール統合**: `main.tf`にParameter Storeモジュールを追加
2. **出力値追加**: Parameter Store関連の出力を追加
3. **依存関係設定**: Lambda関数作成後にParameter Store作成

### フェーズ3: アプリケーション側対応

1. **Admin UI更新**: Parameter Storeから設定を読み込むよう変更
2. **Fetch Lambda更新**: Parameter Storeから設定を読み込むよう変更
3. **IAMロール更新**: 必要な権限をアタッチ

### フェーズ4: 検証とデプロイ

1. **開発環境検証**: 全機能が正常動作することを確認
2. **ステージング環境検証**: 本番同等環境でテスト
3. **本番環境デプロイ**: 段階的にロールアウト

## 運用設計

### 設定変更手順

1. **Parameter Store更新**: AWS CLIまたはコンソールで値を更新
2. **アプリケーション再起動**: 新しい設定値を反映（必要に応じて）
3. **動作確認**: 設定変更が正しく反映されていることを確認

### 監視とアラート

1. **CloudWatch Metrics**: Parameter Store API呼び出し数を監視
2. **CloudTrail Logs**: 設定変更操作を監視
3. **アラート設定**: 異常なアクセスパターンを検知

### バックアップと復旧

1. **設定値バックアップ**: 定期的にParameter Store値をエクスポート
2. **バージョン管理**: Parameter Storeの履歴機能を活用
3. **復旧手順**: 設定値の誤変更時の復旧手順を文書化

## リスク分析と対策

### リスク1: Parameter Store障害

**影響**: アプリケーションが設定を読み込めない
**対策**: 
- アプリケーション側でキャッシュ機能を実装
- フォールバック設定を環境変数で保持

### リスク2: IAM権限設定ミス

**影響**: アプリケーションがParameter Storeにアクセスできない
**対策**:
- 最小権限の原則に従った権限設計
- 開発環境での十分なテスト
- IAMポリシーシミュレーターでの事前検証

### リスク3: 設定値の誤変更

**影響**: アプリケーションの動作不良
**対策**:
- Parameter Storeの履歴機能を活用
- 変更前のバックアップ取得
- 段階的なロールアウト

## 成功指標

### 技術指標

1. **可用性**: Parameter Store読み取り成功率 99.9%以上
2. **パフォーマンス**: 設定読み込み時間 100ms以下
3. **セキュリティ**: 不正アクセス検知 0件

### 運用指標

1. **設定変更時間**: Terraform再実行不要により50%短縮
2. **デプロイ独立性**: インフラとアプリケーションの独立デプロイ実現
3. **監査対応**: 設定変更履歴の完全な追跡可能

## まとめ

Parameter Store移行により、以下の価値を実現：

1. **コスト効率**: 実質無料での運用
2. **セキュリティ**: KMS暗号化による保護
3. **運用効率**: 動的な設定変更とデプロイ分離
4. **監査対応**: 完全な変更履歴追跡

この移行により、dynamodb-clientライブラリの運用がより柔軟で安全になります。