# DynamoDBクライアントライブラリ - 設計書

## 概要

DynamoDB Single-Table設計向けのクライアントライブラリです。MongoDB風のシンプルなAPIを提供し、型定義からシャドー設定を自動生成することで、開発効率とデータ整合性を両立します。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│ クライアント層                                               │
│  - Webアプリ (React)                                        │
│  - モバイルアプリ (React Native)                             │
│  - 他のLambda関数                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
              パッケージ名/client
                          ↓
              HTTPS (Lambda Function URL)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ データアクセス層（唯一のDynamoDB操作者）                      │
│                                                             │
│  Lambda関数                                                 │
│    - パッケージ名/server/query (クエリ変換)                 │
│    - パッケージ名/server/shadow (シャドウ生成)              │
│    - AWS SDK (DynamoDB操作)                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ DynamoDB                                                    │
│  - テーブル (Single-Table)                                  │
└─────────────────────────────────────────────────────────────┘
```

**設計原則:**
- DynamoDB操作はLambda経由でのみ実行
- クライアントはDynamoDBへの直接アクセス権限を持たない
- 全てのDynamoDB操作が一箇所に集約され、データ整合性を保証

## パッケージ構成

```
@exabugs/dynamodb-client/
├── src/
│   ├── client/                    # クライアントSDK（全クライアントで使用）
│   │   ├── DynamoClient.ts        # ベースクライアント（依存性注入）
│   │   ├── Database.ts
│   │   ├── Collection.ts
│   │   ├── FindCursor.ts
│   │   ├── aws-sigv4.ts           # AWS SigV4署名
│   │   ├── index.ts               # 共通エクスポート
│   │   ├── index.iam.ts           # IAM認証用クライアント
│   │   ├── index.cognito.ts       # Cognito認証用クライアント
│   │   └── index.token.ts         # Token認証用クライアント
│   ├── server/                    # サーバーサイド実装
│   │   └── shadow/                # シャドウ管理
│   │       └── generator.ts       # シャドウレコード生成
│   ├── shadows/                   # シャドウ管理パッケージ（統合）
│   │   ├── types.ts               # シャドウ型定義
│   │   ├── generator.ts           # シャドウSK生成
│   │   ├── differ.ts              # シャドウ差分計算
│   │   ├── config.ts              # 設定管理
│   │   └── index.ts               # エクスポート
│   └── types.ts                   # 共通型定義
└── package.json
```

```json
// package.json
{
  "name": "@exabugs/dynamodb-client",
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client/index.js",
    "./client/iam": "./dist/client/index.iam.js",
    "./client/cognito": "./dist/client/index.cognito.js",
    "./client/token": "./dist/client/index.token.js",
    "./server": "./dist/index.js",
    "./shadows": "./dist/shadows/index.js",
    "./types": "./dist/types.js"
  }
}
```

## データ設計（Single Source of Truth）

### 型定義とスキーマ定義

```typescript
// packages/api-types/src/schema.ts

/**
 * シャドウフィールドの型
 */
export enum ShadowFieldType {
  String = 'string',
  Number = 'number',
  Datetime = 'datetime',
  Boolean = 'boolean',
}

/**
 * シャドウフィールド定義
 */
export interface ShadowFieldDefinition {
  type: ShadowFieldType;
}

/**
 * スキーマ定義
 */
export interface SchemaDefinition<T = any> {
  resource: string;
  type: T;
  shadows: {
    sortableFields: Record<string, ShadowFieldDefinition>;
  };
  ttl?: {
    days: number;
  };
}
```

```typescript
// packages/api-types/src/models/Article.ts

import { SchemaDefinition, ShadowFieldType } from '../schema.js';

export interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const ArticleSchema: SchemaDefinition<Article> = {
  resource: 'articles',
  type: {} as Article,
  
  // ソートしたいフィールドのみ明示的に定義
  shadows: {
    sortableFields: {
      publishedAt: { type: ShadowFieldType.Datetime },
      createdAt: { type: ShadowFieldType.Datetime },
      updatedAt: { type: ShadowFieldType.Datetime },
    },
  },
  
  // TTL設定（オプション）
  ttl: {
    days: 90,
  },
};
```

```typescript
// packages/api-types/src/schema.ts

