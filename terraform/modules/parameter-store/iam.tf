# Parameter Store アクセス用IAMポリシー

# Note: 実際のプロジェクトでは、以下のようなIAMポリシーを
# 各リソース（Admin UI、Fetch Lambda等）で個別に定義してください：

# Admin UI用Parameter Store読み取りポリシー例:
# Resource: "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/app/*"

# Fetch Lambda用Parameter Store読み取りポリシー例:
# Resource: [
#   "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/app/records-api-url",
#   "arn:aws:ssm:region:*:parameter/{project_name}/{environment}/lambda/records-function-arn"
# ]
