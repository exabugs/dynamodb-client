# 設計書: GeoHash検索機能

## 概要

本設計は、GeoHashを用いた効率的な開催地検索機能を実装します。GeoHashは緯度・経度を1次元の文字列に変換し、データベースの辞書式インデックスで高速検索を可能にします。

## アーキテクチャ

### システム構成

```
Mobile App (Flutter)
    ↓ GET /venues/nearby?lat=35.6812&lng=139.7671&limit=5
Records Lambda (BFF)
    ├─ GeoHash計算
    ├─ 段階的検索ループ
    ├─ 距離計算・ソート
    └─ DynamoDB Client API呼び出し (IAM)
        ↓
DynamoDB Client API
    ├─ GeoHashインデックス検索
    └─ DynamoDBアクセス
```

### データフロー

1. **App → Records API**: 位置情報（緯度・経度）と取得件数を送信
2. **Records API**: GeoHashを計算
3. **Records API → DynamoDB Client**: GeoHash前方一致で候補を検索
4. **Records API**: 候補を正円距離でソート
5. **Records API → App**: 距離順にソートされた開催地を返却

## コンポーネントとインターフェース

### 1. GeoHashユーティリティ

**目的**: 緯度・経度とGeoHashの相互変換、隣接GeoHashの計算

**実装**:
```typescript
// packages/core/src/utils/geohash.ts

/**
 * GeoHashエンコード
 * @param latitude 緯度 (-90 to 90)
 * @param longitude 経度 (-180 to 180)
 * @param precision 精度（文字数）デフォルト: 6
 * @returns GeoHash文字列
 */
export function encodeGeoHash(
  latitude: number,
  longitude: number,
  precision: number = 6
): string {
  // ngeohash ライブラリを使用
  return ngeohash.encode(latitude, longitude, precision);
}

/**
 * GeoHashデコード
 * @param geohash GeoHash文字列
 * @returns { latitude, longitude, error }
 */
export function decodeGeoHash(geohash: string): {
  latitude: number;
  longitude: number;
  error: { latitude: number; longitude: number };
} {
  return ngeohash.decode(geohash);
}

/**
 * 隣接する8方向のGeoHashを取得
 * @param geohash 中心のGeoHash文字列
 * @returns 9つのGeoHash（中心 + 8方向）
 */
export function getNeighborGeoHashes(geohash: string): string[] {
  const neighbors = [
    geohash, // 中心
    ngeohash.neighbor(geohash, [1, 0]),   // 右
    ngeohash.neighbor(geohash, [-1, 0]),  // 左
    ngeohash.neighbor(geohash, [0, 1]),   // 上
    ngeohash.neighbor(geohash, [0, -1]),  // 下
    ngeohash.neighbor(geohash, [1, 1]),   // 右上
    ngeohash.neighbor(geohash, [1, -1]),  // 右下
    ngeohash.neighbor(geohash, [-1, 1]),  // 左上
    ngeohash.neighbor(geohash, [-1, -1]), // 左下
  ];
  
  // 重複を排除（境界条件で同じGeoHashが返る場合がある）
  return Array.from(new Set(neighbors));
}

/**
 * GeoHash精度と誤差の対応表
 */
export const GEOHASH_PRECISION = {
  1: { error: 2500000, description: '大陸レベル' },
  4: { error: 20000, description: '大都市レベル' },
  6: { error: 610, description: '近隣レベル' },
  7: { error: 76, description: '街区レベル' },
  8: { error: 19, description: '建物レベル' },
  10: { error: 0.6, description: '高精度' },
} as const;

/**
 * GeoHash精度設定
 * 
 * シャドウインデックスは高精度（8文字）で保存し、
 * 検索は低精度（6文字）で開始することで、
 * パフォーマンスと将来の拡張性を両立する。
 */
export const SHADOW_GEOHASH_PRECISION = 8;  // シャドウインデックス生成時の精度（±19m）
export const SEARCH_GEOHASH_PRECISION = 6;  // 検索開始時の精度（±610m）
```

**依存関係**:
- `ngeohash`: GeoHashエンコード・デコード・隣接計算ライブラリ

### 2. 距離計算ユーティリティ

**目的**: 2点間の正円距離（Haversine公式）を計算

**実装**:
```typescript
// packages/core/src/utils/distance.ts

/**
 * Haversine公式による2点間の距離計算
 * @param lat1 地点1の緯度
 * @param lon1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lon2 地点2の経度
 * @returns 距離（メートル）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 地球の半径（メートル）
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
```

### 3. Records API: 開催地検索エンドポイント

**エンドポイント**: `GET /venues/nearby`

