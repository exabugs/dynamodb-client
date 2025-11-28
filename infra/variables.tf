# Terraform変数定義

variable "project_name" {
  description = "プロジェクト名（リソース名のプレフィックスとして使用）"
  type        = string
  default     = "ainews"
}

variable "environment" {
  description = "環境識別子（dev, stg, prd）"
  type        = string

  validation {
    condition     = contains(["dev", "stg", "prd"], var.environment)
    error_message = "環境は dev, stg, prd のいずれかである必要があります。"
  }
}

variable "region" {
  description = "AWSリージョン"
  type        = string
  default     = "us-east-1"
}

variable "enable_pitr" {
  description = "DynamoDB Point-in-Time Recoveryを有効化するかどうか"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch Logsの保持期間（日数）"
  type        = number
  default     = 7

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "CloudWatch Logsの保持期間は有効な値である必要があります。"
  }
}

# Cognito設定

variable "admin_callback_urls" {
  description = "Admin UI用コールバックURLのリスト"
  type        = list(string)
  default = [
    "http://localhost:3000",
    "http://localhost:3000/callback"
  ]
}

variable "admin_logout_urls" {
  description = "Admin UI用ログアウトURLのリスト"
  type        = list(string)
  default = [
    "http://localhost:3000",
    "http://localhost:3000/logout"
  ]
}

variable "mobile_callback_urls" {
  description = "Mobile App用コールバックURLのリスト"
  type        = list(string)
  default = [
    "exp://localhost:8081",
    "exp://localhost:8081/callback"
  ]
}

variable "mobile_logout_urls" {
  description = "Mobile App用ログアウトURLのリスト"
  type        = list(string)
  default = [
    "exp://localhost:8081",
    "exp://localhost:8081/logout"
  ]
}

# Lambda Records設定

variable "lambda_records_log_level" {
  description = "Records Lambdaのログレベル（debug, info, warn, error）"
  type        = string
  default     = "info"

  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.lambda_records_log_level)
    error_message = "ログレベルは debug, info, warn, error のいずれかである必要があります。"
  }
}

# Lambda Fetch設定

variable "lambda_fetch_log_level" {
  description = "Fetch Lambdaのログレベル（debug, info, warn, error）"
  type        = string
  default     = "info"

  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.lambda_fetch_log_level)
    error_message = "ログレベルは debug, info, warn, error のいずれかである必要があります。"
  }
}

# Lambda Maintenance設定

variable "lambda_maintenance_log_level" {
  description = "Maintenance Lambdaのログレベル（debug, info, warn, error）"
  type        = string
  default     = "info"

  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.lambda_maintenance_log_level)
    error_message = "ログレベルは debug, info, warn, error のいずれかである必要があります。"
  }
}

variable "maintenance_allow_resources" {
  description = "メンテナンスで許可されたリソース名（カンマ区切り）"
  type        = string
  default     = "articles,tasks,fetchLogs"
}

variable "allow_default_workspace" {
  description = "defaultワークスペースでの実行を許可するか（通常はfalse）"
  type        = bool
  default     = false
}
