# Maintenance Step Functions Terraform Module

Worker Lambdaを並列実行するオーケストレーション Step Functions の Terraform モジュールです。

## 概要

このモジュールは以下のリソースを作成します：

- Step Functions State Machine
- Step Functions 専用 IAM ロール
- Lambda Invoke 権限
- CloudWatch Logs ロググループ

## 使用方法

```hcl
module "maintenance_sfn" {
  source = "./modules/maintenance/step-functions"

  env                = var.env
  worker_function_arn = module.maintenance_worker.function_arn
  log_retention_days  = 7
}
```

## 入力変数

| 変数名                | 説明                               | 型       | デフォルト値 | 必須   |
| --------------------- | ---------------------------------- | -------- | ------------ | ------ |
| `env`                 | 環境識別子 (dev, stg, prd)         | `string` | -            | はい   |
| `worker_function_arn` | Worker Lambda 関数 ARN             | `string` | -            | はい   |
| `log_retention_days`  | CloudWatch Logs の保持期間（日数） | `number` | `7`          | いいえ |

## 出力値

| 出力名               | 説明                              |
| -------------------- | --------------------------------- |
| `state_machine_arn`  | Step Functions ステートマシン ARN |
| `state_machine_name` | Step Functions ステートマシン名   |
| `role_arn`           | Step Functions IAM ロール ARN     |
| `log_group_name`     | CloudWatch Logs ロググループ名    |

## State Machine フロー

1. **GenerateSegments**: セグメント配列を生成（0-7）
2. **ParallelWorkers**: Worker Lambda を並列実行（MaxConcurrency: 8）
3. **AggregateResults**: 各ワーカーの結果を集約

## IAM 権限

Step Functions は以下の権限を持ちます：

- **Lambda**: `InvokeFunction`（Worker Lambda のみ）
- **CloudWatch Logs**: ログ出力

## 前提条件

- Worker Lambda 関数が作成済みであること

## 実行例

```bash
# Coordinator Lambda 経由で実行
aws lambda invoke \
  --function-name ainews-dev-maintenance-coordinator \
  --payload '{"resource":"articles","segments":8,"dryRun":true}' \
  response.json

# 実行状態を確認
aws stepfunctions describe-execution \
  --execution-arn <execution-arn>
```

## 関連リソース

- [State Machine 定義](./state-machine.json)
- [Maintenance Coordinator Lambda モジュール](../lambda-coordinator/)
- [Maintenance Worker Lambda モジュール](../lambda-worker/)
