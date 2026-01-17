/**
 * コスト追跡ユーティリティ
 *
 * DynamoDB操作のConsumedCapacityを収集・集計します。
 */
import type { AggregatedCost, ConsumedCapacity } from '../../shared/types/consumed-capacity.js';

/**
 * コスト追跡クラス
 *
 * DynamoDB操作のConsumedCapacityを収集・集計します。
 * 複数のDynamoDB操作のRCU/WCUを累積し、集計結果を提供します。
 *
 * @example
 * ```typescript
 * const costTracker = new CostTracker();
 *
 * // DynamoDB操作後にConsumedCapacityを追加
 * const response = await dynamoClient.send(command);
 * costTracker.add(response.ConsumedCapacity);
 *
 * // 集計結果を取得
 * const cost = costTracker.getAggregated();
 * console.log(`Total RCU: ${cost.totalRCU}, Total WCU: ${cost.totalWCU}`);
 * ```
 */
export class CostTracker {
  private totalRCU: number = 0;
  private totalWCU: number = 0;
  private operationCount: number = 0;

  /**
   * ConsumedCapacityを追加
   *
   * DynamoDB操作のConsumedCapacityを累積します。
   * undefinedが渡された場合は何もしません（エラーにしない）。
   *
   * AWS SDKのConsumedCapacityは以下のフィールドを持ちます:
   * - CapacityUnits: 総キャパシティユニット（RCU + WCU）
   * - ReadCapacityUnits: 読み取りキャパシティユニット
   * - WriteCapacityUnits: 書き込みキャパシティユニット
   *
   * このメソッドはReadCapacityUnitsとWriteCapacityUnitsを優先的に使用し、
   * 存在しない場合はCapacityUnitsを読み取りとして扱います。
   *
   * @param consumedCapacity - DynamoDB操作のConsumedCapacity
   */
  add(consumedCapacity: ConsumedCapacity | undefined): void {
    if (!consumedCapacity) {
      return;
    }

    // ReadCapacityUnits と WriteCapacityUnits を優先
    const rcu = consumedCapacity.ReadCapacityUnits ?? 0;
    const wcu = consumedCapacity.WriteCapacityUnits ?? 0;

    this.totalRCU += rcu;
    this.totalWCU += wcu;
    this.operationCount += 1;
  }

  /**
   * 集計結果を取得
   *
   * これまでに追加されたConsumedCapacityの集計結果を返します。
   *
   * @returns 集計されたコスト情報
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
   *
   * 累積されたコスト情報をクリアします。
   */
  reset(): void {
    this.totalRCU = 0;
    this.totalWCU = 0;
    this.operationCount = 0;
  }
}
