# テストカバレッジ改善設計

## Overview

dynamodb-clientライブラリのテストカバレッジを33.69%から80%以上に向上させるための包括的なテスト戦略を設計します。特に$nearオペレータ関連の実装（現在3.67%）を90%以上にすることを最優先とします。

## Architecture

### テスト階層

```
┌─────────────────────────────────────┐
│   End-to-End Tests (E2E)            │  ← クライアント→Lambda→DynamoDB
├─────────────────────────────────────┤
│   Integration Tests                 │  ← 複数コンポーネント統合
├─────────────────────────────────────┤
│   Unit Tests                        │  ← 個別関数・クラス
└─────────────────────────────────────┘
```

### テスト対象の優先順位

1. **最優先**: `nearQuery.ts` (現在3.67% → 目標90%)
2. **高優先**: `filter.ts` (現在27.56% → 目標90%)
3. **高優先**: `find/utils.ts` (現在49.6% → 目標90%)
4. **中優先**: その他のserver/operations/* (現在0-8% → 目標80%)
5. **低優先**: react-admin統合 (現在0% → 目標60%)

## Components and Interfaces

### 1. nearQuery.tsのテスト設計

#### テストファイル: `__tests__/near-query.test.ts`

**テストケース構成**:

```typescript
describe('executeNearQuery', () => {
  describe('正常系', () => {
    test('簡易形式の$nearクエリで検索できる')
    test('GeoJSON形式の$nearクエリで検索できる')
    test('limitパラメータが正しく適用される')
    test('距離情報(__distance)が正しく付与される')
    test('結果が距離順にソートされる')
  })

  describe('DynamoDB統合', () => {
    test('シャドウレコードから本体レコードを取得できる')
    test('複数のシャドウレコードから複数の本体レコードを取得できる')
    test('シャドウレコードが存在しない場合は空配列を返す')
    test('本体レコードが削除されている場合はスキップする')
    test('GeoHashフィールド名が正しく生成される')
  })

  describe('エラーハンドリング', () => {
    test('DynamoDBエラー時に適切なエラーを投げる')
    test('無効な座標の場合にエラーを投げる')
    test('無効なlimitの場合にエラーを投げる')
  })

  describe('エッジケース', () => {
    test('座標(0, 0)で検索できる')
    test('北極点(90, 0)で検索できる')
    test('南極点(-90, 0)で検索できる')
    test('日付変更線(0, 180)で検索できる')
    test('maxDistance=0で完全一致のみ返す')
  })

  describe('パフォーマンス', () => {
    test('1000件の検索が5秒以内に完了する')
    test('最初の反復で結果が見つかった場合、追加反復しない')
  })
})
```

#### モック戦略

```typescript
// DynamoDBクライアントのモック
vi.mock('../../src/server/utils/dynamodb.js', () => ({
  getDBClient: vi.fn(),
  getTableName: vi.fn(() => 'test-table'),
  executeDynamoDBOperation: vi.fn(),
  extractCleanRecord: vi.fn((record) => record),
}))

// executeNearSearchのモック（必要に応じて）
vi.mock('../../src/server/query/nearSearch.js', () => ({
  executeNearSearch: vi.fn(),
}))
```

### 2. filter.tsのテスト設計

#### テストファイル: `__tests__/filter-comprehensive.test.ts`

**テストケース構成**:

```typescript
describe('parseFilterField', () => {
  describe('全オペレータのパース', () => {
    test.each([
      ['field:$eq', { field: 'field', operator: '$eq', type: 'string' }],
      ['field:$ne', { field: 'field', operator: '$ne', type: 'string' }],
      ['field:$lt', { field: 'field', operator: '$lt', type: 'string' }],
      ['field:$lte', { field: 'field', operator: '$lte', type: 'string' }],
      ['field:$gt', { field: 'field', operator: '$gt', type: 'string' }],
      ['field:$gte', { field: 'field', operator: '$gte', type: 'string' }],
      ['field:$in', { field: 'field', operator: '$in', type: 'string' }],
      ['field:$nin', { field: 'field', operator: '$nin', type: 'string' }],
      ['field:$starts', { field: 'field', operator: '$starts', type: 'string' }],
      ['field:$ends', { field: 'field', operator: '$ends', type: 'string' }],
      ['field:$contains', { field: 'field', operator: '$contains', type: 'string' }],
      ['field:$exists', { field: 'field', operator: '$exists', type: 'string' }],
      ['field:$near', { field: 'field', operator: '$near', type: 'string' }],
    ])('"%s"を正しくパースできる', (input, expected) => {
      expect(parseFilterField(input)).toEqual(expected)
    })
  })

  describe('型指定のパース', () => {
    test.each([
      ['field:$eq:string', 'string'],
      ['field:$eq:number', 'number'],
      ['field:$eq:date', 'date'],
      ['field:$eq:boolean', 'boolean'],
    ])('"%s"の型を正しくパースできる', (input, expectedType) => {
      const result = parseFilterField(input)
      expect(result.type).toBe(expectedType)
    })
  })
})

describe('isValidOperator', () => {
  test('FilterOperator型の全ての値がtrueを返す', () => {
    const operators: FilterOperator[] = [
      '$eq', '$ne', '$lt', '$lte', '$gt', '$gte',
      '$in', '$nin', '$starts', '$ends', '$contains', '$exists', '$near'
    ]
    operators.forEach(op => {
      expect(isValidOperator(op)).toBe(true)
    })
  })

  test('無効なオペレータはfalseを返す', () => {
    expect(isValidOperator('invalid')).toBe(false)
    expect(isValidOperator('eq')).toBe(false) // $プレフィックスなし
    expect(isValidOperator('$unknown')).toBe(false)
  })
})

describe('matchesFilter', () => {
  describe('全オペレータの評価', () => {
    test('$eqで等価比較できる')
    test('$neで不等価比較できる')
    test('$ltで小なり比較できる')
    test('$lteで小なりイコール比較できる')
    test('$gtで大なり比較できる')
    test('$gteで大なりイコール比較できる')
    test('$startsで前方一致できる')
    test('$endsで後方一致できる')
  })

  describe('型変換', () => {
    test('string型に変換して比較できる')
    test('number型に変換して比較できる')
    test('date型に変換して比較できる')
    test('boolean型に変換して比較できる')
  })
})

describe('convertType', () => {
  test.each([
    ['123', 'string', '123'],
    ['123', 'number', 123],
    ['2024-01-01', 'date', new Date('2024-01-01')],
    ['true', 'boolean', true],
    ['false', 'boolean', false],
    [true, 'boolean', true],
    [false, 'boolean', false],
  ])('convertType(%s, %s) = %s', (value, type, expected) => {
    const result = convertType(value, type as FilterType)
    if (type === 'date') {
      expect(result).toEqual(expected)
    } else {
      expect(result).toBe(expected)
    }
  })
})
```

### 3. find/utils.tsのテスト設計

#### テストファイル: `__tests__/find-utils-comprehensive.test.ts`

**テストケース構成**:

```typescript
describe('detectNearQuery', () => {
  describe('ネストされたオブジェクト形式', () => {
    test('簡易形式の$nearを検出できる')
    test('GeoJSON形式の$nearを検出できる')
    test('複数フィールドがある場合、$nearを持つフィールドを検出できる')
  })

  describe('フィールド名に演算子を含める形式', () => {
    test('"location:$near"形式を検出できる')
    test('"location:$near:string"形式を検出できる')
  })

  describe('$nearが存在しない場合', () => {
    test('空のフィルターでnullを返す')
    test('他のオペレータのみの場合nullを返す')
    test('$nearがネストされていない場合nullを返す')
  })
})

describe('parseFilters', () => {
  describe('全オペレータ形式のパース', () => {
    test('ネストされたオブジェクト形式をパースできる')
    test('フィールド名に演算子を含める形式をパースできる')
    test('両方の形式が混在している場合をパースできる')
  })

  describe('エラーハンドリング', () => {
    test('無効なオペレータの場合にエラーを投げる')
    test('無効な型の場合にエラーを投げる')
    test('無効な構文の場合にエラーを投げる')
  })
})

describe('matchesAllFilters', () => {
  test('全てのフィルターにマッチする場合trueを返す')
  test('1つでもマッチしない場合falseを返す')
  test('空のフィルター配列の場合trueを返す')
  test('複数のオペレータが混在する場合に正しく評価できる')
})
```

### 4. エンドツーエンドテストの設計

#### テストファイル: `__tests__/e2e-near-search.test.ts`

**テストケース構成**:

```typescript
describe('$near検索のE2Eテスト', () => {
  beforeAll(async () => {
    // テストデータの投入
    await seedTestVenues()
  })

  afterAll(async () => {
    // テストデータのクリーンアップ
    await cleanupTestVenues()
  })

  describe('クライアント→Lambda→DynamoDB', () => {
    test('簡易形式の$nearクエリで検索できる')
    test('GeoJSON形式の$nearクエリで検索できる')
    test('paginationのperPageが適用される')
    test('maxDistanceでフィルタリングできる')
    test('minDistanceでフィルタリングできる')
    test('結果が距離順にソートされる')
    test('__distanceフィールドが付与される')
  })

  describe('エラーケース', () => {
    test('無効な座標の場合にエラーを返す')
    test('無効なlimitの場合にエラーを返す')
    test('GeoHashフィールドが存在しない場合にエラーを返す')
  })
})
```

## Data Models

### テストデータモデル

```typescript
interface TestVenue {
  id: string
  name: string
  location: {
    latitude: number
    longitude: number
  }
  status: 'active' | 'inactive'
}

interface TestShadowRecord {
  PK: string
  SK: string
  // dataフィールドは含まない（シャドウレコードの仕様）
}

interface TestMainRecord {
  PK: string
  SK: string
  data: TestVenue
}
```

### テストデータセット

```typescript
const TEST_VENUES: TestVenue[] = [
  {
    id: 'venue-001',
    name: '東京タワー',
    location: { latitude: 35.6586, longitude: 139.7454 },
    status: 'active',
  },
  {
    id: 'venue-002',
    name: '東京スカイツリー',
    location: { latitude: 35.7101, longitude: 139.8107 },
    status: 'active',
  },
  {
    id: 'venue-003',
    name: '北極点',
    location: { latitude: 90.0, longitude: 0.0 },
    status: 'active',
  },
  {
    id: 'venue-004',
    name: '南極点',
    location: { latitude: -90.0, longitude: 0.0 },
    status: 'active',
  },
  {
    id: 'venue-005',
    name: '日付変更線',
    location: { latitude: 0.0, longitude: 180.0 },
    status: 'active',
  },
]
```

## Testing Strategy

### カバレッジ目標

| ファイル | 現在 | 目標 | 優先度 |
|---------|------|------|--------|
| nearQuery.ts | 3.67% | 90% | 最優先 |
| filter.ts | 27.56% | 90% | 高 |
| find/utils.ts | 49.6% | 90% | 高 |
| handler.ts | 95.65% | 95% | 維持 |
| generator.ts | 83.72% | 90% | 中 |
| その他operations/* | 0-8% | 80% | 中 |

### テスト実行戦略

```bash
# 1. ユニットテストのみ実行（高速）
npm run test:unit

# 2. カバレッジ付きで全テスト実行
npm run test:coverage

# 3. 特定ファイルのカバレッジ確認
npm run test:coverage -- __tests__/near-query.test.ts

# 4. カバレッジ閾値チェック（CI/CD用）
npm run test:coverage -- --coverage.lines=80 --coverage.branches=75
```

### CI/CDでのカバレッジチェック

```yaml
# .github/workflows/ci.yml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Check coverage thresholds
  run: |
    npm run test:coverage -- \
      --coverage.lines=80 \
      --coverage.branches=75 \
      --coverage.functions=75 \
      --coverage.statements=80
```

## Error Handling

### テストでのエラーハンドリング

```typescript
describe('エラーハンドリング', () => {
  test('DynamoDBエラー時に適切なエラーを投げる', async () => {
    // Arrange
    vi.mocked(executeDynamoDBOperation).mockRejectedValue(
      new Error('DynamoDB error')
    )

    // Act & Assert
    await expect(
      executeNearQuery('venues', 'location', mockNearQuery, 10, 'test-id')
    ).rejects.toThrow('DynamoDB error')
  })

  test('無効な座標の場合にエラーを投げる', async () => {
    // Arrange
    const invalidNearQuery = {
      latitude: 91, // 無効（-90〜90の範囲外）
      longitude: 0,
    }

    // Act & Assert
    await expect(
      executeNearQuery('venues', 'location', invalidNearQuery, 10, 'test-id')
    ).rejects.toThrow('Invalid coordinates')
  })
})
```

## Implementation Plan

### Phase 1: nearQuery.tsのテスト追加（最優先）

1. `__tests__/near-query.test.ts`を作成
2. 正常系テストを追加（5ケース）
3. DynamoDB統合テストを追加（5ケース）
4. エラーハンドリングテストを追加（3ケース）
5. エッジケーステストを追加（5ケース）
6. カバレッジ確認（目標90%）

### Phase 2: filter.tsのテスト追加（高優先）

1. `__tests__/filter-comprehensive.test.ts`を作成
2. 全オペレータのパーステストを追加（13ケース）
3. isValidOperatorのテストを追加（15ケース）
4. matchesFilterのテストを追加（10ケース）
5. convertTypeのテストを追加（6ケース）
6. カバレッジ確認（目標90%）

### Phase 3: find/utils.tsのテスト追加（高優先）

1. `__tests__/find-utils-comprehensive.test.ts`を作成
2. detectNearQueryのテストを追加（8ケース）
3. parseFiltersのテストを追加（6ケース）
4. matchesAllFiltersのテストを追加（4ケース）
5. カバレッジ確認（目標90%）

### Phase 4: E2Eテストの追加（中優先）

1. `__tests__/e2e-near-search.test.ts`を作成
2. クライアント→Lambda→DynamoDBのテストを追加（7ケース）
3. エラーケーステストを追加（3ケース）
4. パフォーマンステストを追加（2ケース）

### Phase 5: CI/CDでのカバレッジチェック設定

1. `.github/workflows/ci.yml`を更新
2. カバレッジ閾値を設定（80%/75%）
3. カバレッジレポートをGitHub Actionsに表示

## Notes

- テストは**実装前に書く**（TDD）ではなく、**実装後に充実させる**アプローチ
- カバレッジは**指標**であり、**目的ではない**（質の高いテストを書くことが重要）
- エッジケースは**実際に発生しうる**ケースに絞る（過度なテストは避ける）
- モックは**必要最小限**にする（実際のコードパスをテストすることを優先）
