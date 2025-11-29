# Basic Example: DynamoDB Client Lambda Deployment

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

# DynamoDB Table
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

  tags = {
    Name        = "${var.project_name}-${var.environment}-records"
    Environment = var.environment
  }
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-users"

  tags = {
    Name        = "${var.project_name}-${var.environment}-users"
    Environment = var.environment
  }
}

# Records Lambda Module
module "lambda_records" {
  source = "../../"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region

  # DynamoDB
  dynamodb_table_name = aws_dynamodb_table.main.name
  dynamodb_table_arn  = aws_dynamodb_table.main.arn

  # Cognito
  cognito_user_pool_id = aws_cognito_user_pool.main.id

  # Shadow Config
  shadow_config = base64encode(jsonencode({
    "$schemaVersion" = "1.0"
    resources = {
      articles = {
        sortDefaults = {
          field = "updatedAt"
          order = "DESC"
        }
        shadows = {
          title     = { type = "string" }
          status    = { type = "string" }
          createdAt = { type = "datetime" }
          updatedAt = { type = "datetime" }
        }
      }
    }
  }))

  # Logging
  log_retention_days = 7
  log_level          = "info"
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
