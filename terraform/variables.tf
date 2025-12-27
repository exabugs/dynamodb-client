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

variable "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain"
  type        = string
}

variable "cognito_admin_ui_client_id" {
  description = "Admin UI用Cognito User Pool Client ID"
  type        = string
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

# シャドウ設定（環境変数ベース）
variable "shadow_created_at_field" {
  description = "作成日時フィールド名"
  type        = string
  default     = "createdAt"
}

variable "shadow_updated_at_field" {
  description = "更新日時フィールド名"
  type        = string
  default     = "updatedAt"
}

variable "shadow_string_max_bytes" {
  description = "プリミティブ型の最大バイト数（array/objectは2倍）"
  type        = number
  default     = 100

  validation {
    condition     = var.shadow_string_max_bytes > 0
    error_message = "shadow_string_max_bytes は正の整数である必要があります。"
  }
}

variable "shadow_number_padding" {
  description = "数値のパディング桁数"
  type        = number
  default     = 15

  validation {
    condition     = var.shadow_number_padding > 0 && var.shadow_number_padding <= 15
    error_message = "shadow_number_padding は 1 から 15 の間である必要があります。"
  }
}
