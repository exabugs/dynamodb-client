# メインリソース定義

# defaultワークスペースでの実行を防止
locals {
  workspace            = terraform.workspace
  is_default_workspace = local.workspace == "default"
}

# defaultワークスペースチェック
resource "null_resource" "workspace_check" {
  count = local.is_default_workspace && !var.allow_default_workspace ? 1 : 0

  provisioner "local-exec" {
    command = <<-EOT
      echo ""
      echo "❌ ERROR: defaultワークスペースでの実行は許可されていません"
      echo ""
      echo "以下のコマンドで環境を切り替えてください："
      echo "  terraform workspace select dev"
      echo "  terraform workspace select stg"
      echo "  terraform workspace select prd"
      echo ""
      echo "または、Makefileを使用してください："
      echo "  make plan ENV=dev"
      echo "  make apply ENV=dev"
      echo ""
      exit 1
    EOT
  }
}

# DynamoDB Single-Table
module "dynamodb" {
  source = "./modules/core/dynamodb"

  project_name = var.project_name
  environment  = var.environment
  enable_pitr  = var.enable_pitr

  # 将来の拡張用（現在は無効）
  enable_streams = false
}

# S3 Assets Bucket
module "s3" {
  source = "./modules/core/s3"

  project_name = var.project_name
  environment  = var.environment

  # 古いバージョンの自動削除を有効化
  enable_version_expiration = true

  # CORS設定（本番環境では特定のドメインに制限することを推奨）
  cors_allowed_origins = ["*"]
}

# CloudFront CDN
module "cloudfront" {
  source = "./modules/core/cloudfront"

  project_name = var.project_name
  environment  = var.environment

  # S3バケット情報（S3モジュールの出力を使用）
  s3_bucket_id                   = module.s3.bucket_name
  s3_bucket_arn                  = module.s3.bucket_arn
  s3_bucket_regional_domain_name = module.s3.bucket_regional_domain_name

  # 日本メインのためPriceClass_200を使用（北米・ヨーロッパ・アジア・中東・アフリカ）
  price_class = "PriceClass_200"

  # 地理的制限なし
  geo_restriction_type      = "none"
  geo_restriction_locations = []
}

# Cognito User Pool
module "cognito" {
  source = "./modules/core/cognito"

  project_name = var.project_name
  environment  = var.environment

  # MFA設定（本番環境では有効化推奨）
  enable_mfa = var.environment == "prd" ? true : false

  # 削除保護（本番環境では有効化推奨）
  enable_deletion_protection = var.environment == "prd" ? true : false

  # Admin UI用コールバックURL（環境変数で上書き可能）
  admin_callback_urls = var.admin_callback_urls
  admin_logout_urls   = var.admin_logout_urls

  # Mobile App用コールバックURL（環境変数で上書き可能）
  mobile_callback_urls = var.mobile_callback_urls
  mobile_logout_urls   = var.mobile_logout_urls
}

# Records Lambda（HTTP API）
# ライブラリのTerraformモジュールを使用
module "lambda_records" {
  source = "../packages/core/terraform"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region

  # DynamoDB設定（DynamoDBモジュールの出力を使用）
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn

  # Cognito設定（Cognitoモジュールの出力を使用）
  cognito_user_pool_id = module.cognito.user_pool_id

  # シャドウ設定（base64エンコード）
  shadow_config = base64encode(file("${path.root}/../config/shadow.config.json"))

  # ログ設定
  log_retention_days = var.log_retention_days
  log_level          = var.lambda_records_log_level
}

# Fetch Lambda（ニュース記事自動取得）
module "lambda_fetch" {
  source = "./modules/pipeline/lambda-fetch"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region

  # Records Lambda設定（Records Lambdaモジュールの出力を使用）
  records_function_name = module.lambda_records.function_name
  records_function_arn  = module.lambda_records.function_arn
  records_function_url  = module.lambda_records.function_url

  # ログ設定
  log_retention_days = var.log_retention_days
  log_level          = var.lambda_fetch_log_level
}

# Maintenance Worker Lambda（シャドー整合性修復ワーカー）
module "maintenance_worker" {
  source = "./modules/maintenance/lambda-worker"

  env    = var.environment
  region = var.region

  # DynamoDB設定
  table_name = module.dynamodb.table_name
  table_arn  = module.dynamodb.table_arn

  # シャドー設定（Records Lambdaと同じ設定を使用）
  shadow_config = module.lambda_records.shadow_config

  # ログ設定
  log_level          = var.lambda_maintenance_log_level
  log_retention_days = var.log_retention_days
}

# Maintenance Step Functions（Worker並列実行オーケストレーション）
module "maintenance_sfn" {
  source = "./modules/maintenance/step-functions"

  env = var.environment

  # Worker Lambda設定
  worker_function_arn = module.maintenance_worker.function_arn

  # ログ設定
  log_retention_days = var.log_retention_days
}

# Maintenance Coordinator Lambda（メンテナンス開始オーケストレーター）
module "maintenance_coordinator" {
  source = "./modules/maintenance/lambda-coordinator"

  env    = var.environment
  region = var.region

  # Step Functions設定
  state_machine_arn = module.maintenance_sfn.state_machine_arn

  # 許可されたリソース名
  allow_resources = var.maintenance_allow_resources

  # ログ設定
  log_level          = var.lambda_maintenance_log_level
  log_retention_days = var.log_retention_days
}
