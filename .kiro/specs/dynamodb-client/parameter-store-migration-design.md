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

### 🔒 Single Source of Truth（重要事項）

**Parameter Store は秘匿情報の唯一の情報源（Single Source of Truth）である**

#### 基本原則

1. **秘匿情報の一元管理**
   - API キー、データベース接続文字列、認証情報等の秘匿情報は **Parameter Store のみ** に保存する
   - 環境変数、設定ファイル、コード内への直接記述は **絶対に禁止**
   - 開発環境でも本番環境と同じ Parameter Store を使用する

2. **情報の重複禁止**
   - 同じ秘匿情報を複数の場所に保存してはならない
   - Parameter Store の値が変更された場合、他の場所での更新は不要でなければならない
   - 「バックアップ」や「フォールバック」を理由とした重複保存も禁止

3. **アクセスパターンの統一**
   - すべてのアプリケーションは Parameter Store から直接読み取る
   - キャッシュする場合も、Parameter Store が最新の情報源であることを保証する
   - 設定変更時は Parameter Store の更新のみで全システムに反映される

#### 秘匿情報の分類と管理

**Level 1: 最高機密（Top Secret）**
- データベースのマスターパスワード
- 外部 API の秘密キー（Stripe、AWS等）
- JWT 署名キー
- 暗号化キー

**Level 2: 機密（Secret）**
- Cognito Client Secret
- OAuth Client Secret
- サードパーティサービスの API キー

**Level 3: 内部情報（Internal）**
- データベース接続文字列（パスワード含む）
- 内部サービスの URL
- 設定値（機密性は低いが一元管理が必要）

#### 禁止事項（絶対に守ること）

❌ **環境変数での秘匿情報保存**
```bash
# 絶対に禁止
export DATABASE_PASSWORD="secret123"
export API_KEY="sk-1234567890"
```

❌ **設定ファイルでの秘匿情報保存**
```json
// 絶対に禁止
{
  "database": {
    "password": "secret123"
  },
  "apiKey": "sk-1234567890"
}
```

❌ **コード内での秘匿情報ハードコーディング**
```typescript
// 絶対に禁止
const API_KEY = "sk-1234567890";
const DB_PASSWORD = "secret123";
```

❌ **複数箇所での同一情報保存**
```bash
# Parameter Store に保存済みなのに、環境変数にも保存（禁止）
export DATABASE_URL="postgresql://user:pass@host/db"
```

#### 正しい実装パターン

✅ **Parameter Store からの直接読み取り**
```typescript
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: "ap-northeast-1" });

async function getSecretValue(parameterName: string): Promise<string> {
  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: true, // SecureString の復号化
  });
  
  const response = await ssmClient.send(command);
  return response.Parameter?.Value || "";
}

// 使用例
const apiKey = await getSecretValue("/myapp/prod/api/stripe-secret-key");
const dbPassword = await getSecretValue("/myapp/prod/db/password");
```

✅ **キャッシュ付きの読み取り（推奨）**
```typescript
class ParameterStoreCache {
  private cache = new Map<string, { value: string; expiry: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5分

  async getParameter(name: string): Promise<string> {
    const cached = this.cache.get(name);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    const value = await getSecretValue(name);
    this.cache.set(name, {
      value,
      expiry: Date.now() + this.TTL
    });
    
    return value;
  }
}
```

#### 監査とコンプライアンス

1. **アクセスログの完全記録**
   - CloudTrail で全 Parameter Store アクセスを記録
   - 誰が、いつ、どのパラメータにアクセスしたかを追跡
   - 不正アクセスの即座検知

2. **定期的な棚卸し**
   - 月次で Parameter Store の全パラメータを棚卸し
   - 不要になったパラメータの削除
   - アクセス権限の見直し

3. **セキュリティスキャン**
   - コードベースに秘匿情報がハードコーディングされていないかスキャン
   - 環境変数や設定ファイルに秘匿情報が含まれていないかチェック
   - CI/CD パイプラインでの自動検証

#### 違反時の対応

**重大な違反を発見した場合**:

1. **即座に停止**: 違反している実装を即座に停止
2. **影響範囲調査**: 秘匿情報の漏洩範囲を調査
3. **秘匿情報の更新**: 漏洩した可能性のある秘匿情報をすべて更新
4. **Parameter Store への移行**: 正しい実装に修正
5. **再発防止策**: チーム全体での教育と仕組みの改善

**軽微な違反の場合**:

1. **優先度付け**: セキュリティリスクに応じて優先度を設定
2. **段階的修正**: 計画的に Parameter Store への移行を実施
3. **監視強化**: 修正完了まで監視を強化

#### チェックリスト

新機能開発・既存機能修正時に以下を確認すること:

