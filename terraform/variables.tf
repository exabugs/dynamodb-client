# Records Lambdaモジュール変数定義

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

variable "dynamodb_table_name" {
  description = "DynamoDBテーブル名"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "DynamoDBテーブルARN"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito App Client ID（オプション、指定時は aud を検証）"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch Logsの保持期間（日数）"
  type        = number
  default     = 7
}

variable "log_level" {
  description = "ログレベル（debug, info, warn, error）"
  type        = string
  default     = "info"

  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.log_level)
    error_message = "ログレベルは debug, info, warn, error のいずれかである必要があります。"
  }
}

variable "shadow_config" {
  description = "シャドー設定（base64エンコード済みJSON）"
  type        = string
}
