# Design Document: Test Mock Accuracy

## Overview

本設計は、dynamodb-clientプロジェクトのテストモックが実際のインターフェースと正確に一致することを保証するための設計です。型安全性を活用し、モックの正確性をコンパイル時に検証できるようにします。

## Architecture

### 設計原則

1. **Type-First Approach**: TypeScriptの型システムを最大限活用し、モックの正確性をコンパイル時に保証
2. **Mock Factory Pattern**: 再利用可能なモックファクトリーを提供し、一貫性を確保
3. **Real Interface Alignment**: 実際のインターフェースと完全に一致するモックを生成
4. **Error Simulation**: 実際のエラー型を使用してエラーケースをテスト
5. **No Type Assertions**: `as any`や型アサーションを使用せず、型安全性を維持

### アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Layer                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Unit Tests   │  │ Integration  │  │ E2E Tests    │     │
│  │              │  │ Tests        │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                           │                                 │
├───────────────────────────┼─────────────────────────────────┤
│                     Mock Layer                              │
├───────────────────────────┼─────────────────────────────────┤
│  ┌────────────────────────▼──────────────────────────────┐ │
│  │         Type-Safe Mock Factories                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ Operation    │  │ Response     │  │ Error      │ │ │
│  │  │ Mocks        │  │ Builders     │  │ Simulators │ │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                 │
├───────────────────────────┼─────────────────────────────────┤
│                  Actual Implementation                      │
├───────────────────────────┼─────────────────────────────────┤
│  ┌────────────────────────▼──────────────────────────────┐ │
│  │         Real Operations & Types                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ insertMany   │  │ updateMany   │  │ findOne    │ │ │
│  │  │ updateOne    │  │ deleteMany   │  │ findMany   │ │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Mock Factory Module

モックファクトリーは、実際のインターフェースと一致するモックデータを生成します。

#### 1.1 Response Builders

```typescript
/**
 * InsertManyResult モックビルダー
 */
export interface InsertManyResultBuilder {
  /** 成功レスポンスを生成 */
  success(count: number, ids: string[]): InsertManyResult;
  /** 部分失敗レスポンスを生成 */
  partialFailure(
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>
  ): InsertManyResult;
  /** 完全失敗レスポンスを生成 */
  failure(ids: string[], errors: Record<number, OperationError>): InsertManyResult;
}

/**
 * UpdateManyResult モックビルダー
 */
export interface UpdateManyResultBuilder {
  /** 成功レスポンスを生成 */
  success(count: number, ids: string[]): UpdateManyResult;
  /** 部分失敗レスポンスを生成 */
  partialFailure(
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>
  ): UpdateManyResult;
  /** 完全失敗レスポンスを生成 */
  failure(ids: string[], errors: Record<number, OperationError>): UpdateManyResult;
}

/**
 * DeleteManyResult モックビルダー
 */
export interface DeleteManyResultBuilder {
  /** 成功レスポンスを生成 */
  success(count: number, ids: string[]): DeleteManyResult;
  /** 部分失敗レスポンスを生成 */
  partialFailure(
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>
  ): DeleteManyResult;
  /** 完全失敗レスポンスを生成 */
  failure(ids: string[], errors: Record<number, OperationError>): DeleteManyResult;
}

/**
 * FindOneResult モックビルダー
 */
export interface FindOneResultBuilder {
  /** 成功レスポンスを生成 */
  success(record: Record<string, unknown>): FindOneResult;
  /** 見つからない場合のエラーを生成 */
  notFound(id: string): never; // ItemNotFoundError をスロー
}

/**
 * FindManyResult モックビルダー
 */
export interface FindManyResultBuilder {
  /** 成功レスポンスを生成 */
  success(records: Record<string, unknown>[]): FindManyResult;
  /** 空の結果を生成 */
  empty(): FindManyResult;
}
```

#### 1.2 Error Simulators

```typescript
/**
 * エラーシミュレーター
 * 実際のエラークラスを使用してエラーケースをテスト
 */
export interface ErrorSimulator {
  /** ItemNotFoundError を生成 */
  itemNotFound(id: string, resource: string): ItemNotFoundError;
  /** ValidationError を生成 */
  validationError(message: string, details?: Record<string, unknown>): AppError;
  /** PartialFailureError を生成 */
  partialFailure(
    failedIds: string[],
    errors: Array<{ id: string; code: string; message: string }>
  ): PartialFailureError;
  /** OperationError を生成 */
  operationError(id: string, code: string, message: string): OperationError;
}
```