import { ArticleSchema } from './models/Article.js';
import { TaskSchema } from './models/Task.js';
import { FetchLogSchema } from './models/FetchLog.js';

/**
 * スキーマレジストリ設定（Single Source of Truth）
 */
export const SchemaRegistryConfig: SchemaRegistryConfig = {
  database: {
    name: 'ainews',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  resources: {
    articles: ArticleSchema,
    tasks: TaskSchema,
    fetchLogs: FetchLogSchema,
  },
};

export type ResourceName = keyof typeof SchemaRegistryConfig.resources;
```

### シャドー設定の自動生成

```typescript
// packages/api-types/scripts/generate-shadow-config.ts

import { writeFileSync } from 'fs';
import { SchemaRegistryConfig } from '../src/schema.js';

/**
 * スキーマレジストリからshadow.config.jsonを自動生成
 */
function generateShadowConfig() {
  const config = {
    $schemaVersion: '1.0',
    $generatedAt: new Date().toISOString(),
    $generatedFrom: 'packages/api-types/src/schema.ts',
    
    resources: {} as Record<string, any>,
  };
  
  // 各リソースのスキーマを変換
  for (const [resourceName, schema] of Object.entries(SchemaRegistryConfig.resources)) {
    config.resources[resourceName] = {
      sortableFields: schema.shadows.sortableFields,
    };
  }
  
  // JSONファイルとして出力（プロジェクトルート/config/）
  const output = JSON.stringify(config, null, 2);
  const outputPath = '../../../../config/shadow.config.json';
  
  writeFileSync(outputPath, output, 'utf-8');
  
  console.log(`✅ Generated shadow.config.json from TypeScript schemas`);
}

generateShadowConfig();
```

```json
// config/shadow.config.json（自動生成）
{
  "$schemaVersion": "1.0",
  "$generatedAt": "2025-01-19T12:00:00.000Z",
  "$generatedFrom": "packages/api-types/src/schema.ts",
  "resources": {
    "articles": {
      "sortableFields": {
        "publishedAt": { "type": "datetime" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      }
    },
    "tasks": {
      "sortableFields": {
        "priority": { "type": "number" },
        "dueDate": { "type": "datetime" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      }
    }
  }
}
```

## クライアントAPI

### DynamoClient

#### 環境別対応（依存性注入パターン）

クライアントは認証方式に応じて異なるエントリーポイントを提供します。

**設計原則:**
- ビジネスロジックは100%共通化（Collection、Database、DynamoClient）
- 認証ハンドラーのみを認証方式別に分離
- 依存性注入パターンで認証ハンドラーを外部から注入

**ファイル構成:**

```
packages/core/src/client/
├── DynamoClient.ts                # ベースクライアント（依存性注入）
├── Database.ts                    # 共通実装
├── Collection.ts                  # 共通実装
├── FindCursor.ts                  # 共通実装
├── aws-sigv4.ts                   # AWS SigV4署名（IAM認証用）
├── index.ts                       # 共通エクスポート
├── index.iam.ts                   # IAM認証用クライアント
├── index.cognito.ts               # Cognito認証用クライアント
└── index.token.ts                 # Token認証用クライアント
```

**認証方式別のエクスポート:**

```typescript
// packages/core/src/client/index.iam.ts
export interface IAMAuthOptions {
  region: string;
}

export class DynamoClient extends BaseDynamoClient<IAMAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    super(endpoint, options, async (url, body, auth) => {
      return await signRequest(url, body, auth.region);
    });
  }
}

// packages/core/src/client/index.cognito.ts
export interface CognitoAuthOptions {
  getToken: () => Promise<string>;
}

export class DynamoClient extends BaseDynamoClient<CognitoAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    super(endpoint, options, async (_url, _body, auth) => {
      const token = await auth.getToken();
      return { Authorization: `Bearer ${token}` };
    });
  }
}

// packages/core/src/client/index.token.ts
export interface TokenAuthOptions {
  token: string;
}

