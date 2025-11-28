# CloudFrontモジュール変数定義

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境識別子（dev, stg, prd）"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3バケットID"
  type        = string
}

variable "s3_bucket_arn" {
  description = "S3バケットARN"
  type        = string
}

variable "s3_bucket_regional_domain_name" {
  description = "S3バケットリージョナルドメイン名"
  type        = string
}

variable "default_root_object" {
  description = "デフォルトルートオブジェクト"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront価格クラス（PriceClass_All, PriceClass_200, PriceClass_100）"
  type        = string
  default     = "PriceClass_200" # 北米・ヨーロッパ・アジア・中東・アフリカ
}

variable "geo_restriction_type" {
  description = "地理的制限タイプ（none, whitelist, blacklist）"
  type        = string
  default     = "none"
}

variable "geo_restriction_locations" {
  description = "地理的制限対象の国コードリスト"
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM証明書ARN（カスタムドメイン使用時）"
  type        = string
  default     = null
}

variable "error_404_path" {
  description = "404エラーページのパス"
  type        = string
  default     = null
}

variable "error_403_path" {
  description = "403エラーページのパス"
  type        = string
  default     = null
}
