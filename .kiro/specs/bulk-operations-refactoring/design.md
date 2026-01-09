# バルク操作リファクタリング - 設計書

## 概要

dynamodb-clientの単一操作（findOne, insertOne, updateOne, deleteOne）を、バルク操作（findMany, insertMany, updateMany, deleteMany）を内部で使用するように共通化します。これにより、コードの重複を削減し、保守性を向上させます。

**重要な設計原則:**
- **単一操作はバルク操作のサブセット**: findOne は findMany([id]) を呼び出して先頭の1件を取得
- **バルク操作は独立**: バルク操作は単一操作に依存せず、既存の実装を維持
- **コードの重複削減**: 単一操作の検証、シャドウ生成、エラーハンドリングをバルク操作で共通化

## アーキテクチャ

### 現在の実装

```
findOne.ts    findMany.ts
insertOne.ts  insertMany.ts
updateOne.ts  updateMany.ts
deleteOne.ts  deleteMany.ts
```

各操作が独立して実装されており、コードの重複が多い。

### リファクタリング後の実装

```
findOne.ts ──→ findMany.ts (findOne内部でfindMany([id])を呼び出し)
insertOne.ts ─→ insertMany.ts (insertOne内部でinsertMany([data])を呼び出し)
updateOne.ts ─→ updateMany.ts (updateOne内部でupdateMany([id], data)を呼び出し)
deleteOne.ts ─→ deleteMany.ts (deleteOne内部でdeleteMany([id])を呼び出し)
```

単一操作がバルク操作を内部で使用することで、コードの重複を削減。バルク操作は既存の実装を維持し、効率的な処理を提供。

## コンポーネント設計

### バルク操作（変更なし）

バルク操作は既存の実装を維持します。単一操作に依存しない独立した実装を持ちます。

**findMany.ts**
- idsまたはfilterで複数レコードを取得
- BatchGetItemまたはfind操作を使用
- __shadowKeysを除外してレスポンスを返す
- 効率的な一括取得を提供

**insertMany.ts**
- 複数レコードを一括作成
- ULIDを生成してレコードIDを作成
- シャドウレコードを生成して一括保存
- チャンク分割してTransactWriteItemsで効率的に処理

**updateMany.ts**
- idsまたはfilterで複数レコードを更新
- JSON Merge Patchを適用
- シャドウレコードの差分を計算して更新
- チャンク分割してTransactWriteItemsで効率的に処理
- upsertオプションをサポート

**deleteMany.ts**
- idsまたはfilterで複数レコードを削除
- メインレコードとシャドウレコードを一括削除
- チャンク分割してTransactWriteItemsで効率的に処理

### 単一操作（リファクタリング対象）

単一操作はバルク操作を内部で使用するように変更します。

#### findOne.ts

**現在の実装:**
```typescript
// idが指定された場合はGetItemで取得
if ('id' in params) {
  const result = await dbClient.send(new GetCommand({
    TableName: tableName,
    Key: { PK: resource, SK: generateMainRecordSK(id) },
  }));
  
  if (!result.Item) {
    throw new ItemNotFoundError(resource, id);
  }
  
  const { __shadowKeys, ...data } = result.Item;
  return data;
}

// filterが指定された場合はfind操作で検索
if ('filter' in params) {
  const findResult = await handleFind(resource, { filter }, requestId);
  if (findResult.items.length === 0) {
    throw new ItemNotFoundError(resource, JSON.stringify(filter));
  }
  return findResult.items[0];
}
```

**リファクタリング後:**
```typescript
// idが指定された場合はfindManyを呼び出し
if ('id' in params) {
  const result = await handleFindMany(resource, { ids: [id] }, requestId);
  
  // 既存のインターフェースを維持: 見つからない場合はItemNotFoundErrorをスロー
  if (result.length === 0) {
    throw new ItemNotFoundError(resource, id);
  }
  
  // 既存のインターフェースを維持: 単一レコードを返す
  return result[0];
}

// filterが指定された場合はfindManyを呼び出し
if ('filter' in params) {
  const result = await handleFindMany(resource, { filter }, requestId);
  
  // 既存のインターフェースを維持: 見つからない場合はItemNotFoundErrorをスロー
  if (result.length === 0) {
    throw new ItemNotFoundError(resource, JSON.stringify(filter));
  }
  
  // 既存のインターフェースを維持: 単一レコードを返す
  return result[0];
}
```