export class DynamoClient extends BaseDynamoClient<TokenAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    super(endpoint, options, async (_url, _body, auth) => {
      return { Authorization: `Bearer ${auth.token}` };
    });
  }
}
```

**共通実装（依存性注入）:**

```typescript
// src/client/DynamoClient.ts

export type AuthHeadersGetter = (
  endpoint: string,
  body: string,
  authOptions?: any
) => Promise<Record<string, string>>;

export class DynamoClient<TAuthOptions = any> {
  constructor(
    endpoint: string,
    options: ClientOptions<TAuthOptions> | undefined,
    getAuthHeaders: AuthHeadersGetter  // ★ 認証ハンドラーを注入
  ) {
    this.endpoint = endpoint;
    this.options = options;
    this.getAuthHeaders = getAuthHeaders;
  }
  
  async connect(): Promise<void> {
    // Cognito認証の場合、トークンを取得
    const auth = this.options?.auth as any;
    if (auth?.type === 'cognito' && auth.getToken) {
      this.authToken = await auth.getToken();
    }
    this.connected = true;
  }
  
  db(name: string): Database<TAuthOptions> {
    return new Database<TAuthOptions>(
      this.endpoint,
      name,
      this.authToken,
      this.options?.auth,
      this.options,
      this.getAuthHeaders  // ★ 認証ハンドラーを渡す
    );
  }
}
```

**使用方法:**

```typescript
// IAM認証（Lambda環境）
import { DynamoClient } from '@ainews/core/client/iam';

const client = new DynamoClient(FUNCTION_URL, {
  auth: { region: 'us-east-1' }
});

// Cognito認証（Webアプリ）
import { DynamoClient } from '@ainews/core/client/cognito';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    getToken: async () => {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    }
  }
});

// Token認証（テスト環境）
import { DynamoClient } from '@ainews/core/client/token';

const client = new DynamoClient(FUNCTION_URL, {
  auth: { token: 'test-token' }
});
```

**パッケージエクスポート:**

```json
// package.json
{
  "exports": {
    "./client": "./dist/client/index.js",
    "./client/iam": "./dist/client/index.iam.js",
    "./client/cognito": "./dist/client/index.cognito.js",
    "./client/token": "./dist/client/index.token.js"
  }
}
```

**コード共通化の成果:**
- ビジネスロジック: Collection、Database、DynamoClient、FindCursorが100%共通化
- 認証方式別コード: 各50行程度（IAM、Cognito、Token）
- 重複コード: 0行

### Collection

```typescript
// src/client/Collection.ts

export class Collection<TSchema = any> {
  /**
   * ドキュメントを検索
   */
  find(filter: Filter<TSchema> = {}, options?: FindOptions): FindCursor<TSchema> {
    return new FindCursor<TSchema>(
      this.endpoint,
      this.database,
      this.collectionName,
      filter,
      options,
      this.authToken
    );
  }
  
  /**
   * 単一ドキュメントを挿入
   */
  async insertOne(document: TSchema): Promise<InsertOneResult> {
    const response = await this.request('insertOne', { document });
    return {
      acknowledged: true,
      insertedId: response.insertedId,
    };
  }
  
  /**
   * 複数ドキュメントを更新
   */
  async updateMany(
    filter: Filter<TSchema>,
    update: UpdateOperators<TSchema>
  ): Promise<UpdateResult> {
    const response = await this.request('updateMany', { filter, update });
    return {
      acknowledged: true,
      matchedCount: response.matchedCount,
      modifiedCount: response.modifiedCount,
    };
  }
}
```

### FindCursor

```typescript
// src/client/FindCursor.ts

export class FindCursor<TSchema = any> {
  /**
   * ソート条件を設定
   */
  sort(sort: Record<string, 1 | -1 | 'asc' | 'desc'>): this {
    this.options = { ...this.options, sort };
    return this;
  }
  
  /**
   * 取得件数を制限
   */
  limit(limit: number): this {
    this.options = { ...this.options, limit };
    return this;
  }
  
  /**
   * 配列として取得
   */
  async toArray(): Promise<TSchema[]> {
    if (!this.executed) {
      await this.execute();
    }
    return this.results;
  }
}
```

## 型定義

```typescript
// src/types.ts

/**
 * フィルタ演算子（$プレフィックスなし）
 */
