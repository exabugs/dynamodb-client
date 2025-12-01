# Records Lambda Terraformモジュール

DynamoDB Single-Table設計向けのRecords Lambda関数をデプロイするTerraformモジュールです。

## 概要

このモジュールは、以下のリソースをデプロイします：

- AWS Lambda関数（Records Lambda）
- Lambda Function URL（認証付き）
- IAMロールとポリシー
- CloudWatch Logsロググループ

## 使用方法

### 基本的な使用例

```hcl
module "lambda_records" {
  source = "github.com/exabugs/dynamodb-client//terraform"

  project_name = "my-project"
  environment  = "dev"
  region       = "us-east-1"

  # DynamoDB設定
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn

  # Cognito設定
  cognito_user_pool_id = module.cognito.user_pool_id

  # シャドウ設定（base64エンコード）
  shadow_config = base64encode(file("${path.root}/../packages/api-types/shadow.config.json"))

  # ログ設定
  log_retention_days = 7
  log_level          = "info"
}
```

### ローカル開発時

```hcl
module "lambda_records" {
  source = "./terraform"  # 相対パス

  project_name = "my-project"
  environment  = "dev"
  region       = "us-east-1"

  # DynamoDB設定
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn

  # Cognito設定
  cognito_user_pool_id = module.cognito.user_pool_id

  # シャドウ設定（base64エンコード）
  shadow_config = base64encode(file("${path.root}/../packages/api-types/shadow.config.json"))
}
```

## 入力変数

### 必須変数

| 変数名                 | 型     | 説明                             |
| ---------------------- | ------ | -------------------------------- |
| `project_name`         | string | プロジェクト名                   |
| `environment`          | string | 環境（dev/stg/prd）              |
| `region`               | string | AWSリージョン                    |
| `dynamodb_table_name`  | string | DynamoDBテーブル名               |
| `dynamodb_table_arn`   | string | DynamoDBテーブルARN              |
| `cognito_user_pool_id` | string | Cognito User Pool ID（認証用）   |
| `shadow_config`        | string | シャドウ設定（base64エンコード） |

### オプション変数

| 変数名               | 型     | デフォルト値 | 説明                                |
| -------------------- | ------ | ------------ | ----------------------------------- |
| `log_retention_days` | number | 7            | CloudWatch Logsの保持期間（日）     |
| `log_level`          | string | "info"       | ログレベル（debug/info/warn/error） |
| `lambda_timeout`     | number | 900          | Lambda関数のタイムアウト（秒）      |
| `lambda_memory`      | number | 512          | Lambda関数のメモリサイズ（MB）      |

## 出力

| 出力名           | 説明                             |
| ---------------- | -------------------------------- |
| `function_name`  | Lambda関数名                     |
| `function_arn`   | Lambda関数ARN                    |
| `function_url`   | Lambda Function URL              |
| `log_group_name` | CloudWatch Logsロググループ名    |
| `role_arn`       | Lambda実行ロールARN              |
| `shadow_config`  | シャドウ設定（base64エンコード） |

## 要件

- **Terraform**: >= 1.5.0
- **AWS Provider**: >= 5.0.0
- **DynamoDBテーブル**: Single-Table設計のテーブルが必要
- **Cognito User Pool**: 認証用のUser Poolが必要

## シャドウ設定

シャドウ設定は、DynamoDBのソート可能フィールドを定義するJSON設定ファイルです。

### 設定例

```json
{
  "$schemaVersion": "1.0",
  "resources": {
    "articles": {
      "sortDefaults": {
        "field": "updatedAt",
        "order": "DESC"
      },
      "shadows": {
        "name": { "type": "string" },
        "status": { "type": "string" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      }
    }
  }
}
```

### Base64エンコード

Terraformでは、シャドウ設定をbase64エンコードして渡します：

```hcl
shadow_config = base64encode(file("${path.root}/../packages/api-types/shadow.config.json"))
```

## IAMポリシー

このモジュールは、最小権限の原則に従ったIAMポリシーを作成します：

### Records Lambda IAMロール

- **DynamoDB**: 特定テーブルへの読み書き
  - GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan, BatchGetItem, TransactWriteItems
- **CloudWatch Logs**: ログ出力（AWSマネージドポリシー）
- **X-Ray**: トレーシング（AWSマネージドポリシー）

## デプロイ

### 初回デプロイ

```bash
cd infra
terraform init
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

### 更新デプロイ

```bash
cd infra
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

### Makefileを使用（推奨）

```bash
cd infra
make plan ENV=dev
make apply ENV=dev
```

## トラブルシューティング

### Lambda関数が更新されない

Lambda関数のソースコードを変更した場合、ビルドしてからデプロイしてください：

```bash
# ビルド
make build

# デプロイ
cd infra
make apply ENV=dev
```

### シャドウ設定が反映されない

シャドウ設定を変更した場合、Lambda関数が自動的に再デプロイされます：

```bash
cd infra
make plan ENV=dev  # 差分を確認
make apply ENV=dev # 適用
```

### ログが表示されない

CloudWatch Logsを確認してください：

```bash
# ログを表示
make logs-records ENV=dev

# または直接AWS CLIで
aws logs tail /aws/lambda/my-project-dev-records --follow
```

## 関連ドキュメント

- [パッケージREADME](../README.md) - クライアントライブラリの使用方法
- [使用ガイド](../CLIENT_USAGE.md) - 認証方式別の詳細な使用方法
- [アーキテクチャ](../ARCHITECTURE.md) - 内部設計とコンポーネント構成

## ライセンス

MIT
