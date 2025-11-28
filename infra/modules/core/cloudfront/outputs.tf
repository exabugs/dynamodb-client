# CloudFrontモジュール出力

output "distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.assets.id
}

output "distribution_arn" {
  description = "CloudFront Distribution ARN"
  value       = aws_cloudfront_distribution.assets.arn
}

output "distribution_domain_name" {
  description = "CloudFront Distribution ドメイン名"
  value       = aws_cloudfront_distribution.assets.domain_name
}

output "distribution_hosted_zone_id" {
  description = "CloudFront Distribution Hosted Zone ID（Route 53エイリアスレコード用）"
  value       = aws_cloudfront_distribution.assets.hosted_zone_id
}

output "oai_iam_arn" {
  description = "Origin Access Identity IAM ARN"
  value       = aws_cloudfront_origin_access_identity.assets.iam_arn
}

output "oai_cloudfront_access_identity_path" {
  description = "Origin Access Identity CloudFront Access Identity Path"
  value       = aws_cloudfront_origin_access_identity.assets.cloudfront_access_identity_path
}
