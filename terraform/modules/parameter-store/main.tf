# Parameter Store モジュール
# AWS Parameter Store を使用してアプリケーション設定を管理

# Parameter Store設定の共通変数
locals {
  parameter_tier = "Standard"     # Standard階層を使用（実質無料）
  parameter_type = "SecureString" # すべてSecureStringで統一
  # AWS管理キー（alias/aws/ssm）を使用（カスタマー管理キーは禁止）
}

# DynamoDB Client API URL (外部参照用)
# NONE認証。ブラウザ・Admin UI（Cognito JWT）向け。
# サーバー間呼び出し・運用スクリプト（IAM署名）はこちらを使わないこと
# （IAM認証バイパス脆弱性の修正でNONE URLからIAM認証の分岐が削除された。
# ADR: dynamodb-client/docs/adr/0001-fix-iam-auth-bypass.md）。
# 下のinfra_dynamodb_client_api_iam_urlを使う。
resource "aws_ssm_parameter" "infra_dynamodb_client_api_url" {
  name      = "/${var.project_name}/${var.environment}/infra/dynamodb-client-api-url"
  type      = local.parameter_type
  tier      = local.parameter_tier
  value     = var.records_function_url
  overwrite = true

  description = "DynamoDB Client API URL, NONE auth (for Admin UI / Cognito JWT clients only)"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "infra-info"
  }
}

# DynamoDB Client API URL, AWS_IAM認証版 (外部参照用)
# サーバー間呼び出し・運用スクリプト（IAM署名クライアント）向け
resource "aws_ssm_parameter" "infra_dynamodb_client_api_iam_url" {
  count = var.records_iam_function_url != null ? 1 : 0

  name      = "/${var.project_name}/${var.environment}/infra/dynamodb-client-api-iam-url"
  type      = local.parameter_type
  tier      = local.parameter_tier
  value     = var.records_iam_function_url
  overwrite = true

  description = "DynamoDB Client API URL, AWS_IAM auth (for server-to-server callers and operational scripts)"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "infra-info"
  }
}

# DynamoDB Client API Lambda ARN (外部参照用)
resource "aws_ssm_parameter" "infra_dynamodb_client_api_arn" {
  name      = "/${var.project_name}/${var.environment}/infra/dynamodb-client-api-arn"
  type      = local.parameter_type
  tier      = local.parameter_tier
  value     = var.records_function_arn
  overwrite = true

  description = "DynamoDB Client API Lambda Function ARN"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "infra-info"
  }
}



# DynamoDB Table Name (外部参照用)
resource "aws_ssm_parameter" "infra_dynamodb_table_name" {
  name      = "/${var.project_name}/${var.environment}/infra/dynamodb-table-name"
  type      = local.parameter_type
  tier      = local.parameter_tier
  value     = var.dynamodb_table_name
  overwrite = true

  description = "DynamoDB Table Name"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "infra-info"
  }
}

# DynamoDB Table ARN (外部参照用)
resource "aws_ssm_parameter" "infra_dynamodb_table_arn" {
  name      = "/${var.project_name}/${var.environment}/infra/dynamodb-table-arn"
  type      = local.parameter_type
  tier      = local.parameter_tier
  value     = var.dynamodb_table_arn
  overwrite = true

  description = "DynamoDB Table ARN"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "infra-info"
  }
}
