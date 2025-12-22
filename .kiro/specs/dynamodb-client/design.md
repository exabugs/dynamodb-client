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


## 自動シャドウ化（v0.3.0以降）

### 概要

v0.3.0以降、シャドウレコードの生成が完全に自動化されました。各レコードは、そのレコードに実際に存在するプリミティブ型フィールドのみを自動的にシャドウ化します。

### 設計原則

1. **設定ファイル不要**: `shadow.config.json`の手動メンテナンスが不要
2. **レコードごとに独立**: 各レコードが持つフィールドのみをシャドウ化
3. **型に基づく自動判定**: フィールドの型を実行時に判定してシャドウ化
4. **id フィールドの除外**: v0.3.6以降、`id`フィールドはシャドウ化しない

### 自動シャドウ化のルール

```typescript
/**
 * 自動シャドウ化の判定ロジック
 */
function shouldGenerateShadow(fieldName: string, value: any): boolean {
  // 1. 内部メタデータフィールドは除外
  if (fieldName.startsWith('__')) {
    return false;
  }
  
  // 2. id フィールドは除外（v0.3.6以降）
  if (fieldName === 'id') {
    return false;
  }
  
  // 3. null/undefined は除外
  if (value === null || value === undefined) {
    return false;
  }
  
  // 4. プリミティブ型と複合型をシャドウ化
  const type = typeof value;
  return (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    Array.isArray(value) ||
    (type === 'object' && value instanceof Date) ||
    (type === 'object' && !Array.isArray(value))
  );
}
```

### フィールド型の処理

#### プリミティブ型

| 型 | 処理 | 切り詰め |
|---|---|---|
| string | そのまま使用 | 100バイト（UTF-8） |
| number | オフセット + ゼロパディング | なし |
| boolean | "0" または "1" に変換 | なし |
| datetime | ISO 8601形式 | なし |

#### 複合型

| 型 | 処理 | 切り詰め |
|---|---|---|
| array | JSON文字列化 | 200バイト（UTF-8） |
| object | JSON文字列化 | 200バイト（UTF-8） |

### 数値のオフセット方式

負数を含む数値を文字列としてソート可能にするため、オフセット方式を採用：

```typescript
/**
 * 数値のフォーマット
 * 
 * @param value - 数値（-10^20 ～ +10^20）
 * @returns 20桁のゼロパディング文字列
 */
function formatNumber(value: number): string {
  const OFFSET = 1e20; // 10^20
  const PADDING = 20;
  
  if (value < -OFFSET || value > OFFSET) {
    throw new Error(`Number out of range: ${value}`);
  }
  
  const offsetValue = value + OFFSET;
  return offsetValue.toString().padStart(PADDING, '0');
}

// 例:
// -100 → "09999999999999999900"
//    0 → "10000000000000000000"
//  100 → "10000000000000000100"
```

### 文字列の切り詰め処理

マルチバイト文字の境界を考慮した切り詰め：

```typescript
/**
 * UTF-8バイト数を考慮した文字列切り詰め
 * 
 * @param str - 元の文字列
 * @param maxBytes - 最大バイト数
 * @returns 切り詰められた文字列
 */
function truncateString(str: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  if (bytes.length <= maxBytes) {
    return str;
  }
  
  // マルチバイト文字の境界を考慮
  let truncated = str;
  while (encoder.encode(truncated).length > maxBytes) {
    truncated = truncated.slice(0, -1);
  }
  
  return truncated;
}
```

### JSONフィールドの正規化

レコード保存時にJSONフィールドの順序を正規化：

```typescript
/**
 * JSONフィールドの正規化
 * 
 * 順序:
 * 1. id（先頭）
 * 2. その他のフィールド（アルファベット順）
 * 3. createdAt（末尾）
 * 4. updatedAt（末尾）
 */
function normalizeJson(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(normalizeJson);
  }
  
  const { id, createdAt, updatedAt, ...rest } = obj;
  const sorted = Object.keys(rest)
    .sort()
    .reduce((acc, key) => {
      acc[key] = normalizeJson(rest[key]);
      return acc;
    }, {} as any);
  
  return {
    ...(id !== undefined && { id }),
    ...sorted,
    ...(createdAt !== undefined && { createdAt }),
    ...(updatedAt !== undefined && { updatedAt }),
  };
}
```

