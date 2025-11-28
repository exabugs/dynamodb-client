# Cognitoモジュール出力

output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool エンドポイント"
  value       = aws_cognito_user_pool.main.endpoint
}

output "user_pool_domain" {
  description = "Cognito User Pool ドメイン（Hosted UI用）"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "user_pool_domain_cloudfront" {
  description = "Cognito User Pool CloudFrontドメイン"
  value       = aws_cognito_user_pool_domain.main.cloudfront_distribution
}

output "admin_ui_client_id" {
  description = "Admin UI用Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.admin_ui.id
}

output "admin_ui_client_secret" {
  description = "Admin UI用Cognito User Pool Client Secret（存在する場合）"
  value       = aws_cognito_user_pool_client.admin_ui.client_secret
  sensitive   = true
}

output "mobile_app_client_id" {
  description = "Mobile App用Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.mobile_app.id
}

output "mobile_app_client_secret" {
  description = "Mobile App用Cognito User Pool Client Secret（存在する場合）"
  value       = aws_cognito_user_pool_client.mobile_app.client_secret
  sensitive   = true
}

output "hosted_ui_url" {
  description = "Cognito Hosted UI URL"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

# 現在のリージョン情報を取得
data "aws_region" "current" {}
