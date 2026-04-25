/**
 * GeoHash関連の型定義
 */

/**
 * 地理座標
 */
export interface GeoCoordinates {
  latitude: number; // -90 ≤ latitude ≤ 90
  longitude: number; // -180 ≤ longitude ≤ 180
}

/**
 * $near演算子のクエリ（GeoJSON形式）
 */
export interface NearQueryGeoJSON {
  $geometry: {
    type: 'Point';
    coordinates: [number, number]; // [経度, 緯度]
  };
  $maxDistance?: number; // メートル（オプション）
  $minDistance?: number; // メートル（オプション）
  $minPrecision?: number; // GeoHash最小精度（オプション、デフォルト: DEFAULT_GEOHASH_CONFIG.minPrecision）
}

/**
 * $near演算子のクエリ（簡易形式）
 */
export interface NearQuerySimple {
  latitude: number;
  longitude: number;
  maxDistance?: number; // メートル（オプション）
  minDistance?: number; // メートル（オプション）
  minPrecision?: number; // GeoHash最小精度（オプション、デフォルト: DEFAULT_GEOHASH_CONFIG.minPrecision）
}

/**
 * $near演算子のクエリ（統合型）
 */
export type NearQuery = NearQueryGeoJSON | NearQuerySimple;

/**
 * 距離付きドキュメント
 */
export interface DocumentWithDistance extends Record<string, unknown> {
  __distance?: number; // メートル
  __geohash?: string; // 検索に使用したGeoHash
}

/**
 * GeoHash設定
 */
export interface GeoHashConfig {
  /**
   * シャドウインデックス生成時の精度（デフォルト: 8）
   * ±19m（建物レベル）
   */
  shadowPrecision: number;

  /**
   * 検索開始時の精度（デフォルト: 6）
   * ±610m（近隣レベル）
   */
  searchPrecision: number;

  /**
   * 最小精度（段階的検索用、デフォルト: 4）
   * ±20km（大都市レベル）
   */
  minPrecision: number;

  /**
   * 最大検索反復回数（デフォルト: 5）
   */
  maxIterations: number;

  /**
   * 候補数の倍率（デフォルト: 3）
   */
  candidateMultiplier: number;
}

/**
 * GeoHash精度と誤差の対応表
 */
export const GEOHASH_PRECISION_TABLE = {
  1: { error: 2500000, description: '大陸レベル' },
  4: { error: 20000, description: '大都市レベル' },
  6: { error: 610, description: '近隣レベル' },
  7: { error: 76, description: '街区レベル' },
  8: { error: 19, description: '建物レベル' },
  10: { error: 0.6, description: '高精度' },
} as const;

/**
 * デフォルトGeoHash設定
 */
export const DEFAULT_GEOHASH_CONFIG: GeoHashConfig = {
  shadowPrecision: 8, // ±19m（建物レベル）
  searchPrecision: 6, // ±610m（近隣レベル）
  minPrecision: 4, // ±20km（大都市レベル）
  maxIterations: 5,
  candidateMultiplier: 3,
};
