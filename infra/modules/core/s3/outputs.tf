# S3モジュール出力

output "bucket_name" {
  description = "S3バケット名"
  value       = aws_s3_bucket.assets.id
}

output "bucket_arn" {
  description = "S3バケットARN"
  value       = aws_s3_bucket.assets.arn
}

output "bucket_domain_name" {
  description = "S3バケットドメイン名"
  value       = aws_s3_bucket.assets.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "S3バケットリージョナルドメイン名"
  value       = aws_s3_bucket.assets.bucket_regional_domain_name
}
