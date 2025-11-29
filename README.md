# DynamoDB Client SDK

[![CI](https://github.com/exabugs/dynamodb-client/actions/workflows/ci.yml/badge.svg)](https://github.com/exabugs/dynamodb-client/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@exabugs%2Fdynamodb-client.svg)](https://www.npmjs.com/package/@exabugs/dynamodb-client)

DynamoDB Single-Table Client SDK with MongoDB-like API, Shadow Records, and Lambda implementation for serverless applications.

## Features

- 🚀 MongoDB-like API for DynamoDB
- 📦 Single-Table Design with Shadow Records
- 🔐 Multiple authentication methods (IAM, Cognito, Token)
- ⚡ Lambda function implementation included
- 🎨 react-admin integration
- 📝 TypeScript support
- 🏗️ Terraform modules for deployment

## Installation

### From GitHub Packages (Private Repository)

1. Create a Personal Access Token with `read:packages` scope
2. Configure `.npmrc`:

```bash
@exabugs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

3. Install the package:

```bash
npm install @exabugs/dynamodb-client
```

For detailed instructions, see [Private Package Usage Guide](docs/PRIVATE_PACKAGE_USAGE.md).

### From npm (Public - Coming Soon)

```bash
npm install @exabugs/dynamodb-client
```

## Quick Start

### Client Usage (IAM Authentication)

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';

const client = new DynamoClient(FUNCTION_URL, {
  region: 'ap-northeast-1',
});

const db = client.db();
const collection = db.collection('articles');

// Create
await collection.insertOne({ title: 'Hello World', content: '...' });

// Read
const article = await collection.findOne({ title: 'Hello World' });

// Update
await collection.updateOne({ id: article.id }, { $set: { status: 'published' } });

// Delete
await collection.deleteOne({ id: article.id });
```

### Server Usage (Lambda Function)

```typescript
import { createHandler } from '@exabugs/dynamodb-client/server/handler';

export const handler = createHandler({
  tableName: process.env.TABLE_NAME!,
  region: process.env.AWS_REGION!,
});
```

## Requirements

- Node.js >= 18.0.0
- AWS Account (for DynamoDB and Lambda)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

### 主要コマンド

```bash
# ヘルプを表示
make help

# 開発
make install    # 依存関係のインストール
make build      # 全パッケージとLambda関数のビルド
make test       # 全パッケージのテスト実行
make lint       # Lint実行
make format     # フォーマット実行
make clean      # ビルド成果物の削除

# デプロイ
make deploy-dev    # dev環境にデプロイ
make deploy-stg    # stg環境にデプロイ
make deploy-prd    # prd環境にデプロイ

# インフラ操作
make infra-plan ENV=dev     # Terraformプランを表示
make infra-apply ENV=dev    # Terraformを適用
make infra-status           # Terraform状態を表示

# Lambda操作
make invoke-fetch ENV=dev      # Fetch Lambdaを実行
make logs-fetch ENV=dev        # Fetch Lambdaのログを表示
make logs-records ENV=dev      # Records Lambdaのログを表示

# その他
make shadow-config    # shadow.config.jsonを再生成
```

### 個別Makefileの使用

各Lambda関数には個別のMakefileも用意されています：

```bash
# Fetch Lambda
cd functions/fetch
make help
make build
make deploy ENV=dev
make invoke
make logs

# Terraform
cd infra
make help
make plan ENV=dev
make apply ENV=dev
make status
```

詳細は[Makefile運用ガイドライン](.kiro/steering/makefile-operations.md)を参照してください。

## Records Lambda

Records Lambdaは`@exabugs/dynamodb-client`ライブラリに統合されています。

詳細は[packages/core/README.md](packages/core/README.md)を参照してください。

## ワークスペース構成

```
.
├── apps/           # アプリケーション (Admin UI, Mobile App)
├── functions/      # Lambda関数 (Fetch, Pipeline, Maintenance)
├── packages/       # 共有ライブラリ (core, shadows, graphql-types)
│   └── core/       # Records Lambda（サーバー実装）を含む
└── infra/          # Terraform設定
```

**注**: Records Lambdaは`packages/core/`に統合されています。

## Admin UI 開発・デプロイ

### ローカル開発

```bash
# 開発サーバー起動
pnpm --filter @ainews/admin dev

# ブラウザで http://localhost:3000 にアクセス
```

### 環境変数設定

`apps/admin/.env`ファイルを作成：

```bash
# Records Lambda Function URL
VITE_RECORDS_API_URL=https://xxxxx.lambda-url.us-east-1.on.aws/

# Cognito User Pool設定
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=ainews-dev-auth.auth.us-east-1.amazoncognito.com
VITE_COGNITO_REGION=us-east-1

# 開発環境で認証を無効化する場合のみ（本番環境では必ずfalse）
VITE_DISABLE_AUTH=false
```

### 重要な設定

**必須**: Admin UIは**BrowserRouter**を使用します。HashRouterは使用しないでください。

理由：

- Cognito Hosted UIの認証コールバックがクエリパラメータ（`?code=xxx`）を使用
- HashRouter（`#/`）ではクエリパラメータが正しく処理されない

### 本番デプロイ（CloudFront）

CloudFront経由で配信する場合、以下の設定が必要です：

1. **エラーページ設定**: 404/403エラーを`/index.html`にリダイレクト（SPA対応）
2. **キャッシュ設定**:
   - `index.html`: キャッシュしない（TTL=0）
   - 静的アセット（JS/CSS/画像）: 長期キャッシュ（TTL=7日〜1年）
3. **Cognitoコールバック URL**: 本番ドメインを追加

詳細は[設計書](.kiro/specs/ainews-pipeline/design.md)の「Admin UI 重要な設定」セクションを参照してください。

### トラブルシューティング

#### CORSエラーが発生する場合

1. **Lambda関数を最新版にデプロイ**:

   ```bash
   cd functions/records
   pnpm build
   cd ../../infra
   terraform apply -var-file=envs/dev.tfvars
   ```

2. **ブラウザのキャッシュをクリア**: Cmd+Shift+R (Mac) または Ctrl+Shift+R (Windows/Linux)

3. **Lambda Function URLのCORS設定を確認**: `infra/modules/api/lambda-records/main.tf`

**重要**: Lambda Function URLのCORS設定を使用するため、Lambda関数のハンドラーではCORSヘッダーを設定しません。

#### Cognito Hosted UIでログインできない場合

1. **開発サーバーのポートを確認**: `http://localhost:3000` で起動していることを確認
   - Vite設定で `strictPort: true` が設定されているため、ポート3000が使用中の場合はエラーになります
   - 他のプロセスがポート3000を使用していないか確認してください

2. **Cognitoのコールバック/ログアウトURLを確認**: `infra/envs/dev.tfvars`

   ```hcl
   admin_callback_urls = [
     "http://localhost:3000",
     "http://localhost:3000/callback",
     ...
   ]
   ```

3. **ブラウザのローカルストレージをクリア**: 古いセッション情報が残っている可能性があります

## ドキュメント

詳細な設計・要件については以下を参照してください：

- [要件定義書](.kiro/specs/ainews-pipeline/requirements.md)
- [設計書](.kiro/specs/ainews-pipeline/design.md)
- [実装タスクリスト](.kiro/specs/ainews-pipeline/tasks.md)

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

Copyright (c) 2024 exabugs
