# フィルタリングとページネーション

## 概要

管理UIでは、複数フィールドのAND検索と無限スクロールによるページネーションを実装しています。

## フィルタリングの仕組み

### 1. UI層（react-admin）

複数のフィルター入力を`<Filter>`コンポーネント内に配置することで、自動的にAND条件として処理されます。

```tsx
const ArticleFilter = (props: any) => (
  <Filter {...props}>
    <TextInput source="category" alwaysOn resettable />
    <SelectInput source="status" choices={status_choices} alwaysOn resettable />
  </Filter>
);
```

ユーザーが入力した値は、以下のようなオブジェクトとして`dataProvider`に渡されます：

```typescript
{
  category: "tech",
  status: "published"
}
```

### 2. DataProvider層

`dataProvider.ts`の`getList`メソッドで、フィルターオブジェクトをそのままAPIに送信します。

```typescript
getList: async (resource, params) => {
  const filter = params.filter || {}; // 複数フィールドのフィルター

  const apiParams: GetListParams = {
    filter,
    sort: { field, order },
    pagination: { perPage, nextToken },
  };

  const data = await sendRequest<GetListData>({
    op: 'getList',
    resource,
    params: apiParams,
  });
};
```

### 3. Records Lambda層

`functions/records/src/operations/getList.ts`で、以下の処理を実行します：

1. **シャドーレコードをQueryで取得**（ソートフィールドのみ）

   ```typescript
   const queryResult = await dbClient.send(
     new QueryCommand({
       KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
       Limit: perPage, // 例: 25件
     })
   );
   ```

2. **本体レコードをBatchGetItemで取得**

3. **クライアント側フィルタリング**（メモリ上でAND条件を適用）
   ```typescript
   if (params.filter && Object.keys(params.filter).length > 0) {
     items = items.filter((record) => {
       return Object.entries(params.filter!).every(([key, value]) => {
         return record[key] === value; // AND条件
       });
     });
   }
   ```

## ページネーションの仕組み

### 無限スクロールを採用する理由

通常のページネーション（1, 2, 3...のボタン）ではなく、無限スクロールを採用しています。

**理由:**

- ソートフィールド以外のフィルターは、DynamoDBから取得後にメモリ上で適用される
- 例: 25件取得 → フィルター後3件になる可能性がある
- 通常のページネーションでは「2ページ目なのに3件しかない」という違和感が生じる
- 無限スクロールなら、スクロールするたびに追加データを取得し、自然なUXを提供できる

### 実装

```tsx
import { InfiniteList } from 'react-admin';

const list = () => (
  <InfiniteList
    filters={<ArticleFilter />}
    sort={{ field: 'updatedAt', order: 'DESC' }}
    perPage={25}
    exporter={false}
  >
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      {/* フィールド定義 */}
    </Datagrid>
  </InfiniteList>
);
```

### nextTokenベースのページネーション

DynamoDBの`LastEvaluatedKey`を使用して、次ページのトークンを生成します。

```typescript
// Records Lambda側
const hasNextPage = queryResult.LastEvaluatedKey !== undefined;
const nextTokenValue = hasNextPage
  ? encodeNextToken(
      queryResult.LastEvaluatedKey!.PK as string,
      queryResult.LastEvaluatedKey!.SK as string
    )
  : undefined;

return {
  items,
  pageInfo: {
    hasNextPage,
    hasPreviousPage: !!nextToken,
  },
  ...(nextTokenValue && { nextToken: nextTokenValue }),
};
```

```typescript
// DataProvider側
return {
  data: data.items as any,
  pageInfo: {
    hasNextPage: data.pageInfo.hasNextPage,
    hasPreviousPage: false, // 無限スクロールでは前ページなし
  },
  // nextToken を meta に保存（次回リクエストで使用）
  ...(data.nextToken && {
    meta: {
      nextToken: data.nextToken,
    },
  }),
};
```

## 動作フロー

### 単一フィールドフィルター（効率的）

```
ユーザー: category="tech" でフィルター
↓
Records Lambda: category シャドーレコードをQuery
↓
DynamoDB: category#tech#id#{id} のレコードを取得（25件）
↓
本体レコードを取得（25件）
↓
フィルター適用: 不要（既にソート済み）
↓
UI: 25件表示
```