#### 1.3 Operation Mocks

```typescript
/**
 * 操作モックファクトリー
 * 実際の操作関数と同じシグネチャを持つモックを生成
 */
export interface OperationMockFactory {
  /** insertMany モックを生成 */
  createInsertManyMock(): typeof handleInsertMany;
  /** updateMany モックを生成 */
  createUpdateManyMock(): typeof handleUpdateMany;
  /** deleteMany モックを生成 */
  createDeleteManyMock(): typeof handleDeleteMany;
  /** findOne モックを生成 */
  createFindOneMock(): typeof handleFindOne;
  /** findMany モックを生成 */
  createFindManyMock(): typeof handleFindMany;
}
```

### 2. Type-Safe Mock Implementation

#### 2.1 Response Builder Implementation

```typescript
/**
 * InsertManyResult ビルダー実装
 */
export const insertManyResultBuilder: InsertManyResultBuilder = {
  success(count: number, ids: string[]): InsertManyResult {
    const successIds: Record<number, string> = {};
    ids.forEach((id, index) => {
      successIds[index] = id;
    });

    return {
      count,
      successIds,
      failedIds: {},
      errors: {},
    };
  },

  partialFailure(
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>
  ): InsertManyResult {
    return {
      count: Object.keys(successIds).length,
      successIds,
      failedIds,
      errors,
    };
  },

  failure(ids: string[], errors: Record<number, OperationError>): InsertManyResult {
    const failedIds: Record<number, string> = {};
    ids.forEach((id, index) => {
      failedIds[index] = id;
    });

    return {
      count: 0,
      successIds: {},
      failedIds,
      errors,
    };
  },
};
```

#### 2.2 Error Simulator Implementation

```typescript
/**
 * エラーシミュレーター実装
 */
export const errorSimulator: ErrorSimulator = {
  itemNotFound(id: string, resource: string): ItemNotFoundError {
    return new ItemNotFoundError(`Record not found: ${id}`, { resource, id });
  },

  validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  },

  partialFailure(
    failedIds: string[],
    errors: Array<{ id: string; code: string; message: string }>
  ): PartialFailureError {
    return new PartialFailureError('Partial failure occurred', failedIds, errors);
  },

  operationError(id: string, code: string, message: string): OperationError {
    return {
      id,
      code,
      message,
    };
  },
};
```

#### 2.3 Operation Mock Factory Implementation

```typescript
/**
 * 操作モックファクトリー実装
 */
export const operationMockFactory: OperationMockFactory = {
  createInsertManyMock() {
    return vi.fn<typeof handleInsertMany>();
  },

  createUpdateManyMock() {
    return vi.fn<typeof handleUpdateMany>();
  },

  createDeleteManyMock() {
    return vi.fn<typeof handleDeleteMany>();
  },

  createFindOneMock() {
    return vi.fn<typeof handleFindOne>();
  },

  createFindManyMock() {
    return vi.fn<typeof handleFindMany>();
  },
};
```

### 3. Test Helper Module

#### 3.1 Mock Setup Helpers

```typescript
/**
 * モックセットアップヘルパー
 */
export interface MockSetupHelpers {
  /** insertMany の成功ケースをセットアップ */
  setupInsertManySuccess(mock: ReturnType<typeof vi.fn>, ids: string[]): void;
  /** insertMany の部分失敗ケースをセットアップ */
  setupInsertManyPartialFailure(
    mock: ReturnType<typeof vi.fn>,
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>
  ): void;
  /** updateMany の成功ケースをセットアップ */
  setupUpdateManySuccess(mock: ReturnType<typeof vi.fn>, ids: string[]): void;
  /** findOne の成功ケースをセットアップ */
  setupFindOneSuccess(mock: ReturnType<typeof vi.fn>, record: Record<string, unknown>): void;
  /** findOne の見つからないケースをセットアップ */
  setupFindOneNotFound(mock: ReturnType<typeof vi.fn>, id: string, resource: string): void;
}
```

