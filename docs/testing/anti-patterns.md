# テストのアンチパターン

## 概要

このドキュメントでは、dynamodb-clientプロジェクトでテストを書く際に避けるべきアンチパターンを説明します。

## 1. 型アサーション（`as any`）の乱用

### ❌ アンチパターン

```typescript
const mockResponse = {
  count: 1,
  successIds: { 0: 'id-1' },
  failedIds: {},
  errors: {},
} as any; // 型安全性を完全に放棄

vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
```

### 問題点

- 型チェックが無効化される
- インターフェースが変更されても検知できない
- テストの信頼性が低下
- 将来のバグの原因となる

### ✅ 正しいパターン

```typescript
const mockResponse = insertManyResultBuilder.success(1, ['id-1']);

vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
```

## 2. 不完全なモックレスポンス

### ❌ アンチパターン

```typescript
const mockResponse = {
  count: 1,
  successIds: { 0: 'id-1' },
  // failedIdsとerrorsが欠落
};

vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse as any);
```

### 問題点

- 実際のインターフェースと一致しない
- プロダクションコードで予期しないエラーが発生する可能性
- テストが実際の動作を正確に反映しない

### ✅ 正しいパターン

```typescript
const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
// {
//   count: 1,
//   successIds: { 0: 'id-1' },
//   failedIds: {},
//   errors: {}
// }
```

## 3. プレーンオブジェクトでエラーを模倣

### ❌ アンチパターン

```typescript
const mockError = {
  id: 'record-123',
  code: 'NOT_FOUND',
  message: 'Record not found',
}; // 実際のエラークラスではない

const mockResponse = {
  count: 0,
  successIds: {},
  failedIds: { 0: 'record-123' },
  errors: { 0: mockError },
};
```

### 問題点

- 実際のエラークラスと動作が異なる
- エラーハンドリングのテストが不正確
- `instanceof`チェックが機能しない

### ✅ 正しいパターン

```typescript
const mockResponse = insertManyResultBuilder.failure(['record-123'], {
  0: errorSimulator.itemNotFound('record-123'),
});
// 実際のItemNotFoundErrorインスタンスを使用
```

## 4. モックの重複定義

### ❌ アンチパターン

```typescript
describe('insertOne tests', () => {
  it('test 1', async () => {
    const mockResponse = {
      count: 1,
      successIds: { 0: 'id-1' },
      failedIds: {},
      errors: {},
    };
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });

  it('test 2', async () => {
    const mockResponse = {
      count: 1,
      successIds: { 0: 'id-2' },
      failedIds: {},
      errors: {},
    };
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });

  it('test 3', async () => {
    const mockResponse = {
      count: 1,
      successIds: { 0: 'id-3' },
      failedIds: {},
      errors: {},
    };
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });
});
```

### 問題点

- コードの重複が多い
- メンテナンスが困難
- 変更時に複数箇所を修正する必要がある

### ✅ 正しいパターン

```typescript
describe('insertOne tests', () => {
  it('test 1', async () => {
    const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });

  it('test 2', async () => {
    const mockResponse = insertManyResultBuilder.success(1, ['id-2']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });

  it('test 3', async () => {
    const mockResponse = insertManyResultBuilder.success(1, ['id-3']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });
});
```

## 5. 不適切なエラーインデックス

### ❌ アンチパターン

```typescript
const mockResponse = {
  count: 1,
  successIds: { 0: 'id-1', 2: 'id-3' },
  failedIds: { 1: 'id-2' },
  errors: {
    0: { id: 'id-2', code: 'ERROR', message: 'Error' }, // インデックスが間違っている
  },
};
```

### 問題点

- `failedIds`のインデックス（1）と`errors`のインデックス（0）が一致しない
- 実際の動作と異なる
- バグの原因となる

### ✅ 正しいパターン

```typescript
const mockResponse = updateManyResultBuilder.partialFailure(['id-1', 'id-2', 'id-3'], {
  1: errorSimulator.validationError('id-2', 'Validation error'),
});
// {
//   count: 2,
//   successIds: { 0: 'id-1', 2: 'id-3' },
//   failedIds: { 1: 'id-2' },
//   errors: { 1: { id: 'id-2', code: 'VALIDATION_ERROR', message: 'Validation error' } }
// }
```

## 6. beforeEachでモックをクリアしない

### ❌ アンチパターン

```typescript
describe('insertOne tests', () => {
  // beforeEachがない

  it('test 1', async () => {
    const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });

  it('test 2', async () => {
    // test 1のモックが残っている可能性がある
    const mockResponse = insertManyResultBuilder.success(1, ['id-2']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });
});
```

