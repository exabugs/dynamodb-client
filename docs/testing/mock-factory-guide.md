# テストヘルパー使用ガイド

## 概要

dynamodb-clientプロジェクトでは、型安全なテストを作成するためのヘルパーを提供しています。このガイドでは、テストでモックを作成する際の標準的な方法を説明します。

## 基本原則

1. **型安全性**: `as any`や型アサーションを使用せず、実際のインターフェースと完全に一致するモックを作成
2. **Vitest標準機能の活用**: `vi.fn<typeof operation>()`を使用して型安全なモックを作成
3. **再利用性**: 共通のビルダーとシミュレーターを使用してコードの重複を削減
4. **保守性**: 実際のインターフェースが変更された場合、型エラーで即座に検知

## モックの作成

### Vitestの標準機能を使用

モック関数は`vi.fn()`とTypeScriptのジェネリクスを使用して作成します：

```typescript
import { vi } from 'vitest';

import type { handleInsertMany } from '../../src/server/operations/insertMany.js';

// 型安全なモックを作成
const mockInsertMany = vi.fn<typeof handleInsertMany>();

// モックの戻り値を設定
mockInsertMany.mockResolvedValue(insertManyResultBuilder.success(1, ['id-1']));
```

この方法により：

- 実際の関数シグネチャと完全に一致
- 型エラーで即座に不整合を検知
- Vitestの全機能（mockResolvedValue、mockRejectedValue等）を使用可能

## 利用可能なヘルパー

### Response Builders

実際の操作結果と同じ構造のレスポンスを生成します。

```typescript
import {
  deleteManyResultBuilder,
  findManyResultBuilder,
  findOneResultBuilder,
  insertManyResultBuilder,
  updateManyResultBuilder,
} from '../helpers/response-builders.js';
```

#### InsertManyResultBuilder

```typescript
// 成功ケース
const result = insertManyResultBuilder.success(2, ['id-1', 'id-2']);
// {
//   count: 2,
//   successIds: { 0: 'id-1', 1: 'id-2' },
//   failedIds: {},
//   errors: {}
// }

// 部分失敗ケース
const result = insertManyResultBuilder.partialFailure(
  ['id-1', 'id-2', 'id-3'],
  { 1: errorSimulator.validationError('id-2', 'Invalid data') }
);
// {
//   count: 2,
//   successIds: { 0: 'id-1', 2: 'id-3' },
//   failedIds: { 1: 'id-2' },
//   errors: { 1: { id: 'id-2', code: 'VALIDATION_ERROR', message: 'Invalid data' } }
// }

// 完全失敗ケース
const result = insertManyResultBuilder.failure(
  ['id-1', 'id-2'],
  {
    0: errorSimulator.operationError('id-1', 'DB_ERROR', 'Database error'),
    1: errorSimulator.operationError('id-2', 'DB_ERROR', 'Database error'),
  }
);
```

#### UpdateManyResultBuilder

```typescript
// 成功ケース
const result = updateManyResultBuilder.success(3, ['id-1', 'id-2', 'id-3']);

// 部分失敗ケース
const result = updateManyResultBuilder.partialFailure(
  ['id-1', 'id-2', 'id-3'],
  { 2: errorSimulator.itemNotFound('id-3') }
);

// 完全失敗ケース
const result = updateManyResultBuilder.failure(
  ['id-1', 'id-2'],
  {
    0: errorSimulator.itemNotFound('id-1'),
    1: errorSimulator.itemNotFound('id-2'),
  }
);
```

#### DeleteManyResultBuilder

```typescript
// 成功ケース
const result = deleteManyResultBuilder.success(2, ['id-1', 'id-2']);

// 部分失敗ケース
const result = deleteManyResultBuilder.partialFailure(
  ['id-1', 'id-2', 'id-3'],
  { 1: errorSimulator.itemNotFound('id-2') }
);

// 完全失敗ケース
const result = deleteManyResultBuilder.failure(
  ['id-1'],
  { 0: errorSimulator.itemNotFound('id-1') }
);
```

