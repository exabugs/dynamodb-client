# Design Document: DynamoDB Cost Tracking

## Overview

dynamodb-clientにDynamoDB操作のコスト追跡機能を追加します。各DynamoDB操作で消費されたRCU（Read Capacity Units）とWCU（Write Capacity Units）を収集・集計し、MongoDB-likeインターフェースのレスポンスとHTTP APIレスポンスに含めます。

この機能により、開発者はDynamoDB操作のコストを可視化し、最適化の判断材料とすることができます。

## Architecture

### コンポーネント構成

```
┌─────────────────────────────────────────────────────────────┐
│ Client Layer (Collection, FindCursor)                       │
│ - MongoDB-like interface                                    │
│ - ConsumedCapacity をレスポンスに含める                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Server Layer (Operations)                                   │
│ - DynamoDB SDK 呼び出し                                      │
│ - ReturnConsumedCapacity: 'TOTAL' を設定                    │
│ - ConsumedCapacity を抽出・集計                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ DynamoDB                                                     │
│ - ConsumedCapacity を返却                                    │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **Client → Server**: 操作リクエスト送信
2. **Server → DynamoDB**: `ReturnConsumedCapacity: 'TOTAL'` を含むリクエスト
3. **DynamoDB → Server**: レスポンスに `ConsumedCapacity` を含める
4. **Server**: `ConsumedCapacity` を抽出・集計
5. **Server → Client**: レスポンスに集計したコスト情報を含める

## Components and Interfaces

### 1. ConsumedCapacity型定義


DynamoDB SDKから返される`ConsumedCapacity`の型定義を追加します。

**ファイル**: `src/shared/types/consumed-capacity.ts`

```typescript
/**
 * DynamoDB ConsumedCapacity 情報
 */
export interface ConsumedCapacity {
  /** 読み取りキャパシティユニット */
  readCapacityUnits?: number;
  /** 書き込みキャパシティユニット */
  writeCapacityUnits?: number;
  /** キャパシティユニット（読み取り + 書き込み） */
  capacityUnits?: number;
}

/**
 * 集計されたコスト情報
 */
export interface AggregatedCost {
  /** 総読み取りキャパシティユニット */
  totalRCU: number;
  /** 総書き込みキャパシティユニット */
  totalWCU: number;
  /** DynamoDB操作回数 */
  operationCount: number;
}
```

### 2. CostTracker クラス

コスト情報を収集・集計するクラスを実装します。

**ファイル**: `src/server/utils/cost-tracker.ts`

```typescript
import type { ConsumedCapacity, AggregatedCost } from '../../shared/types/consumed-capacity.js';

/**
 * コスト追跡クラス
 * 
 * DynamoDB操作のConsumedCapacityを収集・集計します。
 */
export class CostTracker {
  private totalRCU: number = 0;
  private totalWCU: number = 0;
  private operationCount: number = 0;

  /**
   * ConsumedCapacityを追加
   */
  add(consumedCapacity: ConsumedCapacity | undefined): void {
    if (!consumedCapacity) {
      return;
    }

    this.totalRCU += consumedCapacity.readCapacityUnits || 0;
    this.totalWCU += consumedCapacity.writeCapacityUnits || 0;
    this.operationCount += 1;
  }

  /**
   * 集計結果を取得
   */
  getAggregated(): AggregatedCost {
    return {
      totalRCU: this.totalRCU,
      totalWCU: this.totalWCU,
      operationCount: this.operationCount,
    };
  }

  /**
   * リセット
   */
  reset(): void {
    this.totalRCU = 0;
    this.totalWCU = 0;
    this.operationCount = 0;
  }
}
```

### 3. DynamoDB SDK呼び出しの修正


すべてのDynamoDB SDK呼び出しに`ReturnConsumedCapacity: 'TOTAL'`を追加します。

**対象ファイル**:
- `src/server/operations/find/handler.ts`
- `src/server/operations/insertOne.ts`
- `src/server/operations/updateOne.ts`
- `src/server/operations/updateMany.ts`
- `src/server/operations/deleteOne.ts`
- `src/server/operations/deleteMany.ts`
- `src/server/operations/insertMany.ts`

**修正例** (`QueryCommand`の場合):

```typescript
// Before
const command = new QueryCommand({
  TableName: tableName,
  KeyConditionExpression: '...',
  // ...
});

// After
const command = new QueryCommand({
  TableName: tableName,
  KeyConditionExpression: '...',
  ReturnConsumedCapacity: 'TOTAL', // 追加
  // ...
});

const response = await client.send(command);

