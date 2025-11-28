# Production環境固有の設定

environment        = "prd"
enable_pitr        = true
log_retention_days = 30

# Cognito設定（Production環境）
# 本番環境用のドメインを設定してください
admin_callback_urls = [
  "https://admin.example.com",
  "https://admin.example.com/callback"
]

admin_logout_urls = [
  "https://admin.example.com",
  "https://admin.example.com/logout"
]

mobile_callback_urls = [
  "ainews://callback"
]

mobile_logout_urls = [
  "ainews://logout"
]

# Lambda Records設定（Production環境）
lambda_records_log_level = "warn"