### 環境変数による設定

```bash
# 文字列の最大バイト数（デフォルト: 100）
SHADOW_STRING_MAX_BYTES=100

# 数値のパディング桁数（デフォルト: 20）
SHADOW_NUMBER_PADDING=20
```

### 後方互換性

- 既存のレコードは更新時に自動的に新しい方式でシャドウレコードが生成される
- 古いシャドウレコードは削除され、新しいシャドウレコードが作成される
- クエリは新しいシャドウレコード形式を使用する

## OSS化の設計

### 概要

dynamodb-clientライブラリは、ainews-pipelineから独立した汎用的なOSSライブラリとして設計されています。

### パッケージ構造

```
@exabugs/dynamodb-client/
├── src/                    # ソースコード
│   ├── client/             # クライアント SDK
│   ├── server/             # サーバー実装
│   ├── shadows/            # シャドウ管理
│   └── types.ts            # 共通型定義
├── __tests__/              # テストコード
├── docs/                   # ドキュメント
│   ├── README.md           # メインドキュメント
│   ├── API.md              # API リファレンス
│   └── ARCHITECTURE.md     # アーキテクチャ
├── terraform/              # Terraform モジュール（オプション）
├── package.json
├── tsconfig.json
├── LICENSE                 # MIT ライセンス
└── README.md
```

### npm公開設定

```json
// package.json
{
  "name": "@exabugs/dynamodb-client",
  "version": "0.3.6",
  "description": "DynamoDB Single-Table Design Client with MongoDB-like API",
  "keywords": [
    "dynamodb",
    "single-table",
    "mongodb",
    "aws",
    "client",
    "shadow-records"
  ],
  "author": "exabugs",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/exabugs/dynamodb-client.git"
  },
  "bugs": {
    "url": "https://github.com/exabugs/dynamodb-client/issues"
  },
  "homepage": "https://github.com/exabugs/dynamodb-client#readme",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client/index.js",
    "./server": "./dist/index.js",
    "./shadows": "./dist/shadows/index.js",
    "./types": "./dist/types.js"
  },
  "types": "./dist/index.d.ts"
}
```

### CI/CD設定

GitHub Actionsによる自動テスト・ビルド・公開：

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run lint

  publish:
    needs: test
    if: github.event_name == 'push' && 
        github.ref == 'refs/heads/main' && 
        contains(github.event.head_commit.message, '[publish]')
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### npm Trusted Publishing

- npm Trusted Publishingを使用してセキュアに公開
- CI Workflow (`.github/workflows/ci.yml`) のみがnpmへのパブリッシュを許可
- `NPM_TOKEN`シークレットは不要（OIDCトークンで認証）

### バージョニング戦略

セマンティックバージョニング（SemVer）に従う：

- **MAJOR**: 破壊的変更（例: 0.x.x → 1.0.0）
- **MINOR**: 後方互換な機能追加（例: 0.3.x → 0.4.0）
- **PATCH**: 後方互換なバグ修正（例: 0.3.5 → 0.3.6）

### 国際化対応

- すべてのドキュメントは英語で記述
- JSDocコメントは英語で記述
- エラーメッセージは英語で記述
- コード内コメントは英語で記述

### ライセンス

MIT ライセンスを採用：

