# Fetch Lambda

ニュース記事を自動取得し、Records Lambdaに保存するLambda関数です。

## 概要

- **目的**: ニュース記事の自動取得と保存
- **トリガー**: EventBridge Scheduler（定期実行）
- **出力**: Records Lambda経由でDynamoDBに保存

## アーキテクチャ

```
EventBridge Scheduler
  ↓
Fetch Lambda
  ↓ (SSM Parameter Store読み取り)
  ↓ (ニュース記事取得)
  ↓ (Lambda Invoke)
Records Lambda
  ↓
DynamoDB
```

## 環境変数

| 変数名                  | 説明                    | 例                               |
| ----------------------- | ----------------------- | -------------------------------- |
| `ENV`                   | 環境識別子              | `dev`, `stg`, `prd`              |
| `REGION`                | AWSリージョン           | `ap-northeast-1`                 |
| `PARAM_PATH`            | SSM Parameter Storeパス | `/ainews/dev/key/`               |
| `RECORDS_FUNCTION_NAME` | Records Lambda関数名    | `ainews-dev-records`             |
| `LOG_LEVEL`             | ログレベル              | `debug`, `info`, `warn`, `error` |

## ビルド

```bash
pnpm build
```

出力: `dist/handler.mjs`

## テスト

```bash
pnpm test
```

## デプロイ

Terraformで自動デプロイされます。

```bash
cd infra
make apply ENV=dev
```

## プロバイダー

Fetch Lambdaは複数のニュースプロバイダーから記事を取得します。各プロバイダーのAPIキーはSSM Parameter Storeに保存されます。

### 1. NewsAPI（実装済み）

NewsAPI (https://newsapi.org/) を使用してニュース記事を取得します。

**APIキーの取得:**

1. https://newsapi.org/ にアクセス
2. アカウント登録（無料プラン: 100リクエスト/日）
3. APIキーを取得

**SSM Parameter Store設定:**

```bash
# dev環境
aws ssm put-parameter \
  --name "/ainews/dev/key/NEWSAPI" \
  --value "YOUR_NEWSAPI_KEY_HERE" \
  --type "SecureString" \
  --region ap-northeast-1
```

**機能:**

- top-headlines APIエンドポイント使用
- カテゴリ、言語、検索キーワードフィルター対応
- ページネーション対応（最大100件/リクエスト）
- レート制限エラー（429）時の自動リトライ

### 2. GNews（実装済み）

GNews (https://gnews.io/) を使用してニュース記事を取得します。

**APIキーの取得:**

1. https://gnews.io/ にアクセス
2. アカウント登録（無料プラン: 100リクエスト/日）
3. APIキーを取得

**SSM Parameter Store設定:**

```bash
# dev環境
aws ssm put-parameter \
  --name "/ainews/dev/key/GNEWS" \
  --value "YOUR_GNEWS_KEY_HERE" \
  --type "SecureString" \
  --region ap-northeast-1
```

**機能:**

- top-headlines APIエンドポイント使用
- 言語、トピック、検索キーワードフィルター対応
- ページネーション対応（最大100件/リクエスト）
- レート制限エラー（429）時の自動リトライ

### 3. APITube（実装済み）

APITube (https://apitube.io/) を使用してニュース記事を取得します。

**APIキーの取得:**

1. https://apitube.io/ にアクセス
2. アカウント登録
3. APIキーを取得

**SSM Parameter Store設定:**

```bash
# dev環境
aws ssm put-parameter \
  --name "/ainews/dev/key/APITUBE" \
  --value "YOUR_APITUBE_KEY_HERE" \
  --type "SecureString" \
  --region ap-northeast-1
```

**機能:**

- everything APIエンドポイント使用
- 言語、検索キーワードフィルター対応
- ページネーション対応
- レート制限エラー（429）時の自動リトライ

### パラメータ確認

```bash
# すべてのAPIキーを確認
aws ssm get-parameters-by-path \
  --path "/ainews/dev/key/" \
  --with-decryption \
  --region ap-northeast-1

# 特定のAPIキーを確認
aws ssm get-parameter \
  --name "/ainews/dev/key/NEWSAPI" \
  --with-decryption \
  --region ap-northeast-1
```

### フォールバック動作

- すべてのプロバイダーのAPIキーが設定されていない場合、ダミープロバイダーが使用されます
- 一部のプロバイダーが失敗しても、他のプロバイダーから記事を取得します
- 各プロバイダーのエラーは個別にログ出力されます

## IAMロール

Fetch Lambda専用のIAMロールを使用します（最小権限の原則）:

- **SSM Parameter Store**: 読み取り権限（`/ainews/{env}/*`）
- **Lambda Invoke**: Records Lambda呼び出し権限
- **CloudWatch Logs**: ログ出力権限
- **X-Ray**: トレーシング権限

## 開発

### ローカルテスト

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm build

# テスト実行
pnpm test
```

### Records Lambda呼び出し例

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: process.env.REGION });

const response = await lambda.send(
  new InvokeCommand({
    FunctionName: process.env.RECORDS_FUNCTION_NAME,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({
      operation: 'createMany',
      resource: 'articles',
      data: [
        { name: 'Article 1', category: 'tech', status: 'draft' },
        { name: 'Article 2', category: 'business', status: 'draft' },
      ],
    }),
  })
);
```

## トラブルシューティング

### ビルドエラー

```bash
pnpm clean
pnpm install
pnpm build
```

### テストエラー

```bash
pnpm test --reporter=verbose
```

### デプロイエラー

```bash
cd infra
make plan ENV=dev
```

## 参考

- [Records Lambda](../records/README.md)
- [DynamoClient](../../packages/core/README.md)
- [API Types](../../packages/api-types/README.md)