export interface FilterOperators<T> {
  eq?: T;           // 等しい
  ne?: T;           // 等しくない
  gt?: T;           // より大きい
  gte?: T;          // 以上
  lt?: T;           // より小さい
  lte?: T;          // 以下
  in?: T[];         // いずれかに一致
  nin?: T[];        // いずれにも一致しない
  exists?: boolean; // フィールドの存在チェック
  regex?: string | RegExp; // 正規表現マッチ
}

/**
 * フィルタ定義
 */
export type Filter<T> = {
  [P in keyof T]?: T[P] | FilterOperators<T[P]>;
} & {
  and?: Filter<T>[];  // AND条件
  or?: Filter<T>[];   // OR条件
};

/**
 * 更新演算子（$プレフィックスなし）
 */
export interface UpdateOperators<T> {
  set?: Partial<T>;                    // フィールドを設定
  unset?: (keyof T)[];                 // フィールドを削除
  inc?: Partial<Record<keyof T, number>>; // 数値をインクリメント
}

/**
 * バルク操作の統一レスポンス形式（Records Lambda内部形式）
 */
export interface BulkOperationResult {
  /** 成功件数 */
  count: number;
  /** 成功したレコードのインデックスとID（{ 0: 'A', 2: 'C' }） */
  successIds: Record<number, string>;
  /** 失敗したレコードのインデックスとID（{ 1: 'B' }） */
  failedIds: Record<number, string>;
  /** エラー情報（インデックスをキーとする）（{ 1: { code: '...', message: '...' } }） */
  errors: Record<number, { id: string; code: string; message: string }>;
}

/**
 * MongoDB互換のinsertMany結果
 */
export interface InsertManyResult {
  acknowledged: boolean;
  insertedCount: number;
  insertedIds: Record<number, string>;
}

/**
 * MongoDB互換のupdateMany結果
 */
export interface UpdateResult {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
}

/**
 * MongoDB互換のdeleteMany結果
 */
export interface DeleteResult {
  acknowledged: boolean;
  deletedCount: number;
}
```

## バルク操作のレスポンス形式

### 設計原則

Records Lambdaは統一された内部形式でレスポンスを返却し、Collection.tsがMongoDB互換形式に変換します。

**Records Lambda（内部形式）:**
```typescript
{
  count: 2,                          // 成功件数
  successIds: { 0: 'A', 2: 'C' },   // 成功したレコードのインデックスとID
  failedIds: { 1: 'B' },             // 失敗したレコードのインデックスとID
  errors: {                          // エラー情報
    1: { id: 'B', code: 'VALIDATION_ERROR', message: '...' }
  }
}
```

**Collection.ts（MongoDB互換形式）:**
```typescript
// insertMany
{
  acknowledged: true,
  insertedCount: 2,
  insertedIds: { 0: 'A', 2: 'C' }  // successIdsをそのまま使用
}

// updateMany
{
  acknowledged: true,
  matchedCount: 3,      // successIds + failedIds の合計
  modifiedCount: 2      // successIds の件数
}

// deleteMany
{
  acknowledged: true,
  deletedCount: 2       // successIds の件数
}
```

### 利点

1. **情報の保持**: Records Lambdaは統一形式で全情報を保持（successIds, failedIds, errors）
2. **MongoDB互換性**: Collection.tsがMongoDB互換形式に変換
3. **情報の欠落なし**: Records Lambdaの統一形式から変換するため、情報は欠落しない
4. **拡張性**: 将来的に拡張情報（failedIds, errors）を提供するオプションを追加可能

## 使用例

### Webアプリ（Cognito認証）

```typescript
// apps/admin/src/dataProvider.ts

import { DynamoClient } from '@ainews/core/client/cognito';
import { Auth } from 'aws-amplify';
import type { Article } from '@ainews/api-types';

const FUNCTION_URL = import.meta.env.VITE_FUNCTION_URL;

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    getToken: async () => {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    },
  },
});

await client.connect();

const db = client.db('ainews');
const articles = db.collection<Article>('articles');

// MongoDB風のクエリ
const results = await articles
  .find({ status: 'published', publishedAt: { gte: '2025-01-01' } })
  .sort({ publishedAt: 'desc' })
  .limit(10)
  .toArray();

