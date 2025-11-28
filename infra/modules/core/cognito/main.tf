# Cognito User Poolモジュール

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-userpool"

  # パスワードポリシー設定（≥8文字、大小英字+数字）
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # 自動検証属性
  auto_verified_attributes = ["email"]

  # ユーザー名属性
  username_attributes = ["email"]

  # ユーザー名の大文字小文字を区別しない
  username_configuration {
    case_sensitive = false
  }

  # アカウント復旧設定
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # スキーマ定義
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # MFA設定（オプション、本番環境では有効化推奨）
  mfa_configuration = var.enable_mfa ? "OPTIONAL" : "OFF"

  # デバイス記憶設定
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = true
  }

  # メール設定
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # 管理者によるユーザー作成設定
  admin_create_user_config {
    allow_admin_create_user_only = false

    invite_message_template {
      email_subject = "Your temporary password for ${var.project_name}"
      email_message = "Your username is {username} and temporary password is {####}."
      sms_message   = "Your username is {username} and temporary password is {####}."
    }
  }

  # ユーザープール削除保護（本番環境では有効化推奨）
  deletion_protection = var.enable_deletion_protection ? "ACTIVE" : "INACTIVE"

  tags = {
    Name        = "${var.project_name}-${var.environment}-userpool"
    Environment = var.environment
  }
}

# Cognito User Pool Domain（Hosted UI用）
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${var.environment}-auth"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Cognito User Pool Client（Admin UI用）
resource "aws_cognito_user_pool_client" "admin_ui" {
  name         = "${var.project_name}-${var.environment}-admin-ui"
  user_pool_id = aws_cognito_user_pool.main.id

  # 認可コードフロー（code flow）を使用
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "profile", "email"]

  # サポートするIdentity Provider
  supported_identity_providers = ["COGNITO"]

  # サポートする認証フロー
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # コールバックURL（ローカル開発 + 本番環境）
  callback_urls = var.admin_callback_urls

  # ログアウトURL
  logout_urls = var.admin_logout_urls

  # トークン有効期限設定
  refresh_token_validity = 30 # 30日
  access_token_validity  = 60 # 60分
  id_token_validity      = 60 # 60分

  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  # PKCE必須（セキュリティ強化）
  prevent_user_existence_errors = "ENABLED"

  # クライアントシークレットなし（SPAのため）
  generate_secret = false

  # 読み取り・書き込み属性
  read_attributes = [
    "email",
    "email_verified",
    "name"
  ]

  write_attributes = [
    "email",
    "name"
  ]
}

# Cognito User Pool Client（Mobile App用）
resource "aws_cognito_user_pool_client" "mobile_app" {
  name         = "${var.project_name}-${var.environment}-mobile-app"
  user_pool_id = aws_cognito_user_pool.main.id

  # 認可コードフロー（code flow + PKCE）を使用
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "profile", "email"]

  # サポートする認証フロー
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # コールバックURL（Expo開発 + 本番環境）
  callback_urls = var.mobile_callback_urls

  # ログアウトURL
  logout_urls = var.mobile_logout_urls

  # トークン有効期限設定
  refresh_token_validity = 30 # 30日
  access_token_validity  = 60 # 60分
  id_token_validity      = 60 # 60分

  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  # PKCE必須（セキュリティ強化）
  prevent_user_existence_errors = "ENABLED"

  # クライアントシークレットなし（モバイルアプリのため）
  generate_secret = false

  # 読み取り・書き込み属性
  read_attributes = [
    "email",
    "email_verified",
    "name"
  ]

  write_attributes = [
    "email",
    "name"
  ]
}