### 問題点

- テスト間で状態が共有される
- 前のテストの影響を受ける
- テストの独立性が損なわれる
- デバッグが困難

### ✅ 正しいパターン

```typescript
describe('insertOne tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test 1', async () => {
    const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });

  it('test 2', async () => {
    const mockResponse = insertManyResultBuilder.success(1, ['id-2']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
    // ...
  });
});
```

## 7. 空配列の不適切な型アサーション

### ❌ アンチパターン

```typescript
const mockResponse: any[] = []; // 型アサーションを使用

vi.mocked(findManyModule.handleFindMany).mockResolvedValue(mockResponse);
```

### 問題点

- 型安全性が損なわれる
- 実際の型と一致しない可能性がある

### ✅ 正しいパターン

```typescript
const mockResponse = findManyResultBuilder.success([]);

vi.mocked(findManyModule.handleFindMany).mockResolvedValue(mockResponse);
```

## 8. 不適切なエラーコード

### ❌ アンチパターン

```typescript
const mockError = {
  id: 'record-123',
  code: 'ERROR', // 不明確なエラーコード
  message: 'Something went wrong',
};
```

### 問題点

- エラーコードが不明確
- 実際のエラーコードと一致しない
- エラーハンドリングのテストが不正確

### ✅ 正しいパターン

```typescript
// 明確なエラーコードを使用
const mockError1 = errorSimulator.itemNotFound('record-123');
// code: 'ITEM_NOT_FOUND'

const mockError2 = errorSimulator.validationError('record-123', 'Invalid data');
// code: 'VALIDATION_ERROR'

const mockError3 = errorSimulator.operationError('record-123', 'DB_ERROR', 'Database error');
// code: 'DB_ERROR'
```

## 9. テストの説明が不明確

### ❌ アンチパターン

```typescript
it('test 1', async () => {
  // テストの目的が不明
});

it('works', async () => {
  // 何が動作するのか不明
});

it('should return data', async () => {
  // どのようなデータを返すのか不明
});
```

### 問題点

- テストの目的が不明確
- 失敗時に原因を特定しにくい
- ドキュメントとしての価値が低い

### ✅ 正しいパターン

```typescript
it('insertMany([data])を呼び出して作成されたレコードを返す', async () => {
  // テストの目的が明確
});

it('レコードが存在しない場合はItemNotFoundErrorをスローする', async () => {
  // 期待される動作が明確
});

it('部分失敗の場合は成功したレコードと失敗したレコードを返す', async () => {
  // テストのシナリオが明確
});
```

## 10. モックの検証不足

### ❌ アンチパターン

```typescript
it('insertOneが動作する', async () => {
  const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
  vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

  await handleInsertOne(resource, { data: testData }, requestId);

  // モックが呼び出されたかを検証していない
  // 引数が正しいかを検証していない
});
```

### 問題点

- モックが実際に呼び出されたか不明
- 正しい引数で呼び出されたか不明
- テストの信頼性が低い

### ✅ 正しいパターン

```typescript
it('insertMany([data])を正しい引数で呼び出す', async () => {
  const testData = { title: 'テスト記事', content: 'テスト内容' };
  const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
  vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

  await handleInsertOne(resource, { data: testData }, requestId);

  // モックが呼び出されたことを確認
  expect(insertManyModule.handleInsertMany).toHaveBeenCalledTimes(1);

  // 正しい引数で呼び出されたことを確認
  expect(insertManyModule.handleInsertMany).toHaveBeenCalledWith(
    resource,
    { data: [testData] },
    requestId
  );
});
```

## まとめ

### 避けるべきアンチパターン

1. ❌ `as any`の乱用
2. ❌ 不完全なモックレスポンス
3. ❌ プレーンオブジェクトでエラーを模倣
4. ❌ モックの重複定義
5. ❌ 不適切なエラーインデックス
6. ❌ beforeEachでモックをクリアしない
7. ❌ 空配列の不適切な型アサーション
8. ❌ 不適切なエラーコード
9. ❌ テストの説明が不明確
10. ❌ モックの検証不足

### 推奨される代替手段

1. ✅ Response Buildersを使用
2. ✅ Error Simulatorsを使用
3. ✅ beforeEachでvi.clearAllMocks()を呼び出す
4. ✅ 明確なテストの説明を記述
5. ✅ モックの呼び出しと引数を検証

これらのアンチパターンを避けることで、保守性が高く信頼性のあるテストを作成できます。
