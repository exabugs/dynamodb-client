# メディア機能モジュール変数定義

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

variable "table_name" {
  description = "呼び出し側の既存DynamoDBテーブル名（mediaリソースを相乗りさせる）"
  type        = string
}

variable "table_arn" {
  description = "呼び出し側の既存DynamoDBテーブルARN"
  type        = string
}

variable "image_cache_ttl_days" {
  description = "cache/{fileId}/{width}（オンデマンドリサイズ結果）のS3 Lifecycleによる自動削除までの日数"
  type        = number
  default     = 30
}

variable "allowed_upload_origins" {
  description = "presigned POSTでのブラウザアップロードを許可するオリジン（例: Admin UIのドメイン）。空配列の場合はCORS設定自体を作らない（モバイルのみの利用等、ブラウザアップロードが不要な場合）"
  type        = list(string)
  default     = []
}

# 呼び出し側の既存テーブルに相乗りするため、process-handlerが生成するShadow Recordsの
# 形式は呼び出し側の既存Lambda（records等）の設定と一致させる必要がある
# （詳細: docs/media-design.md「環境変数の一致」）。既定値は本体（terraform/variables.tf）と揃える。
variable "shadow_created_at_field" {
  description = "作成日時フィールド名（呼び出し側の既存設定と一致させること）"
  type        = string
  default     = "createdAt"
}

variable "shadow_updated_at_field" {
  description = "更新日時フィールド名（呼び出し側の既存設定と一致させること）"
  type        = string
  default     = "updatedAt"
}

variable "shadow_string_max_bytes" {
  description = "プリミティブ型の最大バイト数（呼び出し側の既存設定と一致させること）"
  type        = number
  default     = 100
}

variable "shadow_number_padding" {
  description = "数値のパディング桁数（呼び出し側の既存設定と一致させること）"
  type        = number
  default     = 15
}

variable "signing_public_key_param" {
  description = "CloudFront署名用の公開鍵（PEM形式）を保持するSSM Parameter名。値そのものは呼び出し側が別途登録する"
  type        = string
}

variable "image_policy_param" {
  description = "image policy（masterMaxDimension・allowedContentTypes・maxUploadSize）のJSONを保持するSSM Parameter名。値そのものは呼び出し側が別途登録する"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logsの保持期間（日数）"
  type        = number
  default     = 7
}

variable "process_handler_timeout" {
  description = "process-handler Lambdaのタイムアウト（秒）"
  type        = number
  default     = 60
}

variable "process_handler_memory_size" {
  description = "process-handler Lambdaのメモリサイズ（MB）"
  type        = number
  default     = 1024
}

variable "media_handler_memory_size" {
  description = "media-handler Lambdaのメモリサイズ（MB）"
  type        = number
  default     = 1024
}

variable "domain_name" {
  description = "配信用CloudFrontのカスタムドメイン名（省略時はCloudFrontのデフォルトドメインを使う）"
  type        = string
  default     = null
}

variable "acm_certificate_arn" {
  description = "domain_name指定時に使うACM証明書ARN（us-east-1リージョンのものである必要がある）"
  type        = string
  default     = null
}

variable "route53_zone_id" {
  description = "domain_name指定時にAliasレコードを作成するRoute53 Hosted Zone ID（省略時はDNSレコードを作成しない）"
  type        = string
  default     = null
}
