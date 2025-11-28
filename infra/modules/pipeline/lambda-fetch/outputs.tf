# Fetch Lambdaモジュール出力

output "function_name" {
  description = "Lambda関数名"
  value       = aws_lambda_function.fetch.function_name
}

output "function_arn" {
  description = "Lambda関数ARN"
  value       = aws_lambda_function.fetch.arn
}

output "function_invoke_arn" {
  description = "Lambda関数Invoke ARN"
  value       = aws_lambda_function.fetch.invoke_arn
}

output "function_qualified_arn" {
  description = "Lambda関数Qualified ARN（バージョン付き）"
  value       = aws_lambda_function.fetch.qualified_arn
}

output "role_arn" {
  description = "Lambda実行ロールARN"
  value       = aws_iam_role.lambda_fetch.arn
}

output "role_name" {
  description = "Lambda実行ロール名"
  value       = aws_iam_role.lambda_fetch.name
}

output "log_group_name" {
  description = "CloudWatch Logsロググループ名"
  value       = aws_cloudwatch_log_group.lambda_fetch.name
}

output "log_group_arn" {
  description = "CloudWatch LogsロググループARN"
  value       = aws_cloudwatch_log_group.lambda_fetch.arn
}
