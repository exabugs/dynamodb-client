/**
 * GeoHash近隣検索ロジック
 *
 * Records Lambdaで検証済みの9ブロック検索アルゴリズムを移植
 */
import {
  DEFAULT_GEOHASH_CONFIG,
  type DocumentWithDistance,
  type GeoHashConfig,
  type NearQuery,
  calculateDistance,
  encodeGeoHash,
  extractCoordinatesFromNearQuery,
  extractMaxDistanceFromNearQuery,
  extractMinDistanceFromNearQuery,
  getNeighborGeoHashes,
} from '../../shared/geohash/index.js';

/**
 * GeoHash精度ごとの誤差範囲（メートル）
 * 9ブロック検索（3×3）での実効カバー範囲を計算
 */
const GEOHASH_COVERAGE: Record<number, number> = {
  8: 19 * 3, // ±19m × 3 = 約57m
  7: 76 * 3, // ±76m × 3 = 約228m
  6: 610 * 3, // ±610m × 3 = 約1,830m (1.8km)
  5: 2400 * 3, // ±2.4km × 3 = 約7,200m (7.2km)
  4: 20000 * 3, // ±20km × 3 = 約60,000m (60km)
  3: 78000 * 3, // ±78km × 3 = 約234,000m (234km)
  2: 630000 * 3, // ±630km × 3 = 約1,890,000m (1,890km)
};

/**
 * 指定された精度での9ブロック検索がmaxDistanceをカバーしているか判定
 */
function coversMaxDistance(precision: number, maxDistance: number): boolean {
  const coverage = GEOHASH_COVERAGE[precision];
  if (!coverage) {
    return false;
  }
  return coverage >= maxDistance;
}

/**
 * 9ブロック検索の結果
 */
export interface NearSearchResult<T> {
  /** 距離付きドキュメント */
  documents: Array<T & DocumentWithDistance>;
  /** 検索メタデータ */
  metadata: {
    /** 検索反復回数 */
    iterations: number;
    /** 候補数 */
    candidatesFound: number;
    /** 要求件数 */
    requestedLimit: number;
  };
}

/**
 * 9ブロック検索を実行
 *
 * Records Lambdaの`findVenueCandidates`関数のロジックを移植。
 * 段階的に精度を緩和しながら、9ブロック（中心 + 隣接8方向）を検索します。
 *
 * @param nearQuery - $nearクエリ
 * @param fieldName - GeoHashフィールド名
 * @param limit - 取得件数
 * @param searchFunction - 実際の検索を実行する関数
 * @param config - GeoHash設定
 * @returns 距離付きドキュメントと検索メタデータ
 *
 * @example
 * ```typescript
 * const result = await executeNearSearch(
 *   { latitude: 35.6812, longitude: 139.7671, maxDistance: 5000 },
 *   'location',
 *   10,
 *   async (geohashPrefix) => {
 *     // DynamoDBから検索
 *     return await collection.find({ geohash: { $regex: `^${geohashPrefix}` } }).toArray();
 *   }
 * );
 * ```
 */
