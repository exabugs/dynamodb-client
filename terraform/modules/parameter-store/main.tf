# Parameter Store モジュール
# AWS Parameter Store を使用してアプリケーション設定を管理

# Parameter Store設定の共通変数
locals {
  parameter_tier = "Standard"     # Standard階層を使用（実質無料）
  parameter_type = "SecureString" # すべてSecureStringで統一
  # AWS管理キー（alias/aws/ssm）を使用（カスタマー管理キーは禁止）
}

# Records Lambda Function URL (外部参照用)
resource "aws_ssm_parameter" "app_records_api_url" {
  name  = "/${var.project_name}/${var.environment}/app/records-api-url"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = var.records_function_url

  description = "Records Lambda Function URL"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }
}

# Records Lambda Function ARN (外部参照用)
resource "aws_ssm_parameter" "lambda_records_function_arn" {
  name  = "/${var.project_name}/${var.environment}/lambda/records-function-arn"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = var.records_function_arn

  description = "Records Lambda Function ARN"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "lambda-info"
  }
}

# 外部参照用のパラメータ（実際の値を設定）
# アプリケーション（Admin UI、Fetch Lambda等）がこれらの値を参照する

# Cognito User Pool ID (Admin UI参照用)
resource "aws_ssm_parameter" "app_admin_ui_cognito_user_pool_id" {
  name  = "/${var.project_name}/${var.environment}/app/admin-ui/cognito-user-pool-id"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = var.cognito_user_pool_id

  description = "Cognito User Pool ID for Admin UI"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }
}

# Cognito Client ID (Admin UI参照用)
resource "aws_ssm_parameter" "app_admin_ui_cognito_client_id" {
  name  = "/${var.project_name}/${var.environment}/app/admin-ui/cognito-client-id"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = var.cognito_admin_ui_client_id

  description = "Cognito Client ID for Admin UI"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }
}

# Cognito Domain (Admin UI参照用)
resource "aws_ssm_parameter" "app_admin_ui_cognito_domain" {
  name  = "/${var.project_name}/${var.environment}/app/admin-ui/cognito-domain"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = "${var.cognito_user_pool_domain}.auth.${var.region}.amazoncognito.com"

  description = "Cognito Domain for Admin UI"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }
}

# DynamoDB Table Name (外部参照用)
resource "aws_ssm_parameter" "infra_dynamodb_table_name" {
  name  = "/${var.project_name}/${var.environment}/infra/dynamodb-table-name"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = var.dynamodb_table_name

  description = "DynamoDB Table Name"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "infra-info"
  }
}