```
MIT License

Copyright (c) 2024 exabugs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## まとめ

DynamoDBクライアントライブラリは、以下の特徴を持つ汎用的なOSSライブラリです：

1. **自動シャドウ化**: v0.3.0以降、設定ファイル不要で自動的にシャドウレコードを生成
2. **型安全性**: TypeScript型定義がSingle Source of Truth
3. **MongoDB風API**: 学習コストが低く、直感的なAPI
4. **セキュリティ**: DynamoDB操作をLambda経由でのみ実行
5. **OSS化**: npm公開可能な汎用的なライブラリ構造
6. **CI/CD**: GitHub Actionsによる自動テスト・ビルド・公開
7. **国際化**: 英語ドキュメントとエラーメッセージ
8. **MITライセンス**: 商用利用可能なオープンソースライセンス

## アーキテクチャリファクタリング設計

### 概要

コードベースの保守性と拡張性を向上させるため、以下の原則に基づいてアーキテクチャをリファクタリングします。

### 設計原則

#### 1. 単一責任の原則（Single Responsibility Principle）

各モジュール・クラス・関数は1つの責任のみを持つ：

```
src/
├── client/                    # クライアントSDK（責任：HTTPクライアント）
│   ├── core/                  # コアロジック
│   │   ├── DynamoClient.ts    # 接続管理
│   │   ├── Database.ts        # データベース操作
│   │   └── Collection.ts      # コレクション操作
│   ├── query/                 # クエリ構築
│   │   ├── FilterBuilder.ts   # フィルタ構築
│   │   ├── SortBuilder.ts     # ソート構築
│   │   └── FindCursor.ts      # カーソル管理
│   ├── auth/                  # 認証処理
│   │   ├── IAMAuth.ts         # IAM認証
│   │   ├── CognitoAuth.ts     # Cognito認証
│   │   └── TokenAuth.ts       # Token認証
│   └── utils/                 # クライアント用ユーティリティ
│       ├── http.ts            # HTTP通信
│       └── validation.ts      # バリデーション
├── server/                    # サーバーサイド実装（責任：DynamoDB操作）
│   ├── handlers/              # リクエストハンドラー
│   │   ├── handler.ts         # メインハンドラー
│   │   └── middleware.ts      # ミドルウェア
│   ├── operations/            # CRUD操作
│   │   ├── create.ts          # 作成操作
│   │   ├── read.ts            # 読み取り操作
│   │   ├── update.ts          # 更新操作
│   │   └── delete.ts          # 削除操作
│   ├── query/                 # クエリ変換
│   │   ├── converter.ts       # フィルタ変換
│   │   └── optimizer.ts       # クエリ最適化
│   ├── shadow/                # シャドウ管理
│   │   ├── generator.ts       # シャドウ生成
│   │   ├── differ.ts          # 差分計算
│   │   └── manager.ts         # シャドウ管理
│   └── utils/                 # サーバー用ユーティリティ
│       ├── dynamodb.ts        # DynamoDB操作
│       ├── validation.ts      # バリデーション
│       └── config.ts          # 設定管理
├── shadows/                   # シャドウ管理パッケージ（責任：シャドウロジック）
│   ├── core/                  # コアロジック
│   │   ├── generator.ts       # SK生成
│   │   ├── differ.ts          # 差分計算
│   │   └── formatter.ts       # 値フォーマット
│   ├── config/                # 設定管理
│   │   ├── loader.ts          # 設定読み込み
│   │   └── validator.ts       # 設定検証
│   └── utils/                 # シャドウ用ユーティリティ
│       ├── escape.ts          # エスケープ処理
│       └── truncate.ts        # 切り詰め処理
├── shared/                    # 共通モジュール（責任：共通ロジック）
│   ├── types/                 # 型定義
│   │   ├── client.ts          # クライアント型
│   │   ├── server.ts          # サーバー型
│   │   └── common.ts          # 共通型
│   ├── errors/                # エラー定義
│   │   ├── ClientError.ts     # クライアントエラー
│   │   ├── ServerError.ts     # サーバーエラー
│   │   └── ValidationError.ts # バリデーションエラー
│   ├── constants/             # 定数定義
│   │   ├── http.ts            # HTTP定数
│   │   └── dynamodb.ts        # DynamoDB定数
│   └── utils/                 # 共通ユーティリティ
│       ├── logger.ts          # ログ出力
│       ├── ulid.ts            # ID生成
│       └── validation.ts      # 共通バリデーション
└── integrations/              # 外部統合（責任：外部ライブラリ統合）
    └── react-admin/           # react-admin統合
        ├── dataProvider.ts    # データプロバイダー
        └── authProvider.ts    # 認証プロバイダー
```

#### 2. 依存関係の整理

依存方向を一方向に整理：

```
┌─────────────────┐
│  integrations/  │ (最上位層)
└─────────────────┘
         ↓
┌─────────────────┐
│    client/      │ (クライアント層)
└─────────────────┘
         ↓
┌─────────────────┐
│    server/      │ (サーバー層)
└─────────────────┘
         ↓
┌─────────────────┐
│   shadows/      │ (シャドウ層)
└─────────────────┘
         ↓
