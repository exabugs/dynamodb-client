/**
 * CostTracker ユニットテスト
 *
 * 要件: 9.1, 9.2, 10.1, 10.2
 *
 * このテストは、CostTrackerクラスの機能を検証します。
 * - add()メソッド: ConsumedCapacityの追加と累積
 * - getAggregated()メソッド: 集計結果の取得
 * - reset()メソッド: 累積データのクリア
 *
 * カバレッジ目標: 100%
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { CostTracker } from '../../../src/server/utils/cost-tracker.js';
import type { ConsumedCapacity } from '../../../src/shared/types/consumed-capacity.js';

describe('CostTracker', () => {
  let costTracker: CostTracker;

  beforeEach(() => {
    costTracker = new CostTracker();
  });

  describe('初期状態', () => {
    it('初期状態ではすべてゼロである', () => {
      const result = costTracker.getAggregated();

      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });
  });

  describe('add()メソッド', () => {
    it('正常なConsumedCapacityを追加できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 5.5,
        WriteCapacityUnits: 2.0,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(5.5);
      expect(result.totalWCU).toBe(2.0);
      expect(result.operationCount).toBe(1);
    });

    it('undefinedを追加しても何もしない', () => {
      costTracker.add(undefined);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });

    it('ReadCapacityUnitsのみの場合も正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 3.0,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(3.0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(1);
    });

    it('WriteCapacityUnitsのみの場合も正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        WriteCapacityUnits: 4.0,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(4.0);
      expect(result.operationCount).toBe(1);
    });

    it('複数回の追加で正しく累積される', () => {
      const consumedCapacity1: ConsumedCapacity = {
        ReadCapacityUnits: 1.0,
        WriteCapacityUnits: 2.0,
      };
      const consumedCapacity2: ConsumedCapacity = {
        ReadCapacityUnits: 3.0,
        WriteCapacityUnits: 4.0,
      };
      const consumedCapacity3: ConsumedCapacity = {
        ReadCapacityUnits: 5.0,
        WriteCapacityUnits: 6.0,
      };

      costTracker.add(consumedCapacity1);
      costTracker.add(consumedCapacity2);
      costTracker.add(consumedCapacity3);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(9.0); // 1 + 3 + 5
      expect(result.totalWCU).toBe(12.0); // 2 + 4 + 6
      expect(result.operationCount).toBe(3);
    });

    it('undefinedと正常値を混在させても正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 2.5,
        WriteCapacityUnits: 1.5,
      };

      costTracker.add(undefined);
      costTracker.add(consumedCapacity);
      costTracker.add(undefined);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(2.5);
      expect(result.totalWCU).toBe(1.5);
      expect(result.operationCount).toBe(1);
    });

    it('ゼロ値のConsumedCapacityも正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 0,
        WriteCapacityUnits: 0,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(1);
    });

    it('非常に大きな値も正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 1000000.5,
        WriteCapacityUnits: 999999.5,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(1000000.5);
      expect(result.totalWCU).toBe(999999.5);
      expect(result.operationCount).toBe(1);
    });

    it('小数点以下の値も正確に累積される', () => {
      const consumedCapacity1: ConsumedCapacity = {
        ReadCapacityUnits: 0.1,
        WriteCapacityUnits: 0.2,
      };
      const consumedCapacity2: ConsumedCapacity = {
        ReadCapacityUnits: 0.3,
        WriteCapacityUnits: 0.4,
      };

      costTracker.add(consumedCapacity1);
      costTracker.add(consumedCapacity2);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBeCloseTo(0.4, 10); // 0.1 + 0.3
      expect(result.totalWCU).toBeCloseTo(0.6, 10); // 0.2 + 0.4
      expect(result.operationCount).toBe(2);
    });
  });

  describe('getAggregated()メソッド', () => {
    it('何も追加していない場合はゼロを返す', () => {
      const result = costTracker.getAggregated();

      expect(result).toEqual({
        totalRCU: 0,
        totalWCU: 0,
        operationCount: 0,
      });
    });

    it('追加後の集計結果を正しく返す', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 10.5,
        WriteCapacityUnits: 5.5,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result).toEqual({
        totalRCU: 10.5,
        totalWCU: 5.5,
        operationCount: 1,
      });
    });

    it('複数回呼び出しても同じ結果を返す（副作用なし）', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 3.0,
        WriteCapacityUnits: 2.0,
      };

      costTracker.add(consumedCapacity);

      const result1 = costTracker.getAggregated();
      const result2 = costTracker.getAggregated();
      const result3 = costTracker.getAggregated();

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1).toEqual({
        totalRCU: 3.0,
        totalWCU: 2.0,
        operationCount: 1,
      });
    });
  });

  describe('reset()メソッド', () => {
    it('累積データをクリアできる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 5.0,
        WriteCapacityUnits: 3.0,
      };

      costTracker.add(consumedCapacity);
      costTracker.reset();

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });

    it('リセット後に再度追加できる', () => {
      const consumedCapacity1: ConsumedCapacity = {
        ReadCapacityUnits: 5.0,
        WriteCapacityUnits: 3.0,
      };
      const consumedCapacity2: ConsumedCapacity = {
        ReadCapacityUnits: 2.0,
        WriteCapacityUnits: 1.0,
      };

      costTracker.add(consumedCapacity1);
      costTracker.reset();
      costTracker.add(consumedCapacity2);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(2.0);
      expect(result.totalWCU).toBe(1.0);
      expect(result.operationCount).toBe(1);
    });

    it('何も追加していない状態でリセットしてもエラーにならない', () => {
      expect(() => {
        costTracker.reset();
      }).not.toThrow();

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });

    it('複数回リセットしてもエラーにならない', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 1.0,
        WriteCapacityUnits: 1.0,
      };

      costTracker.add(consumedCapacity);
      costTracker.reset();
      costTracker.reset();
      costTracker.reset();

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });
  });

  describe('統合シナリオ', () => {
    it('複数操作のコスト追跡シナリオ', () => {
      // Query操作
      costTracker.add({
        ReadCapacityUnits: 2.5,
        WriteCapacityUnits: 0,
      });

      // PutItem操作
      costTracker.add({
        ReadCapacityUnits: 0,
        WriteCapacityUnits: 1.0,
      });

      // BatchGetItem操作
      costTracker.add({
        ReadCapacityUnits: 5.0,
        WriteCapacityUnits: 0,
      });

      // UpdateItem操作
      costTracker.add({
        ReadCapacityUnits: 1.0,
        WriteCapacityUnits: 1.0,
      });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(8.5); // 2.5 + 0 + 5.0 + 1.0
      expect(result.totalWCU).toBe(2.0); // 0 + 1.0 + 0 + 1.0
      expect(result.operationCount).toBe(4);
    });

    it('ページネーション付きfind操作のシナリオ', () => {
      // 1ページ目
      costTracker.add({
        ReadCapacityUnits: 3.0,
        WriteCapacityUnits: 0,
      });

      // 2ページ目
      costTracker.add({
        ReadCapacityUnits: 2.5,
        WriteCapacityUnits: 0,
      });

      // 3ページ目
      costTracker.add({
        ReadCapacityUnits: 1.5,
        WriteCapacityUnits: 0,
      });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(7.0); // 3.0 + 2.5 + 1.5
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(3);
    });

    it('バルク操作のシナリオ', () => {
      // BatchGetCommand（配列形式）
      const batchGetCapacities = [
        { ReadCapacityUnits: 1.0, WriteCapacityUnits: 0 },
        { ReadCapacityUnits: 1.5, WriteCapacityUnits: 0 },
        { ReadCapacityUnits: 2.0, WriteCapacityUnits: 0 },
      ];

      batchGetCapacities.forEach((capacity) => {
        costTracker.add(capacity);
      });

      // TransactWriteCommand（配列形式）
      const transactWriteCapacities = [
        { ReadCapacityUnits: 0, WriteCapacityUnits: 2.0 },
        { ReadCapacityUnits: 0, WriteCapacityUnits: 2.5 },
      ];

      transactWriteCapacities.forEach((capacity) => {
        costTracker.add(capacity);
      });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(4.5); // 1.0 + 1.5 + 2.0
      expect(result.totalWCU).toBe(4.5); // 2.0 + 2.5
      expect(result.operationCount).toBe(5);
    });
  });
});
