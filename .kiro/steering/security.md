# セキュリティ原則

## 最小権限の原則（Principle of Least Privilege）

すべてのAWSリソース、特にIAMロールとポリシーは、最小権限の原則に厳密に従うこと。

### IAMロール設計ルール

1. **Lambda関数ごとに独立したIAMロールを作成する**
   - Records Lambda、Fetch Lambda、Maintenance Lambdaなど、各Lambda関数に専用のIAMロールを割り当てる
   - 複数のLambda関数で同一のIAMロールを共有しない

2. **必要最小限のアクションのみを許可する**
   - ワイルドカード（`*`）の使用を避け、具体的なアクション名を指定する
   - 例: `dynamodb:*` ではなく `dynamodb:GetItem`, `dynamodb:PutItem` など

3. **リソースARNを具体的に指定する**
   - 可能な限りワイルドカード（`*`）を避け、特定のリソースARNを指定する
   - 例: `arn:aws:dynamodb:${region}:${account}:table/ainews-${env}-records`
   - 例外: 同条件が並列で並ぶ場合（例: 複数のテーブルやインデックス）、単純化のためワイルドカードを使用して良い
     - 例: `arn:aws:dynamodb:${region}:${account}:table/ainews-${env}-*`（同一環境の全テーブル）
     - 例: `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/ainews-${env}-*`（同一環境の全Lambda関数ログ）

4. **AWSマネージドポリシーを積極的に活用する**
   - CloudWatch Logs、X-Ray、VPCアクセスなど、標準的な権限セットにはAWSマネージドポリシーを使用する
   - 推奨マネージドポリシー:
     - `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole` (CloudWatch Logs)
     - `arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess` (X-Ray)
     - `arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole` (VPC)
   - ビジネスロジック固有の権限（DynamoDB、S3、SSM、Lambda Invoke）はカスタムポリシーで定義する

5. **環境ごとにリソースを分離する**
   - dev、stg、prd環境で異なるリソースARNを使用する
   - 環境変数（`${env}`）を使用してリソースARNを動的に構築する

### Records Lambda IAMロール

Records Lambdaは以下の権限のみを持つ：

- **DynamoDB**: 特定テーブル（`ainews-{env}-records`）への読み書き（カスタムポリシー）
  - GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan, BatchGetItem, TransactWriteItems
- **CloudWatch Logs**: ログ出力（AWSマネージドポリシー: AWSLambdaBasicExecutionRole）
- **X-Ray**: トレーシング（AWSマネージドポリシー: AWSXRayDaemonWriteAccess）

Records Lambdaは以下の権限を持たない：
- S3アクセス
- SSM Parameter Storeアクセス
- 他のLambda関数の呼び出し

### Fetch Lambda IAMロール

Fetch Lambdaは以下の権限のみを持つ：

- **SSM Parameter Store**: 特定パスプレフィックス（`/ainews/{env}/*`）からのパラメータ読み取り（カスタムポリシー）
  - GetParameter, GetParametersByPath
- **Lambda Invoke**: Records Lambda関数（`ainews-{env}-records`）の呼び出し（カスタムポリシー）
  - InvokeFunction（特定関数ARNのみ）
- **CloudWatch Logs**: ログ出力（AWSマネージドポリシー: AWSLambdaBasicExecutionRole）
- **X-Ray**: トレーシング（AWSマネージドポリシー: AWSXRayDaemonWriteAccess）

Fetch Lambdaは以下の権限を持たない：
- DynamoDBへの直接アクセス
- S3への直接アクセス
- Records Lambda以外のLambda関数の呼び出し

### IAMポリシー実装ガイドライン

```hcl
# 良い例: Records Lambda IAMロール
resource "aws_iam_role" "records_lambda" {
  name = "ainews-${var.env}-records-lambda-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
  
  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Purpose     = "records-lambda"
  }
}

# AWSマネージドポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "records_basic_execution" {
  role       = aws_iam_role.records_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "records_xray" {
  role       = aws_iam_role.records_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# カスタムポリシー: DynamoDBアクセス
resource "aws_iam_role_policy" "records_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.records_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
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
      Resource = "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/ainews-${var.env}-records"
    }]
  })
}

# 悪い例: ワイルドカードの過剰使用
resource "aws_iam_role_policy" "bad_example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = "dynamodb:*"  # NG: すべてのDynamoDBアクションを許可
      Resource = "*"         # NG: すべてのリソースを許可
    }]
  })
}
```

### エラーハンドリング

Lambda関数は権限不足エラー（AccessDeniedException）を適切にハンドリングすること：

```typescript
try {
  await dynamoDBClient.send(command);
} catch (error) {
  if (error.name === 'AccessDeniedException') {
    logger.error('DynamoDB access denied', {
      action: 'GetItem',
      resource: tableName,
      error: error.message
    });
    throw new Error('Insufficient permissions to access DynamoDB');
  }
  throw error;
}
```

### 監査とコンプライアンス

1. **タグ付け**: すべてのIAMロールとポリシーに以下のタグを付与する
   - `Environment`: dev/stg/prd
   - `ManagedBy`: terraform
   - `Purpose`: records-lambda / fetch-lambda など

2. **Terraform Output**: IAMロールとポリシーのARNをoutputとして出力し、監査を容易にする

3. **定期レビュー**: IAMポリシーを定期的にレビューし、不要な権限を削除する
