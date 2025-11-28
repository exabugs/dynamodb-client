# Maintenance Step Functions Variables

variable "env" {
  description = "環境識別子 (dev, stg, prd)"
  type        = string
}

variable "worker_function_arn" {
  description = "Worker Lambda関数ARN"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logsの保持期間（日数）"
  type        = number
  default     = 7
}
