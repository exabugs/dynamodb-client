# テストのベストプラクティス

## 概要

このドキュメントでは、dynamodb-clientプロジェクトでテストを書く際のベストプラクティスを説明します。

## 基本原則

### 1. 型安全性を最優先

**❌ 悪い例: 型アサーションを使用**

```typescript
const mockResponse = {
  count: 1,
  successIds: { 0: 'id-1' },
  failedIds: {},
  errors: {},
} as any; // 型安全性を損なう

vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
```

**✅ 良い例: Response BuilderとVitestの標準機能を使用**

```typescript
const mockResponse = insertManyResultBuilder.success(1, ['id-1']);

// Vitestの標準機能で型安全にモックを設定
vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);
```

**理由**:

- Response Builderは実際の型定義と完全に一致
- `vi.mocked()`で型安全なモック操作
- インターフェースが変更された場合、型エラーで即座に検知
- テストの信頼性が向上

### 2. 実際のエラークラスを使用

**❌ 悪い例: プレーンオブジェクトでエラーを模倣**

```typescript
const mockError = {
  id: 'record-123',
  code: 'NOT_FOUND',
  message: 'Record not found',
}; // 実際のエラークラスではない
```

**✅ 良い例: Error Simulatorを使用**

```typescript
const mockError = errorSimulator.itemNotFound('record-123');
// 実際のItemNotFoundErrorインスタンスを生成
```

**理由**:

- 実際のエラークラスと同じ動作を保証
- エラーハンドリングのテストが正確
- プロダクションコードとの整合性が保たれる

### 3. モックの重複を避ける

**❌ 悪い例: 各テストで同じモックを繰り返し定義**

```typescript
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
```

**✅ 良い例: Response Builderで簡潔に**

```typescript
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
```

**理由**:

- コードの重複を削減
- テストの可読性が向上
- メンテナンスが容易

## エラーケースのテスト

### 完全失敗のテスト

```typescript
it('全てのレコードが失敗した場合', async () => {
  const ids = ['id-1', 'id-2'];

  const mockResponse = insertManyResultBuilder.failure(ids, {
    0: errorSimulator.validationError('id-1', 'Invalid data'),
    1: errorSimulator.validationError('id-2', 'Invalid data'),
  });

  vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

  await expect(handleInsertOne(resource, { data: testData }, requestId)).rejects.toThrow(
    'Failed to insert record'
  );
});
```

### 部分失敗のテスト

```typescript
it('一部のレコードが失敗した場合', async () => {
  const ids = ['id-1', 'id-2', 'id-3'];

  const mockResponse = updateManyResultBuilder.partialFailure(ids, {
    1: errorSimulator.itemNotFound('id-2'),
  });

  vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockResponse);

  const result = await handleUpdateMany(resource, { ids, data: testData }, requestId);

  // 成功したレコードを確認
  expect(result.count).toBe(2);
  expect(result.successIds).toEqual({ 0: 'id-1', 2: 'id-3' });

  // 失敗したレコードを確認
  expect(result.failedIds).toEqual({ 1: 'id-2' });
  expect(result.errors[1]).toBeDefined();
});
```

### エラーの種類別テスト

```typescript
describe('エラーケース', () => {
  it('レコードが見つからない場合', async () => {
    const mockResponse = updateManyResultBuilder.failure(['id-1'], {
      0: errorSimulator.itemNotFound('id-1'),
    });

    vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockResponse);

    await expect(
      handleUpdateOne(resource, { id: 'id-1', data: testData }, requestId)
    ).rejects.toThrow('Failed to update record');
  });

  it('バリデーションエラーの場合', async () => {
    const mockResponse = insertManyResultBuilder.failure(['temp-id'], {
      0: errorSimulator.validationError('temp-id', 'Invalid email format'),
    });

    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

    await expect(handleInsertOne(resource, { data: testData }, requestId)).rejects.toThrow(
      'Failed to insert record'
    );
  });

  it('データベースエラーの場合', async () => {
    const mockResponse = deleteManyResultBuilder.failure(['id-1'], {
      0: errorSimulator.operationError('id-1', 'DB_ERROR', 'Database connection failed'),
    });

    vi.mocked(deleteManyModule.handleDeleteMany).mockResolvedValue(mockResponse);

    await expect(handleDeleteOne(resource, { id: 'id-1' }, requestId)).rejects.toThrow(
      'Failed to delete record'
    );
  });
});
```