#### FindOneResultBuilder

```typescript
// 成功ケース
const result = findOneResultBuilder.success({
  id: 'article-001',
  title: 'テスト記事',
  content: 'テスト内容',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});
// { id: 'article-001', title: 'テスト記事', ... }
```

#### FindManyResultBuilder

```typescript
// 成功ケース（複数レコード）
const result = findManyResultBuilder.success([
  { id: 'id-1', name: 'Record 1' },
  { id: 'id-2', name: 'Record 2' },
]);
// [{ id: 'id-1', name: 'Record 1' }, { id: 'id-2', name: 'Record 2' }]

// 空配列
const result = findManyResultBuilder.success([]);
// []
```

### Error Simulators

実際のエラークラスを使用してエラーを生成します。

```typescript
import { errorSimulator } from '../helpers/error-simulators.js';
```

#### itemNotFound

```typescript
const error = errorSimulator.itemNotFound('record-123');
// ItemNotFoundError: Record not found: record-123
```

#### validationError

```typescript
const error = errorSimulator.validationError('record-123', 'Invalid email format');
// AppError: Invalid email format (code: VALIDATION_ERROR)
```

#### operationError

```typescript
const error = errorSimulator.operationError('record-123', 'DB_ERROR', 'Database connection failed');
// OperationError: { id: 'record-123', code: 'DB_ERROR', message: 'Database connection failed' }
```

#### partialFailure

```typescript
const error = errorSimulator.partialFailure(['id-1', 'id-2', 'id-3'], {
  1: errorSimulator.validationError('id-2', 'Invalid data'),
  2: errorSimulator.itemNotFound('id-3'),
});
// PartialFailureError: 2 operations failed out of 3
```

## 実践例

### insertOne操作のテスト

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as insertManyModule from '../../src/server/operations/insertMany.js';
import { handleInsertOne } from '../../src/server/operations/insertOne.js';
import { errorSimulator } from '../helpers/error-simulators.js';
import { insertManyResultBuilder } from '../helpers/response-builders.js';

vi.mock('../../src/server/operations/insertMany.js', () => ({
  handleInsertMany: vi.fn(),
}));

describe('insertOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('レコード作成が成功した場合', async () => {
    const testData = {
      title: 'テスト記事',
      content: 'テスト内容',
    };

    // Response Builderを使用してモックレスポンスを作成
    const mockResponse = insertManyResultBuilder.success(1, ['article-001']);

    // Vitestの標準機能でモックの戻り値を設定
    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

    const result = await handleInsertOne(resource, { data: testData }, requestId);

    expect(insertManyModule.handleInsertMany).toHaveBeenCalledWith(
      resource,
      { data: [testData] },
      requestId
    );
    expect(result).toEqual({ id: 'article-001' });
  });

  it('レコード作成が失敗した場合', async () => {
    const testData = { title: 'テスト記事' };

    // Error Simulatorを使用してエラーを生成
    const mockResponse = insertManyResultBuilder.failure(['temp-id'], {
      0: errorSimulator.validationError('temp-id', 'Invalid data'),
    });

    vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockResponse);

    await expect(handleInsertOne(resource, { data: testData }, requestId)).rejects.toThrow(
      'Failed to insert record'
    );
  });
});
```

### updateOne操作のテスト

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as findOneModule from '../../src/server/operations/findOne.js';
import * as updateManyModule from '../../src/server/operations/updateMany.js';
import { handleUpdateOne } from '../../src/server/operations/updateOne.js';
import { errorSimulator } from '../helpers/error-simulators.js';
import { findOneResultBuilder, updateManyResultBuilder } from '../helpers/response-builders.js';

vi.mock('../../src/server/operations/updateMany.js', () => ({
  handleUpdateMany: vi.fn(),
}));

vi.mock('../../src/server/operations/findOne.js', () => ({
  handleFindOne: vi.fn(),
}));

describe('updateOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('更新が成功した場合', async () => {
    const testId = 'article-001';
    const testData = { title: '更新後のタイトル' };

    // Response Buildersを使用
    const mockUpdateManyResponse = updateManyResultBuilder.success(1, [testId]);
    const mockFindOneResponse = findOneResultBuilder.success({
      id: testId,
      title: '更新後のタイトル',
      content: 'テスト内容',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    });

    vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);
    vi.mocked(findOneModule.handleFindOne).mockResolvedValue(mockFindOneResponse);

    const result = await handleUpdateOne(resource, { id: testId, data: testData }, requestId);

    expect(result).toEqual(mockFindOneResponse);
  });

  it('更新が失敗した場合', async () => {
    const testId = 'article-001';
    const testData = { title: '更新後のタイトル' };

    // Error Simulatorを使用
    const mockUpdateManyResponse = updateManyResultBuilder.failure([testId], {
      0: errorSimulator.itemNotFound(testId),
    });

    vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);

    await expect(
      handleUpdateOne(resource, { id: testId, data: testData }, requestId)
    ).rejects.toThrow('Failed to update record');
  });
});
```

