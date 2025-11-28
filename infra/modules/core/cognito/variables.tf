# Cognitoモジュール変数定義

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境識別子（dev, stg, prd）"
  type        = string
}

variable "enable_mfa" {
  description = "MFAを有効化するかどうか（本番環境では推奨）"
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "削除保護を有効化するかどうか（本番環境では推奨）"
  type        = bool
  default     = false
}

variable "admin_callback_urls" {
  description = "Admin UI用コールバックURLのリスト（ローカル開発 + 本番環境）"
  type        = list(string)
  default = [
    "http://localhost:5173",
    "http://localhost:5173/callback"
  ]
}

variable "admin_logout_urls" {
  description = "Admin UI用ログアウトURLのリスト"
  type        = list(string)
  default = [
    "http://localhost:5173",
    "http://localhost:5173/login"
  ]
}

variable "mobile_callback_urls" {
  description = "Mobile App用コールバックURLのリスト（Expo開発 + 本番環境）"
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