## テストの構造化

### describe/itの適切な使用

```typescript
describe('insertOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('レコード作成が成功した場合', () => {
    it('insertMany([data])を呼び出して作成されたレコードを返す', async () => {
      // テストコード
    });

    it('作成されたレコードのIDを返す', async () => {
      // テストコード
    });
  });

  describe('レコード作成が失敗した場合', () => {
    it('バリデーションエラーの場合はErrorをスローする', async () => {
      // テストコード
    });

    it('データベースエラーの場合はErrorをスローする', async () => {
      // テストコード
    });
  });
});
```

### beforeEachでモックをクリア

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**理由**:

- テスト間の独立性を保証
- 前のテストの影響を受けない
- テストの信頼性が向上

## モックの検証

### 呼び出し回数の確認

```typescript
it('insertManyが1回だけ呼び出される', async () => {
  const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
  vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

  await handleInsertOne(resource, { data: testData }, requestId);

  expect(insertManyModule.handleInsertMany).toHaveBeenCalledTimes(1);
});
```

### 引数の確認

```typescript
it('正しい引数でinsertManyを呼び出す', async () => {
  const testData = { title: 'テスト記事', content: 'テスト内容' };
  const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
  vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

  await handleInsertOne(resource, { data: testData }, requestId);

  expect(insertManyModule.handleInsertMany).toHaveBeenCalledWith(
    resource,
    { data: [testData] },
    requestId
  );
});
```

## テストデータの管理

### 定数の使用

```typescript
describe('updateOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';
  const testId = 'article-001';
  const testData = {
    title: '更新後のタイトル',
    content: '更新後の内容',
  };

  // テストで定数を使用
  it('更新が成功した場合', async () => {
    const mockResponse = updateManyResultBuilder.success(1, [testId]);
    // ...
  });
});
```

### テストデータの明確化

```typescript
it('複数フィールドを更新する場合', async () => {
  const testData = {
    title: '新しいタイトル',
    content: '新しい内容',
    status: 'published',
    updatedAt: '2025-01-02T00:00:00Z',
  };

  const mockResponse = updateManyResultBuilder.success(1, ['id-1']);
  vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockResponse);

  // テストコード
});
```

## 統合テストとユニットテストの使い分け

### ユニットテスト（直接テスト）

**目的**: 特定の関数が依存する関数を正しく呼び出しているかを確認

```typescript
// __tests__/operations/insertOne-direct.test.ts
describe('insertOne - 直接テスト', () => {
  it('insertManyを正しく呼び出す', async () => {
    const mockResponse = insertManyResultBuilder.success(1, ['id-1']);
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

    await handleInsertOne(resource, { data: testData }, requestId);

    expect(insertManyModule.handleInsertMany).toHaveBeenCalledWith(
      resource,
      { data: [testData] },
      requestId
    );
  });
});
```

### 統合テスト

**目的**: 実際のHTTPリクエスト/レスポンスを含むエンドツーエンドの動作を確認

```typescript
// __tests__/operations/updateOne-filter.test.ts
describe('updateOne with filter', () => {
  it('should update existing record by filter', async () => {
    const db = client.db('test');
    const collection = db.collection<TestDevice>('devices');

    // fetchをモック（HTTPレベル）
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: 'device-1',
          userId: 'user-1',
          // ...
        },
      }),
    });

    const result = await collection.updateOne({ token: testToken }, { $set: { userId: 'user-1' } });

    expect(result.matchedCount).toBe(1);
  });
});
```

## まとめ

1. **型安全性**: Vitestの`vi.fn<typeof operation>()`とResponse Builders、Error Simulatorsを使用
2. **エラーケース**: 完全失敗、部分失敗、エラーの種類別にテスト
3. **テスト構造**: describe/itで適切に構造化
4. **モック検証**: 呼び出し回数と引数を確認
5. **テストデータ**: 定数を使用して明確化
6. **テストの種類**: ユニットテストと統合テストを使い分け

これらのベストプラクティスに従うことで、保守性が高く信頼性のあるテストを作成できます。
