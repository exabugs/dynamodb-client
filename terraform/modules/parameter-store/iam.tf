# Parameter Store アクセス用IAMポリシー

# Admin UI用Parameter Store読み取りポリシー
resource "aws_iam_policy" "admin_ui_parameter_read" {
  name        = "${var.project_name}-${var.environment}-admin-ui-parameter-read"
  description = "Admin UI用Parameter Store読み取り権限"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${var.region}:*:parameter/${var.project_name}/${var.environment}/app/*"
        ]
      }
    ]
  })

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "admin-ui-parameter-access"
  }
}

# Fetch Lambda用Parameter Store読み取りポリシー
resource "aws_iam_policy" "fetch_lambda_parameter_read" {
  name        = "${var.project_name}-${var.environment}-fetch-lambda-parameter-read"
  description = "Fetch Lambda用Parameter Store読み取り権限"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${var.region}:*:parameter/${var.project_name}/${var.environment}/app/records-api-url",
          "arn:aws:ssm:${var.region}:*:parameter/${var.project_name}/${var.environment}/lambda/records-function-arn"
        ]
      }
    ]
  })

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "fetch-lambda-parameter-access"
  }
}
