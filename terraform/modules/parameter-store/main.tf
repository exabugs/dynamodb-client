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

# 外部参照用のプレースホルダーパラメータ
# 実際のプロジェクトで他のTerraformモジュールから値を設定する

# Cognito User Pool ID (Admin UI参照用)
resource "aws_ssm_parameter" "app_admin_ui_cognito_user_pool_id" {
  name  = "/${var.project_name}/${var.environment}/app/admin-ui/cognito-user-pool-id"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = "PLACEHOLDER_COGNITO_USER_POOL_ID"

  description = "Cognito User Pool ID for Admin UI (set by external Terraform module)"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# Cognito Client ID (Admin UI参照用)
resource "aws_ssm_parameter" "app_admin_ui_cognito_client_id" {
  name  = "/${var.project_name}/${var.environment}/app/admin-ui/cognito-client-id"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = "PLACEHOLDER_COGNITO_CLIENT_ID"

  description = "Cognito Client ID for Admin UI (set by external Terraform module)"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# Cognito Domain (Admin UI参照用)
resource "aws_ssm_parameter" "app_admin_ui_cognito_domain" {
  name  = "/${var.project_name}/${var.environment}/app/admin-ui/cognito-domain"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = "PLACEHOLDER_COGNITO_DOMAIN"

  description = "Cognito Domain for Admin UI (set by external Terraform module)"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "app-config"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# DynamoDB Table Name (外部参照用)
resource "aws_ssm_parameter" "infra_dynamodb_table_name" {
  name  = "/${var.project_name}/${var.environment}/infra/dynamodb-table-name"
  type  = local.parameter_type
  tier  = local.parameter_tier
  value = "PLACEHOLDER_DYNAMODB_TABLE_NAME"

  description = "DynamoDB Table Name (set by external Terraform module)"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Category    = "infra-info"
  }

  lifecycle {
    ignore_changes = [value]
  }
}