**インターフェースの維持:**
- **戻り値**: 単一レコードオブジェクトを返す（配列ではない）
- **エラー**: レコードが見つからない場合は`ItemNotFoundError`をスロー
- **既存コードとの互換性**: 完全に維持

**利点:**
- findManyの検証ロジックを再利用
- __shadowKeysの除外処理を共通化
- エラーハンドリングを統一
- コードの重複を削減（GetItemの実装が不要）
- **既存のAPIインターフェースを完全に維持**

**パフォーマンス考慮:**
- BatchGetItemの代わりに1件のみのBatchGetItemを使用
- 実用上の影響は最小限（1件のみの取得）

#### updateOne.ts

**現在の実装:**
```typescript
// 既存レコードを取得
const getResult = await dbClient.send(new GetCommand({ ... }));

// JSON Merge Patchを適用
const mergedData = applyJsonMergePatch(existingData, patchData);
const updatedData = addUpdateTimestamp(mergedData);

// シャドウレコードの差分を計算
const newShadowRecords = generateShadowRecords(updatedData, resource, shadowConfig);
const shadowDiff = calculateShadowDiff(existingShadowKeys, newShadowRecords);

// TransactWriteItemsで更新
await dbClient.send(new TransactWriteCommand({ ... }));
```

**リファクタリング後:**
```typescript
// updateManyを呼び出し
const result = await handleUpdateMany(
  resource,
  { ids: [id], data: patchData },
  requestId
);

// 既存のインターフェースを維持: 失敗した場合はエラーをスロー
if (Object.keys(result.failedIds).length > 0) {
  const error = result.errors[0];
  throw new Error(error.message);
}

// 既存のインターフェースを維持: 更新されたレコードを取得して返す
const updatedRecord = await handleFindOne(resource, { id }, requestId);
return updatedRecord;
```

**インターフェースの維持:**
- **戻り値**: 更新されたレコードオブジェクトを返す（updateManyの結果形式ではない）
- **エラー**: 更新失敗時は通常のErrorをスロー（部分失敗の形式ではない）
- **既存コードとの互換性**: 完全に維持

**利点:**
- updateManyの検証ロジックを再利用
- JSON Merge Patchの適用を共通化
- シャドウレコードの差分計算を共通化
- upsertオプションのサポートを自動的に継承
- コードの重複を削減
- **既存のAPIインターフェースを完全に維持**

**パフォーマンス考慮:**
- 1件のみのupdateManyを呼び出すため、オーバーヘッドは最小限
- 更新後にfindOneを呼び出すため、1回の追加GetItemが発生
- 実用上の影響は小さい

#### insertOne.ts

**現在の実装:**
```typescript
// ULIDを生成してレコードIDを作成
const id = (params.data.id as string | undefined) || ulid();

// タイムスタンプとTTLを追加
let recordData = addCreateTimestamps({ ...params.data, id });
recordData = addTTL(resource, recordData);

// シャドーレコードを生成
const shadowRecords = generateShadowRecords(recordData, resource, shadowConfig);

// メインレコードを保存
await dbClient.send(new PutCommand({ ... }));

// シャドーレコードを保存
for (const shadowRecord of shadowRecords) {
  await dbClient.send(new PutCommand({ ... }));
}
```

**リファクタリング後:**
```typescript
// insertManyを呼び出し
const result = await handleInsertMany(
  resource,
  { data: [params.data] },
  requestId
);

// 既存のインターフェースを維持: 失敗した場合はエラーをスロー
if (Object.keys(result.failedIds).length > 0) {
  const error = result.errors[0];
  throw new Error(error.message);
}

// 既存のインターフェースを維持: 作成されたレコードのIDを取得
const createdId = Object.values(result.successIds)[0];
if (!createdId) {
  throw new Error('Failed to get created record ID');
}

// 既存のインターフェースを維持: 作成されたレコードを取得して返す
const createdRecord = await handleFindOne(resource, { id: createdId }, requestId);
return createdRecord;
```

