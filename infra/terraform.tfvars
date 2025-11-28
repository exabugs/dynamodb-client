# Terraform デフォルト変数値
# 環境固有の値は envs/*.tfvars で上書き可能

project_name       = "ainews"
environment        = "dev"
region             = "us-east-1"
enable_pitr        = false
log_retention_days = 7