// ConsumedCapacityを抽出
const consumedCapacity = response.ConsumedCapacity;
costTracker.add(consumedCapacity);
```

### 4. レスポンス型の拡張

MongoDB-likeインターフェースとHTTP APIレスポンスにコスト情報を追加します。

#### 4.1 共通型定義の拡張

**ファイル**: `src/shared/types/consumed-capacity.ts`（追加）

```typescript
/**
 * コスト情報を含むレスポンス
 */
export interface WithConsumedCapacity {
  /** 消費されたキャパシティ情報 */
  consumedCapacity?: AggregatedCost;
}
```

#### 4.2 MongoDB-like インターフェースのレスポンス拡張

**ファイル**: `src/shared/index.ts`（既存型の拡張）

```typescript
import type { WithConsumedCapacity } from './types/consumed-capacity.js';

/**
 * InsertOneResult（拡張）
 */
export interface InsertOneResult extends WithConsumedCapacity {
  acknowledged: boolean;
  insertedId: string;
}

/**
 * InsertManyResult（拡張）
 */
export interface InsertManyResult extends WithConsumedCapacity {
  acknowledged: boolean;
  insertedCount: number;
  insertedIds: Record<number, string>;
  failedIds?: string[];
  errors?: Array<{ id: string; code: string; message: string }>;
}

/**
 * UpdateResult（拡張）
 */
export interface UpdateResult extends WithConsumedCapacity {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
  upsertedId?: string;
}

/**
 * DeleteResult（拡張）
 */
export interface DeleteResult extends WithConsumedCapacity {
  acknowledged: boolean;
  deletedCount: number;
}
```

#### 4.3 FindCursor のレスポンス拡張


**ファイル**: `src/client/FindCursor.ts`

`FindCursor`クラスに`consumedCapacity`フィールドを追加し、`getConsumedCapacity()`メソッドを提供します。

```typescript
export class FindCursor<TSchema, TAuthOptions> {
  private consumedCapacity?: AggregatedCost;

  /**
   * 消費されたキャパシティ情報を取得
   */
  async getConsumedCapacity(): Promise<AggregatedCost | undefined> {
    if (!this.executed) {
      await this.execute();
    }
    return this.consumedCapacity;
  }

  private async execute(): Promise<void> {
    // ... 既存のコード ...

    const result = await response.json();
    this.results = result.data?.items || [];
    this.pageInfo = result.data?.pageInfo;
    
    // ConsumedCapacityを保存
    this.consumedCapacity = result.data?.consumedCapacity;
    
    this.executed = true;
  }
}
```

**使用例**:

```typescript
const cursor = collection.find({ status: 'active' });
const results = await cursor.toArray();
const cost = await cursor.getConsumedCapacity();

console.log(`Found ${results.length} items`);
console.log(`RCU: ${cost?.totalRCU}, WCU: ${cost?.totalWCU}`);
```

#### 4.4 HTTP APIレスポンスの拡張

**ファイル**: `src/server/types.ts`

```typescript
/**
 * find レスポンスデータ（拡張）
 */
