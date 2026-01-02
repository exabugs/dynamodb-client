/**
 * GeoHashユーティリティ関数
 */
import ngeohash from 'ngeohash';

import type { GeoCoordinates, NearQuery, NearQueryGeoJSON, NearQuerySimple } from './types.js';

/**
 * 地理座標かどうかを判定
 */
export function isGeoCoordinates(value: unknown): value is GeoCoordinates {
  return (
    typeof value === 'object' &&
    value !== null &&
    'latitude' in value &&
    'longitude' in value &&
    typeof (value as GeoCoordinates).latitude === 'number' &&
    typeof (value as GeoCoordinates).longitude === 'number' &&
    (value as GeoCoordinates).latitude >= -90 &&
    (value as GeoCoordinates).latitude <= 90 &&
    (value as GeoCoordinates).longitude >= -180 &&
    (value as GeoCoordinates).longitude <= 180
  );
}

/**
 * GeoHashエンコード
 * @param latitude 緯度 (-90 to 90)
 * @param longitude 経度 (-180 to 180)
 * @param precision 精度（文字数）デフォルト: 6
 * @returns GeoHash文字列
 */
export function encodeGeoHash(latitude: number, longitude: number, precision: number = 6): string {
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
    ngeohash.neighbor(geohash, [1, 0]), // 右
    ngeohash.neighbor(geohash, [-1, 0]), // 左
    ngeohash.neighbor(geohash, [0, 1]), // 上
    ngeohash.neighbor(geohash, [0, -1]), // 下
    ngeohash.neighbor(geohash, [1, 1]), // 右上
    ngeohash.neighbor(geohash, [1, -1]), // 右下
    ngeohash.neighbor(geohash, [-1, 1]), // 左上
    ngeohash.neighbor(geohash, [-1, -1]), // 左下
  ];

  // 重複を排除（境界条件で同じGeoHashが返る場合がある）
  return Array.from(new Set(neighbors));
}

/**
 * Haversine公式による2点間の距離計算
 * @param lat1 地点1の緯度
 * @param lon1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lon2 地点2の経度
 * @returns 距離（メートル）
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

/**
 * $nearクエリがGeoJSON形式かどうかを判定
 */
export function isNearQueryGeoJSON(query: NearQuery): query is NearQueryGeoJSON {
  return '$geometry' in query && query.$geometry.type === 'Point';
}

/**
 * $nearクエリから緯度・経度を抽出
 */
export function extractCoordinatesFromNearQuery(query: NearQuery): GeoCoordinates {
  if (isNearQueryGeoJSON(query)) {
    // GeoJSON形式: coordinates = [経度, 緯度]
    return {
      longitude: query.$geometry.coordinates[0],
      latitude: query.$geometry.coordinates[1],
    };
  } else {
    // 簡易形式
    return {
      latitude: (query as NearQuerySimple).latitude,
      longitude: (query as NearQuerySimple).longitude,
    };
  }
}

/**
 * $nearクエリから最大距離を抽出
 */
export function extractMaxDistanceFromNearQuery(query: NearQuery): number | undefined {
  if (isNearQueryGeoJSON(query)) {
    return query.$maxDistance;
  } else {
    return (query as NearQuerySimple).maxDistance;
  }
}

/**
 * $nearクエリから最小距離を抽出
 */
export function extractMinDistanceFromNearQuery(query: NearQuery): number | undefined {
  if (isNearQueryGeoJSON(query)) {
    return query.$minDistance;
  } else {
    return (query as NearQuerySimple).minDistance;
  }
}

/**
 * 緯度・経度の範囲チェック
 */
export function validateLocation(latitude: number, longitude: number): void {
  if (latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }
}