### 複数フィールドフィルター（クライアント側フィルタリング）

```
ユーザー: category="tech" AND status="published" でフィルター
↓
Records Lambda: category シャドーレコードをQuery（ソートフィールド）
↓
DynamoDB: category#tech#id#{id} のレコードを取得（25件）
↓
本体レコードを取得（25件）
↓
フィルター適用: status="published" のみ抽出（3件に減少）
↓
UI: 3件表示
↓
ユーザーがスクロール
↓
Records Lambda: 次の25件を取得
↓
フィルター適用: 5件に減少
↓
UI: 累計8件表示（3件 + 5件）
```

## 制約と考慮事項

### 1. シャドウフィールドのnull値の扱い

**重要**: シャドウレコードは、フィールド値が`null`または`undefined`の場合、空文字`""`に変換して生成されます。

```typescript
// Records Lambda (create.ts / update.ts / createMany.ts / updateMany.ts)
let fieldValue = recordData[fieldName];

// null/undefined は空文字に変換してシャドーを生成
if (fieldValue === undefined || fieldValue === null) {
  fieldValue = '';
}

const shadowSK = generateShadowSK(fieldName, fieldValue, id, fieldConfig.type);
shadowKeys.push(shadowSK);
```

**理由**:

- **完全性**: すべてのレコードがリスト表示される
- **ソート順序**: 空値は先頭にソートされる（文字列の場合）
- **一貫性**: null/undefined/空文字を統一的に扱える

**影響**:

- すべてのレコードがリストに表示される（値がnullでも）
- 空値のレコードはソート順序の先頭に表示される
- 例: `tasks`リソースで`dueDate`が`null`の場合、dueDateでソートすると先頭に表示される

**ベストプラクティス**:

- 重要なフィールドは必須にする（`validate={[required()]}`）
- デフォルト値を設定する（`defaultValue="..."`）
- 空値を許容する場合は、UIで「未設定」などの表示を追加する

### 2. 複数フィルター時の件数変動

- DynamoDBから取得する件数（`perPage`）と、実際に表示される件数は異なる可能性がある
- 無限スクロールUIにより、ユーザー体験への影響を最小化

### 2. 総件数の非表示

- DynamoDBでは総件数を効率的に取得できない
- `total`は`undefined`として扱い、UIには表示しない

### 3. ソートフィールドの選択

- ソート可能なフィールドは、`shadow.config.json`で定義されたシャドーレコードのみ
- 必須シャドー: `id`, `name`, `createdAt`, `updatedAt`
- カスタムシャドー: リソースごとに定義

### 4. パフォーマンス

- 単一フィールドフィルター: 効率的（DynamoDB Queryのみ）
- 複数フィールドフィルター: クライアント側フィルタリングが必要
- 大規模データセットでは、よく使われるフィルター組み合わせに対して複合シャドウレコードの追加を検討

## 将来の改善案

### 1. 複合シャドウレコード

よく使われるフィルター組み合わせに対して、複合シャドウレコードを生成：

```
SK: category#tech#status#published#id#{id}
```

メリット:

- 複数フィールドフィルターでもDynamoDB Queryのみで完結
- ページネーション精度の向上

デメリット:

- シャドウレコード数の増加
- ストレージコストの増加

### 2. オーバーフェッチ戦略

`Limit`を大きめに設定（例: `perPage * 3`）して、フィルター後の件数を目標値に近づける：

```typescript
Limit: perPage * 3,  // 75件取得 → フィルター後 20-25件程度
```

メリット:

- ページネーション精度の向上
- 追加リクエスト数の削減

デメリット:

- DynamoDB読み取りコストの増加
- Lambda実行時間の増加

### 3. ElasticSearch/OpenSearch統合

全文検索や複雑なフィルタリングが必要な場合、検索エンジンを統合：

メリット:

- 高度な検索機能
- 正確なページネーション
- 総件数の取得

デメリット:

- インフラコストの増加
- データ同期の複雑化