// 更新
await articles.updateMany(
  { status: 'draft' },
  { set: { status: 'published', publishedAt: new Date().toISOString() } }
);
```

### Lambda（IAM認証）

```typescript
// functions/fetch/src/handler.ts

import { DynamoClient } from '@ainews/core/client/iam';
import type { Article } from '@ainews/api-types';

const FUNCTION_URL = process.env.RECORDS_FUNCTION_URL!;

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    region: process.env.AWS_REGION!,
  },
});

await client.connect();

const db = client.db('ainews');
const articles = db.collection<Article>('articles');

// 一括挿入
const results = await articles.insertMany([
  { 
    title: 'Article 1', 
    content: 'Content 1',
    status: 'published',
    publishedAt: new Date().toISOString(),
  },
  { 
    title: 'Article 2', 
    content: 'Content 2',
    status: 'draft',
  },
]);

console.log(`Inserted ${results.insertedCount} articles`);
```

## Lambda側の実装

### シャドウレコード生成

```typescript
// packages/core/src/server/shadow/generator.ts

/**
 * シャドーレコードを生成（定義されたフィールドのみ）
 * 
 * undefined/nullの値も空文字として扱い、シャドーレコードを生成します。
 * これにより、必須でないフィールドでもソート可能になります。
 */
export function generateShadowRecords(
  record: any,
  schema: ShadowSchema
): ShadowRecord[] {
  const shadows: ShadowRecord[] = [];
  
  for (const [fieldName, fieldDef] of Object.entries(schema.sortableFields)) {
    const value = record[fieldName];
    
    // undefined/nullも空文字として扱う
    const normalizedValue = normalizeValue(value, fieldDef.type);
    const sk = `${fieldName}#${normalizedValue}#id#${record.id}`;
    
    shadows.push({
      PK: schema.resource,
      SK: sk,
      data: { id: record.id },
    });
  }
  
  return shadows;
}

function normalizeValue(value: any, type: ShadowFieldType): string {
  // undefined/nullの場合は空文字を返す
  if (value === undefined || value === null) {
    return '';
  }
  
  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return String(value).padStart(20, '0');
    case 'datetime':
      return value;
    case 'boolean':
      return value ? '1' : '0';
  }
}
```

### Records Lambda実装

Records Lambdaは以下のバルク操作を実装しています:

- **insertMany**: 複数レコードの一括作成（TransactWriteItems使用）
- **updateMany**: 複数レコードの一括更新（JSON Merge Patch形式）
- **deleteMany**: 複数レコードの一括削除

各操作は以下の共通パターンに従います:

1. 準備段階: レコードデータの検証とシャドウSK生成
2. チャンク分割: DynamoDBの制限（100アイテム/トランザクション）に対応
3. 順次実行: 各チャンクをTransactWriteItemsで実行
4. 部分失敗ハンドリング: 成功/失敗を個別に追跡

詳細は `functions/records/src/operations/` を参照してください。

#### undefined/null値の処理

必須でないフィールド（オプショナルフィールド）でもソート可能にするため、undefined/null値は空文字として扱います。

**生成例:**

```typescript
// 通常の値
const record1 = {
  id: '01HZXY123',
  price: 1000,
  publishedAt: '2025-11-21T10:00:00.000Z'
};
// => シャドウSK: 'price#00000000000000001000#id#01HZXY123'
// => シャドウSK: 'publishedAt#2025-11-21T10:00:00.000Z#id#01HZXY123'

// undefined/nullの値
const record2 = {
  id: '01HZXY456',
  price: null,
  publishedAt: undefined
};
// => シャドウSK: 'price##id#01HZXY456'
// => シャドウSK: 'publishedAt##id#01HZXY456'
```

**ソート順:**
- 空文字（undefined/null）は辞書順で最初にソートされます
- これにより、「値が設定されていないレコード」を先頭または末尾に配置できます

**利点:**
- オプショナルフィールドでもソート可能
- 「未設定」のレコードを簡単にフィルタリング可能
- データの欠損を明示的に扱える

## シャドウ管理パッケージ（統合）

### 概要

`@exabugs/dynamodb-client/shadows` は、DynamoDB Single-Table設計におけるシャドウレコード管理の完全な実装を提供します。このパッケージは、既存の `@ainews/shadows` パッケージの機能を統合し、OSSライブラリとして提供します。

### 主要機能

#### 1. シャドウSK生成

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

#### 2. シャドウ差分計算

```typescript
import { calculateShadowDiff } from '@exabugs/dynamodb-client/shadows';

