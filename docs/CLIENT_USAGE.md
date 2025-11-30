# DynamoDB Client SDK 使用ガイド

## 概要

DynamoDB Client SDKは、Records Lambda Function URL経由でDynamoDBにアクセスするためのHTTPクライアントです。
MongoDB風のシンプルなAPIを提供し、認証方式ごとに最適化されたクライアントを使用できます。

## 認証方式

Records Lambda は、リクエストヘッダーを見て自動的に認証方式を判定します：

1. **IAM認証**: `x-amz-date` + `x-amz-content-sha256` ヘッダーが存在する場合
2. **Cognito認証**: 上記以外の場合、`Authorization: Bearer <token>` を JWT として検証

### 1. IAM認証（Node.js専用）

Lambda関数など、AWS環境で実行されるコードで使用します。

```typescript
import { DynamoClient } from '@ainews/core/client/iam';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    region: 'ap-northeast-1',
  },
});

await client.connect();
```

**認証の仕組み**:

- クライアントが AWS SigV4 署名を生成し、リクエストに以下のヘッダーを追加：
  - `x-amz-date`: リクエスト日時
  - `x-amz-content-sha256`: リクエストボディのSHA-256ハッシュ
  - `Authorization`: AWS4-HMAC-SHA256 署名
- Records Lambda がこれらのヘッダーの存在を確認し、IAM認証として処理

**依存パッケージ**:

- `@aws-sdk/credential-provider-node`
- `@smithy/signature-v4`
- `@aws-crypto/sha256-js`

### 2. Cognito認証

ブラウザまたはNode.jsで、Cognitoトークンを使用する場合に使用します。

```typescript
import { DynamoClient } from '@ainews/core/client/cognito';
import { Auth } from 'aws-amplify';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    getToken: async () => {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    },
  },
});

await client.connect();
```

**認証の仕組み**:

- クライアントが `Authorization: Bearer <token>` ヘッダーを送信
- Records Lambda が IAM認証のヘッダーが存在しないことを確認
- `aws-jwt-verify` を使用して JWT トークンを検証（署名検証、有効期限、発行者など）

**依存パッケージ**: なし（認証ライブラリは別途必要）

### 3. Token認証

固定トークンを使用する場合に使用します。

```typescript
import { DynamoClient } from '@ainews/core/client/token';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    token: 'your-static-token',
  },
});

await client.connect();
```

**依存パッケージ**: なし

## 基本的な使い方

### データベースとコレクションの取得

```typescript
const db = client.db('mydb');
const articles = db.collection<Article>('articles');
```

### レコードの検索

```typescript
// 単純な検索
const allArticles = await articles.find({}).toArray();

// フィルター付き検索
const publishedArticles = await articles.find({ status: 'published' }).toArray();

// ソート付き検索
const sortedArticles = await articles.find({}).sort({ createdAt: 'desc' }).toArray();

// ページネーション
const pagedArticles = await articles.find({}).sort({ createdAt: 'desc' }).limit(10).toArray();
```

### レコードの作成

```typescript
// 単一レコード作成
const result = await articles.insertOne({
  name: 'New Article',
  category: 'tech',
  status: 'draft',
});

console.log('Inserted ID:', result.insertedId);

// 複数レコード作成
const bulkResult = await articles.insertMany([
  { name: 'Article 1', category: 'tech', status: 'draft' },
  { name: 'Article 2', category: 'business', status: 'published' },
]);

console.log('Inserted count:', bulkResult.insertedCount);
```

### レコードの更新

```typescript
// 単一レコード更新
await articles.updateOne({ id: 'article-id' }, { set: { status: 'published' } });

// 複数レコード更新
await articles.updateMany({ status: 'draft' }, { set: { status: 'published' } });
```

### レコードの削除

```typescript
// 単一レコード削除
await articles.deleteOne({ id: 'article-id' });

// 複数レコード削除
await articles.deleteMany(['id1', 'id2', 'id3']);
```

## 環境別の使用例

### Lambda関数（IAM認証）

```typescript
import { DynamoClient } from '@ainews/core/client/iam';

let client: DynamoClient | null = null;

async function getClient() {
  if (!client) {
    client = new DynamoClient(process.env.RECORDS_FUNCTION_URL!, {
      auth: {
        region: process.env.AWS_REGION || 'ap-northeast-1',
      },
    });
    await client.connect();
  }
  return client;
}

export async function handler(event: any) {
  const dynamoClient = await getClient();
  const db = dynamoClient.db('mydb');
  const articles = db.collection('articles');

  const result = await articles.insertMany(event.articles);

  return {
    statusCode: 200,
    body: JSON.stringify({
      insertedCount: result.insertedCount,
    }),
  };
}
```

### React Admin（Cognito認証）

```typescript
import { DynamoClient } from '@ainews/core/client/cognito';

import { getIdToken } from './authProvider';

function createClient() {
  return new DynamoClient(API_URL, {
    auth: {
      getToken: async () => {
        const token = await getIdToken();
        if (!token) {
          throw new Error('認証トークンが見つかりません');
        }
        return token;
      },
    },
  });
}

export async function getArticles() {
  const client = createClient();
  await client.connect();

  try {
    const db = client.db('mydb');
    const articles = db.collection('articles');
    return await articles.find({}).toArray();
  } finally {
    await client.close();
  }
}
```

### CLIツール（IAM認証）

```typescript
import { DynamoClient } from '@ainews/core/client/iam';

async function main() {
  const client = new DynamoClient(process.env.API_URL!, {
    auth: {
      region: 'ap-northeast-1',
    },
  });

  await client.connect();

  try {
    const db = client.db('mydb');
    const articles = db.collection('articles');

    const result = await articles.find({}).toArray();
    console.log(`Found ${result.length} articles`);
  } finally {
    await client.close();
  }
}

main();
```

## パッケージサイズの最適化

認証方式ごとにクライアントを分離することで、不要な依存関係を除外できます：

- **IAM認証**: AWS SDK パッケージを含む（~500KB）
- **Cognito認証**: AWS SDK を含まない（~50KB）
- **Token認証**: AWS SDK を含まない（~50KB）

ブラウザアプリケーションでは、Cognito認証またはToken認証を使用することで、バンドルサイズを大幅に削減できます。

## トラブルシューティング

### 認証エラー

```
Error: Insufficient permissions to access DynamoDB
```

**解決方法**:

- IAM認証: Lambda実行ロールに適切な権限があるか確認
- Cognito認証: トークンが有効か確認
- Token認証: トークンが正しいか確認

### 接続エラー

```
Error: Client is not connected
```

**解決方法**:

- `await client.connect()` を呼び出してから使用する
- または `autoConnect: true` オプションを使用する

```typescript
const client = new DynamoClient(FUNCTION_URL, {
  auth: { region: 'ap-northeast-1' },
  autoConnect: true,
});
```
