# Records Lambda関数モジュール

# Records Lambda専用IAMロール
# 最小権限の原則に従い、DynamoDBとCloudWatch Logsのみにアクセス可能
resource "aws_iam_role" "lambda_records" {
  name = "${var.project_name}-${var.environment}-records-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-records-lambda-role"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "records-lambda"
  }
}

# AWSマネージドポリシー: CloudWatch Logs
resource "aws_iam_role_policy_attachment" "records_basic_execution" {
  role       = aws_iam_role.lambda_records.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# AWSマネージドポリシー: X-Ray
resource "aws_iam_role_policy_attachment" "records_xray" {
  role       = aws_iam_role.lambda_records.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# カスタムインラインポリシー: DynamoDBアクセス
# Records Lambdaは特定テーブルへの読み書きのみ可能
resource "aws_iam_role_policy" "records_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda_records.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:TransactWriteItems"
        ]
        Resource = var.dynamodb_table_arn
      }
    ]
  })
}

# CloudWatch Logsロググループ
resource "aws_cloudwatch_log_group" "lambda_records" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-records"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-records-logs"
  }
}

# Lambda関数のZIPファイルを作成
data "archive_file" "lambda_records" {
  type        = "zip"
  source_file = "${path.module}/../dist/server/handler.cjs"
  output_path = "${path.module}/../dist/server/handler.zip"
}

# Lambda関数
resource "aws_lambda_function" "records" {
  function_name = "${var.project_name}-${var.environment}-records"
  description   = "Records Lambda - CRUD operations with shadow management"
  role          = aws_iam_role.lambda_records.arn

  # ビルド成果物
  filename         = data.archive_file.lambda_records.output_path
  source_code_hash = data.archive_file.lambda_records.output_base64sha256

  # ランタイム設定
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  handler       = "handler.handler"

  # パフォーマンス設定
  timeout     = 30
  memory_size = 512

  # 環境変数
  environment {
    variables = {
      ENV                  = var.environment
      REGION               = var.region
      TABLE_NAME           = var.dynamodb_table_name
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      COGNITO_CLIENT_ID    = var.cognito_client_id
      COGNITO_REGION       = var.region
      LOG_LEVEL            = var.log_level
      # シャドウ設定（環境変数ベース）
      SHADOW_CREATED_AT_FIELD = var.shadow_created_at_field
      SHADOW_UPDATED_AT_FIELD = var.shadow_updated_at_field
      SHADOW_STRING_MAX_BYTES = var.shadow_string_max_bytes
      SHADOW_NUMBER_PADDING   = var.shadow_number_padding
    }
  }

  # X-Ray有効化
  tracing_config {
    mode = "Active"
  }

  # CloudWatch Logsへの依存関係を明示
  depends_on = [
    aws_cloudwatch_log_group.lambda_records,
    aws_iam_role_policy.records_dynamodb
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-records"
  }
}

# Lambda Function URL
resource "aws_lambda_function_url" "records" {
  function_name      = aws_lambda_function.records.function_name
  authorization_type = "NONE" # JWT検証はLambda内で実施

  # CORS設定
  cors {
    allow_origins     = ["*"]
    allow_methods     = ["POST"]
    allow_headers     = ["content-type", "authorization", "x-amz-date", "x-api-key", "x-amz-security-token"]
    expose_headers    = ["content-type", "x-amzn-requestid"]
    allow_credentials = false
    max_age           = 86400 # 24時間
  }

  depends_on = [aws_lambda_function.records]
}

# Lambda Function URLのリソースベースポリシー
resource "aws_lambda_permission" "function_url" {
  statement_id           = "AllowFunctionURLInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.records.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
# Parameter Store モジュール
module "parameter_store" {
  source = "./modules/parameter-store"

  # 基本設定
  project_name = var.project_name
  environment  = var.environment
  region       = var.region

  # Records Lambda設定
  records_function_url = aws_lambda_function_url.records.function_url
  records_function_arn = aws_lambda_function.records.arn

  depends_on = [
    aws_lambda_function.records,
    aws_lambda_function_url.records
  ]
}
