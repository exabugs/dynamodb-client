# Parameter Store モジュール出力

# Parameter Store ARNs
output "parameter_arns" {
  description = "作成されたParameter StoreパラメータのARN一覧"
  value = {
    records_api_url      = aws_ssm_parameter.app_records_api_url.arn
    dynamodb_table_name  = aws_ssm_parameter.infra_dynamodb_table_name.arn
    records_function_arn = aws_ssm_parameter.lambda_records_function_arn.arn
  }
}

# Parameter Store Names
output "parameter_names" {
  description = "作成されたParameter Storeパラメータの名前一覧"
  value = {
    records_api_url      = aws_ssm_parameter.app_records_api_url.name
    dynamodb_table_name  = aws_ssm_parameter.infra_dynamodb_table_name.name
    records_function_arn = aws_ssm_parameter.lambda_records_function_arn.name
  }
}

# Parameter Store Paths (same as names)
output "parameter_paths" {
  description = "作成されたParameter Storeパラメータのパス一覧"
  value = {
    records_api_url      = aws_ssm_parameter.app_records_api_url.name
    dynamodb_table_name  = aws_ssm_parameter.infra_dynamodb_table_name.name
    records_function_arn = aws_ssm_parameter.lambda_records_function_arn.name
  }
}

# Note: IAMポリシーは各プロジェクトで個別に定義してください
# 詳細は iam.tf のコメントを参照
