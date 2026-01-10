# テストカバレッジ改善 - 設計書

## 概要

dynamodb-clientライブラリのテストカバレッジを60%→80%に向上させるための設計。

## アーキテクチャ

### モジュールモック戦略

**Vitestの`vi.mock()`を使用してDynamoDBクライアントをモック化**

#### 利点
- ✅ **既存コード変更不要**: 本番コードの関数シグネチャを維持
- ✅ **テストコードのみ修正**: 影響範囲が限定的
- ✅ **標準機能**: Vitestの標準機能、追加ライブラリ不要
- ✅ **破壊的変更なし**: 約30ファイルの関数シグネチャ変更が不要

#### 実装方法

```typescript
// __tests__/integration/operations/insertOne.test.ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleInsertOne } from '../../../src/server/operations/insertOne.js';
import { DynamoDBMock } from '../../helpers/dynamodb-mock.js';

// DynamoDBモックインスタンス
let mockDynamoClient: DynamoDBMock;

// モジュール全体をモック
vi.mock('../../../src/server/utils/dynamodb.ts', () => ({
  getDBClient: vi.fn(() => mockDynamoClient),
  getTableName: vi.fn(() => 'test-table'),
  removeShadowKeys: vi.fn((record) => {
    const { __shadowKeys, ...rest } = record;
    return rest;
  }),
  extractCleanRecord: vi.fn((item) => {
    const data = item.data || item;
    const { __shadowKeys, ...rest } = data;
    return rest;
  }),
  executeDynamoDBOperation: vi.fn(async (operation) => await operation()),
}));

describe('insertOne', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockDynamoClient = new DynamoDBMock();
    mockDynamoClient.createTable('test-table');
  });

  afterEach(() => {
    mockDynamoClient.clear();
  });

  it('should insert a new record', async () => {
    const result = await handleInsertOne(
      'users',
      { data: { name: 'Alice', email: 'alice@example.com' } },
      'test-request-id'
    );

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Alice');
  });
});
```

#### モックの配置

```typescript
// vitest.setup.ts（グローバルセットアップ）
import { beforeEach } from 'vitest';
import { DynamoDBMock } from './__tests__/helpers/dynamodb-mock.js';

// グローバル変数として宣言（テストファイルからアクセス可能）
declare global {
  var mockDynamoClient: DynamoDBMock;
}

beforeEach(() => {
  // 各テスト前にモックをリセット
  global.mockDynamoClient = new DynamoDBMock();
});
```

### テスト構造

```
__tests__/
├── unit/                    # ユニットテスト（既存）
│   ├── client/             # クライアント側
│   └── server/             # サーバー側（新規）
├── integration/            # 統合テスト（新規）
│   ├── operations/         # 操作別テスト
│   └── scenarios/          # シナリオテスト
├── helpers/                # テストヘルパー
│   ├── dynamodb-mock.ts   # DynamoDBモック（新規）
│   ├── factories.ts        # テストデータファクトリー（新規）
│   └── assertions.ts       # カスタムアサーション（既存）
└── fixtures/               # テストフィクスチャ（新規）
    ├── shadow-configs.ts
    └── test-data.ts
```

## コンポーネント設計

### 1. DynamoDBモック

#### 設計方針

- **メモリ内データストア**: Map<string, Map<string, Item>> 構造
- **トランザクション対応**: 操作のバッチ実行とロールバック
- **エラーシミュレーション**: 条件付きエラー発生
- **モジュールモック使用**: Vitestの`vi.mock()`で`src/server/utils/dynamodb.ts`をモック
- **既存コード変更不要**: 本番コードの関数シグネチャはそのまま維持

#### インターフェース