export interface FindResult extends WithConsumedCapacity {
  items: Record<string, unknown>[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  nextToken?: string;
  total?: number;
}

// 他のレスポンス型も同様に拡張
```

### 5. Operation Handlers の修正

各操作ハンドラーで`CostTracker`を使用してコスト情報を収集します。

**修正パターン**:

```typescript
import { CostTracker } from '../utils/cost-tracker.js';

export async function handleFind(params: FindParams): Promise<FindResult> {
  const costTracker = new CostTracker();

  // DynamoDB操作
  const command = new QueryCommand({
    // ...
    ReturnConsumedCapacity: 'TOTAL',
  });

  const response = await client.send(command);
  costTracker.add(response.ConsumedCapacity);

  // 複数ページの場合
  while (response.LastEvaluatedKey) {
    const nextCommand = new QueryCommand({
      // ...
      ReturnConsumedCapacity: 'TOTAL',
      ExclusiveStartKey: response.LastEvaluatedKey,
    });
    const nextResponse = await client.send(nextCommand);
    costTracker.add(nextResponse.ConsumedCapacity);
  }

  return {
    items: [...],
    pageInfo: {...},
    consumedCapacity: costTracker.getAggregated(),
  };
}
```

### 6. Collection クラスの修正


`Collection`クラスの各メソッドで、レスポンスに含まれる`consumedCapacity`を返却します。

**ファイル**: `src/client/Collection.ts`

```typescript
async insertOne(document: InputBase & Omit<TSchema, 'id'>): Promise<InsertOneResult> {
  const response = await this.request('insertOne', { document });
  const result = response as { 
    insertedId: string;
    consumedCapacity?: AggregatedCost;
  };
  
  return {
    acknowledged: true,
    insertedId: result.insertedId,
    consumedCapacity: result.consumedCapacity, // 追加
  };
}

// updateOne, updateMany, deleteOne, deleteMany も同様に修正
```

## Data Models

### ConsumedCapacity（DynamoDB SDK）

DynamoDB SDKから返される`ConsumedCapacity`の構造:

```typescript
{
  TableName?: string;
  CapacityUnits?: number;
  ReadCapacityUnits?: number;
  WriteCapacityUnits?: number;
  Table?: {
    ReadCapacityUnits?: number;
    WriteCapacityUnits?: number;
    CapacityUnits?: number;
  };
  LocalSecondaryIndexes?: Record<string, {
    ReadCapacityUnits?: number;
    WriteCapacityUnits?: number;
    CapacityUnits?: number;
  }>;
  GlobalSecondaryIndexes?: Record<string, {
    ReadCapacityUnits?: number;
    WriteCapacityUnits?: number;
    CapacityUnits?: number;
  }>;
}
```

本実装では、トップレベルの`ReadCapacityUnits`と`WriteCapacityUnits`のみを使用します。

### AggregatedCost（集計結果）

```typescript
{
  totalRCU: number;      // 総読み取りキャパシティユニット
  totalWCU: number;      // 総書き込みキャパシティユニット
  operationCount: number; // DynamoDB操作回数
}
```

## Correctness Properties

*プロパティとは、システムのすべての有効な実行において真であるべき特性や動作のことです。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。*

### Property 1: ConsumedCapacity抽出の正確性

*For any* DynamoDB操作レスポンス、`ConsumedCapacity`が存在する場合、RCUとWCUが正しく抽出されること

**Validates: Requirements 1.2**

### Property 2: コスト集計の正確性

*For any* 複数のDynamoDB操作、各操作の`ConsumedCapacity`が正しく累積されること

**Validates: Requirements 2.1, 2.3**

### Property 3: レスポンス構造の一貫性

*For any* Collection操作、レスポンスに`consumedCapacity`フィールドが含まれ、`AggregatedCost`型に準拠すること

**Validates: Requirements 3.1, 3.2, 8.2**

### Property 4: 後方互換性の維持

*For any* 既存のコード、`consumedCapacity`フィールドを使用しない場合でも正常に動作すること

**Validates: Requirements 3.7**

### Property 5: バルク操作のコスト集計

*For any* バルク操作（insertMany, updateMany, deleteMany）、すべてのチャンクの`ConsumedCapacity`が集計されること

**Validates: Requirements 7.1, 7.4**

### Property 6: ゼロコストの処理

*For any* DynamoDB操作、`ConsumedCapacity`が存在しない場合、RCU/WCUがゼロとして扱われること

**Validates: Requirements 1.3**

### Property 7: パフォーマンスオーバーヘッド

*For any* API操作、コスト追跡によるオーバーヘッドが5ms以内であること

**Validates: Requirements 7.1**

## Error Handling

### ConsumedCapacity が存在しない場合


DynamoDBレスポンスに`ConsumedCapacity`が含まれない場合（例: ローカルDynamoDB、モック環境）:

- `CostTracker.add()`は`undefined`を受け入れ、何もしない
- `AggregatedCost`は`{ totalRCU: 0, totalWCU: 0, operationCount: 0 }`を返す
- エラーは発生させない

### 型安全性の確保

- すべてのコスト情報は`AggregatedCost`型に準拠
- TypeScriptの型チェックで不正な値を防止
- オプショナルフィールド（`consumedCapacity?`）で後方互換性を維持

## Testing Strategy

### Unit Tests

#### CostTracker クラス

**ファイル**: `__tests__/server/utils/cost-tracker.test.ts`

- `add()`メソッドのテスト
  - 正常なConsumedCapacityの追加
  - undefinedの処理
  - 複数回の追加による累積
- `getAggregated()`メソッドのテスト
  - 初期状態（ゼロ）
  - 集計結果の正確性
- `reset()`メソッドのテスト

**カバレッジ目標**: 100%

#### ConsumedCapacity抽出ロジック

**ファイル**: `__tests__/server/operations/consumed-capacity.test.ts`

- DynamoDB SDKレスポンスからの抽出
- 各操作タイプ（Query, Scan, GetItem, PutItem, UpdateItem, DeleteItem, BatchGetItem, BatchWriteItem）
- ConsumedCapacityが存在しない場合

**カバレッジ目標**: 100%

### Integration Tests

#### Collection クラス

**ファイル**: `__tests__/client/collection-cost.test.ts`

- `insertOne()`のコスト情報
- `insertMany()`のコスト情報
- `updateOne()`のコスト情報
- `updateMany()`のコスト情報
- `deleteOne()`のコスト情報
- `deleteMany()`のコスト情報

**カバレッジ目標**: 90%

#### FindCursor クラス

**ファイル**: `__tests__/client/find-cursor-cost.test.ts`

- `find()`のコスト情報
- `getConsumedCapacity()`メソッド
- 複数ページのコスト集計

**カバレッジ目標**: 90%

#### HTTP API

**ファイル**: `__tests__/server/api-cost.test.ts`

- 各操作のレスポンスにconsumedCapacityが含まれること
- バルク操作のコスト集計

**カバレッジ目標**: 90%

### Edge Case Tests

**ファイル**: `__tests__/edge-cases/cost-tracking.test.ts`

- ConsumedCapacityが存在しない場合
- RCU/WCUがゼロの場合
- 非常に大きなRCU/WCU値
- 複数ページにわたるfind操作
- バルク操作の部分失敗

**カバレッジ目標**: 100%

### Performance Tests

**ファイル**: `__tests__/performance/cost-tracking.test.ts`

- コスト追跡のオーバーヘッド測定
- 1000回の操作でのパフォーマンス影響
- メモリ使用量の測定

**目標**: オーバーヘッド < 5ms

### Mock Strategy

DynamoDB SDKのモックには`@aws-sdk/client-dynamodb`の型を使用:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const dynamoMock = mockClient(DynamoDBClient);

dynamoMock.on(QueryCommand).resolves({
  Items: [...],
  ConsumedCapacity: {
    TableName: 'test-table',
    CapacityUnits: 1.5,
    ReadCapacityUnits: 1.5,
    WriteCapacityUnits: 0,
  },
});
```

## Implementation Notes

### パフォーマンス最適化

1. **オブジェクト割り当ての最小化**
   - `CostTracker`はプリミティブ型（number）のみを使用
   - 不要なオブジェクト生成を避ける

2. **同期処理**
   - コスト追跡は同期的に実行（非同期I/Oなし）
   - オーバーヘッドを最小限に抑える

3. **条件分岐の最適化**
   - `ConsumedCapacity`の存在チェックは最小限
   - 早期リターンで不要な処理をスキップ

### 後方互換性

1. **オプショナルフィールド**
   - すべてのレスポンス型で`consumedCapacity?`をオプショナルに
   - 既存コードは変更不要

2. **型の拡張**
   - 既存の型を`extends`で拡張
   - 破壊的変更なし

### ログ出力

コスト情報は既存のロガーを使用してログ出力:

```typescript
logger.info('Operation completed', {
  operation: 'find',
  resource: 'venues',
  consumedCapacity: {
    totalRCU: 5.5,
    totalWCU: 0,
    operationCount: 2,
  },
});
```

高コスト操作の警告（閾値は環境変数で設定可能、デフォルト: RCU > 100 または WCU > 50）:

```typescript
if (cost.totalRCU > threshold.rcu || cost.totalWCU > threshold.wcu) {
  logger.warn('High cost operation detected', {
    operation: 'find',
    resource: 'venues',
    consumedCapacity: cost,
  });
}
```

## Migration Plan

### Phase 1: 型定義とユーティリティ

1. `ConsumedCapacity`型定義の追加
2. `CostTracker`クラスの実装
3. ユニットテストの作成

### Phase 2: Server Layer の修正

1. 各操作ハンドラーに`ReturnConsumedCapacity: 'TOTAL'`を追加
2. `CostTracker`を使用してコスト情報を収集
3. レスポンスに`consumedCapacity`を含める
4. 統合テストの作成

### Phase 3: Client Layer の修正

1. `Collection`クラスのレスポンス型を拡張
2. `FindCursor`に`getConsumedCapacity()`を追加
3. 統合テストの作成

### Phase 4: テストとドキュメント

1. エッジケーステストの作成
2. パフォーマンステストの実行
3. READMEとAPIドキュメントの更新

## Rollout Strategy

1. **開発環境でのテスト**: すべてのテストが通過することを確認
2. **ステージング環境でのテスト**: 実際のDynamoDBでの動作確認
3. **本番環境へのデプロイ**: 段階的なロールアウト
4. **モニタリング**: CloudWatch Logsでコスト情報を監視

## Success Metrics

- テストカバレッジ: 全体 80%以上、コスト追跡モジュール 90%以上
- パフォーマンスオーバーヘッド: 5ms以内
- 後方互換性: 既存のテストがすべて通過
- 本番環境での安定性: エラー率 < 0.1%