┌─────────────────┐
│    shared/      │ (共通層・最下位層)
└─────────────────┘
```

**ルール**:
- 上位層は下位層に依存可能
- 下位層は上位層に依存禁止
- 同一層内での循環依存禁止

#### 3. 関数の分割基準

**分割対象**:
- 50行を超える関数
- 複数の責任を持つ関数
- 複雑な条件分岐を持つ関数

**分割例**:

```typescript
// ❌ 悪い例: 複数の責任を持つ大きな関数
async function processRecord(record: any, config: ShadowConfig): Promise<void> {
  // バリデーション (責任1)
  if (!record.id) throw new Error('ID is required');
  if (!record.name) throw new Error('Name is required');
  
  // タイムスタンプ追加 (責任2)
  record.createdAt = new Date().toISOString();
  record.updatedAt = record.createdAt;
  
  // シャドウレコード生成 (責任3)
  const shadows = [];
  for (const [field, fieldConfig] of Object.entries(config.sortableFields)) {
    const value = record[field];
    if (value !== undefined) {
      const sk = `${field}#${formatValue(value, fieldConfig.type)}#id#${record.id}`;
      shadows.push({ PK: config.resource, SK: sk, data: { id: record.id } });
    }
  }
  
  // DynamoDB保存 (責任4)
  await dynamoClient.transactWrite({
    TransactItems: [
      { Put: { TableName: TABLE_NAME, Item: record } },
      ...shadows.map(shadow => ({ Put: { TableName: TABLE_NAME, Item: shadow } }))
    ]
  }).promise();
}

// ✅ 良い例: 責任ごとに分割された関数
async function processRecord(record: any, config: ShadowConfig): Promise<void> {
  const validatedRecord = validateRecord(record);
  const timestampedRecord = addTimestamps(validatedRecord);
  const shadows = generateShadowRecords(timestampedRecord, config);
  await saveRecordWithShadows(timestampedRecord, shadows);
}

function validateRecord(record: any): any {
  if (!record.id) throw new ValidationError('ID is required');
  if (!record.name) throw new ValidationError('Name is required');
  return record;
}

function addTimestamps(record: any): any {
  const now = new Date().toISOString();
  return { ...record, createdAt: now, updatedAt: now };
}

function generateShadowRecords(record: any, config: ShadowConfig): ShadowRecord[] {
  // シャドウレコード生成ロジック
}

async function saveRecordWithShadows(record: any, shadows: ShadowRecord[]): Promise<void> {
  // DynamoDB保存ロジック
}
```

#### 4. 共通ロジックの抽出

**抽出対象**:
- 3回以上繰り返されるロジック
- 複数のモジュールで使用される処理
- 設定値やマジックナンバー

**抽出例**:

```typescript
// ❌ 悪い例: 重複したロジック
// client/Collection.ts
const timeout = 15 * 60 * 1000; // 15分

// server/operations/create.ts  
const timeout = 15 * 60 * 1000; // 15分

// server/operations/update.ts
const timeout = 15 * 60 * 1000; // 15分

// ✅ 良い例: 共通定数として抽出
// shared/constants/http.ts
export const HTTP_TIMEOUT_MS = 15 * 60 * 1000; // 15分
export const BATCH_SIZE = 100;
export const MAX_RETRIES = 3;

// 使用箇所
import { HTTP_TIMEOUT_MS } from '../../shared/constants/http.js';
```

#### 5. エラーハンドリングの統一

**統一されたエラー階層**:

```typescript
// shared/errors/BaseError.ts
export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(message: string, public readonly context?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

// shared/errors/ClientError.ts
export class ClientError extends BaseError {
  readonly code = 'CLIENT_ERROR';
  readonly statusCode = 400;
}

// shared/errors/ValidationError.ts
export class ValidationError extends ClientError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

// shared/errors/ServerError.ts
export class ServerError extends BaseError {
  readonly code = 'SERVER_ERROR';
  readonly statusCode = 500;
}
```

**統一されたエラーハンドリングパターン**:

```typescript
// shared/utils/errorHandler.ts
export function handleError(error: unknown): BaseError {
  if (error instanceof BaseError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ServerError(error.message, { originalError: error });
  }
  
  return new ServerError('Unknown error occurred', { originalError: error });
}

// 使用例
try {
  await someOperation();
} catch (error) {
  const handledError = handleError(error);
  logger.error(handledError.message, {
    code: handledError.code,
    context: handledError.context
  });
  throw handledError;
}
```

#### 6. ログ出力の構造化

**統一されたログ形式**:

```typescript
// shared/utils/logger.ts
export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  resource?: string;
  [key: string]: any;
}

