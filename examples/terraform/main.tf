# Advanced Example: Multi-Environment with External Shadow Config

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# DynamoDB Table with TTL
resource "aws_dynamodb_table" "main" {
  name         = "${var.project_name}-${var.environment}-records"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # TTL Configuration
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time Recovery
  point_in_time_recovery {
    enabled = var.environment == "prd"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-records"
    Environment = var.environment
  }
}

# Cognito User Pool with Advanced Settings
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-users"

  # Password Policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # MFA Configuration
  mfa_configuration = var.environment == "prd" ? "REQUIRED" : "OPTIONAL"

  tags = {
    Name        = "${var.project_name}-${var.environment}-users"
    Environment = var.environment
  }
}

# Cognito App Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-${var.environment}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Token Validity
  access_token_validity  = 1  # 1 hour
  id_token_validity      = 1  # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

# Records Lambda Module with External Config
module "lambda_records" {
  source = "../../terraform"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region

  # DynamoDB
  dynamodb_table_name = aws_dynamodb_table.main.name
  dynamodb_table_arn  = aws_dynamodb_table.main.arn

  # Cognito
  cognito_user_pool_id = aws_cognito_user_pool.main.id
  cognito_client_id    = aws_cognito_user_pool_client.main.id

  # Shadow Config from External File
  shadow_config = filebase64("${path.module}/shadow.config.json")

  # Logging (environment-specific)
  log_retention_days = var.environment == "prd" ? 30 : 7
  log_level          = var.environment == "prd" ? "warn" : "debug"
}

# CloudWatch Alarm for Lambda Errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Lambda function error rate is too high"

  dimensions = {
    FunctionName = module.lambda_records.function_name
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
}

# Outputs
output "function_url" {
  description = "Lambda Function URL"
  value       = module.lambda_records.function_url
}

output "function_name" {
  description = "Lambda Function Name"
  value       = module.lambda_records.function_name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = aws_cognito_user_pool_client.main.id
}