**インターフェースの維持:**
- **戻り値**: 作成されたレコードオブジェクトを返す（insertManyの結果形式ではない）
- **エラー**: 作成失敗時は通常のErrorをスロー（部分失敗の形式ではない）
- **既存コードとの互換性**: 完全に維持

**利点:**
- insertManyの検証ロジックを再利用
- ULID生成、タイムスタンプ追加、TTL追加を共通化
- シャドウレコードの生成処理を共通化
- コードの重複を削減
- **既存のAPIインターフェースを完全に維持**

**パフォーマンス考慮:**
- 1件のみのinsertManyを呼び出すため、オーバーヘッドは最小限
- 作成後にfindOneを呼び出すため、1回の追加GetItemが発生
- 実用上の影響は小さい

#### deleteOne.ts

**現在の実装:**
```typescript
// 既存レコードを取得
const getResult = await dbClient.send(new GetCommand({ ... }));

// __shadowKeysを取得
const shadowKeys = (existingData.__shadowKeys as string[]) || [];

// TransactWriteItemsで削除
await dbClient.send(new TransactWriteCommand({ ... }));
```

**リファクタリング後:**
```typescript
// deleteManyを呼び出し
const result = await handleDeleteMany(
  resource,
  { ids: [id] },
  requestId
);

// 既存のインターフェースを維持: 失敗した場合はエラーをスロー
if (Object.keys(result.failedIds).length > 0) {
  const error = result.errors[0];
  throw new Error(error.message);
}

// 既存のインターフェースを維持: 削除されたIDを返す
return { id };
```

**インターフェースの維持:**
- **戻り値**: `{ id }` オブジェクトを返す（deleteManyの結果形式ではない）
- **エラー**: 削除失敗時は通常のErrorをスロー（部分失敗の形式ではない）
- **既存コードとの互換性**: 完全に維持

**利点:**
- deleteManyの検証ロジックを再利用
- シャドウレコードの削除処理を共通化
- エラーハンドリングを統一
- コードの重複を削減
- **既存のAPIインターフェースを完全に維持**

**パフォーマンス考慮:**
- 1件のみのdeleteManyを呼び出すため、オーバーヘッドは最小限
- 実用上の影響は小さい

## データモデル

変更なし。既存のデータモデルを維持します。

## 後方互換性

### 単一操作のインターフェース維持

**重要**: 単一操作のインターフェース（戻り値の型とエラーハンドリング）は完全に維持されます。

#### findOne

```typescript
// 戻り値: 単一レコードオブジェクト（配列ではない）
const venue: Venue = await handleFindOne(resource, { id: '123' }, requestId);

// エラー: レコードが見つからない場合
throw new ItemNotFoundError(resource, id);
```

#### insertOne

```typescript
// 戻り値: 作成されたレコードオブジェクト（insertManyの結果形式ではない）
const createdVenue: Venue = await handleInsertOne(resource, { data: { name: 'New Venue' } }, requestId);

// エラー: 作成失敗時は通常のError
throw new Error(error.message);
```

#### updateOne

```typescript
// 戻り値: 更新されたレコードオブジェクト（updateManyの結果形式ではない）
const updatedVenue: Venue = await handleUpdateOne(resource, { id: '123', data: { name: 'New Name' } }, requestId);

// エラー: 更新失敗時は通常のError
throw new Error(error.message);
```

#### deleteOne

```typescript
// 戻り値: { id } オブジェクト（deleteManyの結果形式ではない）
const result: { id: string } = await handleDeleteOne(resource, { id: '123' }, requestId);

// エラー: 削除失敗時は通常のError
throw new Error(error.message);
```

### バルク操作のインターフェース維持

バルク操作は既存の実装を維持するため、インターフェースも変更ありません。