**クエリパラメータ**:
```typescript
interface NearbyVenuesQuery {
  latitude: number;   // 緯度 (-90 to 90)
  longitude: number;  // 経度 (-180 to 180)
  limit: number;      // 取得件数（デフォルト: 5, 最大: 50）
}
```

**レスポンス**:
```typescript
interface NearbyVenuesResponse {
  venues: Array<{
    id: string;
    name: string;
    location: {
      latitude: number;
      longitude: number;
    };
    distance: number;  // メートル
    geohash: string;
    // ... その他の開催地プロパティ
  }>;
  metadata: {
    searchLocation: {
      latitude: number;
      longitude: number;
    };
    requestedLimit: number;
    returnedCount: number;
    searchIterations: number;  // 検索ループ回数
  };
}
```

**実装**:
```typescript
// functions/records/src/handlers/venues.ts

async function handleNearbyVenues(
  query: NearbyVenuesQuery
): Promise<NearbyVenuesResponse> {
  // 1. パラメータ検証
  validateLocation(query.latitude, query.longitude);
  const limit = Math.min(query.limit || 5, 50);

  // 2. GeoHash計算
  const searchGeoHash = encodeGeoHash(
    query.latitude,
    query.longitude,
    DEFAULT_PRECISION
  );

  // 3. 段階的検索
  const candidates = await findVenueCandidates(
    searchGeoHash,
    limit,
    query.latitude,
    query.longitude
  );

  // 4. 距離計算・ソート
  const venuesWithDistance = candidates.map(venue => ({
    ...venue,
    distance: calculateDistance(
      query.latitude,
      query.longitude,
      venue.location.latitude,
      venue.location.longitude
    ),
  }));

  venuesWithDistance.sort((a, b) => a.distance - b.distance);

  // 5. レスポンス生成
  return {
    venues: venuesWithDistance.slice(0, limit),
    metadata: {
      searchLocation: {
        latitude: query.latitude,
        longitude: query.longitude,
      },
      requestedLimit: limit,
      returnedCount: Math.min(venuesWithDistance.length, limit),
      searchIterations: candidates.length > 0 ? 1 : 0,
    },
  };
}
```

### 4. 9ブロック検索アルゴリズム（隣接GeoHash検索）

**目的**: 境界をまたぐ開催地を見逃さないため、対象地点と隣接8方向の合計9ブロックを検索

**検索漏れが発生する理由**:
- GeoHashは地球表面を階層的な矩形（ボックス）に分割
- 対象地点がごく近くにあっても、異なるGeoHash矩形に属していれば検索結果から漏れる
- 特に矩形の境界付近では、隣接ブロックに近い開催地が存在する可能性が高い

**実装**:
```typescript
// functions/records/src/services/venue-search.ts

const DEFAULT_PRECISION = 6;  // 検索開始精度: ±610m
const MIN_PRECISION = 4;      // 最小精度: ±20km
const MAX_ITERATIONS = 5;
const CANDIDATE_MULTIPLIER = 3;  // 候補数の倍率

async function findVenueCandidates(
  searchGeoHash: string,
  limit: number,
  latitude: number,
  longitude: number
): Promise<Venue[]> {
  const { db } = await getDynamoClient();
  const venuesCollection = db.collection<Venue>('venues');
  
  let precision = DEFAULT_PRECISION;
  let allCandidates: Venue[] = [];
  let iterations = 0;
  
  // 段階的に精度を緩和しながら検索
  while (
    allCandidates.length < limit * CANDIDATE_MULTIPLIER &&
    precision >= MIN_PRECISION &&
    iterations < MAX_ITERATIONS
  ) {
    iterations++;
    
    // 現在の精度でGeoHashを再計算
    const currentGeoHash = encodeGeoHash(latitude, longitude, precision);
    
    // 隣接する8方向のGeoHashを取得（合計9ブロック）
    const neighborGeoHashes = getNeighborGeoHashes(currentGeoHash);
    
    log('DEBUG', '9ブロック検索開始', {
      precision,
      centerGeoHash: currentGeoHash,
      neighborCount: neighborGeoHashes.length,
    });
    
    // 9ブロック分のGeoHashで並列検索
    // 注: シャドウインデックスは8文字で保存されているが、
    //     6文字の前方一致で検索可能（より細かい粒度でヒット）
    // 各GeoHashブロックの検索は独立しているため、Promise.all()で並列化
    const searchPromises = neighborGeoHashes.map(geohash =>
      venuesCollection
        .find({
          geohash: { $regex: `^${geohash}` },  // 前方一致検索
          status: 'active',
        })
        .toArray()
    );
    
    const results = await Promise.all(searchPromises);
    const candidates = results.flat();
    
    // 重複を除外して追加
    for (const candidate of candidates) {
      if (!allCandidates.some(v => v.id === candidate.id)) {
        allCandidates.push(candidate);
      }
    }
    
    log('DEBUG', '9ブロック検索完了', {
      precision,
      foundCount: candidates.length,
      totalCandidates: allCandidates.length,
      targetCount: limit * CANDIDATE_MULTIPLIER,
    });
    
    // 精度を1文字減らす（検索範囲を広げる）
    precision--;
  }
  
  log('INFO', 'GeoHash検索完了', {
    iterations,
    candidatesFound: allCandidates.length,
    requestedLimit: limit,
  });
  
  return allCandidates;
}
```

