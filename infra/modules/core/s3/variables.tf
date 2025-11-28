# S3モジュール変数定義

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境識別子（dev, stg, prd）"
  type        = string
}

variable "enable_version_expiration" {
  description = "古いバージョンの自動削除を有効化するかどうか"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "CORS許可オリジンのリスト"
  type        = list(string)
  default     = ["*"]
}