const oldKeys = [
  'name#Old#Name#id#01HZXY123',
  'priority#00000000000000000010#id#01HZXY123',
];

const newKeys = [
  'name#New#Name#id#01HZXY123',
  'priority#00000000000000000010#id#01HZXY123',
];

const diff = calculateShadowDiff(oldKeys, newKeys);
// => {
//   toDelete: ['name#Old#Name#id#01HZXY123'],
//   toAdd: ['name#New#Name#id#01HZXY123']
// }
```

#### 3. 設定ファイル読み込み

```typescript
import { loadShadowConfig, getAllShadowFields } from '@exabugs/dynamodb-client/shadows';

// shadow.config.jsonを読み込む（ファイルシステム）
const config = await loadShadowConfig('./shadow.config.json');

// SSM Parameter Storeから読み込む
const config = await loadShadowConfig('/ainews/dev/shadow-config');

// リソースの全シャドーフィールドを取得
const fields = getAllShadowFields(config, 'articles');
// => {
//   id: { type: 'string' },
//   name: { type: 'string' },
//   createdAt: { type: 'datetime' },
//   updatedAt: { type: 'datetime' },
//   priority: { type: 'number' }
// }
```

### エスケープルール

文字列値は以下のルールでエスケープされます：

- `#` → `##`
- スペース → `#`

例：
- `"Tech News"` → `"Tech#News"`
- `"AI#ML"` → `"AI##ML"`

### フォーマットルール

#### 数値フォーマット

- 20桁のゼロ埋め文字列に変換
- 負の数値は0として扱う
- 例: `123` → `"00000000000000000123"`

#### 日時フォーマット

- UTC ISO 8601形式を使用
- 例: `"2025-11-12T10:00:00.000Z"`

#### undefined/null値の処理

- undefined/null値は空文字として扱う
- シャドウSK: `"fieldName##id#recordId"`
- ソート順: 空文字は辞書順で最初にソートされる

### 型定義

```typescript
// シャドウフィールドの型
export type ShadowFieldType = 'string' | 'number' | 'datetime';

// シャドー設定のフィールド定義
export interface ShadowFieldConfig {
  type: ShadowFieldType;
}

// リソースごとのシャドー設定
export interface ResourceShadowConfig {
  sortDefaults: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  shadows: {
    [fieldName: string]: ShadowFieldConfig;
  };
  ttl?: {
    days: number;
  };
}

// shadow.config.jsonの全体構造
export interface ShadowConfig {
  $schemaVersion: string;
  resources: {
    [resourceName: string]: ResourceShadowConfig;
  };
}

// シャドー差分計算の結果
export interface ShadowDiff {
  toDelete: string[];
  toAdd: string[];
}
```

### 統合のメリット

1. **完全性**: シャドウ管理機能がライブラリに含まれ、外部依存が不要
2. **再利用性**: 他のプロジェクトでもシャドウ管理機能を利用可能
3. **保守性**: 単一パッケージで管理され、バージョン管理が容易
4. **OSS化**: 独立したライブラリとして公開可能
5. **100%互換性**: 既存の `@ainews/shadows` パッケージと完全互換

## Dynamic Shadow Management

### 概要

**Dynamic Shadow Management (動的シャドウ管理)** は、シャドウ設定の変更を検知し、データの整合性を保つ仕組みです。レコード作成時に設定バージョンと設定ハッシュをメタデータとして保存することで、設定変更後もデータの追跡と管理が可能になります。

### 設計原則

1. **設定変更の追跡**: すべてのレコードに `__configVersion` と `__configHash` を保存
2. **起動時のログ出力**: Lambda起動時に現在の設定情報をログに記録
3. **環境変数ベース**: `SHADOW_CONFIG` 環境変数からSHA-256ハッシュを生成

