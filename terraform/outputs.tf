# Records Lambdaモジュール出力

output "function_name" {
  description = "Lambda関数名"
  value       = aws_lambda_function.records.function_name
}

output "function_arn" {
  description = "Lambda関数ARN"
  value       = aws_lambda_function.records.arn
}

output "function_invoke_arn" {
  description = "Lambda関数Invoke ARN（API Gateway等で使用）"
  value       = aws_lambda_function.records.invoke_arn
}

output "function_qualified_arn" {
  description = "Lambda関数Qualified ARN（バージョン付き）"
  value       = aws_lambda_function.records.qualified_arn
}

output "role_arn" {
  description = "Lambda実行ロールARN"
  value       = aws_iam_role.lambda_records.arn
}

output "role_name" {
  description = "Lambda実行ロール名"
  value       = aws_iam_role.lambda_records.name
}

output "log_group_name" {
  description = "CloudWatch Logsロググループ名"
  value       = aws_cloudwatch_log_group.lambda_records.name
}

output "log_group_arn" {
  description = "CloudWatch LogsロググループARN"
  value       = aws_cloudwatch_log_group.lambda_records.arn
}

output "function_url" {
  description = "Lambda Function URL（HTTPSエンドポイント）"
  value       = aws_lambda_function_url.records.function_url
}

output "function_url_id" {
  description = "Lambda Function URL ID"
  value       = aws_lambda_function_url.records.url_id
}
