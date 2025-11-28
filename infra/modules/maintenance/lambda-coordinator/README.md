# Maintenance Coordinator Lambda Terraform Module

シャドー整合性メンテナンスを開始するオーケストレーター Lambda 関数の Terraform モジュールです。

## 概要

このモジュールは以下のリソースを作成します：

- Maintenance Coordinator Lambda 関数
- Lambda 専用 IAM ロール
- Step Functions StartExecution 権限
- CloudWatch Logs ロググループ

## 使用方法

```hcl
module "maintenance_coordinator" {
  source = "./modules/maintenance/lambda-coordinator"

  env               = var.env
  region            = var.region
  state_machine_arn = module.maintenance_sfn.state_machine_arn
  allow_resources   = "articles,tasks,fetchLogs"
  log_level         = "INFO"
  log_retention_days = 7
}
```

## 入力変数

| 変数名               | 説明                                  | 型       | デフォルト値                 | 必須   |
| -------------------- | ------------------------------------- | -------- | ---------------------------- | ------ |
| `env`                | 環境識別子 (dev, stg, prd)            | `string` | -                            | はい   |
| `region`             | AWS リージョン                        | `string` | -                            | はい   |
| `state_machine_arn`  | Step Functions ステートマシン ARN     | `string` | -                            | はい   |
| `allow_resources`    | 許可されたリソース名（カンマ区切り）  | `string` | `"articles,tasks,fetchLogs"` | いいえ |
| `log_level`          | ログレベル (DEBUG, INFO, WARN, ERROR) | `string` | `"INFO"`                     | いいえ |
| `log_retention_days` | CloudWatch Logs の保持期間（日数）    | `number` | `7`                          | いいえ |

## 出力値

| 出力名           | 説明                              |
| ---------------- | --------------------------------- |
| `function_arn`   | Coordinator Lambda 関数 ARN       |
| `function_name`  | Coordinator Lambda 関数名         |
| `role_arn`       | Coordinator Lambda IAM ロール ARN |
| `log_group_name` | CloudWatch Logs ロググループ名    |

## IAM 権限

Coordinator Lambda は以下の権限を持ちます：

- **Step Functions**: `states:StartExecution`（特定のステートマシンのみ）
- **CloudWatch Logs**: ログ出力（AWS マネージドポリシー）
- **X-Ray**: トレーシング（AWS マネージドポリシー）

## 前提条件

- Lambda 関数のビルド成果物が `../functions/maintenance/coordinator/dist/handler.mjs` に存在すること
- Step Functions ステートマシンが作成済みであること

## デプロイ前の準備

```bash
# Lambda 関数をビルド
cd functions/maintenance/coordinator
pnpm install
pnpm build
```

## 関連リソース

- [Coordinator Lambda ソースコード](../../../functions/maintenance/coordinator/)
- [Maintenance Worker Lambda モジュール](../lambda-worker/)
- [Step Functions モジュール](../step-functions/)