### 実装詳細

#### 設定メタデータ

各レコードには以下のメタデータが自動的に付与されます:

```typescript
{
  id: '01HZXY123',
  name: 'Example Record',
  // ... その他のフィールド
  __configVersion: '1.0.0',           // スキーマバージョン
  __configHash: 'a1b2c3d4...',        // 設定ハッシュ (SHA-256)
  __shadowKeys: ['field1#...', ...]   // シャドウキー一覧
}
```

#### 設定ハッシュの生成

```typescript
// functions/records/src/config.ts

export function getShadowConfigHash(): string {
  // 環境変数 SHADOW_CONFIG は Terraform により base64 エンコードされた JSON として設定される
  const configBase64 = process.env.SHADOW_CONFIG;
  if (!configBase64) {
    throw new Error('SHADOW_CONFIG environment variable is not set');
  }

  // SHA-256ハッシュを生成
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(configBase64).digest('hex');
  return hash;
}
```

#### 起動時のログ出力

Lambda起動時（コールドスタート時）に設定情報をログ出力:

```typescript
// functions/records/src/handler.ts

import { getSchemaVersion, getShadowConfigHash } from './config.js';

try {
  const schemaVersion = getSchemaVersion();
  const configHash = getShadowConfigHash();
  logger.info('Records Lambda started', {
    schemaVersion,
    configHash,
  });
} catch (error) {
  logger.warn('Failed to load shadow config at startup', {
    error: error instanceof Error ? error.message : String(error),
  });
}
```

#### レコード作成時のメタデータ追加

```typescript
// functions/records/src/operations/insertOne.ts
// functions/records/src/operations/insertMany.ts

import { getSchemaVersion, getShadowConfigHash } from '../config.js';

// レコードデータを構築
let recordData = addCreateTimestamps({ ...params.data, id });
recordData = addTTL(resource, recordData);

// 設定メタデータを追加（要件: 11.12）
recordData.__configVersion = getSchemaVersion();
recordData.__configHash = getShadowConfigHash();
```

### ユースケース

#### 1. 設定変更の検知

設定変更後、古い設定で作成されたレコードを特定:

```typescript
// 特定のハッシュで作成されたレコードを検索
const oldRecords = await collection.find({
  __configHash: 'old-hash-value'
}).toArray();
```

#### 2. マイグレーションの実行

設定変更時、影響を受けるレコードを更新:

```typescript
// 古い設定のレコードを新しい設定で更新
const result = await collection.updateMany(
  { __configHash: { ne: currentHash } },
  { set: { needsMigration: true } }
);
```

#### 3. デバッグとトラブルシューティング

Lambda起動ログでデプロイされた設定を確認:

```json
{
  "timestamp": "2025-01-19T10:00:00.000Z",
  "level": "info",
  "message": "Records Lambda started",
  "schemaVersion": "1.0.0",
  "configHash": "a1b2c3d4e5f6..."
}
```

### テスト

動的シャドウ管理の動作を検証するテスト:

```typescript
// __tests__/operations/shadowConfig.test.ts

describe('Shadow Config Metadata', () => {
  it('should add __configVersion and __configHash to the record', async () => {
    await handleInsertOne('articles', { data: { title: 'Test' } }, 'req-1');
    
    const putCommand = dbClient.send.mock.calls[0][0];
    const item = putCommand.input.Item;
    
    expect(item.data.__configVersion).toBe('1.0.0');
    expect(item.data.__configHash).toBe('test-hash');
  });
});
```

## メリット

1. **セキュリティ**: DynamoDB権限を持つのはLambdaのみ
2. **一貫性**: 全てのDynamoDB操作が一箇所に集約
3. **保守性**: ビジネスロジックがLambda側に集約
4. **型安全性**: TypeScript型定義がSingle Source of Truth
5. **自動化**: 型定義からshadow.config.jsonを自動生成
6. **シンプル**: $プレフィックスなしの直感的なAPI
7. **テスト容易性**: HTTPクライアントなのでモックが簡単
8. **設定変更追跡**: Dynamic Shadow Managementにより設定変更を追跡可能

