# Fetch Lambda関数モジュール

# Fetch Lambda専用IAMロール
# 最小権限の原則に従い、SSM Parameter Store、Lambda Invoke、CloudWatch Logsのみにアクセス可能
resource "aws_iam_role" "lambda_fetch" {
  name = "${var.project_name}-${var.environment}-fetch-lambda-role"

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
    Name        = "${var.project_name}-${var.environment}-fetch-lambda-role"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "fetch-lambda"
  }
}

# AWSマネージドポリシー: CloudWatch Logs
resource "aws_iam_role_policy_attachment" "fetch_basic_execution" {
  role       = aws_iam_role.lambda_fetch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# AWSマネージドポリシー: X-Ray
resource "aws_iam_role_policy_attachment" "fetch_xray" {
  role       = aws_iam_role.lambda_fetch.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# カスタムインラインポリシー: SSM Parameter Storeアクセス
# Fetch Lambdaは特定パスプレフィックス（/ainews/{env}/key/*）のパラメータのみ読み取り可能
resource "aws_iam_role_policy" "fetch_ssm" {
  name = "ssm-access"
  role = aws_iam_role.lambda_fetch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/key/*"
      }
    ]
  })
}

# カスタムインラインポリシー: Lambda Invoke
# Fetch LambdaはRecords Lambda関数のみ呼び出し可能
resource "aws_iam_role_policy" "fetch_lambda_invoke" {
  name = "lambda-invoke"
  role = aws_iam_role.lambda_fetch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = var.records_function_arn
      }
    ]
  })
}

# 現在のAWSアカウントIDを取得
data "aws_caller_identity" "current" {}

# CloudWatch Logsロググループ
resource "aws_cloudwatch_log_group" "lambda_fetch" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-fetch"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-fetch-logs"
  }
}

# Lambda関数のZIPファイルを作成
data "archive_file" "lambda_fetch" {
  type        = "zip"
  source_file = "${path.root}/../functions/fetch/dist/handler.cjs"
  output_path = "${path.root}/../functions/fetch/dist/handler.zip"
}

# Lambda関数
resource "aws_lambda_function" "fetch" {
  function_name = "${var.project_name}-${var.environment}-fetch"
  description   = "Fetch Lambda - Automated news article fetching and storage"
  role          = aws_iam_role.lambda_fetch.arn

  # ビルド成果物
  filename         = data.archive_file.lambda_fetch.output_path
  source_code_hash = data.archive_file.lambda_fetch.output_base64sha256

  # ランタイム設定
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  handler       = "handler.lambdaHandler"

  # パフォーマンス設定
  timeout     = 60
  memory_size = 512

  # 環境変数
  environment {
    variables = {
      ENV                   = var.environment
      REGION                = var.region
      PARAM_PATH            = "/${var.project_name}/${var.environment}/key/"
      RECORDS_FUNCTION_URL  = var.records_function_url
      RECORDS_FUNCTION_NAME = var.records_function_name
      LOG_LEVEL             = var.log_level
    }
  }

  # X-Ray有効化
  tracing_config {
    mode = "Active"
  }

  # CloudWatch Logsへの依存関係を明示
  depends_on = [
    aws_cloudwatch_log_group.lambda_fetch,
    aws_iam_role_policy.fetch_ssm,
    aws_iam_role_policy.fetch_lambda_invoke
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-fetch"
  }
}