**検索ロジックの詳細**:

1. **対象地点のGeoHashを特定**: 検索したい地点の緯度・経度から、適切な精度（桁数）のGeoHashを生成
2. **隣接する8方向のGeoHashを取得**: 対象GeoHashの上、下、左、右、左上、右上、左下、右下の8つの隣接GeoHashを特定
3. **9つのGeoHashを検索対象とする**: 対象GeoHashと隣接する8つのGeoHash、合計9つのGeoHashをデータベースクエリの対象とする
4. **重複を排除**: 9つの矩形に含まれるすべてのデータが取得されるため、重複した開催地を除外
5. **距離でフィルタリング**: 取得したデータに対して最終的な距離計算を行い、距離順にソート

**境界条件の処理**:
- `ngeohash.neighbor()`関数は日付変更線や極付近の境界を適切に処理
- 境界をまたぐ場合でも正しい隣接GeoHashを返却
- 重複するGeoHashは`Set`で自動的に排除
```

### 5. DynamoDB Client: GeoHash自動保存

**目的**: 開催地の保存時にGeoHashを自動計算・保存

**実装**:
```typescript
// DynamoDB Client側の実装（@exabugs/dynamodb-client）

// shadow.config.json でGeoHashフィールドを定義
{
  "venues": {
    "fields": {
      "id": { "type": "string", "primary": true },
      "name": { "type": "string" },
      "location": {
        "type": "object",
        "properties": {
          "latitude": { "type": "number" },
          "longitude": { "type": "number" }
        }
      },
      "geohash": { "type": "string", "index": true },  // 自動インデックス
      "status": { "type": "string" }
    }
  }
}

// Records API側でGeoHashを計算して保存
async function createOrUpdateVenue(venue: Venue): Promise<Venue> {
  // GeoHashを計算（シャドウインデックス用に8文字で保存）
  const geohash = encodeGeoHash(
    venue.location.latitude,
    venue.location.longitude,
    8  // シャドウインデックスは高精度（±19m）で保存
  );
  
  const venueWithGeoHash = {
    ...venue,
    geohash,
  };
  
  const { db } = await getDynamoClient();
  const venuesCollection = db.collection<Venue>('venues');
  
  await venuesCollection.updateOne(
    { id: venue.id },
    { $set: venueWithGeoHash },
    { upsert: true }
  );
  
  return venueWithGeoHash;
}
```

## データモデル

### 開催地（拡張）

```typescript
interface Venue {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  geohash: string;  // 新規追加
  status: 'active' | 'inactive';
  // ... その他のフィールド
}
```

### 距離付き開催地

```typescript
interface VenueWithDistance extends Venue {
  distance: number;  // メートル
}
```

## 正確性プロパティ

### プロパティ1: GeoHash計算の一貫性

*任意の* 緯度・経度のペアに対して、同じ精度でエンコードした場合、常に同じGeoHash文字列が生成される

**検証対象: 要件 2.1, 2.4**

### プロパティ2: 距離ソートの正確性

*任意の* 検索結果に対して、返却される開催地は距離の昇順でソートされている

**検証対象: 要件 1.4, 4.2**

### プロパティ3: 9ブロック検索の完全性

*任意の* 検索リクエストに対して、9ブロック検索（中心 + 隣接8方向）は単一ブロック検索よりも多くの候補を返す（または同数）

**検証対象: 要件 3.1, 3.4**

### プロパティ4: 隣接GeoHashの正確性

*任意の* GeoHashに対して、getNeighborGeoHashes()は9つの一意なGeoHashを返す（境界条件を除く）

**検証対象: 要件 3.2, 3.3**

### プロパティ5: 段階的検索の完全性

*任意の* 検索リクエストに対して、精度を緩和することで、より多くの候補が見つかる（または同数）

**検証対象: 要件 4.1, 4.2**

### プロパティ6: 重複排除

*任意の* 検索結果に対して、同じ開催地IDが複数回含まれることはない

**検証対象: 要件 3.4, 4.4**

### プロパティ7: GeoHash検索の正確性

*任意の* 9ブロック検索に対して、返却される開催地のGeoHashは9つのGeoHashのいずれかに一致する

**検証対象: 要件 3.1**

### プロパティ8: 距離計算の対称性

*任意の* 2つの地点A, Bに対して、distance(A, B) == distance(B, A)

**検証対象: 要件 5.1**

### プロパティ9: レスポンス件数の制限

*任意の* 検索リクエストに対して、返却される開催地の数は要求されたlimit以下である

**検証対象: 要件 4.4**

## エラーハンドリング

### 入力検証エラー

```typescript
// 緯度・経度の範囲チェック
function validateLocation(latitude: number, longitude: number): void {
  if (latitude < -90 || latitude > 90) {
    throw new ValidationError('Latitude must be between -90 and 90');
  }
  if (longitude < -180 || longitude > 180) {
    throw new ValidationError('Longitude must be between -180 and 180');
  }
}

