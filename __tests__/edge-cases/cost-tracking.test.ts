/**
 * コスト追跡のエッジケーステスト
 *
 * 要件: 9.1, 9.2, 10.5
 *
 * このテストは、コスト追跡機能のエッジケースを検証します。
 * - ConsumedCapacityが存在しない場合
 * - RCU/WCUがゼロの場合
 * - 非常に大きなRCU/WCU値
 * - 複数ページにわたるfind操作
 * - バルク操作の部分失敗
 *
 * カバレッジ目標: 100%
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { CostTracker } from '../../src/server/utils/cost-tracker.js';
import type { ConsumedCapacity } from '../../src/shared/types/consumed-capacity.js';

describe('Cost tracking edge cases', () => {
  let costTracker: CostTracker;

  beforeEach(() => {
    costTracker = new CostTracker();
  });

  describe('ConsumedCapacityが存在しない場合', () => {
    it('undefinedを追加してもエラーにならない', () => {
      expect(() => {
        costTracker.add(undefined);
      }).not.toThrow();

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });

    it('複数のundefinedを追加してもエラーにならない', () => {
      costTracker.add(undefined);
      costTracker.add(undefined);
      costTracker.add(undefined);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });

    it('undefinedと正常値を混在させても正しく処理できる', () => {
      costTracker.add(undefined);
      costTracker.add({ ReadCapacityUnits: 1.0, WriteCapacityUnits: 0.5 });
      costTracker.add(undefined);
      costTracker.add({ ReadCapacityUnits: 2.0, WriteCapacityUnits: 1.0 });
      costTracker.add(undefined);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(3.0);
      expect(result.totalWCU).toBe(1.5);
      expect(result.operationCount).toBe(2);
    });
  });

  describe('RCU/WCUがゼロの場合', () => {
    it('RCUとWCUが両方ゼロの場合も正しく処理できる', () => {
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

    it('RCUのみゼロの場合も正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 0,
        WriteCapacityUnits: 2.5,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(2.5);
      expect(result.operationCount).toBe(1);
    });

    it('WCUのみゼロの場合も正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 3.5,
        WriteCapacityUnits: 0,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(3.5);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(1);
    });

    it('ゼロ値を複数回追加しても正しく処理できる', () => {
      costTracker.add({ ReadCapacityUnits: 0, WriteCapacityUnits: 0 });
      costTracker.add({ ReadCapacityUnits: 0, WriteCapacityUnits: 0 });
      costTracker.add({ ReadCapacityUnits: 0, WriteCapacityUnits: 0 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(3);
    });
  });

  describe('非常に大きなRCU/WCU値', () => {
    it('100万RCUを処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 1000000,
        WriteCapacityUnits: 0,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(1000000);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(1);
    });

    it('100万WCUを処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 0,
        WriteCapacityUnits: 1000000,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(1000000);
      expect(result.operationCount).toBe(1);
    });

    it('非常に大きな値を複数回追加しても正しく累積される', () => {
      costTracker.add({ ReadCapacityUnits: 500000, WriteCapacityUnits: 300000 });
      costTracker.add({ ReadCapacityUnits: 400000, WriteCapacityUnits: 200000 });
      costTracker.add({ ReadCapacityUnits: 100000, WriteCapacityUnits: 500000 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(1000000);
      expect(result.totalWCU).toBe(1000000);
      expect(result.operationCount).toBe(3);
    });

    it('小数点を含む大きな値も正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 999999.99,
        WriteCapacityUnits: 888888.88,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBeCloseTo(999999.99, 2);
      expect(result.totalWCU).toBeCloseTo(888888.88, 2);
      expect(result.operationCount).toBe(1);
    });
  });

  describe('非常に小さなRCU/WCU値', () => {
    it('0.001のような小さな値も正しく処理できる', () => {
      const consumedCapacity: ConsumedCapacity = {
        ReadCapacityUnits: 0.001,
        WriteCapacityUnits: 0.002,
      };

      costTracker.add(consumedCapacity);

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBeCloseTo(0.001, 10);
      expect(result.totalWCU).toBeCloseTo(0.002, 10);
      expect(result.operationCount).toBe(1);
    });

    it('小さな値を複数回追加しても正確に累積される', () => {
      costTracker.add({ ReadCapacityUnits: 0.1, WriteCapacityUnits: 0.2 });
      costTracker.add({ ReadCapacityUnits: 0.3, WriteCapacityUnits: 0.4 });
      costTracker.add({ ReadCapacityUnits: 0.5, WriteCapacityUnits: 0.6 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBeCloseTo(0.9, 10); // 0.1 + 0.3 + 0.5
      expect(result.totalWCU).toBeCloseTo(1.2, 10); // 0.2 + 0.4 + 0.6
      expect(result.operationCount).toBe(3);
    });
  });

  describe('複数ページにわたるfind操作', () => {
    it('10ページのコストを正しく集計できる', () => {
      // 各ページのコストを追加
      for (let i = 0; i < 10; i++) {
        costTracker.add({
          ReadCapacityUnits: 2.5,
          WriteCapacityUnits: 0,
        });
      }

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(25.0); // 2.5 * 10
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(10);
    });

    it('100ページのコストを正しく集計できる', () => {
      // 各ページのコストを追加
      for (let i = 0; i < 100; i++) {
        costTracker.add({
          ReadCapacityUnits: 1.0,
          WriteCapacityUnits: 0,
        });
      }

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(100.0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(100);
    });

    it('ページごとに異なるコストを正しく集計できる', () => {
      // 1ページ目: 大量のレコード
      costTracker.add({ ReadCapacityUnits: 5.0, WriteCapacityUnits: 0 });

      // 2ページ目: 中程度のレコード
      costTracker.add({ ReadCapacityUnits: 3.0, WriteCapacityUnits: 0 });

      // 3ページ目: 少量のレコード
      costTracker.add({ ReadCapacityUnits: 1.0, WriteCapacityUnits: 0 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(9.0); // 5.0 + 3.0 + 1.0
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(3);
    });
  });

  describe('バルク操作の部分失敗', () => {
    it('一部成功・一部失敗の場合もコストを正しく集計できる', () => {
      // BatchGetCommand: 3件中2件成功
      costTracker.add({ ReadCapacityUnits: 2.0, WriteCapacityUnits: 0 });

      // TransactWriteCommand: 3件中2件成功
      costTracker.add({ ReadCapacityUnits: 0, WriteCapacityUnits: 2.0 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(2.0);
      expect(result.totalWCU).toBe(2.0);
      expect(result.operationCount).toBe(2);
    });

    it('全失敗の場合もコストを正しく集計できる', () => {
      // 全失敗でもDynamoDBはコストを消費する
      costTracker.add({ ReadCapacityUnits: 1.0, WriteCapacityUnits: 0 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(1.0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(1);
    });

    it('複数のバッチ操作のコストを正しく集計できる', () => {
      // バッチ1: 10件中8件成功
      costTracker.add({ ReadCapacityUnits: 8.0, WriteCapacityUnits: 0 });

      // バッチ2: 10件中5件成功
      costTracker.add({ ReadCapacityUnits: 5.0, WriteCapacityUnits: 0 });

      // バッチ3: 10件中10件成功
      costTracker.add({ ReadCapacityUnits: 10.0, WriteCapacityUnits: 0 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(23.0); // 8 + 5 + 10
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(3);
    });
  });

  describe('配列形式のConsumedCapacity', () => {
    it('BatchGetCommandの配列形式を正しく処理できる', () => {
      // BatchGetCommandは配列形式でConsumedCapacityを返す
      const capacities = [
        { ReadCapacityUnits: 1.0, WriteCapacityUnits: 0 },
        { ReadCapacityUnits: 1.5, WriteCapacityUnits: 0 },
        { ReadCapacityUnits: 2.0, WriteCapacityUnits: 0 },
      ];

      capacities.forEach((capacity) => {
        costTracker.add(capacity);
      });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(4.5); // 1.0 + 1.5 + 2.0
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(3);
    });

    it('TransactWriteCommandの配列形式を正しく処理できる', () => {
      // TransactWriteCommandも配列形式でConsumedCapacityを返す場合がある
      const capacities = [
        { ReadCapacityUnits: 0, WriteCapacityUnits: 2.0 },
        { ReadCapacityUnits: 0, WriteCapacityUnits: 2.5 },
      ];

      capacities.forEach((capacity) => {
        costTracker.add(capacity);
      });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(4.5); // 2.0 + 2.5
      expect(result.operationCount).toBe(2);
    });

    it('空の配列を処理してもエラーにならない', () => {
      const capacities: ConsumedCapacity[] = [];

      capacities.forEach((capacity) => {
        costTracker.add(capacity);
      });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(0);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(0);
    });
  });

  describe('リセット後の動作', () => {
    it('リセット後に新しいコストを追加できる', () => {
      // 最初のコスト追加
      costTracker.add({ ReadCapacityUnits: 5.0, WriteCapacityUnits: 3.0 });

      // リセット
      costTracker.reset();

      // 新しいコスト追加
      costTracker.add({ ReadCapacityUnits: 2.0, WriteCapacityUnits: 1.0 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(2.0);
      expect(result.totalWCU).toBe(1.0);
      expect(result.operationCount).toBe(1);
    });

    it('複数回リセットしても正常に動作する', () => {
      costTracker.add({ ReadCapacityUnits: 1.0, WriteCapacityUnits: 1.0 });
      costTracker.reset();

      costTracker.add({ ReadCapacityUnits: 2.0, WriteCapacityUnits: 2.0 });
      costTracker.reset();

      costTracker.add({ ReadCapacityUnits: 3.0, WriteCapacityUnits: 3.0 });

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(3.0);
      expect(result.totalWCU).toBe(3.0);
      expect(result.operationCount).toBe(1);
    });
  });

  describe('浮動小数点演算の精度', () => {
    it('0.1 + 0.2 = 0.3 の精度問題を正しく処理できる', () => {
      costTracker.add({ ReadCapacityUnits: 0.1, WriteCapacityUnits: 0 });
      costTracker.add({ ReadCapacityUnits: 0.2, WriteCapacityUnits: 0 });

      const result = costTracker.getAggregated();
      // JavaScriptの浮動小数点演算の精度問題を考慮
      expect(result.totalRCU).toBeCloseTo(0.3, 10);
      expect(result.totalWCU).toBe(0);
      expect(result.operationCount).toBe(2);
    });

    it('多数の小数点演算でも精度を維持できる', () => {
      // 100回の0.01を追加
      for (let i = 0; i < 100; i++) {
        costTracker.add({ ReadCapacityUnits: 0.01, WriteCapacityUnits: 0.01 });
      }

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBeCloseTo(1.0, 10);
      expect(result.totalWCU).toBeCloseTo(1.0, 10);
      expect(result.operationCount).toBe(100);
    });
  });

  describe('極端なケース', () => {
    it('1000回の操作を正しく集計できる', () => {
      for (let i = 0; i < 1000; i++) {
        costTracker.add({ ReadCapacityUnits: 1.0, WriteCapacityUnits: 0.5 });
      }

      const result = costTracker.getAggregated();
      expect(result.totalRCU).toBe(1000.0);
      expect(result.totalWCU).toBe(500.0);
      expect(result.operationCount).toBe(1000);
    });

    it('RCUとWCUが異なる値を1000回追加しても正しく集計できる', () => {
      for (let i = 0; i < 1000; i++) {
        costTracker.add({
          ReadCapacityUnits: i * 0.1,
          WriteCapacityUnits: i * 0.05,
        });
      }

      const result = costTracker.getAggregated();
      // 0 + 0.1 + 0.2 + ... + 99.9 = 49950.0
      expect(result.totalRCU).toBeCloseTo(49950.0, 1);
      // 0 + 0.05 + 0.1 + ... + 49.95 = 24975.0
      expect(result.totalWCU).toBeCloseTo(24975.0, 1);
      expect(result.operationCount).toBe(1000);
    });
  });
});
