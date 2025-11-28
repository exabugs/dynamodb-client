# Maintenance Worker Lambda Variables

variable "env" {
  description = "環境識別子 (dev, stg, prd)"
  type        = string
}

variable "region" {
  description = "AWSリージョン"
  type        = string
}

variable "table_name" {
  description = "DynamoDBテーブル名"
  type        = string
}

variable "table_arn" {
  description = "DynamoDBテーブルARN"
  type        = string
}

variable "shadow_config" {
  description = "シャドー設定（base64エンコード）"
  type        = string
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
