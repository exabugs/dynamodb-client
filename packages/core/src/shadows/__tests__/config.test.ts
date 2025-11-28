import { describe, expect, it } from 'vitest';

import {
  getAllShadowFields,
  getDefaultSort,
  getResourceConfig,
  isValidShadowField,
} from '../config.js';
import type { ShadowConfig } from '../types.js';

// テスト用のモック設定
const mockConfig: ShadowConfig = {
  $schemaVersion: '2.0',
  resources: {
    articles: {
      sortDefaults: {
        field: 'updatedAt',
        order: 'DESC',
      },
      shadows: {
        name: { type: 'string' },
        priority: { type: 'number' },
        category: { type: 'string' },
        status: { type: 'string' },
        createdAt: { type: 'datetime' },
        updatedAt: { type: 'datetime' },
      },
    },
    tasks: {
      sortDefaults: {
        field: 'createdAt',
        order: 'DESC',
      },
      shadows: {
        name: { type: 'string' },
        status: { type: 'string' },
        dueDate: { type: 'datetime' },
        createdAt: { type: 'datetime' },
        updatedAt: { type: 'datetime' },
      },
    },
  },
};

describe('Shadow Config', () => {
  describe('設定ファイル構造の検証', () => {
    it('shadowsキーを使用している（fieldsキーではない）', () => {
      const articlesConfig = getResourceConfig(mockConfig, 'articles');
      expect(articlesConfig).toHaveProperty('shadows');
      expect(articlesConfig).not.toHaveProperty('fields');
    });

    it('すべてのリソースがshadowsキーを持つ', () => {
      for (const resourceName of Object.keys(mockConfig.resources)) {
        const config = getResourceConfig(mockConfig, resourceName);
        expect(config).toHaveProperty('shadows');
        expect(typeof config.shadows).toBe('object');
      }
    });

    it('すべてのリソースがsortDefaultsを持つ', () => {
      for (const resourceName of Object.keys(mockConfig.resources)) {
        const config = getResourceConfig(mockConfig, resourceName);
        expect(config).toHaveProperty('sortDefaults');
        expect(config.sortDefaults).toHaveProperty('field');
        expect(config.sortDefaults).toHaveProperty('order');
        expect(['ASC', 'DESC']).toContain(config.sortDefaults.order);
      }
    });

    it('必須フィールド（name, createdAt, updatedAt）が明示的に定義されている', () => {
      const articlesFields = getAllShadowFields(mockConfig, 'articles');
      expect(articlesFields).toHaveProperty('name');
      expect(articlesFields).toHaveProperty('createdAt');
      expect(articlesFields).toHaveProperty('updatedAt');

      const tasksFields = getAllShadowFields(mockConfig, 'tasks');
      expect(tasksFields).toHaveProperty('name');
      expect(tasksFields).toHaveProperty('createdAt');
      expect(tasksFields).toHaveProperty('updatedAt');
    });
  });

  describe('getResourceConfig', () => {
    it('リソース設定を取得する', () => {
      const config = getResourceConfig(mockConfig, 'articles');
      expect(config).toBeDefined();
      expect(config.sortDefaults.field).toBe('updatedAt');
      expect(config.shadows).toHaveProperty('priority');
    });

    it('存在しないリソースの場合はエラーをスローする', () => {
      expect(() => getResourceConfig(mockConfig, 'nonexistent')).toThrow(
        "Resource 'nonexistent' not found in shadow config"
      );
    });
  });

  describe('getAllShadowFields', () => {
    it('設定ファイルで定義されたすべてのフィールドを返す', () => {
      const fields = getAllShadowFields(mockConfig, 'articles');

      // 必須フィールド
      expect(fields).toHaveProperty('name');
      expect(fields).toHaveProperty('createdAt');
      expect(fields).toHaveProperty('updatedAt');

      // オプションフィールド
      expect(fields).toHaveProperty('priority');
      expect(fields).toHaveProperty('category');
      expect(fields).toHaveProperty('status');

      // idは本体レコードとして存在するため、shadowsには含まれない
      expect(fields).not.toHaveProperty('id');
    });

    it('リソースごとに異なるフィールドを返す', () => {
      const articlesFields = getAllShadowFields(mockConfig, 'articles');
      const tasksFields = getAllShadowFields(mockConfig, 'tasks');

      expect(articlesFields).toHaveProperty('priority');
      expect(articlesFields).toHaveProperty('category');
      expect(articlesFields).not.toHaveProperty('dueDate');

      expect(tasksFields).toHaveProperty('dueDate');
      expect(tasksFields).not.toHaveProperty('priority');
      expect(tasksFields).not.toHaveProperty('category');
    });
  });

  describe('isValidShadowField', () => {
    it('設定ファイルで定義されたフィールドは有効', () => {
      expect(isValidShadowField(mockConfig, 'articles', 'name')).toBe(true);
      expect(isValidShadowField(mockConfig, 'articles', 'createdAt')).toBe(true);
      expect(isValidShadowField(mockConfig, 'articles', 'updatedAt')).toBe(true);
      expect(isValidShadowField(mockConfig, 'articles', 'priority')).toBe(true);
      expect(isValidShadowField(mockConfig, 'articles', 'category')).toBe(true);
      expect(isValidShadowField(mockConfig, 'tasks', 'dueDate')).toBe(true);
    });

    it('idは本体レコードとして存在するため無効', () => {
      expect(isValidShadowField(mockConfig, 'articles', 'id')).toBe(false);
    });

    it('設定されていないフィールドは無効', () => {
      expect(isValidShadowField(mockConfig, 'articles', 'nonexistent')).toBe(false);
      expect(isValidShadowField(mockConfig, 'articles', 'dueDate')).toBe(false);
    });

    it('存在しないリソースの場合はfalseを返す', () => {
      expect(isValidShadowField(mockConfig, 'nonexistent', 'id')).toBe(false);
    });
  });

  describe('getDefaultSort', () => {
    it('デフォルトソート設定を取得する', () => {
      const articlesSort = getDefaultSort(mockConfig, 'articles');
      expect(articlesSort.field).toBe('updatedAt');
      expect(articlesSort.order).toBe('DESC');

      const tasksSort = getDefaultSort(mockConfig, 'tasks');
      expect(tasksSort.field).toBe('createdAt');
      expect(tasksSort.order).toBe('DESC');
    });

    it('存在しないリソースの場合はエラーをスローする', () => {
      expect(() => getDefaultSort(mockConfig, 'nonexistent')).toThrow(
        "Resource 'nonexistent' not found in shadow config"
      );
    });
  });
});
