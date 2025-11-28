# Maintenance Worker Lambda Outputs

output "function_arn" {
  description = "Worker Lambda関数ARN"
  value       = aws_lambda_function.worker.arn
}

output "function_name" {
  description = "Worker Lambda関数名"
  value       = aws_lambda_function.worker.function_name
}

output "role_arn" {
  description = "Worker Lambda IAMロールARN"
  value       = aws_iam_role.worker_lambda.arn
}

output "log_group_name" {
  description = "CloudWatch Logsロググループ名"
  value       = aws_cloudwatch_log_group.worker.name
}
