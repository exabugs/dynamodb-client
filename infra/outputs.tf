# Terraform出力

# DynamoDB
output "dynamodb_table_name" {
  description = "DynamoDBテーブル名"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "DynamoDBテーブルARN"
  value       = module.dynamodb.table_arn
}

# S3
output "s3_bucket_name" {
  description = "S3 Assets Bucket名"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "S3 Assets Bucket ARN"
  value       = module.s3.bucket_arn
}

output "s3_bucket_domain_name" {
  description = "S3 Assets Bucketドメイン名"
  value       = module.s3.bucket_domain_name
}

# CloudFront
output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront Distribution ARN"
  value       = module.cloudfront.distribution_arn
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront Distribution ドメイン名（CDN URL）"
  value       = module.cloudfront.distribution_domain_name
}

output "cloudfront_oai_iam_arn" {
  description = "CloudFront Origin Access Identity IAM ARN"
  value       = module.cloudfront.oai_iam_arn
}

# Cognito
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = module.cognito.user_pool_arn
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool ドメイン（Hosted UI用）"
  value       = module.cognito.user_pool_domain
}

output "cognito_hosted_ui_url" {
  description = "Cognito Hosted UI URL"
  value       = module.cognito.hosted_ui_url
}

output "cognito_admin_ui_client_id" {
  description = "Admin UI用Cognito User Pool Client ID"
  value       = module.cognito.admin_ui_client_id
}

output "cognito_mobile_app_client_id" {
  description = "Mobile App用Cognito User Pool Client ID"
  value       = module.cognito.mobile_app_client_id
}

# Records Lambda
output "lambda_records_function_name" {
  description = "Records Lambda関数名"
  value       = module.lambda_records.function_name
}

output "lambda_records_function_arn" {
  description = "Records Lambda関数ARN"
  value       = module.lambda_records.function_arn
}

output "lambda_records_function_url" {
  description = "Records Lambda Function URL（HTTPSエンドポイント）"
  value       = module.lambda_records.function_url
}

output "lambda_records_role_arn" {
  description = "Records Lambda実行ロールARN"
  value       = module.lambda_records.role_arn
}

output "lambda_records_log_group_name" {
  description = "Records Lambda CloudWatch Logsロググループ名"
  value       = module.lambda_records.log_group_name
}

# Fetch Lambda
output "lambda_fetch_function_name" {
  description = "Fetch Lambda関数名"
  value       = module.lambda_fetch.function_name
}

output "lambda_fetch_function_arn" {
  description = "Fetch Lambda関数ARN"
  value       = module.lambda_fetch.function_arn
}

output "lambda_fetch_role_arn" {
  description = "Fetch Lambda実行ロールARN"
  value       = module.lambda_fetch.role_arn
}

output "lambda_fetch_log_group_name" {
  description = "Fetch Lambda CloudWatch Logsロググループ名"
  value       = module.lambda_fetch.log_group_name
}

# Maintenance Coordinator Lambda
output "maintenance_coordinator_function_name" {
  description = "Maintenance Coordinator Lambda関数名"
  value       = module.maintenance_coordinator.function_name
}

output "maintenance_coordinator_function_arn" {
  description = "Maintenance Coordinator Lambda関数ARN"
  value       = module.maintenance_coordinator.function_arn
}

output "maintenance_coordinator_role_arn" {
  description = "Maintenance Coordinator Lambda実行ロールARN"
  value       = module.maintenance_coordinator.role_arn
}

output "maintenance_coordinator_log_group_name" {
  description = "Maintenance Coordinator Lambda CloudWatch Logsロググループ名"
  value       = module.maintenance_coordinator.log_group_name
}

# Maintenance Worker Lambda
output "maintenance_worker_function_name" {
  description = "Maintenance Worker Lambda関数名"
  value       = module.maintenance_worker.function_name
}

output "maintenance_worker_function_arn" {
  description = "Maintenance Worker Lambda関数ARN"
  value       = module.maintenance_worker.function_arn
}

output "maintenance_worker_role_arn" {
  description = "Maintenance Worker Lambda実行ロールARN"
  value       = module.maintenance_worker.role_arn
}

output "maintenance_worker_log_group_name" {
  description = "Maintenance Worker Lambda CloudWatch Logsロググループ名"
  value       = module.maintenance_worker.log_group_name
}

# Maintenance Step Functions
output "maintenance_sfn_state_machine_arn" {
  description = "Maintenance Step Functions ステートマシンARN"
  value       = module.maintenance_sfn.state_machine_arn
}

output "maintenance_sfn_state_machine_name" {
  description = "Maintenance Step Functions ステートマシン名"
  value       = module.maintenance_sfn.state_machine_name
}

output "maintenance_sfn_role_arn" {
  description = "Maintenance Step Functions実行ロールARN"
  value       = module.maintenance_sfn.role_arn
}

output "maintenance_sfn_log_group_name" {
  description = "Maintenance Step Functions CloudWatch Logsロググループ名"
  value       = module.maintenance_sfn.log_group_name
}
