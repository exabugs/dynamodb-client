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

# IAM Policy ARNs
output "iam_policy_arns" {
  description = "作成されたIAMポリシーのARN一覧"
  value = {
    admin_ui_parameter_read     = aws_iam_policy.admin_ui_parameter_read.arn
    fetch_lambda_parameter_read = aws_iam_policy.fetch_lambda_parameter_read.arn
  }
}

# IAM Policy Names
output "iam_policy_names" {
  description = "作成されたIAMポリシーの名前一覧"
  value = {
    admin_ui_parameter_read     = aws_iam_policy.admin_ui_parameter_read.name
    fetch_lambda_parameter_read = aws_iam_policy.fetch_lambda_parameter_read.name
  }
}