```typescript
// findMany: レコード配列を返す
const venues: Venue[] = await handleFindMany(resource, { ids: ['123', '456'] }, requestId);

// updateMany: 成功/失敗を個別に追跡
const result: UpdateManyData = await handleUpdateMany(resource, { ids: ['123', '456'], data: { ... } }, requestId);
// result.successIds, result.failedIds, result.errors

// deleteMany: 成功/失敗を個別に追跡
const result: DeleteManyData = await handleDeleteMany(resource, { ids: ['123', '456'] }, requestId);
// result.successIds, result.failedIds, result.errors
```

## 正確性プロパティ

*プロパティは、システムが満たすべき特性や動作を形式的に記述したものです。プロパティベーステストでは、これらのプロパティが全ての有効な入力に対して成立することを検証します。*

### Property 1: 単一操作はバルク操作を使用する

*For any* 単一操作（findOne, updateOne, deleteOne）と任意のレコードID、単一操作を実行すると、内部で対応するバルク操作（findMany, updateMany, deleteMany）が1件のIDで呼び出される

**Validates: Requirements 1.1, 1.2**

### Property 2: 単一操作は1レコードのみを返す

*For any* 単一操作（findOne, updateOne, deleteOne）と任意のレコードID、単一操作を実行すると、バルク操作の結果から先頭の1レコードのみが返される

**Validates: Requirements 1.3**

### Property 3: バルク操作は独立している

*For any* バルク操作（findMany, updateMany, deleteMany）と任意のレコードIDリスト、バルク操作を実行すると、単一操作に依存せず独立して処理される

**Validates: Requirements 2.1, 2.4**

### Property 4: バルク操作は効率的に処理する

*For any* バルク操作（findMany, updateMany, deleteMany）と任意のレコードIDリスト、バルク操作を実行すると、BatchGetItemまたはTransactWriteItemsを使用して効率的に処理される

**Validates: Requirements 2.2, 4.2, 4.3**

### Property 5: 後方互換性の維持

*For any* 既存のテストケース、リファクタリング後も全てのテストケースが成功する

**Validates: Requirements 3.1, 3.2, 3.3, 6.5**

### Property 6: 統一されたエラー形式

*For any* 操作でエラーが発生した場合、エラーレスポンスにはエラーコード、メッセージ、レコードIDが含まれる

**Validates: Requirements 5.1, 5.3**

### Property 7: 部分失敗のハンドリング

*For any* バルク操作で一部のレコードが失敗した場合、成功したレコードと失敗したレコードが正しく分類される

**Validates: Requirements 5.2**

### Property 8: バルク操作の呼び出し検証

*For any* 単一操作のテスト、バルク操作が正しく呼び出されることをモックで検証する

**Validates: Requirements 6.3**

## エラーハンドリング

### エラーの種類

1. **ItemNotFoundError**: レコードが存在しない
2. **ValidationError**: 入力データの検証エラー
3. **DynamoDBError**: DynamoDB操作のエラー
4. **InternalError**: その他の内部エラー

### エラーレスポンス形式

```typescript
{
  id: string;           // レコードID
  code: string;         // エラーコード
  message: string;      // エラーメッセージ
}
```

### 部分失敗のハンドリング

バルク操作では、一部のレコードが失敗しても、成功したレコードは正常に処理されます。

```typescript
{
  count: number;                              // 成功件数
  successIds: Record<number, string>;         // 成功したレコードのインデックスとID
  failedIds: Record<number, string>;          // 失敗したレコードのインデックスとID
  errors: Record<number, OperationError>;     // エラー情報
}
```

## テスト戦略

### ユニットテスト

各単一操作と共通ユーティリティのユニットテストを作成します。

**テスト対象:**
- findOne, updateOne, deleteOne
- bulkOperationHelper.ts
- エラーハンドリング

**テストケース:**
- 正常系: レコードが存在する場合
- 異常系: レコードが存在しない場合
- 異常系: 入力データが不正な場合

### プロパティベーステスト

プロパティベーステストでは、ランダムに生成された入力データに対してプロパティが成立することを検証します。

**テスト対象:**
- Property 1: バルク操作は単一操作を使用する
- Property 2: 単一操作は1レコードのみを処理する
- Property 3: 単一操作は完全な機能を提供する
- Property 5: チャンク分割の維持
- Property 6: 統一されたエラー形式
- Property 7: 部分失敗のハンドリング
- Property 8: 単一操作の呼び出し検証