```typescript
/**
 * DynamoDBモック
 * 実際のDynamoDBの動作を忠実に再現する
 */
class DynamoDBMock {
  private tables: Map<string, Map<string, Item>>;
  private transactionLog: TransactionEntry[];

  /**
   * テーブルを作成
   */
  createTable(tableName: string): void;

  /**
   * アイテムを取得
   */
  getItem(params: GetItemInput): Promise<GetItemOutput>;

  /**
   * アイテムを書き込み
   */
  putItem(params: PutItemInput): Promise<PutItemOutput>;

  /**
   * アイテムを更新
   */
  updateItem(params: UpdateItemInput): Promise<UpdateItemOutput>;

  /**
   * アイテムを削除
   */
  deleteItem(params: DeleteItemInput): Promise<DeleteItemOutput>;

  /**
   * バッチ取得
   */
  batchGetItem(params: BatchGetItemInput): Promise<BatchGetItemOutput>;

  /**
   * トランザクション書き込み
   */
  transactWriteItems(params: TransactWriteItemsInput): Promise<TransactWriteItemsOutput>;

  /**
   * クエリ
   */
  query(params: QueryInput): Promise<QueryOutput>;

  /**
   * スキャン
   */
  scan(params: ScanInput): Promise<ScanOutput>;

  /**
   * エラーシミュレーション設定
   */
  setErrorSimulation(config: ErrorSimulationConfig): void;

  /**
   * データをクリア
   */
  clear(): void;

  /**
   * トランザクションログを取得
   */
  getTransactionLog(): TransactionEntry[];
}
```

#### 実装詳細

**データ構造**:
```typescript
// テーブル名 → (PK#SK → Item)
private tables: Map<string, Map<string, Item>> = new Map();

// 複合キーの生成
private makeKey(pk: string, sk: string): string {
  return `${pk}#${sk}`;
}
```

**トランザクション処理**:
```typescript
async transactWriteItems(params: TransactWriteItemsInput): Promise<TransactWriteItemsOutput> {
  const operations: Operation[] = [];
  
  // 1. 全操作を検証（条件チェック）
  for (const item of params.TransactItems) {
    if (item.ConditionCheck) {
      // 条件チェック
      if (!this.checkCondition(item.ConditionCheck)) {
        throw new TransactionCanceledException();
      }
    }
    operations.push(this.prepareOperation(item));
  }
  
  // 2. 全操作を実行（アトミック）
  for (const op of operations) {
    this.executeOperation(op);
  }
  
  return {};
}
```

**エラーシミュレーション**:
```typescript
interface ErrorSimulationConfig {
  operation: 'putItem' | 'getItem' | 'updateItem' | 'deleteItem' | 'transactWriteItems';
  errorType: 'ConditionalCheckFailedException' | 'ResourceNotFoundException' | 'ValidationException';
  condition?: (params: any) => boolean;
}

setErrorSimulation(config: ErrorSimulationConfig): void {
  this.errorSimulations.push(config);
}
```

### 2. テストデータファクトリー

#### 設計方針

- **型安全**: TypeScriptの型定義を活用
- **カスタマイズ可能**: デフォルト値とオーバーライド
- **ランダム生成**: faker.jsを使用

#### インターフェース

```typescript
/**
 * テストデータファクトリー
 */
interface TestDataFactory {
  /**
   * ユーザーデータを生成
   */
  createUser(overrides?: Partial<User>): User;

  /**
   * 記事データを生成
   */
  createArticle(overrides?: Partial<Article>): Article;

  /**
   * タスクデータを生成
   */
  createTask(overrides?: Partial<Task>): Task;

  /**
   * 複数のユーザーデータを生成
   */
  createUsers(count: number, overrides?: Partial<User>): User[];

  /**
   * シャドー設定を生成
   */
  createShadowConfig(overrides?: Partial<ShadowConfig>): ShadowConfig;
}
```

#### 実装例

```typescript
import { faker } from '@faker-js/faker';

export const testDataFactory = {
  createUser(overrides?: Partial<User>): User {
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  },

  createUsers(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  },
};
```

### 3. 統合テストヘルパー

#### 設計方針

- **セットアップ簡素化**: beforeEach/afterEachの共通化
- **アサーション拡張**: カスタムマッチャー
- **デバッグ支援**: 詳細なエラーメッセージ

#### インターフェース

```typescript
/**
 * 統合テストヘルパー
 */
interface IntegrationTestHelper {
  /**
   * テスト環境をセットアップ
   */
  setup(): Promise<TestContext>;

  /**
   * テスト環境をクリーンアップ
   */
  teardown(context: TestContext): Promise<void>;

  /**
   * DynamoDBモックを取得
   */
  getDynamoDBMock(): DynamoDBMock;

  /**
   * テストデータを投入
   */
  seedData(data: Record<string, any[]>): Promise<void>;

