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

**Note**: v0.3.0以降、すべてのフィールドが自動的にソート可能になりました。設定ファイルは不要です。

カスタム`Datagrid`を使用して、すべてのフィールドを`sortable`に設定できます：

```typescript
export function Datagrid(props: RADatagridProps) {
  const { children, ...rest } = props;

  const decoratedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const source = (child.props as any)?.source as string | undefined;
    if (!source) return child;

    // v0.3.0+: すべてのフィールドがソート可能
    const sortable = true;
    return cloneElement(child, { sortable } as any);
  });

  return <RADatagrid {...rest}>{decoratedChildren}</RADatagrid>;
}
```

または、特定のフィールドのみをソート可能にする場合：

```typescript
function isSortableField(field: string): boolean {
  // id, createdAt, updatedAtなどの一般的なフィールドをソート可能に
  const sortableFields = ['id', 'createdAt', 'updatedAt', 'name', 'title', 'status'];
  return sortableFields.includes(field);
}

export function Datagrid(props: RADatagridProps) {
  const { children, ...rest } = props;

  const decoratedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const source = (child.props as any)?.source as string | undefined;
    if (!source) return child;

    const sortable = isSortableField(source);
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

## 多対多関係の実装

DynamoDB Clientは、中間テーブルを使用した多対多関係をサポートするための専用コンポーネントを提供します。

### 概要

多対多関係（N-to-N）は、2つのリソース間の関連を中間テーブル（ジャンクションテーブル）で管理します。

**例**: Venue（開催地）とUser（ユーザー）の多対多関係

```
venues (開催地)
├── id: "venue_001"
├── name: "新宿御苑"
└── ...

users (ユーザー)
├── id: "user_001"
├── name: "田中太郎"
└── ...

venueManagers (中間テーブル)
├── id: "user_001_venue_001"
├── userId: "user_001"
├── venueId: "venue_001"
└── ...
```

### 提供されるコンポーネント

#### 1. ReferenceManyToManyField（表示用）

Show/List画面で多対多関係を表示するコンポーネント。

```typescript
import { ReferenceManyToManyField } from '@exabugs/dynamodb-client/integrations/react-admin';
import { ChipField, SingleFieldList } from 'react-admin';

// Venue Show画面で管理者一覧を表示
<ReferenceManyToManyField
  reference="users"           // 参照先リソース
  through="venueManagers"     // 中間テーブル
  using="venueId,userId"      // 中間テーブルのフィールド（起点,参照先）
  label="管理者"
>
  <SingleFieldList>
    <ChipField source="name" />
  </SingleFieldList>
</ReferenceManyToManyField>
```

**プロパティ**:

| プロパティ  | 型           | 必須 | 説明                                                                                   |
| ----------- | ------------ | ---- | -------------------------------------------------------------------------------------- |
| `reference` | string       | ✅   | 参照先リソース名（例: "users"）                                                        |
| `through`   | string       | ✅   | 中間テーブルのリソース名（例: "venueManagers"）                                        |
| `using`     | string       | ✅   | 中間テーブルのフィールド名（カンマ区切り）<br/>形式: "起点フィールド,参照先フィールド" |
| `label`     | string       | -    | フィールドのラベル                                                                     |
| `children`  | ReactElement | ✅   | 表示用の子コンポーネント                                                               |

#### 2. ReferenceManyToManyInput（編集用）

Edit/Create画面で多対多関係を編集するコンポーネント。

```typescript
import { ReferenceManyToManyInput } from '@exabugs/dynamodb-client/integrations/react-admin';
import { AutocompleteArrayInput } from 'react-admin';

// Venue Edit画面で管理者を追加・削除
<ReferenceManyToManyInput
  reference="users"           // 参照先リソース
  through="venueManagers"     // 中間テーブル
  using="venueId,userId"      // 中間テーブルのフィールド（起点,参照先）
  label="管理者"
>
  <AutocompleteArrayInput optionText="name" />