- [ ] 秘匿情報は Parameter Store のみに保存されているか
- [ ] 環境変数に秘匿情報が含まれていないか
- [ ] 設定ファイルに秘匿情報が含まれていないか
- [ ] コード内に秘匿情報がハードコーディングされていないか
- [ ] 同じ秘匿情報が複数箇所に保存されていないか
- [ ] Parameter Store からの読み取りが適切に実装されているか
- [ ] エラーハンドリングが適切に実装されているか
- [ ] キャッシュ機能が適切に実装されているか（必要な場合）

### 重要な役割分担（絶対に間違えてはいけない）

#### ⚠️ データフローの方向性

```
dynamodb-client (書き込み) → Parameter Store → example (読み取り)
```

**dynamodb-client の役割**:
- ✅ **Parameter Storeに値を書き込む側**
- ✅ Terraformパラメータとして外部から値を受け取る
- ✅ 受け取った値をParameter Storeに書き込む
- ❌ **Parameter Storeから値を読み取ってはいけない**（循環参照になる）

**example の役割**:
- ✅ **Parameter Storeから値を読み取る側**
- ✅ Terraformパラメータを最小限にする
- ✅ Parameter Storeから直接値を参照する
- ❌ **dynamodb-clientに値を渡してはいけない**（逆方向の依存関係）

#### 間違った設計例（絶対に避ける）

```hcl
# ❌ 間違い: dynamodb-clientがParameter Storeから読み取ろうとする
# これは循環参照になる
data "aws_ssm_parameter" "dynamodb_table_name" {
  name = "/${var.project_name}/${var.environment}/infra/dynamodb-table-name"
}

resource "aws_lambda_function" "records" {
  environment {
    variables = {
      TABLE_NAME = data.aws_ssm_parameter.dynamodb_table_name.value  # ❌ 循環参照
    }
  }
}
```

#### 正しい設計例

```hcl
# ✅ 正しい: dynamodb-clientは外部パラメータを受け取り、Parameter Storeに書き込む
resource "aws_lambda_function" "records" {
  environment {
    variables = {
      TABLE_NAME = var.dynamodb_table_name  # ✅ 外部パラメータを使用
    }
  }
}

module "parameter_store" {
  dynamodb_table_name = var.dynamodb_table_name  # ✅ Parameter Storeに書き込み
}
```

```hcl
# ✅ 正しい: exampleはParameter Storeから読み取る
data "aws_ssm_parameter" "records_api_url" {
  name = "/${var.project_name}/${var.environment}/app/records-api-url"
}

# Admin UIの.env生成でParameter Storeから読み取り
# aws ssm get-parameter --name '/project/env/app/records-api-url'
```

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

## 実装状況

### 完了済み

#### Terraformモジュール実装 ✅
- **Parameter Storeモジュール**: `terraform/modules/parameter-store/` 完全実装
- **パラメータ定義**: 外部参照が必要な全パラメータを定義
- **プレースホルダー設定**: 外部モジュールが値を設定するためのプレースホルダー実装
- **Terraform validation**: 成功確認済み

#### ドキュメント更新 ✅
- **README.md**: Parameter Store統合の説明を追加
- **QUICKSTART.md**: Parameter Store参照手順を追加
- **モジュールREADME**: 使用方法とサンプルコードを完備

#### パッケージ更新 ✅
- **dynamodb-client v0.6.0**: Parameter Store統合版をnpmに公開
- **example プロジェクト**: v0.6.0を使用するよう更新
- **Makefile更新**: Parameter Store参照に変更

#### Git運用強化 ✅
- **厳格なGitルール**: `.kiro/steering/git-operations.md`に追加
- **再発防止策**: `git add .`禁止、個別ファイルステージング必須
- **事前検証**: コミット前の動作確認を義務化

### 実装内容詳細

#### Parameter Store構成

```
/{project_name}/{environment}/
├── app/
│   ├── records-api-url          # Records Lambda Function URL
│   └── admin-ui/
│       ├── cognito-user-pool-id # Cognito User Pool ID
│       ├── cognito-client-id    # Cognito Client ID
│       └── cognito-domain       # Cognito Domain
├── infra/
│   └── dynamodb-table-name      # DynamoDB Table Name
└── lambda/
    └── records-function-arn     # Records Function ARN
```

#### 設計決定事項

1. **Standard階層のみ**: 実質無料（1,000 TPS以下）
2. **SecureString統一**: AWS管理キーで暗号化
3. **プレースホルダー方式**: 外部モジュールが実際の値を設定
4. **lifecycle ignore_changes**: 外部設定値の保護

#### 簡素化された実装

- **IAMポリシー**: 各プロジェクトで個別定義（モジュールには含めない）
- **最小限のパラメータ**: 外部参照が必要なもののみ
- **プレースホルダー値**: "PLACEHOLDER_*"で統一

### 次のステップ

1. **実際のプロジェクトでの使用**: ainewsプロジェクト等での実装
2. **IAMポリシー実装**: 各プロジェクトでの個別実装
3. **運用監視**: Parameter Store使用状況の監視設定