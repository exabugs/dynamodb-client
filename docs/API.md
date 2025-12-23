# API リファレンス

DynamoDB Client SDK の完全なAPIリファレンスです。MongoDB風のシンプルなAPIでDynamoDBを操作できます。

## 目次

- [インストール](#インストール)
- [認証方式](#認証方式)
  - [IAM認証（Node.js専用）](#iam認証nodejs専用)
  - [Cognito認証](#cognito認証)
  - [Token認証](#token認証)
- [基本的な使用方法](#基本的な使用方法)
- [クライアント API](#クライアント-api)
  - [DynamoClient](#dynamoclient)
  - [Database](#database)
  - [Collection](#collection)
  - [FindCursor](#findcursor)
- [型定義](#型定義)
  - [Filter](#filter)
  - [UpdateOperators](#updateoperators)
  - [FindOptions](#findoptions)
  - [結果型](#結果型)
- [react-admin統合](#react-admin統合)
- [エラーハンドリング](#エラーハンドリング)
- [ベストプラクティス](#ベストプラクティス)

## インストール

```bash
npm install @exabugs/dynamodb-client
```

## 認証方式

DynamoDB Client SDKは3つの認証方式をサポートしています。

### IAM認証（Node.js専用）

AWS IAM認証（SigV4署名）を使用します。Node.js環境専用です。

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';

const client = new DynamoClient('https://your-lambda-url.amazonaws.com', {
  auth: {
    region: 'ap-northeast-1', // AWSリージョン
  },
});

await client.connect();
const db = client.db();
```

**必要な環境変数:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`（一時的な認証情報の場合）

### Cognito認証

Amazon Cognito認証を使用します。トークンは動的に取得されます。

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/cognito';

const client = new DynamoClient('https://your-lambda-url.amazonaws.com', {
  auth: {
    getToken: async () => {
      // Cognito認証トークンを取得するロジック
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    },
  },
});

await client.connect();
const db = client.db();
```

### Token認証

固定の認証トークンを使用します。

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/token';

const client = new DynamoClient('https://your-lambda-url.amazonaws.com', {
  auth: {
    token: 'your-auth-token',
  },
});

await client.connect();
const db = client.db();
```

## 基本的な使用方法

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/cognito';

// 製品の型定義
interface Product {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// クライアントを作成
const client = new DynamoClient('https://your-lambda-url.amazonaws.com', {
  auth: {
    getToken: async () => 'your-auth-token',
  },
});

await client.connect();
const db = client.db();
const products = db.collection<Product>('products');

// レコードを検索
const activeProducts = await products
  .find({ status: 'active', price: { gte: 1000 } })
  .sort({ price: 'desc' })
  .limit(10)
  .toArray();

// レコードを作成
const result = await products.insertOne({
  name: 'New Product',
  price: 2000,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// レコードを更新
await products.updateOne(
  { id: result.insertedId },
  { set: { price: 2500, updatedAt: new Date().toISOString() } }
);

// レコードを削除
await products.deleteOne({ id: result.insertedId });

await client.close();
```

## クライアント API

### DynamoClient

Lambda Function URL経由でDynamoDBにアクセスするHTTPクライアントです。

#### コンストラクタ

```typescript
new DynamoClient<TAuthOptions>(
  endpoint: string,
  options: ClientOptions<TAuthOptions>,
  getAuthHeaders: AuthHeadersGetter<TAuthOptions>
)
```

**パラメータ:**
- `endpoint`: Lambda Function URL
- `options`: クライアントオプション
- `getAuthHeaders`: 認証ヘッダー取得関数（内部使用）

#### ClientOptions

```typescript
interface ClientOptions<TAuthOptions = unknown> {
  /** 認証設定 */
  auth?: TAuthOptions;
  /** 自動接続（デフォルト: false） */
  autoConnect?: boolean;
  /** タイムアウト（ミリ秒、デフォルト: 30000） */
  timeout?: number;
}
```

#### メソッド

##### connect()

```typescript
async connect(): Promise<void>
```

クライアントに接続します。Cognito認証の場合、トークンを取得します。

##### db()

```typescript
db(): Database<TAuthOptions>
```

データベースインスタンスを取得します。`connect()`を先に呼び出す必要があります。

##### close()

```typescript
async close(): Promise<void>
```

クライアント接続を閉じます。

##### isConnected()

```typescript
isConnected(): boolean
```

接続状態を確認します。

### Database

コレクションへのアクセスを提供します。

#### メソッド

##### collection()

```typescript
collection<TSchema extends ResultBase>(name: string): Collection<TSchema, TAuthOptions>
```

指定した名前のコレクションを取得します。

**パラメータ:**
- `name`: コレクション名

**型パラメータ:**
- `TSchema`: ドキュメントの型（`ResultBase`を継承）

### Collection

MongoDB風のCRUD操作を提供します。

#### 型パラメータ

```typescript
Collection<TSchema extends ResultBase = ResultBase, TAuthOptions = unknown>
```

- `TSchema`: コレクションのドキュメント型
- `TAuthOptions`: 認証オプションの型

#### 検索メソッド

##### find()

```typescript
find(filter?: Filter<TSchema>, options?: FindOptions): FindCursor<TSchema, TAuthOptions>
```

フィルタ条件に一致するドキュメントを検索します。FindCursorを返します。

**パラメータ:**
- `filter`: フィルタ条件（省略可）
- `options`: 検索オプション（省略可）

**例:**
```typescript
// 基本的な検索
const cursor = products.find({ status: 'active' });

// 複雑な条件
const cursor = products.find({
  status: 'active',
  price: { gte: 1000, lte: 5000 },
  category: { in: ['electronics', 'books'] }
});

// 論理演算子
const cursor = products.find({
  or: [
    { status: 'active' },
    { priority: { gte: 5 } }
  ]
});
```

##### findOne()

```typescript
async findOne(filter: Filter<TSchema>): Promise<TSchema | null>
```

フィルタ条件に一致する最初のドキュメントを取得します。

**パラメータ:**
- `filter`: フィルタ条件

**戻り値:**
- 見つかったドキュメント、または`null`

**例:**
```typescript
const product = await products.findOne({ id: 'product-123' });
if (product) {
  console.log(product.name);
}
```

##### findMany()

```typescript
async findMany(ids: string[]): Promise<TSchema[]>
```

指定したIDの配列に一致するドキュメントを取得します。

**パラメータ:**
- `ids`: IDの配列

**戻り値:**
- ドキュメントの配列

**例:**
```typescript
const products = await collection.findMany(['id1', 'id2', 'id3']);
```

#### 作成メソッド

##### insertOne()

```typescript
async insertOne(document: InputBase & Omit<TSchema, 'id'>): Promise<InsertOneResult>
```

単一のドキュメントを挿入します。

**パラメータ:**
- `document`: 挿入するドキュメント（`id`は省略可）

**戻り値:**
- 挿入結果

**例:**
```typescript
const result = await products.insertOne({
  name: 'New Product',
  price: 1000,
  status: 'active',
  createdAt: new Date().toISOString(),
});

console.log('Inserted ID:', result.insertedId);
```

##### insertMany()

```typescript
async insertMany(documents: (InputBase & Omit<TSchema, 'id'>)[]): Promise<InsertManyResult>
```

複数のドキュメントを一括挿入します。

**パラメータ:**
- `documents`: 挿入するドキュメントの配列

**戻り値:**
- 一括挿入結果

**例:**
```typescript
const result = await products.insertMany([
  { name: 'Product A', price: 1000, status: 'active' },
  { name: 'Product B', price: 2000, status: 'active' },
]);

console.log('Inserted count:', result.insertedCount);
console.log('Inserted IDs:', result.insertedIds);

// 部分失敗の場合
if (result.failedIds && result.failedIds.length > 0) {
  console.log('Failed IDs:', result.failedIds);
  console.log('Errors:', result.errors);
}
```

#### 更新メソッド

##### updateOne()

```typescript
async updateOne(
  filter: Filter<TSchema>,
  update: UpdateOperators<TSchema>
): Promise<UpdateResult>
```

フィルタ条件に一致する最初のドキュメントを更新します。

**パラメータ:**
- `filter`: フィルタ条件
- `update`: 更新操作

**戻り値:**
- 更新結果

**例:**
```typescript
const result = await products.updateOne(
  { id: 'product-123' },
  {
    set: { price: 1500, updatedAt: new Date().toISOString() },
    inc: { viewCount: 1 },
    unset: ['oldField']
  }
);

console.log('Matched:', result.matchedCount);
console.log('Modified:', result.modifiedCount);
```

##### updateMany()

```typescript
async updateMany(
  filter: Filter<TSchema>,
  update: UpdateOperators<TSchema>
): Promise<UpdateResult>
```

フィルタ条件に一致するすべてのドキュメントを更新します。

**パラメータ:**
- `filter`: フィルタ条件
- `update`: 更新操作

**戻り値:**
- 更新結果

**例:**
```typescript
const result = await products.updateMany(
  { status: 'draft' },
  { set: { status: 'active', updatedAt: new Date().toISOString() } }
);

console.log('Updated count:', result.modifiedCount);
```

#### 削除メソッド

##### deleteOne()

```typescript
async deleteOne(filter: Filter<TSchema>): Promise<DeleteResult>
```

フィルタ条件に一致する最初のドキュメントを削除します。

**パラメータ:**
- `filter`: フィルタ条件

**戻り値:**
- 削除結果

**例:**
```typescript
const result = await products.deleteOne({ id: 'product-123' });
console.log('Deleted count:', result.deletedCount);
```

##### deleteMany()

```typescript
async deleteMany(filter: Filter<TSchema>): Promise<DeleteResult>
```

フィルタ条件に一致するすべてのドキュメントを削除します。

**パラメータ:**
- `filter`: フィルタ条件

**戻り値:**
- 削除結果

**例:**
```typescript
const result = await products.deleteMany({ status: 'inactive' });
console.log('Deleted count:', result.deletedCount);
```

### FindCursor

MongoDB風のカーソルAPIを提供します。メソッドチェーンでソート、制限、スキップを設定できます。

#### メソッド

##### sort()

```typescript
sort(sort: Record<string, 1 | -1 | 'asc' | 'desc'>): this
```

ソート条件を設定します。

**パラメータ:**
- `sort`: ソート条件

**例:**
```typescript
// 単一フィールドでソート
cursor.sort({ price: 'desc' });

// 複数フィールドでソート（オブジェクトのキー順序で優先度が決まる）
cursor.sort({ priority: 'desc', createdAt: 'asc' });

// 数値形式でも指定可能
cursor.sort({ price: -1, createdAt: 1 });
```

##### limit()

```typescript
limit(limit: number): this
```

取得件数を制限します。

**パラメータ:**
- `limit`: 取得件数（正の整数）

**例:**
```typescript
cursor.limit(10); // 最初の10件を取得
```

##### skip()

```typescript
skip(skip: number): this
```

スキップする件数を設定します。

**パラメータ:**
- `skip`: スキップする件数（0以上の整数）

**例:**
```typescript
cursor.skip(20); // 最初の20件をスキップ

// ページネーション（3ページ目、1ページ10件）
cursor.skip(20).limit(10);
```

##### toArray()

```typescript
async toArray(): Promise<TSchema[]>
```

クエリを実行し、結果をドキュメントの配列として返します。

**戻り値:**
- ドキュメントの配列

**例:**
```typescript
const results = await products
  .find({ status: 'active' })
  .sort({ price: 'desc' })
  .limit(10)
  .toArray();

console.log(`Found ${results.length} products`);
```

##### getPageInfo()

```typescript
async getPageInfo(): Promise<{
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextToken?: string;
}>
```

ページネーション情報を取得します。

**戻り値:**
- ページネーション情報

**例:**
```typescript
const cursor = products
  .find({ status: 'active' })
  .sort({ price: 'desc' })
  .limit(10);

const results = await cursor.toArray();
const pageInfo = await cursor.getPageInfo();

console.log(`Has next page: ${pageInfo.hasNextPage}`);
console.log(`Next token: ${pageInfo.nextToken}`);
```

## 型定義

### Filter

型安全なフィルタ条件を定義します。

```typescript
type Filter<T> = {
  [P in keyof T]?: T[P] | FilterOperators<T[P]>;
} & {
  /** AND条件（すべての条件を満たす） */
  and?: Filter<T>[];
  /** OR条件（いずれかの条件を満たす） */
  or?: Filter<T>[];
};
```

#### FilterOperators

```typescript
interface FilterOperators<T> {
  /** 等しい */
  eq?: T;
  /** 等しくない */
  ne?: T;
  /** より大きい */
  gt?: T;
  /** 以上 */
  gte?: T;
  /** より小さい */
  lt?: T;
  /** 以下 */
  lte?: T;
  /** いずれかに一致 */
  in?: T[];
  /** いずれにも一致しない */
  nin?: T[];
  /** フィールドの存在チェック */
  exists?: boolean;
  /** 正規表現マッチ */
  regex?: string | RegExp;
}
```

**使用例:**
```typescript
// 直接値を指定
const filter: Filter<Product> = { status: 'active' };

// 演算子を使用
const filter: Filter<Product> = {
  price: { gte: 1000, lte: 5000 },
  status: { in: ['active', 'pending'] },
  name: { regex: /^Product/ }
};

// 論理演算子を使用
const filter: Filter<Product> = {
  or: [
    { status: 'active' },
    { priority: { gte: 5 } }
  ]
};
```

### UpdateOperators

MongoDB風の更新演算子を提供します。

```typescript
interface UpdateOperators<T> {
  /** フィールドを設定 */
  set?: Partial<T>;
  /** フィールドを削除 */
  unset?: (keyof T)[];
  /** 数値をインクリメント（負の値でデクリメント） */
  inc?: Partial<Record<keyof T, number>>;
}
```

**使用例:**
```typescript
// フィールドを設定
const update: UpdateOperators<Product> = {
  set: { status: 'published', updatedAt: new Date().toISOString() }
};

// フィールドを削除
const update: UpdateOperators<Product> = {
  unset: ['description', 'tags']
};

// 数値をインクリメント
const update: UpdateOperators<Product> = {
  inc: { stock: -1, viewCount: 1 }
};

// 複数の演算子を組み合わせ
const update: UpdateOperators<Product> = {
  set: { status: 'published' },
  inc: { viewCount: 1 },
  unset: ['draft']
};
```

### FindOptions

検索オプションを定義します。

```typescript
interface FindOptions {
  /** ソート条件 */
  sort?: Record<string, 1 | -1 | 'asc' | 'desc'>;
  /** 取得件数の制限 */
  limit?: number;
  /** スキップする件数 */
  skip?: number;
  /** ページネーショントークン（カーソルベースのページネーション用） */
  nextToken?: string;
}
```

### 結果型

#### InsertOneResult

```typescript
interface InsertOneResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** 挿入されたドキュメントのID */
  insertedId: string;
}
```

#### InsertManyResult

```typescript
interface InsertManyResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** 挿入されたドキュメントの数 */
  insertedCount: number;
  /** 挿入されたドキュメントのIDマップ */
  insertedIds: Record<number, string>;
  /** 失敗したドキュメントのIDリスト */
  failedIds?: string[];
  /** エラー情報 */
  errors?: Array<{ id: string; code: string; message: string }>;
}
```

#### UpdateResult

```typescript
interface UpdateResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** マッチしたドキュメントの数 */
  matchedCount: number;
  /** 変更されたドキュメントの数 */
  modifiedCount: number;
  /** アップサートされたドキュメントのID（存在する場合） */
  upsertedId?: string;
}
```

#### DeleteResult

```typescript
interface DeleteResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** 削除されたドキュメントの数 */
  deletedCount: number;
}
```

## react-admin統合

react-adminのDataProviderとして使用できます。

### インストール

```typescript
import { createDataProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
import type { TokenProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
```

### 基本的な使用方法

```typescript
// トークンプロバイダーを定義
const tokenProvider: TokenProvider = {
  getToken: async () => {
    // 認証トークンを取得するロジック
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  },
};

// DataProviderを作成
const dataProvider = createDataProvider({
  apiUrl: 'https://your-lambda-url.amazonaws.com',
  tokenProvider,
  defaultPerPage: 25,
  defaultSortField: 'updatedAt',
  defaultSortOrder: 'DESC',
});

// react-adminアプリで使用
function App() {
  return (
    <Admin dataProvider={dataProvider}>
      <Resource name="products" list={ProductList} />
    </Admin>
  );
}
```

### TokenProvider

```typescript
interface TokenProvider {
  /**
   * 認証トークンを取得
   * @returns 認証トークン（JWT、Bearer tokenなど）
   * @throws トークンが取得できない場合はエラーをスロー
   */
  getToken(): Promise<string>;
}
```

### DataProviderOptions

```typescript
interface DataProviderOptions {
  /** Records Lambda Function URL */
  apiUrl: string;
  /** トークンプロバイダー */
  tokenProvider: TokenProvider;
  /** デフォルトのページサイズ（オプション、デフォルト: 25） */
  defaultPerPage?: number;
  /** デフォルトのソートフィールド（オプション、デフォルト: 'id'） */
  defaultSortField?: string;
  /** デフォルトのソート順（オプション、デフォルト: 'ASC'） */
  defaultSortOrder?: 'ASC' | 'DESC';
}
```

## エラーハンドリング

### エラーの種類

DynamoDB Client SDKは以下のエラーを発生させる可能性があります：

- **認証エラー**: トークンが無効または期限切れ
- **ネットワークエラー**: Lambda Function URLへの接続失敗
- **タイムアウトエラー**: リクエストがタイムアウト
- **バリデーションエラー**: 不正なパラメータ
- **DynamoDBエラー**: DynamoDB操作の失敗

### エラーハンドリングの例

```typescript
try {
  const result = await products.insertOne({
    name: 'New Product',
    price: 1000,
    status: 'active',
  });
  console.log('Success:', result.insertedId);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      console.error('Request timeout:', error.message);
    } else if (error.message.includes('Request failed')) {
      console.error('API error:', error.message);
    } else {
      console.error('Unknown error:', error.message);
    }
  }
}
```

### タイムアウト設定

```typescript
const client = new DynamoClient('https://your-lambda-url.amazonaws.com', {
  auth: { token: 'your-token' },
  timeout: 60000, // 60秒のタイムアウト
});
```

## ベストプラクティス

### 1. 型安全性の活用

```typescript
// 製品の型を定義
interface Product {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// 型安全なコレクション
const products = db.collection<Product>('products');

// TypeScriptが型チェックを行う
const result = await products.find({
  status: 'active', // ✅ 正しい値
  // status: 'invalid', // ❌ TypeScriptエラー
});
```

### 2. 効率的なクエリ

```typescript
// ✅ 良い例: 必要な件数のみ取得
const recentProducts = await products
  .find({ status: 'active' })
  .sort({ createdAt: 'desc' })
  .limit(10)
  .toArray();

// ❌ 悪い例: 全件取得してからフィルタ
const allProducts = await products.find().toArray();
const recentProducts = allProducts
  .filter(p => p.status === 'active')
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  .slice(0, 10);
```

### 3. 適切なエラーハンドリング

```typescript
async function createProduct(productData: Omit<Product, 'id'>) {
  try {
    const result = await products.insertOne(productData);
    return { success: true, id: result.insertedId };
  } catch (error) {
    console.error('Failed to create product:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
```

### 4. 接続の管理

```typescript
// ✅ 良い例: 適切な接続管理
async function processProducts() {
  const client = new DynamoClient(endpoint, options);
  
  try {
    await client.connect();
    const db = client.db();
    const products = db.collection<Product>('products');
    
    // 処理を実行
    const results = await products.find({ status: 'active' }).toArray();
    return results;
  } finally {
    await client.close(); // 必ずクローズ
  }
}
```

### 5. バルク操作の活用

```typescript
// ✅ 良い例: バルク操作を使用
const results = await products.insertMany([
  { name: 'Product A', price: 1000, status: 'active' },
  { name: 'Product B', price: 2000, status: 'active' },
  { name: 'Product C', price: 3000, status: 'active' },
]);

// ❌ 悪い例: 個別に挿入
for (const productData of productsData) {
  await products.insertOne(productData); // 非効率
}
```

### 6. ページネーションの実装

```typescript
async function getProductsPage(pageToken?: string) {
  const cursor = products
    .find({ status: 'active' })
    .sort({ createdAt: 'desc' })
    .limit(20);
  
  if (pageToken) {
    cursor.skip(0); // nextTokenを使用する場合はskipは不要
  }
  
  const items = await cursor.toArray();
  const pageInfo = await cursor.getPageInfo();
  
  return {
    items,
    hasNextPage: pageInfo.hasNextPage,
    nextToken: pageInfo.nextToken,
  };
}
```

---

このAPIリファレンスは、DynamoDB Client SDKの全機能を網羅しています。詳細な使用例やトラブルシューティングについては、プロジェクトのREADMEやサンプルコードを参照してください。