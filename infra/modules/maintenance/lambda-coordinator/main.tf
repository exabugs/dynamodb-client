# Maintenance Coordinator Lambda Terraform Module
#
# シャドー整合性メンテナンスを開始するオーケストレーター Lambda 関数

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
data "archive_file" "coordinator_lambda" {
  type        = "zip"
  source_file = "${path.root}/../functions/maintenance/coordinator/dist/handler.mjs"
  output_path = "${path.root}/functions/maintenance/coordinator/dist/handler.zip"
}

# Maintenance Coordinator Lambda IAMロール
resource "aws_iam_role" "coordinator_lambda" {
  name = "ainews-${var.env}-maintenance-coordinator-lambda-role"

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
    Purpose     = "maintenance-coordinator-lambda"
  }
}

# AWSマネージドポリシー: CloudWatch Logs
resource "aws_iam_role_policy_attachment" "coordinator_basic_execution" {
  role       = aws_iam_role.coordinator_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# AWSマネージドポリシー: X-Ray
resource "aws_iam_role_policy_attachment" "coordinator_xray" {
  role       = aws_iam_role.coordinator_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# カスタムインラインポリシー: Step Functions StartExecution
resource "aws_iam_role_policy" "coordinator_sfn" {
  name = "step-functions-access"
  role = aws_iam_role.coordinator_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "states:StartExecution"
      ]
      Resource = var.state_machine_arn
    }]
  })
}

# Maintenance Coordinator Lambda関数
resource "aws_lambda_function" "coordinator" {
  function_name = "ainews-${var.env}-maintenance-coordinator"
  role          = aws_iam_role.coordinator_lambda.arn
  handler       = "handler.lambdaHandler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  timeout       = 60
  memory_size   = 256

  filename         = data.archive_file.coordinator_lambda.output_path
  source_code_hash = data.archive_file.coordinator_lambda.output_base64sha256

  environment {
    variables = {
      ENV               = var.env
      REGION            = var.region
      STATE_MACHINE_ARN = var.state_machine_arn
      ALLOW_RESOURCES   = var.allow_resources
      LOG_LEVEL         = var.log_level
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-coordinator"
  }
}

# CloudWatch Logs ロググループ
resource "aws_cloudwatch_log_group" "coordinator" {
  name              = "/aws/lambda/${aws_lambda_function.coordinator.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-coordinator-logs"
  }
}
