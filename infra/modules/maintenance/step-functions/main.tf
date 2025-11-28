# Maintenance Step Functions Terraform Module
#
# Worker Lambdaを並列実行するオーケストレーション

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# State Machine定義を読み込み、Worker Lambda ARNを置換
locals {
  state_machine_definition = templatefile("${path.module}/state-machine.json", {
    worker_function_arn = var.worker_function_arn
  })
}

# Step Functions IAMロール
resource "aws_iam_role" "sfn" {
  name = "ainews-${var.env}-maintenance-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "states.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-sfn"
  }
}

# カスタムインラインポリシー: Lambda Invoke
resource "aws_iam_role_policy" "sfn_lambda" {
  name = "lambda-invoke"
  role = aws_iam_role.sfn.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "lambda:InvokeFunction"
      ]
      Resource = var.worker_function_arn
    }]
  })
}

# カスタムインラインポリシー: CloudWatch Logs
resource "aws_iam_role_policy" "sfn_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.sfn.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogDelivery",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutResourcePolicy",
        "logs:DescribeResourcePolicies",
        "logs:DescribeLogGroups"
      ]
      Resource = "*"
    }]
  })
}

# CloudWatch Logs ロググループ
resource "aws_cloudwatch_log_group" "sfn" {
  name              = "/aws/states/ainews-${var.env}-maintenance"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-sfn-logs"
  }
}

# Step Functions State Machine
resource "aws_sfn_state_machine" "maintenance" {
  name     = "ainews-${var.env}-maintenance"
  role_arn = aws_iam_role.sfn.arn

  definition = local.state_machine_definition

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "maintenance-sfn"
  }
}