**テスト設定:**
- 最小100回の反復実行
- ランダムなレコードID、データ、エラーケースを生成

### 統合テスト

既存の統合テストを実行して、後方互換性を検証します。

**テスト対象:**
- Property 4: 後方互換性の維持

**テストケース:**
- 既存の全テストケースが成功すること

### テストカバレッジ

**目標:**
- 全体のテストカバレッジ率: 80%以上
- 新規コード（bulkOperationHelper.ts）のテストカバレッジ率: 90%以上

**測定方法:**
- vitestのカバレッジレポートを使用
- CIパイプラインでカバレッジを自動測定

## 実装計画

### Phase 1: findOneのリファクタリング

1. findOne.tsを修正してfindManyを使用
2. ユニットテストを作成
3. プロパティベーステストを作成
4. 既存のテストが成功することを確認

### Phase 2: updateOneのリファクタリング

1. updateOne.tsを修正してupdateManyを使用
2. ユニットテストを作成
3. プロパティベーステストを作成
4. 既存のテストが成功することを確認

### Phase 3: deleteOneのリファクタリング

1. deleteOne.tsを修正してdeleteManyを使用
2. ユニットテストを作成
3. プロパティベーステストを作成
4. 既存のテストが成功することを確認

### Phase 4: テストカバレッジの確認

1. 全体のテストカバレッジを測定
2. 80%以上を達成していることを確認
3. 新規コードのテストカバレッジを測定
4. 90%以上を達成していることを確認

## パフォーマンス考慮事項

### バルク操作の実装（変更なし）

- BatchGetItem: 1回のAPI呼び出しで複数レコードを取得
- TransactWriteItems: 1回のトランザクションで最大100アイテムを処理
- チャンク分割: 大量データを効率的に処理

### 単一操作のリファクタリング後

- findOne: findMany([id]) を呼び出し、先頭の1件を取得
- updateOne: updateMany([id], data) を呼び出し、結果を検証
- deleteOne: deleteMany([id]) を呼び出し、結果を検証

### パフォーマンス影響

**findOne:**
- BatchGetItemを1件のみで使用するため、オーバーヘッドは最小限
- 実用上の影響はほぼなし

**updateOne:**
- updateManyを1件のみで呼び出すため、オーバーヘッドは最小限
- 更新後にfindOneを呼び出すため、1回の追加GetItemが発生
- 実用上の影響は小さい

**deleteOne:**
- deleteManyを1件のみで呼び出すため、オーバーヘッドは最小限
- 実用上の影響はほぼなし

### 利点

**コードの重複削減:**
- 単一操作の検証、シャドウ生成、エラーハンドリングをバルク操作で共通化
- 保守性が大幅に向上

**バルク操作の効率性維持:**
- バルク操作は既存の実装を維持
- BatchGetItemとTransactWriteItemsによる効率的な処理を継続

## 移行計画

### 段階的な移行

1. **Phase 1**: findManyのリファクタリング（影響が小さい）
2. **Phase 2**: updateManyのリファクタリング（チャンク分割を維持）
3. **Phase 3**: deleteManyのリファクタリング（チャンク分割を維持）

### ロールバック計画

各Phaseで既存のテストが失敗した場合、即座にロールバックします。

### モニタリング

リファクタリング後、以下の指標をモニタリングします：

- API呼び出し回数
- レスポンスタイム
- エラー率
- テストカバレッジ

## まとめ

このリファクタリングにより、以下のメリットが得られます：

1. **コードの重複削減**: 単一操作がバルク操作を使用することで、重複コードを大幅に削減
2. **保守性の向上**: 検証、シャドウ生成、エラーハンドリングがバルク操作に集約され、保守が容易
3. **テスト容易性の向上**: バルク操作のテストが単一操作にも適用される
4. **後方互換性の維持**: 既存のAPIとレスポンス形式を維持
5. **パフォーマンスの維持**: バルク操作は既存の実装を維持し、効率的な処理を継続
6. **単一操作のシンプル化**: 単一操作はバルク操作を呼び出すだけのシンプルな実装になる
