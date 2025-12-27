# Parameter Store Terraform Module

AWS Parameter Storeを使用してアプリケーション設定を管理するTerraformモジュールです。

## 概要

このモジュールは、DynamoDB Clientライブラリを使用するアプリケーションの設定情報をAWS Parameter Storeで管理します。

## 特徴

- **Standard階層**: 標準スループット（1,000 TPS以下）では無料
- **SecureString**: すべてのパラメータをKMS暗号化で保存
- **AWS管理キー**: `alias/aws/ssm`を使用（月額料金なし）
- **階層構造**: `/{project_name}/{environment}/`で環境別に管理
- **IAMポリシー**: Admin UIとFetch Lambda用のアクセス権限を提供

## 使用方法

```hcl
module "parameter_store" {
  source = "./modules/parameter-store"

  # 基本設定
  project_name = "my-project"
  environment  = "dev"
  region       = "us-east-1"

  # Records Lambda設定（必須）
  records_function_url = aws_lambda_function_url.records.function_url
  records_function_arn = aws_lambda_function.records.arn
}
```

**Note**: このモジュールは外部参照用のプレースホルダーパラメータも作成します。実際の値は他のTerraformモジュール（Cognito、DynamoDB等）から設定してください。

### プレースホルダーパラメータの更新

他のTerraformモジュールから値を設定する例：

```hcl
# Cognitoモジュールから
resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name      = "/${var.project_name}/${var.environment}/app/admin-ui/cognito-user-pool-id"
  type      = "SecureString"
  value     = aws_cognito_user_pool.main.id
  overwrite = true
}

# DynamoDBモジュールから
resource "aws_ssm_parameter" "dynamodb_table_name" {
  name      = "/${var.project_name}/${var.environment}/infra/dynamodb-table-name"
  type      = "SecureString"
  value     = aws_dynamodb_table.main.name
  overwrite = true
}
```

## パラメータ構造

### アプリケーション設定 (`/app/`)

- `/{project_name}/{environment}/app/records-api-url`
- `/{project_name}/{environment}/app/admin-ui/cognito-user-pool-id`
- `/{project_name}/{environment}/app/admin-ui/cognito-client-id`
- `/{project_name}/{environment}/app/admin-ui/cognito-domain`

### インフラ情報 (`/infra/`)

- `/{project_name}/{environment}/infra/dynamodb-table-name`

### Lambda情報 (`/lambda/`)

- `/{project_name}/{environment}/lambda/records-function-arn`

## IAMポリシー

### Admin UI用ポリシー

Admin UIが必要とするパラメータへの読み取り権限：

```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
  "Resource": ["arn:aws:ssm:region:*:parameter/{project_name}/{environment}/app/*"]
}
```

### Fetch Lambda用ポリシー

Fetch Lambdaが必要とする特定パラメータへの読み取り権限：

```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParameter", "ssm:GetParameters"],
  "Resource": [
    "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/app/records-api-url",
    "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/lambda/records-function-arn"
  ]
}
```

## 出力

- `parameter_arns`: 作成されたパラメータのARN一覧
- `parameter_names`: 作成されたパラメータの名前一覧
- `parameter_paths`: 作成されたパラメータのパス一覧
- `iam_policy_arns`: 作成されたIAMポリシーのARN一覧
- `iam_policy_names`: 作成されたIAMポリシーの名前一覧

## コスト

- **Parameter Store Standard**: 標準スループット（1,000 TPS以下）では無料
- **AWS管理キー**: 無料（カスタマー管理キーと異なり月額料金なし）
- **実質的なコスト**: 通常の使用では完全に無料

## セキュリティ

- すべてのパラメータがKMS暗号化（SecureString）
- IAMによる細かい権限管理
- CloudTrailで完全な操作追跡
- 最小権限の原則に基づくアクセス制御

## 要件

- Terraform >= 1.0
- AWS Provider >= 4.0
- 適切なAWS認証情報の設定