#### 3.2 Assertion Helpers

```typescript
/**
 * アサーションヘルパー
 */
export interface AssertionHelpers {
  /** InsertManyResult の構造を検証 */
  assertInsertManyResult(result: InsertManyResult, expectedCount: number): void;
  /** UpdateManyResult の構造を検証 */
  assertUpdateManyResult(result: UpdateManyResult, expectedCount: number): void;
  /** DeleteManyResult の構造を検証 */
  assertDeleteManyResult(result: DeleteManyResult, expectedCount: number): void;
  /** OperationError の構造を検証 */
  assertOperationError(error: OperationError, expectedId: string, expectedCode: string): void;
  /** ItemNotFoundError がスローされたことを検証 */
  assertItemNotFoundError(error: unknown, expectedId: string): void;
}
```

## Data Models

### Mock Data Structures

```typescript
/**
 * テスト用レコードデータ
 */
export interface TestRecord {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

/**
 * テスト用エラーデータ
 */
export interface TestErrorData {
  id: string;
  code: string;
  message: string;
}

/**
 * テスト用部分失敗データ
 */
export interface TestPartialFailureData {
  successIds: Record<number, string>;
  failedIds: Record<number, string>;
  errors: Record<number, OperationError>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mock Interface Consistency

*For any* mocked function, the mock's parameter types and return type SHALL match the actual function's signature exactly.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4**

### Property 2: Response Structure Completeness

*For any* bulk operation mock response, the response SHALL contain all required fields (count, successIds, failedIds, errors) with correct types.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Error Type Accuracy

*For any* error simulation, the mock SHALL throw or return the same error type as the actual implementation.

**Validates: Requirements 1.5, 3.1, 3.2, 3.3**

### Property 4: Partial Failure Representation

*For any* partial failure scenario, the mock SHALL include failedIds and errors with correct indices and error codes.

**Validates: Requirements 2.6, 3.3, 3.4, 3.5**

### Property 5: Type Safety Enforcement

*For any* mock creation, TypeScript SHALL report compile-time errors if the mock signature doesn't match the actual function.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 6: Mock Reusability

*For any* test requiring similar mocks, the test SHALL reuse mock factories instead of duplicating mock setup.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Integration Test Alignment

*For any* unit test with mocks, the mock behavior SHALL match the actual function's behavior as verified by integration tests.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

## Error Handling

### Error Simulation Strategy

1. **Use Real Error Classes**: すべてのエラーシミュレーションで実際のエラークラス（ItemNotFoundError、AppError等）を使用
2. **Match Error Properties**: エラーのcode、message、statusCode、detailsを実際の実装と一致させる
3. **Test Error Paths**: 成功パスだけでなく、エラーパスも必ずテストする
4. **Partial Failure Handling**: 部分失敗ケースでは、failedIdsとerrorsの両方を正確に設定する

### Error Test Patterns

```typescript
// Pattern 1: ItemNotFoundError
it('should throw ItemNotFoundError when record not found', async () => {
  const mock = operationMockFactory.createFindOneMock();
  mock.mockRejectedValue(errorSimulator.itemNotFound('test-id', 'articles'));

  await expect(handleFindOne('articles', { id: 'test-id' }, 'req-1'))
    .rejects
    .toThrow(ItemNotFoundError);
});

// Pattern 2: Partial Failure
it('should handle partial failure correctly', async () => {
  const mock = operationMockFactory.createInsertManyMock();
  const response = insertManyResultBuilder.partialFailure(
    { 0: 'id-1', 2: 'id-3' },
    { 1: 'id-2' },
    { 1: errorSimulator.operationError('id-2', 'DUPLICATE_KEY', 'Already exists') }
  );
  mock.mockResolvedValue(response);

  const result = await handleInsertMany('articles', { data: [...] }, 'req-1');
  expect(result.count).toBe(2);
  expect(result.failedIds).toEqual({ 1: 'id-2' });
});
```

## Testing Strategy

### Unit Testing with Type-Safe Mocks

1. **Mock Factory Usage**: すべてのユニットテストでモックファクトリーを使用
2. **Response Builder Usage**: レスポンスデータはビルダーで生成
3. **Error Simulator Usage**: エラーケースはシミュレーターで生成
4. **Type Checking**: `as any`を使用せず、型安全性を維持
5. **Assertion Helpers**: アサーションヘルパーで検証を統一

### Integration Testing

1. **Real Implementation**: 統合テストでは実際の実装を使用
2. **Mock Validation**: ユニットテストのモックが統合テストの動作と一致することを確認
3. **Error Scenario Coverage**: 統合テストでエラーシナリオをカバー
4. **Mock Update**: 統合テストで新しい動作が見つかった場合、モックを更新

### Property-Based Testing

各correctness propertyに対して、property-based testを実装します。

#### Property Test 1: Mock Interface Consistency

```typescript
/**
 * Property Test: Mock Interface Consistency
 * Feature: test-mock-accuracy, Property 1
 */