  /**
   * カスタムアサーション
   */
  assertions: {
    toHaveShadowRecords(item: any, expectedCount: number): void;
    toMatchDynamoDBItem(actual: any, expected: any): void;
  };
}
```

## テスト戦略

### フェーズ1: 基盤整備（カバレッジ60%）

#### 優先順位

1. **DynamoDBモックの実装** (Week 1)
   - 基本操作（Put, Get, Update, Delete, Query, Scan）
   - トランザクション操作
   - エラーシミュレーション

2. **基本CRUD操作のテスト** (Week 2)
   - insertOne, findOne, updateOne, deleteOne
   - 正常系と基本的な異常系
   - シャドーレコード生成・更新・削除

3. **クエリ操作のテスト** (Week 3)
   - find（フィルター、ソート、ページネーション）
   - 複雑なフィルター条件（$and, $or, $in等）
   - シャドーレコードを使用したクエリ

4. **バルク操作のテスト** (Week 4)
   - insertMany, updateMany, deleteMany
   - 部分失敗のハンドリング
   - チャンク分割の動作

#### カバレッジ目標

- **全体: 60%**（dynamodb-client全体）

### フェーズ2: 完全カバレッジ（カバレッジ80%）

#### 優先順位

1. **更新オペレーターのテスト** (Week 5)
   - $set, $unset, $inc, $push, $pull等
   - upsert機能（updateOne/updateMany with upsert: true）
   - $setOnInsert オペレーター
   - 条件付き更新

2. **エッジケースのテスト** (Week 6)
   - 空配列、null、undefined
   - 境界値テスト
   - 大量データ処理（1000件以上）

3. **エラーハンドリングのテスト** (Week 7)
   - バリデーションエラー
   - トランザクション失敗
   - タイムアウト
   - 条件チェック失敗

4. **シャドーレコード管理のテスト** (Week 8)
   - シャドー設定変更時の動作
   - シャドーレコードの整合性
   - メタデータ管理
   - 設定ドリフト検出

5. **統合シナリオテスト** (Week 9)
   - 複雑なクエリ
   - 複数操作の組み合わせ
   - パフォーマンステスト

#### カバレッジ目標

- **全体: 80%**（dynamodb-client全体）

## テストケース設計

### ADR 001: セキュリティ原則

**updateOne と updateMany は更新したフィールドのみを返却する**

- **理由**: read権限なしでupdate権限のみの場合の情報漏洩を防止
- **効果**: findOneの追加クエリを削減してパフォーマンス向上
- **実装**: 
  - `updateOne`: `{ id, ...更新したフィールドのみ }` を返却
  - `updateMany`: 各レコードについて `{ id, ...更新したフィールドのみ }` を返却

### updateOne with upsert のテストケース

```typescript
describe('updateOne with upsert', () => {
  let dynamoMock: DynamoDBMock;
  let context: TestContext;

  beforeEach(async () => {
    context = await integrationTestHelper.setup();
    dynamoMock = integrationTestHelper.getDynamoDBMock();
  });

  afterEach(async () => {
    await integrationTestHelper.teardown(context);
  });

  describe('insert case (record does not exist)', () => {
    it('should create new record with $set fields', async () => {
      const result = await handleUpdateOne(
        'users',
        {
          id: 'new-user',
          data: {
            $set: { name: 'Alice', email: 'alice@example.com' },
          },
          options: { upsert: true },
        },
        'test-request-id'
      );

      expect(result.__upsertedId).toBe('new-user');
      expect(result.name).toBe('Alice');
      expect(result.email).toBe('alice@example.com');

      // DynamoDBに実際に保存されたか確認
      const item = await dynamoMock.getItem({
        TableName: 'test-table',
        Key: { PK: 'users', SK: 'MAIN#new-user' },
      });
      expect(item.Item).toBeDefined();
    });

    it('should apply both $set and $setOnInsert on insert', async () => {
      const result = await handleUpdateOne(
        'users',
        {
          id: 'new-user',
          data: {
            $set: { name: 'Alice' },
            $setOnInsert: { status: 'active', role: 'user' },
          },
          options: { upsert: true },
        },
        'test-request-id'
      );

      expect(result.name).toBe('Alice');
      expect(result.status).toBe('active');
      expect(result.role).toBe('user');
    });

    it('should prioritize $set over $setOnInsert for same field', async () => {
      const result = await handleUpdateOne(
        'users',
        {
          id: 'new-user',
          data: {
            $set: { status: 'pending' },
            $setOnInsert: { status: 'active' },
          },
          options: { upsert: true },
        },
        'test-request-id'
      );

      expect(result.status).toBe('pending');
    });

    it('should generate shadow records on insert', async () => {
      const result = await handleUpdateOne(
        'users',
        {
          id: 'new-user',
          data: {
            $set: { name: 'Alice', email: 'alice@example.com' },
          },
          options: { upsert: true },
        },
        'test-request-id'
      );

      // シャドーレコードが生成されたか確認
      const shadows = await dynamoMock.query({
        TableName: 'test-table',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'users',
          ':sk': 'SHADOW#',
        },
      });

      expect(shadows.Items.length).toBeGreaterThan(0);
    });
  });

  describe('update case (record exists)', () => {
    beforeEach(async () => {
      // 既存レコードを作成
      await handleInsertOne(
        'users',
        {
          data: {
            id: 'existing-user',
            name: 'Bob',
            email: 'bob@example.com',
            status: 'active',
          },
        },
        'setup-request-id'
      );
    });

    it('should update existing record', async () => {
      const result = await handleUpdateOne(
        'users',
        {
          id: 'existing-user',
          data: {
            $set: { name: 'Bob Updated' },
          },
          options: { upsert: true },
        },
        'test-request-id'
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
      expect(result.upsertedId).toBeUndefined();
      expect(result.name).toBe('Bob Updated');
    });

    it('should ignore $setOnInsert on update', async () => {
      const result = await handleUpdateOne(
        'users',
        {
          id: 'existing-user',
          data: {
            $set: { name: 'Bob Updated' },
            $setOnInsert: { status: 'pending' },
          },
          options: { upsert: true },
        },
        'test-request-id'
      );

      expect(result.name).toBe('Bob Updated');
      expect(result.status).toBe('active'); // 変更されない
    });

    it('should update shadow records on update', async () => {
      const result = await handleUpdateOne(
        'users',
        {
          id: 'existing-user',
          data: {
            $set: { email: 'bob.new@example.com' },
          },
          options: { upsert: true },
        },
        'test-request-id'
      );

      // シャドーレコードが更新されたか確認
      const shadows = await dynamoMock.query({
        TableName: 'test-table',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'users',
          ':sk': 'SHADOW#email#',
        },
      });

      expect(shadows.Items.length).toBeGreaterThan(0);
    });
  });

  describe('error cases', () => {
    it('should fail when upsert is false and record does not exist', async () => {
      await expect(
        handleUpdateOne(
          'users',
          {
            id: 'non-existent-user',
            data: {
              $set: { name: 'Alice' },
            },
            options: { upsert: false },
          },
          'test-request-id'
        )
      ).rejects.toThrow('Record not found');
    });

    it('should handle validation errors', async () => {
      await expect(
        handleUpdateOne(
          'users',
          {
            id: 'new-user',
            data: {
              $set: { email: 'invalid-email' },
            },
            options: { upsert: true },
          },
          'test-request-id'
        )
      ).rejects.toThrow('Validation error');
    });
  });
});
```

## カバレッジ測定

### Vitest設定

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/types.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 60,      // フェーズ1
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
```

### CI統合

```yaml
# .github/workflows/ci.yml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Check coverage thresholds
  run: |
    if [ $(jq '.total.lines.pct' coverage/coverage-summary.json | cut -d. -f1) -lt 60 ]; then
      echo "Coverage is below 60%"
      exit 1
    fi

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## 実装順序

### Week 1: DynamoDBモック

1. 基本データ構造の実装
2. Put/Get/Update/Delete操作
3. トランザクション操作
4. エラーシミュレーション

### Week 2: CRUD操作テスト

1. insertOne/findOne テスト
2. updateOne テスト（upsert なし）
3. deleteOne テスト
4. 正常系のみ

### Week 3: upsert機能テスト

1. updateOne with upsert テスト
2. $setOnInsert オペレーターテスト
3. エラーケーステスト

### Week 4: バルク操作テスト

1. insertMany テスト
2. updateMany テスト
3. deleteMany テスト
4. 部分失敗ハンドリング

## 参考

- [Vitest Documentation](https://vitest.dev/)
- [AWS SDK v3 Mock](https://aws.amazon.com/blogs/developer/mocking-modular-aws-sdk-for-javascript-v3-in-unit-tests/)
- [faker.js](https://fakerjs.dev/)
