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

variable "records_function_arn" {
  description = "Records Lambda Function ARN"
  type        = string
}