</ReferenceManyToManyInput>
```

**プロパティ**:

| プロパティ  | 型           | 必須 | 説明                                                                                   |
| ----------- | ------------ | ---- | -------------------------------------------------------------------------------------- |
| `reference` | string       | ✅   | 参照先リソース名（例: "users"）                                                        |
| `through`   | string       | ✅   | 中間テーブルのリソース名（例: "venueManagers"）                                        |
| `using`     | string       | ✅   | 中間テーブルのフィールド名（カンマ区切り）<br/>形式: "起点フィールド,参照先フィールド" |
| `label`     | string       | -    | フィールドのラベル                                                                     |
| `children`  | ReactElement | ✅   | 入力用の子コンポーネント                                                               |

### 完全な実装例

#### 型定義

```typescript
// Venue（開催地）
interface Venue {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

// User（ユーザー）
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// VenueManager（中間テーブル）
interface VenueManager {
  id: string; // "${userId}_${venueId}" 形式
  userId: string; // ユーザーID
  venueId: string; // 開催地ID
  createdAt: string;
  updatedAt: string;
}
```

#### Venue Show画面

```typescript
import { Show, SimpleShowLayout, TextField, DateField } from 'react-admin';
import { ReferenceManyToManyField } from '@exabugs/dynamodb-client/integrations/react-admin';
import { ChipField, SingleFieldList } from 'react-admin';

export const VenueShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="name" label="開催地名" />
      <TextField source="address" label="住所" />

      {/* 管理者一覧を表示 */}
      <ReferenceManyToManyField
        reference="users"
        through="venueManagers"
        using="venueId,userId"
        label="管理者"
      >
        <SingleFieldList>
          <ChipField source="name" />
        </SingleFieldList>
      </ReferenceManyToManyField>

      <DateField source="createdAt" label="作成日時" showTime />
      <DateField source="updatedAt" label="更新日時" showTime />
    </SimpleShowLayout>
  </Show>
);
```

#### Venue Edit画面

```typescript
import { Edit, SimpleForm, TextInput, DateField } from 'react-admin';
import { ReferenceManyToManyInput } from '@exabugs/dynamodb-client/integrations/react-admin';
import { AutocompleteArrayInput } from 'react-admin';

export const VenueEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" label="開催地名" />
      <TextInput source="address" label="住所" />

      {/* 管理者を追加・削除 */}
      <ReferenceManyToManyInput
        reference="users"
        through="venueManagers"
        using="venueId,userId"
        label="管理者"
      >
        <AutocompleteArrayInput optionText="name" />
      </ReferenceManyToManyInput>

      <DateField source="createdAt" label="作成日時" showTime />
      <DateField source="updatedAt" label="更新日時" showTime />
    </SimpleForm>
  </Edit>
);
```

#### User Show画面（逆方向の関連）

```typescript
import { Show, SimpleShowLayout, TextField, DateField } from 'react-admin';
import { ReferenceManyToManyField } from '@exabugs/dynamodb-client/integrations/react-admin';
import { ChipField, SingleFieldList } from 'react-admin';