// limitの範囲チェック
function validateLimit(limit: number): void {
  if (limit < 1 || limit > 50) {
    throw new ValidationError('Limit must be between 1 and 50');
  }
}
```

### データベースエラー

```typescript
async function findVenueCandidatesWithRetry(
  searchGeoHash: string,
  limit: number,
  latitude: number,
  longitude: number
): Promise<Venue[]> {
  try {
    return await findVenueCandidates(searchGeoHash, limit, latitude, longitude);
  } catch (error) {
    log('ERROR', 'GeoHash search failed, retrying', {
      error: (error as Error).message,
    });
    
    // 1回だけリトライ
    return await findVenueCandidates(searchGeoHash, limit, latitude, longitude);
  }
}
```

### 空結果の処理

```typescript
// 開催地が見つからない場合でも200を返す
if (venuesWithDistance.length === 0) {
  return {
    venues: [],
    metadata: {
      searchLocation: { latitude, longitude },
      requestedLimit: limit,
      returnedCount: 0,
      searchIterations: iterations,
    },
  };
}
```

## テスト戦略

### ユニットテスト

1. **GeoHashエンコード・デコード**
   - 既知の緯度・経度でGeoHashが正しく生成されるか
   - GeoHashから緯度・経度が正しく復元されるか

2. **距離計算**
   - 既知の2点間の距離が正しく計算されるか
   - 対称性（distance(A, B) == distance(B, A)）

3. **入力検証**
   - 無効な緯度・経度でエラーが発生するか
   - 無効なlimitでエラーが発生するか

### プロパティベーステスト

1. **プロパティ1: GeoHash計算の一貫性**
   ```typescript
   fc.assert(
     fc.property(
       fc.float({ min: -90, max: 90 }),
       fc.float({ min: -180, max: 180 }),
       (lat, lng) => {
         const hash1 = encodeGeoHash(lat, lng, 6);
         const hash2 = encodeGeoHash(lat, lng, 6);
         return hash1 === hash2;
       }
     )
   );
   ```

2. **プロパティ2: 距離ソートの正確性**
   ```typescript
   fc.assert(
     fc.property(
       fc.array(fc.record({ distance: fc.float({ min: 0, max: 100000 }) })),
       (venues) => {
         const sorted = venues.sort((a, b) => a.distance - b.distance);
         for (let i = 0; i < sorted.length - 1; i++) {
           if (sorted[i].distance > sorted[i + 1].distance) {
             return false;
           }
         }
         return true;
       }
     )
   );
   ```

3. **プロパティ6: 距離計算の対称性**
   ```typescript
   fc.assert(
     fc.property(
       fc.float({ min: -90, max: 90 }),
       fc.float({ min: -180, max: 180 }),
       fc.float({ min: -90, max: 90 }),
       fc.float({ min: -180, max: 180 }),
       (lat1, lng1, lat2, lng2) => {
         const d1 = calculateDistance(lat1, lng1, lat2, lng2);
         const d2 = calculateDistance(lat2, lng2, lat1, lng1);
         return Math.abs(d1 - d2) < 0.001; // 浮動小数点誤差を考慮
       }
     )
   );
   ```

### 統合テスト

1. **開催地検索API**
   - 既知の位置で検索し、期待される開催地が返却されるか
   - 距離順にソートされているか
   - limit以下の件数が返却されるか

2. **GeoHash自動保存**
   - 開催地を作成・更新時にGeoHashが保存されるか
   - GeoHashインデックスが使用されるか

## パフォーマンス考慮事項

### GeoHash精度の設計方針

**シャドウインデックスと検索精度の分離**:

本設計では、**シャドウインデックスの精度**と**検索開始精度**を分離することで、パフォーマンスと将来の拡張性を両立します。

#### シャドウインデックス精度: 8文字（±19m）

```typescript
const SHADOW_GEOHASH_PRECISION = 8;  // ±19m（建物レベル）
```

**理由**:
- より細かい粒度でデータを分散
- 同じ6文字プレフィックス内でも、8文字の違いで区別可能
- 距離ソートの精度が向上
- 将来的に検索精度を上げたい場合、データ再計算不要

**影響**:
- インデックスサイズ: 1件あたり2バイト増加（1000件で2KB、無視できるレベル）
- 検索パフォーマンス: 影響なし（検索は6文字で開始）

#### 検索開始精度: 6文字（±610m）

```typescript
const SEARCH_GEOHASH_PRECISION = 6;  // ±610m（近隣レベル）
```

**理由**:
- 初回検索で約3.6km範囲をカバー
- 都市部での近隣検索に十分な精度
- 段階的検索の反復回数が少ない（1-2回）
- パフォーマンス要件（500ms以内）を満たしやすい

**検索の仕組み**:
```typescript
// シャドウインデックス: 'location#xn74rnqp#id#venue-001'（8文字）
// 検索クエリ: 'location#xn74rn'（6文字前方一致）
// → 8文字で保存されているが、6文字の前方一致で検索可能
// → より細かい粒度でヒット（xn74rnqp, xn74rnqz, xn74rnr0 等）
```

#### 将来の拡張性

検索精度を上げたい場合、環境変数を変更するだけ:

```typescript
// 現在
const SEARCH_GEOHASH_PRECISION = 6;  // ±610m

