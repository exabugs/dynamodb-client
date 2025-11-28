# Maintenance Coordinator Lambda Outputs

output "function_arn" {
  description = "Coordinator Lambda関数ARN"
  value       = aws_lambda_function.coordinator.arn
}

output "function_name" {
  description = "Coordinator Lambda関数名"
  value       = aws_lambda_function.coordinator.function_name
}

output "role_arn" {
  description = "Coordinator Lambda IAMロールARN"
  value       = aws_iam_role.coordinator_lambda.arn
}

output "log_group_name" {
  description = "CloudWatch Logsロググループ名"
  value       = aws_cloudwatch_log_group.coordinator.name
}
