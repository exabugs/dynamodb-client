# Parameter Store モジュール変数定義

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境識別子（dev, stg, prd）"
  type        = string
}

variable "region" {
  description = "AWSリージョン"
  type        = string
}

variable "records_function_url" {
  description = "Records Lambda Function URL"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_admin_ui_client_id" {
  description = "Admin UI用Cognito App Client ID"
  type        = string
}

variable "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain"
  type        = string
}

variable "dynamodb_table_name" {
  description = "DynamoDB Table Name"
  type        = string
}

variable "records_function_arn" {
  description = "Records Lambda Function ARN"
  type        = string
}