// 将来（データ再計算不要）
const SEARCH_GEOHASH_PRECISION = 7;  // ±76m
// または
const SEARCH_GEOHASH_PRECISION = 8;  // ±19m

// シャドウインデックスは既に8文字で保存されているので、
// そのまま使える（マイグレーション不要）
```

### GeoHash精度の選択（従来の説明）

- **デフォルト精度**: 6文字（±610m）
  - 都市部での近隣検索に適切
  - インデックスサイズとのバランス

- **最小精度**: 4文字（±20km）
  - 広範囲検索時のフォールバック
  - 候補が少ない地域での検索

### 候補数の倍率

```typescript
const CANDIDATE_MULTIPLIER = 3;
```

- 要求件数の3倍の候補を取得
- 距離ソート後に正確な結果を返却
- 過剰な候補取得を防ぐ

### 検索ループの制限

```typescript
const MAX_ITERATIONS = 5;
```

- 無限ループを防ぐ
- 5回のループで十分な候補が見つかる想定

### 9ブロック検索の並列化

**並列化の実装**:

9つのGeoHashブロックの検索は完全に独立しているため、`Promise.all()`で並列実行します。

```typescript
// 各GeoHashブロックの検索を並列実行
const searchPromises = neighborGeoHashes.map(geohash =>
  venuesCollection
    .find({
      geohash: { $regex: `^${geohash}` },
      status: 'active',
    })
    .toArray()
);

const results = await Promise.all(searchPromises);
const candidates = results.flat();
```

**並列化のメリット**:

1. **レスポンス時間の短縮**:
   - 逐次実行: 9回 × 平均50ms = 450ms
   - 並列実行: max(9回) ≈ 50-100ms
   - 約4-5倍の高速化

2. **DynamoDBコストへの影響**:
   - 読み取りキャパシティユニット（RCU）は変わらない
   - 9回のクエリは並列でも逐次でも同じRCUを消費
   - Lambda実行時間が短縮されるため、Lambda料金は削減

3. **スケーラビリティ**:
   - 各クエリは独立しているため、競合なし
   - DynamoDBの並列クエリ処理能力を活用
   - Lambda同時実行数の制約内で効率的に動作

**注意事項**:
- DynamoDB Client APIのレート制限に注意（通常は問題なし）
- Lambda同時実行数の制約を考慮（デフォルト1000）
- エラーハンドリング: 一部のクエリが失敗しても他の結果を返却

## 設定

### 環境変数

```bash
# Records Lambda
GEOHASH_SHADOW_PRECISION=8   # シャドウインデックス生成時の精度（±19m）
GEOHASH_SEARCH_PRECISION=6   # 検索開始時の精度（±610m）
GEOHASH_MIN_PRECISION=4      # 最小精度（±20km）
GEOHASH_MAX_ITERATIONS=5     # 最大検索ループ回数
GEOHASH_CANDIDATE_MULTIPLIER=3  # 候補数の倍率
```

## 自動GeoHash変換（Phase 10の基盤技術）

### 概要

`@exabugs/dynamodb-client` v0.3.x以降では、すべてのフィールドが自動的にシャドウ化されます。この機能を拡張し、**オブジェクト型で`{latitude, longitude}`を持つフィールドを自動検出してGeoHashに変換**します。

### 設計原則

1. **フィールド名は任意**: `location`は慣例的な名前だが、任意のフィールド名が使用可能
   - dynamodb-clientは`$near`演算子を含むフィールドを自動検出
   - 例: `location`, `coordinates`, `position`, `geo`など
2. **透過的な実装**: クライアントはGeoHashを意識しない
3. **自動シャドウ化**: シャドウレコードで`fieldName#geohash#id#value`形式に変換
4. **後方互換性**: 既存のシャドウ化機能と共存

