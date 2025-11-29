import { describe, expect, it } from 'vitest';

import { calculateShadowDiff, isDiffEmpty, mergeShadowDiffs } from '../src/shadows/differ.js';

describe('Shadow Differ', () => {
  describe('calculateShadowDiff', () => {
    it('名前が変更された場合の差分を計算する', () => {
      const oldKeys = [
        'name#Old#Name#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123',
      ];
      const newKeys = [
        'name#New#Name#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123',
      ];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual(['name#Old#Name#id#01HZXY123']);
      expect(diff.toAdd).toEqual(['name#New#Name#id#01HZXY123']);
    });

    it('優先度が変更された場合の差分を計算する', () => {
      const oldKeys = ['name#Tech#News#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];
      const newKeys = ['name#Tech#News#id#01HZXY123', 'priority#00000000000000000020#id#01HZXY123'];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual(['priority#00000000000000000010#id#01HZXY123']);
      expect(diff.toAdd).toEqual(['priority#00000000000000000020#id#01HZXY123']);
    });

    it('複数のフィールドが変更された場合の差分を計算する', () => {
      const oldKeys = [
        'name#Old#Name#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'category#tech#id#01HZXY123',
      ];
      const newKeys = [
        'name#New#Name#id#01HZXY123',
        'priority#00000000000000000020#id#01HZXY123',
        'category#business#id#01HZXY123',
      ];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toHaveLength(3);
      expect(diff.toAdd).toHaveLength(3);
      expect(diff.toDelete).toContain('name#Old#Name#id#01HZXY123');
      expect(diff.toDelete).toContain('priority#00000000000000000010#id#01HZXY123');
      expect(diff.toDelete).toContain('category#tech#id#01HZXY123');
      expect(diff.toAdd).toContain('name#New#Name#id#01HZXY123');
      expect(diff.toAdd).toContain('priority#00000000000000000020#id#01HZXY123');
      expect(diff.toAdd).toContain('category#business#id#01HZXY123');
    });

    it('変更がない場合は空の差分を返す', () => {
      const keys = [
        'name#Same#Name#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123',
      ];

      const diff = calculateShadowDiff(keys, keys);

      expect(diff.toDelete).toEqual([]);
      expect(diff.toAdd).toEqual([]);
    });

    it('新しいシャドーフィールドが追加された場合', () => {
      const oldKeys = ['name#Tech#News#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];
      const newKeys = [
        'name#Tech#News#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'category#tech#id#01HZXY123',
        'status#published#id#01HZXY123',
      ];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual([]);
      expect(diff.toAdd).toHaveLength(2);
      expect(diff.toAdd).toContain('category#tech#id#01HZXY123');
      expect(diff.toAdd).toContain('status#published#id#01HZXY123');
    });

    it('シャドーフィールドが削除された場合', () => {
      const oldKeys = [
        'name#Tech#News#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'category#tech#id#01HZXY123',
        'status#published#id#01HZXY123',
      ];
      const newKeys = ['name#Tech#News#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toHaveLength(2);
      expect(diff.toDelete).toContain('category#tech#id#01HZXY123');
      expect(diff.toDelete).toContain('status#published#id#01HZXY123');
      expect(diff.toAdd).toEqual([]);
    });

    it('すべてのシャドーが削除される場合', () => {
      const oldKeys = [
        'name#Tech#News#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'category#tech#id#01HZXY123',
      ];
      const newKeys: string[] = [];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual(oldKeys);
      expect(diff.toAdd).toEqual([]);
    });

    it('すべてのシャドーが新規追加される場合', () => {
      const oldKeys: string[] = [];
      const newKeys = [
        'name#Tech#News#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'category#tech#id#01HZXY123',
      ];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual([]);
      expect(diff.toAdd).toEqual(newKeys);
    });

    it('空の配列同士の差分を計算する', () => {
      const diff = calculateShadowDiff([], []);

      expect(diff.toDelete).toEqual([]);
      expect(diff.toAdd).toEqual([]);
    });

    it('重複するキーを正しく処理する', () => {
      const oldKeys = [
        'name#Tech#News#id#01HZXY123',
        'name#Tech#News#id#01HZXY123', // 重複
        'priority#00000000000000000010#id#01HZXY123',
      ];
      const newKeys = ['name#Tech#News#id#01HZXY123', 'priority#00000000000000000020#id#01HZXY123'];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      // 重複は1つとしてカウントされる
      expect(diff.toDelete).toEqual(['priority#00000000000000000010#id#01HZXY123']);
      expect(diff.toAdd).toEqual(['priority#00000000000000000020#id#01HZXY123']);
    });

    it('順序が異なる場合でも正しく差分を計算する', () => {
      const oldKeys = [
        'priority#00000000000000000010#id#01HZXY123',
        'name#Tech#News#id#01HZXY123',
        'category#tech#id#01HZXY123',
      ];
      const newKeys = [
        'category#tech#id#01HZXY123',
        'priority#00000000000000000010#id#01HZXY123',
        'name#Tech#News#id#01HZXY123',
      ];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual([]);
      expect(diff.toAdd).toEqual([]);
    });
  });

  describe('isDiffEmpty', () => {
    it('差分が空の場合はtrueを返す', () => {
      const diff = {
        toDelete: [],
        toAdd: [],
      };

      expect(isDiffEmpty(diff)).toBe(true);
    });

    it('削除のみがある場合はfalseを返す', () => {
      const diff = {
        toDelete: ['name#Old#Name#id#01HZXY123'],
        toAdd: [],
      };

      expect(isDiffEmpty(diff)).toBe(false);
    });

    it('追加のみがある場合はfalseを返す', () => {
      const diff = {
        toDelete: [],
        toAdd: ['name#New#Name#id#01HZXY123'],
      };

      expect(isDiffEmpty(diff)).toBe(false);
    });

    it('削除と追加の両方がある場合はfalseを返す', () => {
      const diff = {
        toDelete: ['name#Old#Name#id#01HZXY123'],
        toAdd: ['name#New#Name#id#01HZXY123'],
      };

      expect(isDiffEmpty(diff)).toBe(false);
    });
  });

  describe('mergeShadowDiffs', () => {
    it('複数の差分をマージする', () => {
      const diff1 = {
        toDelete: ['name#Old#Name#id#01HZXY123'],
        toAdd: ['name#New#Name#id#01HZXY123'],
      };
      const diff2 = {
        toDelete: ['priority#00000000000000000010#id#01HZXY123'],
        toAdd: ['priority#00000000000000000020#id#01HZXY123'],
      };

      const merged = mergeShadowDiffs([diff1, diff2]);

      expect(merged.toDelete).toHaveLength(2);
      expect(merged.toAdd).toHaveLength(2);
      expect(merged.toDelete).toContain('name#Old#Name#id#01HZXY123');
      expect(merged.toDelete).toContain('priority#00000000000000000010#id#01HZXY123');
      expect(merged.toAdd).toContain('name#New#Name#id#01HZXY123');
      expect(merged.toAdd).toContain('priority#00000000000000000020#id#01HZXY123');
    });

    it('重複するキーを除外してマージする', () => {
      const diff1 = {
        toDelete: ['name#Old#Name#id#01HZXY123'],
        toAdd: ['name#New#Name#id#01HZXY123'],
      };
      const diff2 = {
        toDelete: ['name#Old#Name#id#01HZXY123'], // 重複
        toAdd: ['priority#00000000000000000020#id#01HZXY123'],
      };

      const merged = mergeShadowDiffs([diff1, diff2]);

      expect(merged.toDelete).toHaveLength(1);
      expect(merged.toDelete).toContain('name#Old#Name#id#01HZXY123');
      expect(merged.toAdd).toHaveLength(2);
      expect(merged.toAdd).toContain('name#New#Name#id#01HZXY123');
      expect(merged.toAdd).toContain('priority#00000000000000000020#id#01HZXY123');
    });

    it('空の差分配列をマージする', () => {
      const merged = mergeShadowDiffs([]);

      expect(merged.toDelete).toEqual([]);
      expect(merged.toAdd).toEqual([]);
    });

    it('空の差分を含む配列をマージする', () => {
      const diff1 = {
        toDelete: [],
        toAdd: [],
      };
      const diff2 = {
        toDelete: ['name#Old#Name#id#01HZXY123'],
        toAdd: ['name#New#Name#id#01HZXY123'],
      };

      const merged = mergeShadowDiffs([diff1, diff2]);

      expect(merged.toDelete).toEqual(['name#Old#Name#id#01HZXY123']);
      expect(merged.toAdd).toEqual(['name#New#Name#id#01HZXY123']);
    });

    it('3つ以上の差分をマージする', () => {
      const diff1 = {
        toDelete: ['name#Old#Name#id#01HZXY123'],
        toAdd: ['name#New#Name#id#01HZXY123'],
      };
      const diff2 = {
        toDelete: ['priority#00000000000000000010#id#01HZXY123'],
        toAdd: ['priority#00000000000000000020#id#01HZXY123'],
      };
      const diff3 = {
        toDelete: ['category#tech#id#01HZXY123'],
        toAdd: ['category#business#id#01HZXY123'],
      };

      const merged = mergeShadowDiffs([diff1, diff2, diff3]);

      expect(merged.toDelete).toHaveLength(3);
      expect(merged.toAdd).toHaveLength(3);
      expect(merged.toDelete).toContain('name#Old#Name#id#01HZXY123');
      expect(merged.toDelete).toContain('priority#00000000000000000010#id#01HZXY123');
      expect(merged.toDelete).toContain('category#tech#id#01HZXY123');
      expect(merged.toAdd).toContain('name#New#Name#id#01HZXY123');
      expect(merged.toAdd).toContain('priority#00000000000000000020#id#01HZXY123');
      expect(merged.toAdd).toContain('category#business#id#01HZXY123');
    });
  });
});
