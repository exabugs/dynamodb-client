# Fetch Lambdaモジュール変数定義

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

variable "records_function_name" {
  description = "Records Lambda関数名"
  type        = string
}

variable "records_function_arn" {
  description = "Records Lambda関数ARN"
  type        = string
}

variable "records_function_url" {
  description = "Records Lambda Function URL"
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
