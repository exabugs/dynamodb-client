# Dev環境固有の設定

environment        = "dev"
enable_pitr        = false
log_retention_days = 7

# Cognito設定（Dev環境）
admin_callback_urls = [
  "http://localhost:3000",
  "http://localhost:3000/callback",
  "http://localhost:5173",
  "http://localhost:5173/callback"
]

admin_logout_urls = [
  "http://localhost:3000",
  "http://localhost:3000/login",
  "http://localhost:5173",
  "http://localhost:5173/login",
  "http://localhost:5173/logout"
]

mobile_callback_urls = [
  "exp://localhost:8081",
  "exp://localhost:8081/callback"
]

mobile_logout_urls = [
  "exp://localhost:8081",
  "exp://localhost:8081/logout"
]

# Lambda Records設定（Dev環境）
lambda_records_log_level = "debug"
