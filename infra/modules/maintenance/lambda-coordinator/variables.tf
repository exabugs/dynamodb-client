# Maintenance Coordinator Lambda Variables

variable "env" {
  description = "環境識別子 (dev, stg, prd)"
  type        = string
}

variable "region" {
  description = "AWSリージョン"
  type        = string
}

variable "state_machine_arn" {
  description = "Step Functions ステートマシンARN"
  type        = string
}

variable "allow_resources" {
  description = "許可されたリソース名（カンマ区切り）"
  type        = string
  default     = "articles,tasks,fetchLogs"
}

variable "log_level" {
  description = "ログレベル (DEBUG, INFO, WARN, ERROR)"
  type        = string
  default     = "INFO"
}

variable "log_retention_days" {
  description = "CloudWatch Logsの保持期間（日数）"
  type        = number
  default     = 7
}
