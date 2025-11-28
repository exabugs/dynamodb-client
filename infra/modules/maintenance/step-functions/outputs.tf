# Maintenance Step Functions Outputs

output "state_machine_arn" {
  description = "Step Functions ステートマシンARN"
  value       = aws_sfn_state_machine.maintenance.arn
}

output "state_machine_name" {
  description = "Step Functions ステートマシン名"
  value       = aws_sfn_state_machine.maintenance.name
}

output "role_arn" {
  description = "Step Functions IAMロールARN"
  value       = aws_iam_role.sfn.arn
}

output "log_group_name" {
  description = "CloudWatch Logsロググループ名"
  value       = aws_cloudwatch_log_group.sfn.name
}