### 検出条件

以下の条件をすべて満たすフィールドを地理座標として検出:

```typescript
interface GeoCoordinates {
  latitude: number;   // -90 ≤ latitude ≤ 90
  longitude: number;  // -180 ≤ longitude ≤ 180
}
```

**検出ロジック**:
1. フィールドの値がオブジェクト型である
2. `latitude`プロパティを持つ（number型）
3. `longitude`プロパティを持つ（number型）
4. `latitude`が-90〜90の範囲内
5. `longitude`が-180〜180の範囲内

**重要**: `@exabugs/dynamodb-client` v0.3.x では、オブジェクト型フィールドは通常シャドウ化されません。GeoHash変換は、オブジェクト型シャドウ化の初めての実用例となります。このため、**自動検出の誤判定リスクは実質ゼロ**です。既存の動作に影響を与えず、後方互換性が保たれます。

### データ変換例

#### クライアント側データ

```typescript
{
  id: 'venue-001',
  name: '保木公園',
  location: {
    latitude: 35.6812,
    longitude: 139.7671
  }
}
```

#### DynamoDB側データ（シャドウレコード）

```typescript
{
  PK: 'venues#venue-001',
  SK: 'venues#venue-001',
  data: {
    id: 'venue-001',
    name: '保木公園',
    location: {
      latitude: 35.6812,
      longitude: 139.7671
    }
  },
  __shadowKeys: [
    'name#保木公園#id#venue-001',
    'location#xn74rn#id#venue-001'  // GeoHashに自動変換
  ]
}
```

**ポイント**:
- `location`フィールドは元の形式で保存（`{latitude, longitude}`）
- シャドウレコードでは`location#xn74rnqp#id#venue-001`のようにGeoHashに変換（8文字）
- GeoHash精度はシャドウインデックス用に8文字（±19m）で保存
- 検索時は6文字（±610m）で前方一致検索

### シャドウレコード生成ロジック

```typescript
// @exabugs/dynamodb-client内部実装（疑似コード）

function generateShadowKeys(document: any, primaryKey: string): string[] {
  const shadowKeys: string[] = [];
  
  for (const [fieldName, value] of Object.entries(document)) {
    if (isGeoCoordinates(value)) {
      // 地理座標を検出した場合、GeoHashに変換
      // シャドウインデックスは高精度（8文字）で保存
      const geohash = encodeGeoHash(
        value.latitude,
        value.longitude,
        8  // シャドウインデックス精度: ±19m
      );
      shadowKeys.push(`${fieldName}#${geohash}#id#${document[primaryKey]}`);
    } else if (typeof value === 'string') {
      // 通常の文字列フィールド
      shadowKeys.push(`${fieldName}#${value}#id#${document[primaryKey]}`);
    }
    // ... その他の型の処理
  }
  
  return shadowKeys;
}

function isGeoCoordinates(value: any): value is GeoCoordinates {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}
```

### クライアント側の実装

クライアントは地理座標を通常のオブジェクトとして扱うだけで、GeoHashは完全に透過的:

```typescript
// 開催地の作成（GeoHashは自動生成される）
await venuesCollection.updateOne(
  { id: 'venue-001' },
  {
    $set: {
      name: '保木公園',
      location: {
        latitude: 35.6812,
        longitude: 139.7671
      }
    }
  },
  { upsert: true }
);

// 開催地の検索（$nearオペレータ使用）
const nearbyVenues = await venuesCollection.find({
  location: {
    $near: {
      latitude: 35.6812,
      longitude: 139.7671,
      maxDistance: 5000  // 5km
    }
  }
}).limit(10).toArray();

