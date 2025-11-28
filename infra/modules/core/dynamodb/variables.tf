# DynamoDBモジュール変数定義

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境識別子（dev, stg, prd）"
  type        = string
}

variable "enable_pitr" {
  description = "Point-in-Time Recoveryを有効化するかどうか"
  type        = bool
  default     = false
}

variable "enable_streams" {
  description = "DynamoDB Streamsを有効化するかどうか"
  type        = bool
  default     = false
}
