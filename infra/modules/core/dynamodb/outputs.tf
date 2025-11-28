# DynamoDBモジュール出力

output "table_name" {
  description = "DynamoDBテーブル名"
  value       = aws_dynamodb_table.records.name
}

output "table_arn" {
  description = "DynamoDBテーブルARN"
  value       = aws_dynamodb_table.records.arn
}

output "table_id" {
  description = "DynamoDBテーブルID"
  value       = aws_dynamodb_table.records.id
}

output "table_stream_arn" {
  description = "DynamoDB StreamのARN（有効な場合）"
  value       = var.enable_streams ? aws_dynamodb_table.records.stream_arn : null
}