export async function executeNearSearch<T extends Record<string, unknown>>(
  nearQuery: NearQuery,
  fieldName: string,
  limit: number,
  searchFunction: (geohashPrefix: string) => Promise<T[]>,
  config: GeoHashConfig = DEFAULT_GEOHASH_CONFIG
): Promise<NearSearchResult<T>> {
  // クエリから緯度・経度を抽出
  const { latitude, longitude } = extractCoordinatesFromNearQuery(nearQuery);
  const maxDistance = extractMaxDistanceFromNearQuery(nearQuery);
  const minDistance = extractMinDistanceFromNearQuery(nearQuery);

  let precision = config.searchPrecision;
  let allCandidates: T[] = [];
  let iterations = 0;

  // 段階的に精度を緩和しながら検索
  while (
    allCandidates.length < limit * config.candidateMultiplier &&
    precision >= config.minPrecision &&
    iterations < config.maxIterations
  ) {
    iterations++;

    // 現在の精度でGeoHashを再計算
    const currentGeoHash = encodeGeoHash(latitude, longitude, precision);

    // 隣接する8方向のGeoHashを取得（合計9ブロック）
    const neighborGeoHashes = getNeighborGeoHashes(currentGeoHash);

    // 9ブロック分のGeoHashで並列検索
    const searchPromises = neighborGeoHashes.map((geohash) => searchFunction(geohash));

    const results = await Promise.all(searchPromises);
    const candidates = results.flat();

    // 重複を除外して追加
    for (const candidate of candidates) {
      if (!allCandidates.some((c) => c.id === candidate.id)) {
        allCandidates.push(candidate);
      }
    }

    // maxDistanceが指定されている場合、距離内の候補数をチェック
    if (maxDistance !== undefined) {
      // 現在の候補から距離内のものをカウント
      let candidatesWithinDistance = 0;
      for (const candidate of allCandidates) {
        const location = candidate[fieldName] as
          | { latitude: number; longitude: number }
          | undefined;
        if (
          location &&
          typeof location.latitude === 'number' &&
          typeof location.longitude === 'number'
        ) {
          const distance = calculateDistance(
            latitude,
            longitude,
            location.latitude,
            location.longitude
          );
          if (distance <= maxDistance) {
            candidatesWithinDistance++;
          }
        }
      }

      // 距離内の候補が十分に見つかったら終了
      if (candidatesWithinDistance >= limit) {
        console.log('[nearSearch] Early termination: found enough candidates within maxDistance', {
          candidatesWithinDistance,
          limit,
          maxDistance,
          precision,
          iterations,
        });
        break;
      }

      // 現在の精度での検索範囲がmaxDistanceを完全にカバーしている場合、
      // これ以上精度を緩和しても意味がないので終了
      if (coversMaxDistance(precision, maxDistance)) {
        console.log('[nearSearch] Early termination: current precision covers maxDistance', {
          precision,
          maxDistance,
          coverage: GEOHASH_COVERAGE[precision],
          candidatesWithinDistance,
          iterations,
        });
        break;
      }
    }

    // 精度を1文字減らす（検索範囲を広げる）
    precision--;
  }

  // 距離計算・フィルタリング・ソート
  const documentsWithDistance = allCandidates
    .map((doc) => {
      // フィールドから地理座標を取得
      const location = doc[fieldName] as { latitude: number; longitude: number } | undefined;

      // デバッグログ: locationフィールドの内容を確認
      if (!location) {
        console.log('[nearSearch] Location field not found:', {
          fieldName,
          docKeys: Object.keys(doc),
          doc: JSON.stringify(doc).substring(0, 200),
        });
      }

      if (
        !location ||
        typeof location.latitude !== 'number' ||
        typeof location.longitude !== 'number'
      ) {
        return null;
      }

      // 距離計算
      const distance = calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude
      );

      // デバッグログ: 距離計算結果
      console.log('[nearSearch] Distance calculated:', {
        docId: doc.id,
        distance,
        maxDistance,
        minDistance,
        willBeFiltered:
          (maxDistance !== undefined && distance > maxDistance) ||
          (minDistance !== undefined && distance < minDistance),
      });

      // 距離フィルタリング
      if (maxDistance !== undefined && distance > maxDistance) {
        return null;
      }
      if (minDistance !== undefined && distance < minDistance) {
        return null;
      }

      return {
        ...doc,
        __distance: distance,
        __geohash: encodeGeoHash(location.latitude, location.longitude, config.searchPrecision),
      } as T & DocumentWithDistance;
    })
    .filter((doc): doc is T & DocumentWithDistance => doc !== null)
    .sort((a, b) => a.__distance! - b.__distance!)
    .slice(0, limit);

  return {
    documents: documentsWithDistance,
    metadata: {
      iterations,
      candidatesFound: allCandidates.length,
      requestedLimit: limit,
    },
  };
}