### deleteOne操作のテスト

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as deleteManyModule from '../../src/server/operations/deleteMany.js';
import { handleDeleteOne } from '../../src/server/operations/deleteOne.js';
import { errorSimulator } from '../helpers/error-simulators.js';
import { deleteManyResultBuilder } from '../helpers/response-builders.js';

vi.mock('../../src/server/operations/deleteMany.js', () => ({
  handleDeleteMany: vi.fn(),
}));

describe('deleteOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('削除が成功した場合', async () => {
    const testId = 'article-001';

    // Response Builderを使用
    const mockResponse = deleteManyResultBuilder.success(1, [testId]);

    vi.mocked(deleteManyModule.handleDeleteMany).mockResolvedValue(mockResponse);

    const result = await handleDeleteOne(resource, { id: testId }, requestId);

    expect(result).toEqual({ id: testId });
  });

  it('削除が失敗した場合', async () => {
    const testId = 'article-001';

    // Error Simulatorを使用
    const mockResponse = deleteManyResultBuilder.failure([testId], {
      0: errorSimulator.itemNotFound(testId),
    });

    vi.mocked(deleteManyModule.handleDeleteMany).mockResolvedValue(mockResponse);

    await expect(handleDeleteOne(resource, { id: testId }, requestId)).rejects.toThrow(
      'Failed to delete record'
    );
  });
});
```

### findOne操作のテスト

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as findManyModule from '../../src/server/operations/findMany.js';
import { handleFindOne } from '../../src/server/operations/findOne.js';
import { findManyResultBuilder } from '../helpers/response-builders.js';

vi.mock('../../src/server/operations/findMany.js', () => ({
  handleFindMany: vi.fn(),
}));

describe('findOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('レコードが見つかった場合', async () => {
    // Response Builderを使用
    const mockResponse = findManyResultBuilder.success([
      {
        id: 'article-001',
        title: 'テスト記事',
        content: 'テスト内容',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]);

    vi.mocked(findManyModule.handleFindMany).mockResolvedValue(mockResponse);

    const result = await handleFindOne(resource, { id: 'article-001' }, requestId);

    expect(result).toEqual(mockResponse[0]);
  });

  it('レコードが見つからない場合', async () => {
    // 空配列を返す
    const mockResponse = findManyResultBuilder.success([]);

    vi.mocked(findManyModule.handleFindMany).mockResolvedValue(mockResponse);

    await expect(handleFindOne(resource, { id: 'non-existent-id' }, requestId)).rejects.toThrow(
      'Record not found'
    );
  });
});
```

## まとめ

- **Vitestの標準機能**: `vi.fn<typeof operation>()`で型安全なモックを作成
- **Response Builders**: 成功・部分失敗・完全失敗のレスポンスを型安全に生成
- **Error Simulators**: 実際のエラークラスを使用してエラーを生成
- **型安全性**: `as any`や型アサーションを使用せず、実際のインターフェースと完全に一致

これらのヘルパーとVitestの標準機能を組み合わせることで、テストコードの保守性と信頼性が大幅に向上します。