export class Logger {
  info(message: string, context?: LogContext): void {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...context
    }));
  }
  
  error(message: string, context?: LogContext): void {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      ...context
    }));
  }
}

// 使用例
const logger = new Logger();
logger.info('Record created successfully', {
  requestId: 'req-123',
  operation: 'createRecord',
  resource: 'articles',
  recordId: 'art-456'
});
```

### リファクタリング計画

#### フェーズ1: 共通モジュールの抽出

1. `shared/` ディレクトリの作成
2. 共通型定義の移動
3. 共通エラークラスの作成
4. 共通ユーティリティの抽出

#### フェーズ2: 依存関係の整理

1. 循環依存の特定と解消
2. 依存方向の一方向化
3. インターフェースの分離

#### フェーズ3: 関数の分割

1. 50行を超える関数の特定
2. 単一責任の原則に基づく分割
3. テストの更新

#### フェーズ4: 重複コードの削除

1. 重複ロジックの特定
2. 共通関数への抽出
3. 定数の共通化

#### フェーズ5: エラーハンドリングの統一

1. 統一されたエラー階層の実装
2. エラーハンドリングパターンの適用
3. ログ出力の構造化

### 期待される効果

1. **保守性の向上**: 明確な責任分離により、変更の影響範囲が限定される
2. **テスト容易性**: 小さな関数により、単体テストが書きやすくなる
3. **再利用性**: 共通ロジックの抽出により、コードの再利用が促進される
4. **可読性の向上**: 構造化されたコードにより、理解が容易になる
5. **拡張性**: 明確なアーキテクチャにより、新機能の追加が容易になる

## Find操作のリファクタリング設計

### 概要

`handleFind`関数は、複数の責任を持つ大きな関数（約400行）であり、単一責任の原則に従って以下の4つの独立した責任に分割されました。

### 現在の実装状況

既に`src/server/operations/find/`ディレクトリにモジュール化された実装が存在しています：

```
src/server/operations/find/
├── index.ts           # エクスポート定義
├── types.ts           # Find操作の型定義
├── utils.ts           # 共通ユーティリティ関数
├── idQuery.ts         # ID最適化クエリ実装
└── shadowQuery.ts     # シャドウレコードクエリ実装
```

### 責任分離の設計

#### 1. 設定とパラメータ初期化（utils.ts）

**責任**: Find操作のコンテキスト初期化と共通ユーティリティ

```typescript
/**
 * Find操作のコンテキストを初期化する
 * 
 * 処理内容:
 * - シャドー設定の読み込み
 * - ソート条件の正規化（デフォルト値適用）
 * - ページネーション条件の正規化
 * - フィルター条件の解析（拡張フィールド構文対応）
 */
export function initializeFindContext(
  resource: string,
  params: FindParams,
  requestId: string
): FindContext;
```

**主要機能**:
- `normalizeSort()`: ソート条件の正規化とデフォルト値適用
- `normalizePagination()`: ページネーション条件の正規化
- `parseFilters()`: フィルター条件の解析（拡張フィールド構文対応）
- `findOptimizableFilter()`: Query最適化可能なフィルター条件の検出
- `matchesAllFilters()`: メモリ内フィルタリングの実行

#### 2. ID最適化クエリ（idQuery.ts）

**責任**: `sort.field='id'`の場合の特別な処理

```typescript
/**
 * ID最適化クエリを実行する
 * 
 * 処理内容:
 * - 特定IDフィルターの検出と処理
 * - 本体レコードの直接Query（シャドウレコード不要）
 * - ページネーション対応
 * - メモリ内フィルタリング
 */
export async function executeIdOptimizedQuery(
  context: FindContext
): Promise<QueryExecutionResult>;
```

**最適化ポイント**:
- `id`フィールドは本体レコード（`SK = id#{ULID}`）として既に存在
- シャドウレコードを参照する必要がないため、直接Queryで高速取得
- `filter.id`が指定されている場合は、特定のIDのレコードを直接取得

#### 3. シャドウレコードクエリ（shadowQuery.ts）

**責任**: `sort.field != 'id'`の場合の通常のシャドウレコードクエリ

