# Parameter Store モジュール出力

# Parameter Store ARNs
output "parameter_arns" {
  description = "作成されたParameter StoreパラメータのARN一覧"
  value = {
    records_api_url      = aws_ssm_parameter.app_records_api_url.arn
    cognito_user_pool_id = aws_ssm_parameter.app_admin_ui_cognito_user_pool_id.arn
    cognito_client_id    = aws_ssm_parameter.app_admin_ui_cognito_client_id.arn
    cognito_domain       = aws_ssm_parameter.app_admin_ui_cognito_domain.arn
    dynamodb_table_name  = aws_ssm_parameter.infra_dynamodb_table_name.arn
    records_function_arn = aws_ssm_parameter.lambda_records_function_arn.arn
  }
}

# Parameter Store Names
output "parameter_names" {
  description = "作成されたParameter Storeパラメータの名前一覧"
  value = {
    records_api_url      = aws_ssm_parameter.app_records_api_url.name
    cognito_user_pool_id = aws_ssm_parameter.app_admin_ui_cognito_user_pool_id.name
    cognito_client_id    = aws_ssm_parameter.app_admin_ui_cognito_client_id.name
    cognito_domain       = aws_ssm_parameter.app_admin_ui_cognito_domain.name
    dynamodb_table_name  = aws_ssm_parameter.infra_dynamodb_table_name.name
    records_function_arn = aws_ssm_parameter.lambda_records_function_arn.name
  }
}

# Parameter Store Paths (same as names)
output "parameter_paths" {
  description = "作成されたParameter Storeパラメータのパス一覧"
  value = {
    records_api_url      = aws_ssm_parameter.app_records_api_url.name
    cognito_user_pool_id = aws_ssm_parameter.app_admin_ui_cognito_user_pool_id.name
    cognito_client_id    = aws_ssm_parameter.app_admin_ui_cognito_client_id.name
    cognito_domain       = aws_ssm_parameter.app_admin_ui_cognito_domain.name
    dynamodb_table_name  = aws_ssm_parameter.infra_dynamodb_table_name.name
    records_function_arn = aws_ssm_parameter.lambda_records_function_arn.name
  }
}

# Note: IAMポリシーは各プロジェクトで個別に定義してください
# 詳細は iam.tf のコメントを参照