export const UserShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="name" label="ユーザー名" />
      <TextField source="email" label="メールアドレス" />

      {/* 管理している開催地一覧を表示 */}
      <ReferenceManyToManyField
        reference="venues"
        through="venueManagers"
        using="userId,venueId"  // 逆方向: userId → venueId
        label="管理している開催地"
      >
        <SingleFieldList>
          <ChipField source="name" />
        </SingleFieldList>
      </ReferenceManyToManyField>

      <DateField source="createdAt" label="作成日時" showTime />
      <DateField source="updatedAt" label="更新日時" showTime />
    </SimpleShowLayout>
  </Show>
);
```

### 動作の仕組み

#### ReferenceManyToManyField（表示）

1. **起点レコードの取得**: `useRecordContext()`で現在のレコード（例: Venue）を取得
2. **中間レコードの取得**: `through`テーブルから起点フィールドでフィルタリング
   ```typescript
   // venueId = "venue_001" の中間レコードを取得
   dataProvider.getList('venueManagers', {
     filter: { venueId: 'venue_001' },
     pagination: { page: 1, perPage: 1000 },
   });
   ```
3. **参照先IDの抽出**: 中間レコードから参照先フィールドの値を抽出
   ```typescript
   // userId の配列を抽出: ["user_001", "user_002", ...]
   const userIds = junctionRecords.map((r) => r.userId);
   ```
4. **参照先レコードの取得**: `reference`テーブルから一括取得
   ```typescript
   // ユーザー情報を一括取得
   dataProvider.getMany('users', { ids: userIds });
   ```
5. **子コンポーネントへ渡す**: 取得したレコードを子コンポーネントに渡して表示

#### ReferenceManyToManyInput（編集）

1. **現在の関連を取得**: ReferenceManyToManyFieldと同じ手順で現在の関連を取得
2. **ユーザーの選択を監視**: 子コンポーネント（AutocompleteArrayInput）の変更を監視
3. **差分を計算**: 追加されたIDと削除されたIDを計算
   ```typescript
   const addedIds = newIds.filter((id) => !currentIds.includes(id));
   const removedIds = currentIds.filter((id) => !newIds.includes(id));
   ```
4. **中間レコードを作成**: 追加されたIDに対して中間レコードを作成
   ```typescript
   // 追加: venueId="venue_001", userId="user_003"
   dataProvider.createMany('venueManagers', {
     data: [{ id: 'user_003_venue_001', userId: 'user_003', venueId: 'venue_001' }],
   });
   ```
5. **中間レコードを削除**: 削除されたIDに対して中間レコードを削除
   ```typescript
   // 削除: id="user_002_venue_001"
   dataProvider.deleteMany('venueManagers', {
     ids: ['user_002_venue_001'],
   });
   ```
6. **UIを更新**: `useRefresh()`でリストを再読み込み

### エラーハンドリング

コンポーネントは以下のエラーを自動的に処理します：

1. **usingプロパティの形式エラー**

   ```
   Error: 'using' prop must be in format 'sourceField,targetField'
   ```

2. **起点フィールドの不在エラー**

   ```
   Error: Source field 'venueId' not found in current record
   ```

3. **DataProviderエラー**
   - ネットワークエラー
   - 認証エラー
   - サーバーエラー

エラーが発生した場合、ユーザーフレンドリーなメッセージが表示されます。

### パフォーマンス最適化

#### バッチ処理

複数の参照先レコードを一度に取得するため、`getMany`を使用します：

```typescript
// ❌ 非効率: 1件ずつ取得
for (const id of userIds) {
  await dataProvider.getOne('users', { id });
}

// ✅ 効率的: 一括取得
await dataProvider.getMany('users', { ids: userIds });
```

#### リクエストキャンセル

コンポーネントがアンマウントされた場合、進行中のリクエストを自動的にキャンセルします。

### 注意事項

1. **中間テーブルのID形式**: `"${sourceId}_${targetId}"` 形式を推奨

   ```typescript
   // 推奨: userId_venueId
   id: 'user_001_venue_001';

   // 非推奨: ランダムID
   id: '01HQXYZ123';
   ```

2. **usingプロパティの順序**: 必ず "起点フィールド,参照先フィールド" の順序

   ```typescript
   // Venue → User の場合
   using = 'venueId,userId';

   // User → Venue の場合（逆方向）
   using = 'userId,venueId';
   ```

3. **DataProviderの要件**: `createMany`と`deleteMany`メソッドが必要
   ```typescript
   const dataProvider = {
     // ... 他のメソッド
     createMany: async (resource, params) => {
       /* 実装 */
     },
     deleteMany: async (resource, params) => {
       /* 実装 */
     },
   };
   ```

## まとめ

DynamoDB ClientのMongoDB風インターフェースをreact-adminで使用する際の重要なポイント：

1. **nextTokenキャッシュ**: ページ番号とnextTokenのマッピングを管理
2. **キャッシュクリア**: フィルター/ソート変更時に必ずクリア
3. **hasNextPage判定**: フィルタリング前のクエリ結果で判定
4. **FindOptions**: `sort`, `limit`, `nextToken`をすべて含める
5. **pageInfo**: react-admin v5では`total`は不要
6. **多対多関係**: `ReferenceManyToManyField`と`ReferenceManyToManyInput`を使用

これらのベストプラクティスに従うことで、DynamoDB ClientとInfiniteListを組み合わせた、スムーズな無限スクロールUIと多対多関係の管理を実装できます。
