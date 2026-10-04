# メディア機能モジュール出力

output "bucket_name" {
  description = "メディア用S3バケット名"
  value       = aws_s3_bucket.media.bucket
}

output "bucket_arn" {
  description = "メディア用S3バケットARN"
  value       = aws_s3_bucket.media.arn
}

output "cloudfront_distribution_id" {
  description = "メディア配信用CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.media.id
}

output "cloudfront_domain_name" {
  description = "メディア配信用CloudFrontドメイン名（カスタムドメイン未設定時はこちらを使う）"
  value       = aws_cloudfront_distribution.media.domain_name
}

output "base_url" {
  description = "署名付きURL発行時に使う配信ベースURL（カスタムドメイン優先）"
  value       = "https://${coalesce(var.domain_name, aws_cloudfront_distribution.media.domain_name)}"
}

output "key_pair_id" {
  description = "CloudFront署名用のKey Pair ID。sign.tsのkeyPairId引数に渡す"
  value       = aws_cloudfront_public_key.media.id
}

output "key_group_id" {
  description = "CloudFront Key Group ID"
  value       = aws_cloudfront_key_group.media.id
}

output "process_handler_function_name" {
  description = "process-handler Lambda関数名"
  value       = aws_lambda_function.process_handler.function_name
}

output "process_handler_function_arn" {
  description = "process-handler Lambda関数ARN"
  value       = aws_lambda_function.process_handler.arn
}

output "process_handler_dlq_url" {
  description = "process-handlerの失敗レコードを受け取るSQS DLQのURL"
  value       = aws_sqs_queue.process_handler_dlq.url
}

output "media_handler_function_name" {
  description = "media-handler Lambda関数名"
  value       = aws_lambda_function.media_handler.function_name
}

output "media_handler_function_arn" {
  description = "media-handler Lambda関数ARN"
  value       = aws_lambda_function.media_handler.arn
}

output "sharp_layer_arn" {
  description = "sharp Lambda LayerのARN"
  value       = aws_lambda_layer_version.sharp.arn
}