// 注: シャドウインデックスは8文字で保存されているが、
//     検索は6文字で開始される（前方一致）
//     将来的に検索精度を上げたい場合、データ再計算不要
```

### 設定可能なパラメータ

```typescript
interface GeoHashConfig {
  // シャドウインデックス生成時の精度（デフォルト: 8）
  shadowPrecision: number;
  
  // 検索開始時の精度（デフォルト: 6）
  searchPrecision: number;
  
  // 最小精度（段階的検索用、デフォルト: 4）
  minPrecision: number;
  
  // 最大検索反復回数（デフォルト: 5）
  maxIterations: number;
  
  // 候補数の倍率（デフォルト: 3）
  candidateMultiplier: number;
}
```

**設計方針**:
- `shadowPrecision` > `searchPrecision` とすることで、将来の拡張性を確保
- シャドウインデックスは高精度（8文字）で保存
- 検索は低精度（6文字）で開始し、パフォーマンスを維持
- 検索精度を上げたい場合、`searchPrecision`を変更するだけ（データ再計算不要）

### 既存データのマイグレーション

既存の開催地データにGeoHashシャドウレコードを追加する方法:

```typescript
// マイグレーションスクリプト
const venues = await venuesCollection.find({}).toArray();

for (const venue of venues) {
  // updateOneを実行すると、自動的にGeoHashシャドウレコードが生成される
  await venuesCollection.updateOne(
    { id: venue.id },
    { $set: venue }
  );
}
```

## 汎用化設計（Phase 10）

### $nearオペレータ

`@exabugs/dynamodb-client`に`$near`オペレータを実装します。

#### インターフェース設計

```typescript
// 簡易形式（推奨）
collection.find({
  location: {
    $near: {
      latitude: 35.6812,
      longitude: 139.7671,
      maxDistance: 5000,  // メートル（オプション）
      minDistance: 0      // メートル（オプション）
    }
  }
}).limit(10).toArray();
```

**注意**: 
- `limit`は`.limit()`メソッドで指定します（`$near`オブジェクト内ではありません）
- フィールド名は任意です（`location`以外も使用可能）
```

#### レスポンス形式

```typescript
interface NearbyResult<T> {
  // ドキュメント本体
  ...document: T;
  
  // 距離情報（メタデータ）
  __distance?: number;  // メートル
  __geohash?: string;   // 検索に使用したGeoHash
}
```

#### 実装方針

1. **GeoHashフィールドの自動生成**
   - `location.latitude`と`location.longitude`から自動的にGeoHashを計算
   - `geohash`フィールドに保存（インデックス付き）

2. **9ブロック検索の実装**
   - Records Lambdaで検証済みのアルゴリズムを移植
   - 段階的精度緩和（precision 6→5→4）

3. **距離計算・ソート**
   - Haversine公式による正円距離計算
   - 距離の昇順でソート

4. **設定可能なパラメータ**
   ```typescript
   interface GeoHashConfig {
     shadowPrecision: number;  // シャドウインデックス精度（デフォルト: 8）
     searchPrecision: number;  // 検索開始精度（デフォルト: 6）
     minPrecision: number;     // 最小精度（デフォルト: 4）
     maxIterations: number;    // 最大反復回数（デフォルト: 5）
     candidateMultiplier: number; // 候補数倍率（デフォルト: 3）
   }
   ```

#### MongoDB仕様との互換性

| 機能 | MongoDB | @exabugs/dynamodb-client |
|------|---------|--------------------------|
| GeoJSON形式 | ✅ サポート | ✅ サポート予定 |
| Legacy座標 | ✅ サポート | ✅ サポート予定（簡易版） |
| $near演算子 | ✅ サポート | ✅ サポート予定 |
| $nearSphere | ✅ サポート | ⚠️ $nearに統合 |
| $maxDistance | ✅ サポート | ✅ サポート予定 |
| $minDistance | ✅ サポート | ✅ サポート予定 |
| 2dsphereインデックス | ✅ サポート | ⚠️ GeoHashインデックスで代替 |
| 距離フィールド | ✅ サポート | ✅ `__distance`で提供 |

#### Records Lambdaのリファクタリング

汎用化後、Records Lambdaは`$near`オペレータを使用するように変更：

```typescript
// Before: カスタム実装
const candidates = await findVenueCandidates(searchGeoHash, limit, latitude, longitude);
const venuesWithDistance = candidates.map(venue => ({
  ...venue,
  distance: calculateDistance(latitude, longitude, venue.location.latitude, venue.location.longitude)
}));
venuesWithDistance.sort((a, b) => a.distance - b.distance);

// After: $nearオペレータ使用
const venues = await venuesCollection.find({
  location: {
    $near: {
      latitude,
      longitude,
      maxDistance: 50000  // 50km
    }
  },
  status: 'active'
}).limit(limit).toArray();

// 距離情報は __distance フィールドに自動付与
```