```typescript
/**
 * シャドウレコードクエリを実行する
 * 
 * 処理内容:
 * - Query最適化の適用（ソートフィールドと一致するフィルター条件）
 * - シャドウレコードのQuery実行
 * - 本体レコードのBatchGet実行
 * - レコード順序の保持（シャドウの順序で並べる）
 * - メモリ内フィルタリング
 */
export async function executeShadowQuery(
  context: FindContext
): Promise<QueryExecutionResult>;
```

**Query最適化**:
- ソートフィールドと一致するフィルター条件を`KeyConditionExpression`に含める
- 対応演算子: `eq`, `gt`, `gte`, `lt`, `lte`, `starts`
- 値のエンコード: 型に応じたシャドウSK形式への変換

#### 4. 結果処理とレスポンス生成（index.ts経由でhandler実装）

**責任**: クエリ結果の処理とレスポンス形式の統一

```typescript
/**
 * Find操作のメインハンドラー
 * 
 * 処理内容:
 * - コンテキストの初期化
 * - クエリタイプの判定（ID最適化 vs シャドウクエリ）
 * - 適切なクエリ実行関数の呼び出し
 * - レスポンス形式の統一
 * - エラーハンドリング
 */
export async function handleFind(
  resource: string,
  params: FindParams,
  requestId: string
): Promise<FindResult>;
```

### 型定義の統一（types.ts）

Find操作で使用される型定義を統一管理：

```typescript
/**
 * Find操作のコンテキスト
 */
export interface FindContext {
  resource: string;
  params: FindParams;
  requestId: string;
  shadowConfig: any;
  sort: { field: string; order: 'ASC' | 'DESC' };
  pagination: { perPage: number; nextToken?: string };
  parsedFilters: ParsedFilter[];
}

/**
 * クエリ実行結果の統一形式
 */
export interface QueryExecutionResult {
  items: any[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  nextToken?: string;
}
```

### リファクタリングの利点

#### 1. 単一責任の原則の実現

- **設定初期化**: パラメータの正規化とバリデーション
- **ID最適化**: 特別なケースの高速処理
- **シャドウクエリ**: 通常のソート処理
- **結果処理**: レスポンス形式の統一

#### 2. テスト容易性の向上

各責任を独立してテスト可能：

```typescript
// 設定初期化のテスト
describe('initializeFindContext', () => {
  it('should normalize sort conditions', () => {
    // テストコード
  });
});

// ID最適化クエリのテスト
describe('executeIdOptimizedQuery', () => {
  it('should handle specific ID filter', () => {
    // テストコード
  });
});

// シャドウクエリのテスト
describe('executeShadowQuery', () => {
  it('should apply query optimization', () => {
    // テストコード
  });
});
```

#### 3. 保守性の向上

- **変更の影響範囲が限定**: 各責任が独立しているため、変更時の影響が限定される
- **コードの理解が容易**: 各ファイルが特定の責任に集中している
- **デバッグが簡単**: 問題の発生箇所を特定しやすい

#### 4. 拡張性の向上

- **新しいクエリ最適化の追加**: `shadowQuery.ts`に集中して実装
- **新しいフィルター演算子の追加**: `utils.ts`の`matchesAllFilters`に追加
- **新しい認証方式の追加**: 既存のコードに影響なし

#### 5. パフォーマンスの向上

- **ID最適化**: シャドウレコードを経由しない高速クエリ
- **Query最適化**: DynamoDBのKeyConditionExpressionを活用
- **メモリ効率**: 必要な処理のみを実行

### 移行戦略

#### 現在の状況

- ✅ モジュール化された実装が既に存在（`find/`ディレクトリ）
- ✅ 型定義が統一されている（`types.ts`）
- ✅ 各責任が適切に分離されている

#### 次のステップ

1. **既存実装の検証**: 現在のモジュール化された実装をテストで検証
2. **統合テストの追加**: 各モジュール間の連携をテスト
3. **パフォーマンステスト**: ID最適化とQuery最適化の効果を測定
4. **ドキュメント更新**: 新しいアーキテクチャの説明を追加

#### 期待される成果

- **コード行数の削減**: 大きな関数の分割により、各関数が理解しやすいサイズに
- **テストカバレッジの向上**: 独立したテストにより、より詳細なテストが可能
- **バグの減少**: 責任の明確化により、バグの発生箇所を特定しやすく
- **開発速度の向上**: 新機能の追加や修正が容易に
