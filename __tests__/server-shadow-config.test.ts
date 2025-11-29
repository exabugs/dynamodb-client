/**
 * サーバーサイドシャドウ設定のテスト
 *
 * シャドウ設定の構造検証と、設定ファイルとの整合性を確認する。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type ShadowConfig,
  clearShadowConfigCache,
  getResourceSchema,
  getShadowConfig,
} from '../src/server/shadow/config.js';

describe('Server Shadow Config', () => {
  const originalEnv = process.env.SHADOW_CONFIG;

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

  beforeEach(() => {
    // キャッシュをクリア
    clearShadowConfigCache();
    // モック設定をBase64エンコードして環境変数に設定
    const configJson = JSON.stringify(mockConfig);
    const configBase64 = Buffer.from(configJson, 'utf-8').toString('base64');
    process.env.SHADOW_CONFIG = configBase64;
  });

  afterEach(() => {
    // 環境変数を元に戻す
    if (originalEnv) {
      process.env.SHADOW_CONFIG = originalEnv;
    } else {
      delete process.env.SHADOW_CONFIG;
    }
    clearShadowConfigCache();
  });

  describe('設定ファイル構造の検証', () => {
    it('shadowsキーを使用している（fieldsキーではない）', () => {
      const config = getShadowConfig();
      const articlesConfig = config.resources.articles;

      expect(articlesConfig).toHaveProperty('shadows');
      expect(articlesConfig).not.toHaveProperty('fields');
    });

    it('すべてのリソースがshadowsキーを持つ', () => {
      const config = getShadowConfig();

      for (const resourceName of Object.keys(config.resources)) {
        const resourceConfig = config.resources[resourceName];
        expect(resourceConfig).toHaveProperty('shadows');
        expect(typeof resourceConfig.shadows).toBe('object');
      }
    });

    it('すべてのリソースがsortDefaultsを持つ', () => {
      const config = getShadowConfig();

      for (const resourceName of Object.keys(config.resources)) {
        const resourceConfig = config.resources[resourceName];
        expect(resourceConfig).toHaveProperty('sortDefaults');
        expect(resourceConfig.sortDefaults).toHaveProperty('field');
        expect(resourceConfig.sortDefaults).toHaveProperty('order');
        expect(['ASC', 'DESC']).toContain(resourceConfig.sortDefaults.order);
      }
    });

    it('必須フィールド（name, createdAt, updatedAt）が明示的に定義されている', () => {
      const config = getShadowConfig();

      const articlesConfig = config.resources.articles;
      expect(articlesConfig.shadows).toHaveProperty('name');
      expect(articlesConfig.shadows).toHaveProperty('createdAt');
      expect(articlesConfig.shadows).toHaveProperty('updatedAt');

      const tasksConfig = config.resources.tasks;
      expect(tasksConfig.shadows).toHaveProperty('name');
      expect(tasksConfig.shadows).toHaveProperty('createdAt');
      expect(tasksConfig.shadows).toHaveProperty('updatedAt');
    });

    it('フィールド型が正しい', () => {
      const config = getShadowConfig();
      const articlesConfig = config.resources.articles;

      expect(articlesConfig.shadows.name.type).toBe('string');
      expect(articlesConfig.shadows.priority.type).toBe('number');
      expect(articlesConfig.shadows.createdAt.type).toBe('datetime');
      expect(articlesConfig.shadows.updatedAt.type).toBe('datetime');
    });
  });

  describe('getShadowConfig', () => {
    it('環境変数から設定を読み込む', () => {
      const config = getShadowConfig();

      expect(config).toBeDefined();
      expect(config.$schemaVersion).toBe('2.0');
      expect(config.resources).toHaveProperty('articles');
      expect(config.resources).toHaveProperty('tasks');
    });

    it('2回目以降はキャッシュから取得する', () => {
      const config1 = getShadowConfig();
      const config2 = getShadowConfig();

      // 同じオブジェクトインスタンスを返す
      expect(config1).toBe(config2);
    });

    it('環境変数が未設定の場合はエラーをスローする', () => {
      delete process.env.SHADOW_CONFIG;
      clearShadowConfigCache();

      expect(() => getShadowConfig()).toThrow('SHADOW_CONFIG environment variable is not set');
    });

    it('不正なBase64の場合はエラーをスローする', () => {
      process.env.SHADOW_CONFIG = 'invalid-base64!!!';
      clearShadowConfigCache();

      expect(() => getShadowConfig()).toThrow();
    });

    it('不正なJSONの場合はエラーをスローする', () => {
      const invalidJson = Buffer.from('{ invalid json }', 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = invalidJson;
      clearShadowConfigCache();

      expect(() => getShadowConfig()).toThrow('Invalid JSON in SHADOW_CONFIG');
    });

    it('$schemaVersionが欠けている場合はエラーをスローする', () => {
      const invalidConfig = { resources: {} };
      const configBase64 = Buffer.from(JSON.stringify(invalidConfig), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;
      clearShadowConfigCache();

      expect(() => getShadowConfig()).toThrow('Missing $schemaVersion in shadow config');
    });

    it('resourcesが欠けている場合はエラーをスローする', () => {
      const invalidConfig = { $schemaVersion: '2.0' };
      const configBase64 = Buffer.from(JSON.stringify(invalidConfig), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;
      clearShadowConfigCache();

      expect(() => getShadowConfig()).toThrow('Missing or invalid resources in shadow config');
    });
  });

  describe('getResourceSchema', () => {
    it('リソーススキーマを取得する', () => {
      const config = getShadowConfig();
      const schema = getResourceSchema(config, 'articles');

      expect(schema).toBeDefined();
      expect(schema.resource).toBe('articles');
      expect(schema.sortableFields).toHaveProperty('name');
      expect(schema.sortableFields).toHaveProperty('priority');
    });

    it('sortableFieldsがshadowsキーから取得される', () => {
      const config = getShadowConfig();
      const schema = getResourceSchema(config, 'articles');

      // sortableFieldsはconfig.resources.articles.shadowsと同じ内容
      expect(schema.sortableFields).toEqual(config.resources.articles.shadows);
    });

    it('存在しないリソースの場合はエラーをスローする', () => {
      const config = getShadowConfig();

      expect(() => getResourceSchema(config, 'nonexistent')).toThrow(
        "Resource 'nonexistent' not found in shadow config"
      );
    });
  });

  describe('clearShadowConfigCache', () => {
    it('キャッシュをクリアする', () => {
      const config1 = getShadowConfig();
      clearShadowConfigCache();

      // 新しい設定を環境変数に設定
      const newConfig = { ...mockConfig, $schemaVersion: '3.0' };
      const configBase64 = Buffer.from(JSON.stringify(newConfig), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      const config2 = getShadowConfig();

      // 異なるオブジェクトインスタンスを返す
      expect(config1).not.toBe(config2);
      expect(config2.$schemaVersion).toBe('3.0');
    });
  });
});
