# Maintenance Worker Lambda Terraform Module

DynamoDBレコードを走査してシャドーを修復するワーカー Lambda 関数の Terraform モジュールです。

## 概要

このモジュールは以下のリソースを作成します：

- Maintenance Worker Lambda 関数
- Lambda 専用 IAM ロール
- DynamoDB アクセス権限（Scan、Query、GetItem、TransactWriteItems）
- CloudWatch Logs ロググループ

## 使用方法

```hcl
module "maintenance_worker" {
  source = "./modules/maintenance/lambda-worker"

  env               = var.env
  region            = var.region
  table_name        = module.dynamodb.table_name
  table_arn         = module.dynamodb.table_arn
  shadow_config     = local.shadow_config
  log_level         = "INFO"
  log_retention_days = 7
}
```

## 入力変数

| 変数名               | 説明                                  | 型       | デフォルト値 | 必須   |
| -------------------- | ------------------------------------- | -------- | ------------ | ------ |
| `env`                | 環境識別子 (dev, stg, prd)            | `string` | -            | はい   |
| `region`             | AWS リージョン                        | `string` | -            | はい   |
| `table_name`         | DynamoDB テーブル名                   | `string` | -            | はい   |
| `table_arn`          | DynamoDB テーブル ARN                 | `string` | -            | はい   |
| `shadow_config`      | シャドー設定（base64エンコード）      | `string` | -            | はい   |
| `log_level`          | ログレベル (DEBUG, INFO, WARN, ERROR) | `string` | `"INFO"`     | いいえ |
| `log_retention_days` | CloudWatch Logs の保持期間（日数）    | `number` | `7`          | いいえ |

## 出力値

| 出力名           | 説明                           |
| ---------------- | ------------------------------ |
| `function_arn`   | Worker Lambda 関数 ARN         |
| `function_name`  | Worker Lambda 関数名           |
| `role_arn`       | Worker Lambda IAM ロール ARN   |
| `log_group_name` | CloudWatch Logs ロググループ名 |

## IAM 権限

Worker Lambda は以下の権限を持ちます：

- **DynamoDB**: `Scan`、`Query`、`GetItem`、`TransactWriteItems`（特定のテーブルのみ）
- **CloudWatch Logs**: ログ出力（AWS マネージドポリシー）
- **X-Ray**: トレーシング（AWS マネージドポリシー）

## 前提条件

- Lambda 関数のビルド成果物が `../functions/maintenance/worker/dist/handler.mjs` に存在すること
- DynamoDB テーブルが作成済みであること
- シャドー設定（shadow.config.json）が base64 エンコードされていること

## デプロイ前の準備

```bash
# Lambda 関数をビルド
cd functions/maintenance/worker
pnpm install
pnpm build
```

## パフォーマンス考慮事項

- **Lambda タイムアウト**: 15分（900秒）に設定（大量のレコードを処理する場合）
- **Lambda メモリ**: 512MB に設定（必要に応じて調整）
- **DynamoDB キャパシティ**: 大量の修復を実行する場合、DynamoDB のキャパシティを考慮

## 関連リソース

- [Worker Lambda ソースコード](../../../functions/maintenance/worker/)
- [Maintenance Coordinator Lambda モジュール](../lambda-coordinator/)
- [Step Functions モジュール](../step-functions/)