#### 実装スケジュール

1. **Phase 10.1**: Records Lambdaでの検証完了確認（1-2ヶ月）
   - 本番環境での動作確認
   - パフォーマンス測定
   - エッジケースの洗い出し

2. **Phase 10.2**: `@exabugs/dynamodb-client`への実装（2-3週間）
   - `$near`オペレータの実装
   - GeoHashフィールド自動生成
   - 9ブロック検索ロジックの移植
   - 距離計算・ソート機能

3. **Phase 10.3**: Records Lambdaのリファクタリング（1週間）
   - `$near`オペレータへの切り替え
   - カスタム実装の削除
   - 動作確認

4. **Phase 10.4**: ドキュメント作成（1週間）
   - `$near`オペレータの使用方法
   - 他のプロジェクトでの利用例
   - パフォーマンスチューニングガイド

### 汎用化の効果評価

#### 総合評価: 非常に高い効果が期待できる（強く推奨）

**メリット**:

1. **開発効率の向上**
   - Records Lambdaでの実績を活用（約300行のコードが約10行に削減）
   - 他のプロジェクトで2-3週間の開発期間を節約
   - テスト済みのコードを再利用

2. **コードの保守性向上**
   - バグ修正が1箇所で済む
   - アルゴリズム改善が全プロジェクトに自動適用
   - Records Lambdaのコード量が約90%削減

3. **MongoDB互換性による学習コスト削減**
   - 既存知識をそのまま活用可能
   - `$near`オペレータは直感的
   - 豊富なドキュメント・情報

4. **透過的な実装**
   - 開発者はGeoHashの詳細を知る必要なし
   - 座標データをそのまま保存・検索
   - 実装ミスが減少

5. **将来の拡張性**
   - 検索精度を上げたい場合、環境変数変更のみ
   - データ再計算不要（既に8文字で保存済み）
   - マイグレーションコスト: ゼロ

6. **パフォーマンス最適化**
   - 9ブロック検索の並列化で約4-5倍高速化
   - DynamoDB RCU: 変わらない
   - Lambda料金: 削減（実行時間短縮）

7. **自動検出の誤判定リスクなし**
   - オブジェクト型フィールドは通常シャドウ化されない
   - GeoHash変換はオブジェクト型シャドウの初実装
   - 既存の動作に影響なし（後方互換性あり）

**デメリット・リスク**:

1. **初期実装コスト**: 2-3週間（Records Lambda実装を参考にできるため許容範囲）
2. **ライブラリ複雑性**: 約500-700行増加（独立モジュール化で影響を最小化）
3. **MongoDB完全互換でない**: 高度な地理空間クエリは未サポート（基本的な近隣検索には十分）
4. **既存データのマイグレーション**: 1-2時間の作業（簡単なスクリプトで対応可能）

**リスク評価**:

| リスク項目 | 影響度 | 対策 | 評価 |
|-----------|--------|------|------|
| 初期実装コスト | 中 | Records Lambda実装を参考 | ✅ 許容範囲 |
| ライブラリ複雑性 | 低 | 独立モジュール化 | ✅ 問題なし |
| MongoDB完全互換でない | 低 | ドキュメント明記 | ✅ 基本機能は十分 |
| マイグレーション | 低 | 簡単なスクリプト | ✅ 1-2時間 |
| GeoHashの限界 | 極めて低 | 日本国内では問題なし | ✅ 問題なし |
| インデックスサイズ | 極めて低 | 10-20KB/1000件 | ✅ 無視できる |
| 自動検出誤判定 | なし | オブジェクト型シャドウの初実装 | ✅ リスクなし |
| パフォーマンス予測 | 低 | Records Lambda実績あり | ✅ 問題なし |

**結論**: GeoHash汎用化は、Records Lambdaでの実績と、オブジェクト型シャドウの現状を考慮すると、非常に効果的で低リスクな機能拡張です。開発効率、保守性、学習コストの面で大きなメリットがあり、強く推奨されます。

## 関連文書

- [要件定義](./requirements.md)
- [タスクリスト](./tasks.md)
- [メイン設計文書](../design.md)
- [BFFアーキテクチャ](../../../.kiro/steering/bff-architecture.md)
- [DynamoDBアクセス](../../../.kiro/steering/dynamodb-access.md)
- [MongoDB地理空間クエリ](https://www.mongodb.com/ja-jp/docs/manual/geospatial-queries/)
