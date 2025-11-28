# Maintenance Worker Lambda Terraform Module
#
# DynamoDBレコードを走査してシャドーを修復するワーカー Lambda 関数

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# Lambda関数のZIPアーカイブを作成
data "archive_file" "worker_lambda" {
  type        = "zip"
  source_file = "${path.root}/../functions/maintenance/worker/dist/handler.mjs"
  output_path = "${path.root}/functions/maintenance/worker/dist/handler.zip"
}

# Maintenance Worker Lambda IAMロール
resource "aws_iam_role" "worker_lambda" {
  name = "ainews-${var.env}-maintenance-worker-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-worker-lambda"
  }
}

# AWSマネージドポリシー: CloudWatch Logs
resource "aws_iam_role_policy_attachment" "worker_basic_execution" {
  role       = aws_iam_role.worker_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# AWSマネージドポリシー: X-Ray
resource "aws_iam_role_policy_attachment" "worker_xray" {
  role       = aws_iam_role.worker_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# カスタムインラインポリシー: DynamoDB
resource "aws_iam_role_policy" "worker_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.worker_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:TransactWriteItems"
      ]
      Resource = [
        var.table_arn,
        "${var.table_arn}/*"
      ]
    }]
  })
}

# Maintenance Worker Lambda関数
resource "aws_lambda_function" "worker" {
  function_name = "ainews-${var.env}-maintenance-worker"
  role          = aws_iam_role.worker_lambda.arn
  handler       = "handler.lambdaHandler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 900 # 15分（大量のレコードを処理する場合）
  memory_size   = 512

  filename         = data.archive_file.worker_lambda.output_path
  source_code_hash = data.archive_file.worker_lambda.output_base64sha256

  environment {
    variables = {
      ENV           = var.env
      REGION        = var.region
      TABLE_NAME    = var.table_name
      SHADOW_CONFIG = var.shadow_config
      LOG_LEVEL     = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-worker"
  }
}

# CloudWatch Logs ロググループ
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${aws_lambda_function.worker.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-worker-logs"
  }
}
