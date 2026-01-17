/**
 * DynamoDB ConsumedCapacity 型定義
 *
 * DynamoDB操作で消費されたキャパシティユニット（RCU/WCU）の情報を管理します。
 */
import type { ConsumedCapacity as AWSConsumedCapacity } from '@aws-sdk/client-dynamodb';

/**
 * DynamoDB ConsumedCapacity 情報
 *
 * AWS SDKから返されるConsumedCapacityの型を再エクスポートします。
 */
export type ConsumedCapacity = AWSConsumedCapacity;

/**
 * 集計されたコスト情報
 *
 * 複数のDynamoDB操作のConsumedCapacityを集計した結果です。
 */
export interface AggregatedCost {
  /** 総読み取りキャパシティユニット */
  totalRCU: number;
  /** 総書き込みキャパシティユニット */
  totalWCU: number;
  /** DynamoDB操作回数 */
  operationCount: number;
}

/**
 * コスト情報を含むレスポンス
 *
 * MongoDB-likeインターフェースとHTTP APIレスポンスに追加される
 * コスト情報のミックスイン型です。
 */
export interface WithConsumedCapacity {
  /** 消費されたキャパシティ情報 */
  consumedCapacity?: AggregatedCost;
}