it('should maintain interface consistency for all mocked functions', () => {
  // insertMany
  const insertManyMock = operationMockFactory.createInsertManyMock();
  expectTypeOf(insertManyMock).toMatchTypeOf<typeof handleInsertMany>();

  // updateMany
  const updateManyMock = operationMockFactory.createUpdateManyMock();
  expectTypeOf(updateManyMock).toMatchTypeOf<typeof handleUpdateMany>();

  // findOne
  const findOneMock = operationMockFactory.createFindOneMock();
  expectTypeOf(findOneMock).toMatchTypeOf<typeof handleFindOne>();
});
```

#### Property Test 2: Response Structure Completeness

```typescript
/**
 * Property Test: Response Structure Completeness
 * Feature: test-mock-accuracy, Property 2
 */
it('should include all required fields in bulk operation responses', () => {
  const response = insertManyResultBuilder.success(3, ['id-1', 'id-2', 'id-3']);

  expect(response).toHaveProperty('count');
  expect(response).toHaveProperty('successIds');
  expect(response).toHaveProperty('failedIds');
  expect(response).toHaveProperty('errors');
  expect(typeof response.count).toBe('number');
  expect(typeof response.successIds).toBe('object');
  expect(typeof response.failedIds).toBe('object');
  expect(typeof response.errors).toBe('object');
});
```

### Test Coverage Requirements

- **Unit Tests**: すべての操作（insertMany、updateMany、deleteMany、findOne、findMany）
- **Success Cases**: 正常系のテスト
- **Error Cases**: エラーケースのテスト（ItemNotFoundError、ValidationError等）
- **Partial Failure Cases**: 部分失敗ケースのテスト
- **Edge Cases**: 空配列、nullチェック等のエッジケース

## Implementation Plan

### Phase 1: Mock Factory Module

1. Response Buildersの実装
2. Error Simulatorsの実装
3. Operation Mock Factoryの実装

### Phase 2: Test Helper Module

1. Mock Setup Helpersの実装
2. Assertion Helpersの実装

### Phase 3: Existing Test Migration

1. insertOne-direct.test.tsの更新
2. updateOne-direct.test.tsの更新
3. その他の操作テストの更新

### Phase 4: Documentation

1. Mock Factory使用ガイドの作成
2. ベストプラクティスドキュメントの作成
3. アンチパターン集の作成

## File Structure

```
dynamodb-client/
├── __tests__/
│   ├── helpers/
│   │   ├── mock-factory.ts          # モックファクトリー
│   │   ├── response-builders.ts     # レスポンスビルダー
│   │   ├── error-simulators.ts      # エラーシミュレーター
│   │   ├── mock-setup.ts            # モックセットアップヘルパー
│   │   └── assertions.ts            # アサーションヘルパー
│   ├── operations/
│   │   ├── insertOne-direct.test.ts # 更新済み
│   │   ├── updateOne-direct.test.ts # 更新済み
│   │   └── ...
│   └── ...
└── docs/
    ├── testing/
    │   ├── mock-factory-guide.md    # モックファクトリーガイド
    │   ├── best-practices.md        # ベストプラクティス
    │   └── anti-patterns.md         # アンチパターン集
    └── ...
```

## Summary

本設計は、TypeScriptの型システムを活用して、テストモックの正確性をコンパイル時に保証します。モックファクトリーパターンにより、一貫性のあるモックを簡単に作成でき、保守性が向上します。実際のエラークラスを使用することで、エラーハンドリングのテストも正確に行えます。
