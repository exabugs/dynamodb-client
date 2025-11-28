# Staging環境固有の設定

environment        = "stg"
enable_pitr        = true
log_retention_days = 14

# Cognito設定（Staging環境）
# 本番環境用のドメインを設定してください
admin_callback_urls = [
  "http://localhost:5173",
  "http://localhost:5173/callback",
  "https://admin-stg.example.com",
  "https://admin-stg.example.com/callback"
]

admin_logout_urls = [
  "http://localhost:5173",
  "http://localhost:5173/logout",
  "https://admin-stg.example.com",
  "https://admin-stg.example.com/logout"
]

mobile_callback_urls = [
  "exp://localhost:8081",
  "exp://localhost:8081/callback",
  "ainews://callback"
]

mobile_logout_urls = [
  "exp://localhost:8081",
  "exp://localhost:8081/logout",
  "ainews://logout"
]

# Lambda Records設定（Staging環境）
lambda_records_log_level = "info"
