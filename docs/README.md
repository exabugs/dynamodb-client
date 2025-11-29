# @exabugs/dynamodb-client

DynamoDB Single-Table設計向けのクライアントライブラリ。MongoDB風のAPIでDynamoDBを操作できます。

## 特徴

- **認証方式別クライアント**: IAM、Cognito、Token認証に最適化
- **型安全**: TypeScriptで完全に型付けされたAPI
- **軽量**: 認証方式ごとに必要な依存関係のみを含む
- **MongoDB風API**: 使いやすいCRUD操作

## インストール

```bash
npm install @exabugs/dynamodb-client
# または
pnpm add @exabugs/dynamodb-client
```

## クイックスタート

### Cognito認証（ブラウザ/Node.js）

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/cognito';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    getToken: async () => {
      // Cognitoトークンを取得
      return token;
    },
  },
});

await client.connect();

const db = client.db('mydb');
const articles = db.collection('articles');

// CRUD操作
const results = await articles
  .find({ status: 'published' })
  .sort({ publishedAt: 'desc' })
  .limit(10)
  .toArray();
```

### IAM認証（Lambda/Node.js）

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    region: process.env.AWS_REGION!,
  },
});

await client.connect();

const db = client.db('mydb');
const articles = db.collection('articles');

await articles.insertOne({
  title: 'New Article',
  status: 'draft',
});
```

### Token認証（固定トークン）

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/token';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    token: 'your-static-token',
  },
});

await client.connect();
```

## Records Lambda（サーバー側実装）

このライブラリには、Records Lambda（サーバー側実装）も含まれています。

### デプロイ方法

Terraformモジュールを使用してデプロイします。

```hcl
module "lambda_records" {
  source = "github.com/your-org/dynamodb-client//packages/core/terraform"
  # または
  # source = "../packages/core/terraform"  # ローカル開発時

  project_name = "my-project"
  environment  = "dev"
  region       = "us-east-1"

  # DynamoDB設定
  dynamodb_table_name = "my-table"
  dynamodb_table_arn  = "arn:aws:dynamodb:..."

  # Cognito設定
  cognito_user_pool_id = "us-east-1_xxxxx"

  # シャドウ設定（base64エンコード）
  shadow_config = base64encode(file("shadow.config.json"))
}
```

### ビルド

```bash
cd packages/core
pnpm build        # クライアントとサーバーの両方をビルド
pnpm build:lambda # サーバーのみをビルド
```

詳細は[TerraformモジュールのREADME](./terraform/README.md)を参照してください。

## メンテナンススクリプト

### シャドーレコード修復

DynamoClient（IAM認証）を使用してシャドーレコードを修復するスクリプトです。

```bash
# Dry run（変更なし）
pnpm repair-shadows -- --resource articles --dry-run

# 単一レコードを修復
pnpm repair-shadows -- --resource articles --id <RECORD_ID> --repair

# 全レコードを修復
pnpm repair-shadows -- --resource articles --repair
```

環境変数:

- `ENV`: 環境（dev/stg/prd）、デフォルト: `dev`
- `AWS_REGION`: AWSリージョン、デフォルト: `us-east-1`
- `RECORDS_API_URL`: Records Lambda Function URL（省略時はAWS CLIで自動取得）

## ドキュメント

- [使用ガイド](./CLIENT_USAGE.md) - 認証方式別の詳細な使用方法
- [アーキテクチャ](./ARCHITECTURE.md) - 内部設計とコンポーネント構成

## API型定義

Records Lambda API の型定義は `@exabugs/dynamodb-client/types` からエクスポートされています。

```typescript
import type {
  ApiErrorResponse,
  // 操作タイプ
  ApiOperation,
  // リクエスト型
  ApiRequest,
  ApiResponse,
  // レスポンス型
  ApiSuccessResponse,
  BulkOperationResult,
  DeleteOneParams,
  FindManyParams,
  FindOneParams,
  FindParams,
  // データ型
  FindResult,
  InsertOneParams,
  OperationError,
  UpdateOneParams,
} from '@exabugs/dynamodb-client/types';
```

## シャドウ管理機能

このライブラリには、DynamoDB Single-Table設計におけるシャドウレコード管理機能が含まれています。

### インストール

```bash
pnpm add @exabugs/dynamodb-client
```

### 使用方法

#### シャドウSK生成

```typescript
import { generateShadowSK } from '@exabugs/dynamodb-client/shadows';

// 文字列フィールド
const nameSK = generateShadowSK('name', 'Tech News', '01HZXY123', 'string');
// => 'name#Tech#News#id#01HZXY123'

// 数値フィールド
const prioritySK = generateShadowSK('priority', 123, '01HZXY123', 'number');
// => 'priority#00000000000000000123#id#01HZXY123'

// 日時フィールド
const createdAtSK = generateShadowSK(
  'createdAt',
  '2025-11-12T10:00:00.000Z',
  '01HZXY123',
  'datetime'
);
// => 'createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123'
```

#### シャドウ差分計算

```typescript
import { calculateShadowDiff } from '@exabugs/dynamodb-client/shadows';

const oldKeys = ['name#Old#Name#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];

const newKeys = ['name#New#Name#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];

const diff = calculateShadowDiff(oldKeys, newKeys);
// => {
//   toDelete: ['name#Old#Name#id#01HZXY123'],
//   toAdd: ['name#New#Name#id#01HZXY123']
// }
```

#### 設定ファイル読み込み

```typescript
import { getAllShadowFields, loadShadowConfig } from '@exabugs/dynamodb-client/shadows';

// shadow.config.jsonを読み込む
const config = await loadShadowConfig('./shadow.config.json');

// リソースの全シャドーフィールドを取得
const fields = getAllShadowFields(config, 'articles');
// => {
//   id: { type: 'string' },
//   name: { type: 'string' },
//   createdAt: { type: 'datetime' },
//   updatedAt: { type: 'datetime' }
// }
```

### エスケープルール

文字列値は以下のルールでエスケープされます：

- `#` → `##`
- スペース → `#`

例：

- `"Tech News"` → `"Tech#News"`
- `"AI#ML"` → `"AI##ML"`

## パッケージ構成

| エクスポート                              | 環境    | 用途                           | バンドルサイズ |
| ----------------------------------------- | ------- | ------------------------------ | -------------- |
| `@exabugs/dynamodb-client/client/iam`     | Node.js | IAM認証クライアント            | ~500KB         |
| `@exabugs/dynamodb-client/client/cognito` | 共通    | Cognito認証クライアント        | ~50KB          |
| `@exabugs/dynamodb-client/client/token`   | 共通    | Token認証クライアント          | ~50KB          |
| `@exabugs/dynamodb-client/server`         | Node.js | Records Lambda（サーバー実装） | ~1.2MB         |
| `@exabugs/dynamodb-client/server/handler` | Node.js | Records Lambda ハンドラー      | ~1.2MB         |
| `@exabugs/dynamodb-client/shadows`        | Node.js | シャドウ管理機能               | ~10KB          |
| `@exabugs/dynamodb-client/types`          | 共通    | API型定義                      | -              |
| `@exabugs/dynamodb-client/terraform`      | -       | Terraformモジュール            | -              |

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

Copyright (c) 2024 exabugs
