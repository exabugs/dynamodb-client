# react-admin との統合ガイド

このドキュメントでは、DynamoDB Client（MongoDB風インターフェース）をreact-adminで使用する方法と注意点を説明します。

## 目次

- [概要](#概要)
- [基本的な統合](#基本的な統合)
- [nextTokenベースのページネーション](#nexttokenベースのページネーション)
- [InfiniteList（無限スクロール）の実装](#infinitelist無限スクロールの実装)
- [注意点とベストプラクティス](#注意点とベストプラクティス)
- [トラブルシューティング](#トラブルシューティング)

## 概要

DynamoDB ClientはMongoDB風のAPIを提供し、react-adminのデータプロバイダーとして使用できます。特に、DynamoDBのnextTokenベースのページネーションをreact-adminのページ番号ベースのUIと統合する必要があります。

### 主な特徴

- **MongoDB風のAPI**: `find()`, `sort()`, `limit()`, `toArray()`などの直感的なメソッド
- **nextTokenベースのページネーション**: DynamoDBのカーソルベースのページネーションをサポート
- **react-admin v5対応**: `pageInfo`を使用した新しいページネーション形式

## 基本的な統合

### データプロバイダーの作成

```typescript
import { DataProvider } from 'react-admin';

import { DynamoClient } from '@exabugs/dynamodb-client/client/cognito';

export function createDataProvider(options: DataProviderOptions): DataProvider {
  function createClient(): DynamoClient {
    return new DynamoClient(apiUrl, {
      auth: {
        getToken: async () => {
          const idToken = await getIdToken();
          if (!idToken) {
            throw new Error('認証トークンが見つかりません');
          }
          return idToken;
        },
      },
    });
  }

  return {
    getList: async (resource, params) => {
      const client = createClient();
      await client.connect();

      try {
        const { page = 1, perPage = 10 } = params.pagination || {};
        const { field = 'updatedAt', order = 'DESC' } = params.sort || {};
        const filter = params.filter || {};

        const db = client.db('mydb');
        const collection = db.collection(resource);

        // MongoDB風のクエリ
        const cursor = collection.find(filter, {
          sort: { [field]: order === 'DESC' ? 'desc' : 'asc' },
          limit: perPage,
        });

        const items = await cursor.toArray();
        const pageInfo = await cursor.getPageInfo();

        return {
          data: items,
          pageInfo: {
            hasNextPage: pageInfo.hasNextPage,
            hasPreviousPage: page > 1,
          },
        };
      } finally {
        await client.close();
      }
    },
    // ... 他の操作
  };
}
```

## nextTokenベースのページネーション

DynamoDBはnextTokenベースのカーソルページネーションを使用しますが、react-adminはページ番号ベースのUIを提供します。この2つを統合するには、nextTokenをキャッシュする必要があります。

### nextTokenキャッシュの実装

```typescript
/**
 * nextTokenキャッシュ
 * リソースごとに、ページ番号とnextTokenのマッピングを保持
 */
const nextTokenCache: Record<string, Record<number, string | undefined> & { _cacheKey?: string }> =
  {};

/**
 * nextTokenキャッシュをクリア
 */
function clearNextTokenCache(resource: string): void {
  delete nextTokenCache[resource];
}

/**
 * nextTokenをキャッシュに保存
 */
function cacheNextToken(resource: string, page: number, nextToken: string | undefined): void {
  if (!nextTokenCache[resource]) {
    nextTokenCache[resource] = {};
  }
  nextTokenCache[resource][page] = nextToken;
}

/**
 * キャッシュからnextTokenを取得
 *
 * page=2の場合、1ページ目の結果から得たnextTokenを使用する
 */
function getNextTokenFromCache(resource: string, page: number): string | undefined {
  return nextTokenCache[resource]?.[page];
}
```

### キャッシュの使用

```typescript
getList: async (resource, params) => {
  const { page = 1, perPage = 10 } = params.pagination || {};
  const { field = 'updatedAt', order = 'DESC' } = params.sort || {};
  const filter = params.filter || {};

  // フィルターまたはソートが変更された場合、キャッシュをクリア
  const filterKey = JSON.stringify(filter);
  const sortKey = `${field}:${order}`;
  const cacheKey = `${filterKey}:${sortKey}`;

  if (!nextTokenCache[resource] || nextTokenCache[resource]._cacheKey !== cacheKey) {
    clearNextTokenCache(resource);
    nextTokenCache[resource] = { _cacheKey: cacheKey } as any;
  }

  // ページ番号からnextTokenを取得
  const nextToken = page > 1 ? getNextTokenFromCache(resource, page) : undefined;

  // クエリ実行
  const cursor = collection.find(filter, {
    sort: { [field]: order === 'DESC' ? 'desc' : 'asc' },
    limit: perPage,
    nextToken, // nextTokenを渡す
  });

  const items = await cursor.toArray();
  const pageInfo = await cursor.getPageInfo();

  // 次のページのnextTokenをキャッシュ
  if (pageInfo.nextToken) {
    cacheNextToken(resource, page + 1, pageInfo.nextToken);
  }

  return {
    data: items,
    pageInfo: {
      hasNextPage: pageInfo.hasNextPage,
      hasPreviousPage: page > 1,
    },
  };
};
```

### キャッシュの仕組み

1. **1ページ目（page=1）**:
   - `nextToken = undefined`（キャッシュなし）
   - DynamoDBにリクエスト
   - レスポンスの`nextToken`を`cache[2]`に保存

2. **2ページ目（page=2）**:
   - `nextToken = cache[2]`（1ページ目のnextToken）
   - DynamoDBにリクエスト
   - レスポンスの`nextToken`を`cache[3]`に保存

3. **3ページ目（page=3）**:
   - `nextToken = cache[3]`（2ページ目のnextToken）
   - DynamoDBにリクエスト
   - ...

## InfiniteList（無限スクロール）の実装

`InfiniteList`は、スクロールすると自動的に次のページを読み込む無限スクロールUIを提供します。

### リソース定義

```typescript
import { InfiniteList, TextField, DateField } from 'react-admin';
import { Datagrid } from '../components/Datagrid';

const list = () => (
  <InfiniteList
    filters={filters}
    sort={{ field: 'updatedAt', order: 'DESC' }}
  >
    <Datagrid rowClick="edit">
      <TextField source="name" />
      <TextField source="category" />
      <TextField source="status" />
      <DateField source="createdAt" showTime />
      <DateField source="updatedAt" showTime />
    </Datagrid>
  </InfiniteList>
);

export default {
  name: 'articles',
  list,
  // ...
};
```

### InfiniteListの動作

1. **初回読み込み**: 1ページ目のデータを取得
2. **スクロール**: ユーザーがリストの下部までスクロール
3. **自動読み込み**: `hasNextPage: true`の場合、次のページを自動的に取得
4. **追加表示**: 取得したデータをリストの下部に追加
5. **繰り返し**: `hasNextPage: false`になるまで繰り返し

### InfiniteListとnextTokenキャッシュ

`InfiniteList`は内部的にページ番号を管理しており、nextTokenキャッシュと完全に互換性があります：

- ソートやフィルターが変更されると、リストがリセットされ、キャッシュもクリアされる
- ページ番号が順番に増加するため、nextTokenキャッシュが正しく機能する
- `pageInfo.hasNextPage`を使用して、次のページの有無を判定する

## 注意点とベストプラクティス

### 1. hasNextPageの判定

**重要**: `hasNextPage`は、フィルタリング**前**のクエリ結果で判定する必要があります。

```typescript
// ❌ 間違い: フィルタリング後のitemsで判定
const hasNextPage = items.length >= perPage && queryResult.LastEvaluatedKey !== undefined;

// ✅ 正しい: フィルタリング前のshadowItemsで判定
const hasNextPage =
  shadowItems.length < perPage ? false : queryResult.LastEvaluatedKey !== undefined;
```

**理由**: フィルタリングでアイテムが除外されても、次のページにフィルタリング後のデータがある可能性があるため。

### 2. キャッシュのクリア

フィルターまたはソートが変更された場合、必ずキャッシュをクリアしてください：

```typescript
const filterKey = JSON.stringify(filter);
const sortKey = `${field}:${order}`;
const cacheKey = `${filterKey}:${sortKey}`;

if (!nextTokenCache[resource] || nextTokenCache[resource]._cacheKey !== cacheKey) {
  clearNextTokenCache(resource);
  nextTokenCache[resource] = { _cacheKey: cacheKey } as any;
}
```

### 3. FindOptionsの構造

`FindCursor`に渡す`options`は、すべてのオプション（`sort`, `limit`, `nextToken`）を含める必要があります：

```typescript
// ✅ 正しい
const cursor = collection.find(filter, {
  sort: { [field]: order === 'DESC' ? 'desc' : 'asc' },
  limit: perPage,
  nextToken, // nextTokenを含める
});

// ❌ 間違い: nextTokenが含まれていない
const cursor = collection
  .find(filter)
  .sort({ [field]: order === 'DESC' ? 'desc' : 'asc' })
  .limit(perPage);
```

### 4. pageInfoの構造

react-admin v5では、`total`は不要で、`pageInfo`のみを返します：

```typescript
// ✅ 正しい（react-admin v5）
return {
  data: items,
  pageInfo: {
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: page > 1,
  },
};

// ❌ 古い形式（react-admin v4以前）
return {
  data: items,
  total: estimatedTotal, // 不要
};
```

### 5. ソート可能フィールドの管理

カスタム`Datagrid`を使用して、`shadow.config.json`に基づいて自動的に`sortable`プロパティを設定します：

```typescript
import shadowConfig from '@example/api-types/shadow.config.json';

function isSortableField(resource: string | undefined, field: string): boolean {
  if (field === 'id') return true; // idは常にソート可能
  if (!resource) return false;

  const resourceConfig = (shadowConfig.resources as any)?.[resource];
  if (!resourceConfig) return false;

  return field in (resourceConfig.shadows || {});
}

export function Datagrid(props: RADatagridProps) {
  const { children, ...rest } = props;
  const resource = useResourceContext();

  const decoratedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const source = (child.props as any)?.source as string | undefined;
    if (!source) return child;

    const sortable = isSortableField(resource, source);
    return cloneElement(child, { sortable } as any);
  });

  return <RADatagrid {...rest}>{decoratedChildren}</RADatagrid>;
}
```

## トラブルシューティング

### 問題: 無限ループが発生する

**症状**: リストが無限にスクロールし続ける

**原因**: `hasNextPage`の判定が間違っている

**解決策**: フィルタリング前のクエリ結果で判定する

```typescript
// 修正前
const hasNextPage = items.length >= perPage;

// 修正後
const hasNextPage =
  shadowItems.length < perPage ? false : queryResult.LastEvaluatedKey !== undefined;
```

### 問題: 1ページ目と2ページ目が同じ内容

**症状**: ページを切り替えても同じデータが表示される

**原因**: `getNextTokenFromCache`の実装が間違っている

**解決策**: `page`番目のnextTokenを取得する

```typescript
// 修正前
function getNextTokenFromCache(resource: string, page: number): string | undefined {
  return nextTokenCache[resource]?.[page - 1]; // ❌ 間違い
}

// 修正後
function getNextTokenFromCache(resource: string, page: number): string | undefined {
  return nextTokenCache[resource]?.[page]; // ✅ 正しい
}
```

### 問題: ソートが動作しない

**症状**: カラムヘッダーをクリックしても、データの順序が変わらない

**原因**:

1. `FindCursor`に`nextToken`が渡されていない
2. キャッシュがクリアされていない

**解決策**:

1. `options`に`nextToken`を含める
2. ソート変更時にキャッシュをクリアする

```typescript
// 1. optionsにnextTokenを含める
const cursor = collection.find(filter, {
  sort: { [field]: order === 'DESC' ? 'desc' : 'asc' },
  limit: perPage,
  nextToken, // 追加
});

// 2. ソート変更時にキャッシュをクリア
const sortKey = `${field}:${order}`;
const cacheKey = `${filterKey}:${sortKey}`;

if (nextTokenCache[resource]?._cacheKey !== cacheKey) {
  clearNextTokenCache(resource);
  nextTokenCache[resource] = { _cacheKey: cacheKey } as any;
}
```

### 問題: フィルター変更後に古いデータが表示される

**症状**: フィルターを変更しても、前のフィルターのデータが表示される

**原因**: フィルター変更時にキャッシュがクリアされていない

**解決策**: フィルター変更時にキャッシュをクリアする

```typescript
const filterKey = JSON.stringify(filter);
const cacheKey = `${filterKey}:${sortKey}`;

if (nextTokenCache[resource]?._cacheKey !== cacheKey) {
  clearNextTokenCache(resource);
  nextTokenCache[resource] = { _cacheKey: cacheKey } as any;
}
```

## まとめ

DynamoDB ClientのMongoDB風インターフェースをreact-adminで使用する際の重要なポイント：

1. **nextTokenキャッシュ**: ページ番号とnextTokenのマッピングを管理
2. **キャッシュクリア**: フィルター/ソート変更時に必ずクリア
3. **hasNextPage判定**: フィルタリング前のクエリ結果で判定
4. **FindOptions**: `sort`, `limit`, `nextToken`をすべて含める
5. **pageInfo**: react-admin v5では`total`は不要

これらのベストプラクティスに従うことで、DynamoDB ClientとInfiniteListを組み合わせた、スムーズな無限スクロールUIを実装できます。
