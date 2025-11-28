/**
 * サーバーサイドシャドウレコード生成のテスト
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearShadowConfigCache,
  getResourceSchema,
  getShadowConfig,
} from '../server/shadow/config.js';
import { generateShadowRecords } from '../server/shadow/generator.js';

/**
 * シャドウフィールドの型（テスト用）
 */
enum ShadowFieldType {
  String = 'string',
  Number = 'number',
  Datetime = 'datetime',
  Boolean = 'boolean',
}

/**
 * スキーマ定義（テスト用）
 */
interface SchemaDefinition<T = any> {
  resource: string;
  type: T;
  shadows: {
    sortableFields: Record<string, { type: ShadowFieldType }>;
  };
}

describe('Server Shadow Generator', () => {
  describe('generateShadowRecords', () => {
    it('sortableFieldsに定義されたフィールドのみ処理する', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          price: { type: ShadowFieldType.Number },
          createdAt: { type: ShadowFieldType.Datetime },
        },
      };

      const record = {
        id: '01HZXY123',
        name: 'Product 1',
        price: 1000,
        stock: 100,
        createdAt: '2025-11-21T10:00:00.000Z',
      };

      const shadows = generateShadowRecords(record, schema);

      // priceとcreatedAtのみシャドウレコードが生成される
      expect(shadows).toHaveLength(2);
      expect(shadows[0].SK).toBe('price#00000000000000001000#id#01HZXY123');
      expect(shadows[1].SK).toBe('createdAt#2025-11-21T10:00:00.000Z#id#01HZXY123');
    });

    it('値がundefinedの場合は空文字としてシャドウレコードを生成する', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          price: { type: ShadowFieldType.Number },
          stock: { type: ShadowFieldType.Number },
        },
      };

      const record = {
        id: '01HZXY123',
        name: 'Product 1',
        price: 1000,
        stock: undefined,
      };

      const shadows = generateShadowRecords(record, schema);

      // 両方のフィールドでシャドウレコードが生成される
      expect(shadows).toHaveLength(2);
      expect(shadows[0].SK).toBe('price#00000000000000001000#id#01HZXY123');
      expect(shadows[1].SK).toBe('stock##id#01HZXY123'); // 空文字
    });

    it('値がnullの場合は空文字としてシャドウレコードを生成する', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          price: { type: ShadowFieldType.Number },
          stock: { type: ShadowFieldType.Number },
        },
      };

      const record = {
        id: '01HZXY123',
        name: 'Product 1',
        price: 1000,
        stock: null,
      };

      const shadows = generateShadowRecords(record, schema);

      // 両方のフィールドでシャドウレコードが生成される
      expect(shadows).toHaveLength(2);
      expect(shadows[0].SK).toBe('price#00000000000000001000#id#01HZXY123');
      expect(shadows[1].SK).toBe('stock##id#01HZXY123'); // 空文字
    });

    it('シャドウキーが正しい形式で生成される', () => {
      const schema = {
        resource: 'articles',
        sortableFields: {
          priority: { type: ShadowFieldType.Number },
        },
      };

      const record = {
        id: '01HZXY123',
        title: 'Article 1',
        priority: 5,
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows).toHaveLength(1);
      expect(shadows[0].PK).toBe('articles');
      expect(shadows[0].SK).toBe('priority#00000000000000000005#id#01HZXY123');
      expect(shadows[0].data).toEqual({ id: '01HZXY123' });
    });

    it('数値型が20桁ゼロ埋め文字列に変換される', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          price: { type: ShadowFieldType.Number },
        },
      };

      const record = {
        id: '01HZXY123',
        price: 123,
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows[0].SK).toBe('price#00000000000000000123#id#01HZXY123');
    });

    it('日時型がUTC ISO 8601形式で使用される', () => {
      const schema = {
        resource: 'articles',
        sortableFields: {
          publishedAt: { type: ShadowFieldType.Datetime },
        },
      };

      const record = {
        id: '01HZXY123',
        publishedAt: '2025-11-21T10:00:00.000Z',
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows[0].SK).toBe('publishedAt#2025-11-21T10:00:00.000Z#id#01HZXY123');
    });

    it('真偽値型が"0"または"1"に変換される', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          isActive: { type: ShadowFieldType.Boolean },
          isFeatured: { type: ShadowFieldType.Boolean },
        },
      };

      const record = {
        id: '01HZXY123',
        isActive: true,
        isFeatured: false,
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows).toHaveLength(2);
      expect(shadows[0].SK).toBe('isActive#1#id#01HZXY123');
      expect(shadows[1].SK).toBe('isFeatured#0#id#01HZXY123');
    });

    it('複数のフィールドで複数のシャドウレコードを生成する', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          price: { type: ShadowFieldType.Number },
          stock: { type: ShadowFieldType.Number },
          createdAt: { type: ShadowFieldType.Datetime },
        },
      };

      const record = {
        id: '01HZXY123',
        name: 'Product 1',
        price: 1000,
        stock: 50,
        createdAt: '2025-11-21T10:00:00.000Z',
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows).toHaveLength(3);
      expect(shadows[0].SK).toBe('price#00000000000000001000#id#01HZXY123');
      expect(shadows[1].SK).toBe('stock#00000000000000000050#id#01HZXY123');
      expect(shadows[2].SK).toBe('createdAt#2025-11-21T10:00:00.000Z#id#01HZXY123');
    });

    it('sortableFieldsが空の場合は空配列を返す', () => {
      const schema = {
        resource: 'products',
        sortableFields: {},
      };

      const record = {
        id: '01HZXY123',
        name: 'Product 1',
        price: 1000,
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows).toHaveLength(0);
    });

    it('文字列型でundefined/nullの場合は空文字として扱う', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          name: { type: ShadowFieldType.String },
          description: { type: ShadowFieldType.String },
        },
      };

      const record = {
        id: '01HZXY123',
        name: undefined,
        description: null,
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows).toHaveLength(2);
      expect(shadows[0].SK).toBe('name##id#01HZXY123');
      expect(shadows[1].SK).toBe('description##id#01HZXY123');
    });

    it('日時型でundefined/nullの場合は空文字として扱う', () => {
      const schema = {
        resource: 'articles',
        sortableFields: {
          publishedAt: { type: ShadowFieldType.Datetime },
          updatedAt: { type: ShadowFieldType.Datetime },
        },
      };

      const record = {
        id: '01HZXY123',
        publishedAt: undefined,
        updatedAt: null,
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows).toHaveLength(2);
      expect(shadows[0].SK).toBe('publishedAt##id#01HZXY123');
      expect(shadows[1].SK).toBe('updatedAt##id#01HZXY123');
    });

    it('真偽値型でundefined/nullの場合は空文字として扱う', () => {
      const schema = {
        resource: 'products',
        sortableFields: {
          isActive: { type: ShadowFieldType.Boolean },
          isFeatured: { type: ShadowFieldType.Boolean },
        },
      };

      const record = {
        id: '01HZXY123',
        isActive: undefined,
        isFeatured: null,
      };

      const shadows = generateShadowRecords(record, schema);

      expect(shadows).toHaveLength(2);
      expect(shadows[0].SK).toBe('isActive##id#01HZXY123');
      expect(shadows[1].SK).toBe('isFeatured##id#01HZXY123');
    });
  });
});

describe('Server Shadow Config', () => {
  // 元の環境変数を保存
  const originalEnv = process.env.SHADOW_CONFIG;

  beforeEach(() => {
    // 各テスト前にキャッシュをクリア
    clearShadowConfigCache();
  });

  afterEach(() => {
    // 環境変数を元に戻す
    if (originalEnv !== undefined) {
      process.env.SHADOW_CONFIG = originalEnv;
    } else {
      delete process.env.SHADOW_CONFIG;
    }
    // キャッシュをクリア
    clearShadowConfigCache();
  });

  describe('getShadowConfig', () => {
    it('環境変数からシャドー設定を読み込む', () => {
      const config = {
        $schemaVersion: '1.0',
        $generatedAt: '2025-11-20T00:00:00.000Z',
        $generatedFrom: 'test',
        resources: {
          articles: {
            sortDefaults: {
              field: 'name',
              order: 'ASC' as const,
            },
            shadows: {
              name: { type: 'string' },
              priority: { type: 'number' },
            },
          },
        },
      };

      // Base64エンコード
      const configJson = JSON.stringify(config);
      const configBase64 = Buffer.from(configJson, 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      const result = getShadowConfig();

      expect(result.$schemaVersion).toBe('1.0');
      expect(result.resources.articles).toBeDefined();
      expect(result.resources.articles.shadows.name).toEqual({ type: 'string' });
      expect(result.resources.articles.shadows.priority).toEqual({ type: 'number' });
    });

    it('設定をキャッシュする', () => {
      const config = {
        $schemaVersion: '1.0',
        resources: {
          articles: {
            sortDefaults: {
              field: 'name',
              order: 'ASC' as const,
            },
            shadows: {
              name: { type: 'string' },
            },
          },
        },
      };

      const configBase64 = Buffer.from(JSON.stringify(config), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      // 1回目の呼び出し
      const result1 = getShadowConfig();

      // 環境変数を変更
      const newConfig = {
        $schemaVersion: '2.0',
        resources: {
          tasks: {
            sortDefaults: {
              field: 'status',
              order: 'ASC' as const,
            },
            shadows: {
              status: { type: 'string' },
            },
          },
        },
      };
      process.env.SHADOW_CONFIG = Buffer.from(JSON.stringify(newConfig), 'utf-8').toString(
        'base64'
      );

      // 2回目の呼び出し（キャッシュから取得）
      const result2 = getShadowConfig();

      // キャッシュされた値が返される
      expect(result1).toBe(result2);
      expect(result2.$schemaVersion).toBe('1.0');
      expect(result2.resources.articles).toBeDefined();
    });

    it('環境変数が未設定の場合はエラーをスローする', () => {
      delete process.env.SHADOW_CONFIG;

      expect(() => getShadowConfig()).toThrow('SHADOW_CONFIG environment variable is not set');
    });

    it('不正なJSONの場合はエラーをスローする', () => {
      process.env.SHADOW_CONFIG = Buffer.from('invalid json', 'utf-8').toString('base64');

      expect(() => getShadowConfig()).toThrow('Invalid JSON in SHADOW_CONFIG environment variable');
    });

    it('$schemaVersionが欠けている場合はエラーをスローする', () => {
      const config = {
        resources: {
          articles: {
            sortDefaults: {
              field: 'name',
              order: 'ASC' as const,
            },
            shadows: {
              name: { type: 'string' },
            },
          },
        },
      };

      const configBase64 = Buffer.from(JSON.stringify(config), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      expect(() => getShadowConfig()).toThrow('Missing $schemaVersion in shadow config');
    });

    it('resourcesが欠けている場合はエラーをスローする', () => {
      const config = {
        $schemaVersion: '1.0',
      };

      const configBase64 = Buffer.from(JSON.stringify(config), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      expect(() => getShadowConfig()).toThrow('Missing or invalid resources in shadow config');
    });
  });

  describe('getResourceSchema', () => {
    it('リソースのシャドースキーマを取得する', () => {
      const config = {
        $schemaVersion: '1.0',
        resources: {
          articles: {
            sortDefaults: {
              field: 'createdAt',
              order: 'DESC' as const,
            },
            shadows: {
              name: { type: 'string' as const },
              priority: { type: 'number' as const },
              createdAt: { type: 'datetime' as const },
            },
          },
        },
      };

      const configBase64 = Buffer.from(JSON.stringify(config), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      const shadowConfig = getShadowConfig();
      const schema = getResourceSchema(shadowConfig, 'articles');

      expect(schema.resource).toBe('articles');
      expect(schema.sortableFields).toEqual({
        name: { type: 'string' },
        priority: { type: 'number' },
        createdAt: { type: 'datetime' },
      });
    });

    it('存在しないリソースの場合はエラーをスローする', () => {
      const config = {
        $schemaVersion: '1.0',
        resources: {
          articles: {
            sortDefaults: {
              field: 'name',
              order: 'ASC' as const,
            },
            shadows: {
              name: { type: 'string' },
            },
          },
        },
      };

      const configBase64 = Buffer.from(JSON.stringify(config), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      const shadowConfig = getShadowConfig();

      expect(() => getResourceSchema(shadowConfig, 'tasks')).toThrow(
        "Resource 'tasks' not found in shadow config"
      );
    });
  });

  describe('clearShadowConfigCache', () => {
    it('キャッシュをクリアする', () => {
      const config = {
        $schemaVersion: '1.0',
        resources: {
          articles: {
            sortDefaults: {
              field: 'name',
              order: 'ASC' as const,
            },
            shadows: {
              name: { type: 'string' },
            },
          },
        },
      };

      const configBase64 = Buffer.from(JSON.stringify(config), 'utf-8').toString('base64');
      process.env.SHADOW_CONFIG = configBase64;

      // 1回目の呼び出し
      const result1 = getShadowConfig();

      // キャッシュをクリア
      clearShadowConfigCache();

      // 環境変数を変更
      const newConfig = {
        $schemaVersion: '2.0',
        resources: {
          tasks: {
            sortDefaults: {
              field: 'status',
              order: 'ASC' as const,
            },
            shadows: {
              status: { type: 'string' },
            },
          },
        },
      };
      process.env.SHADOW_CONFIG = Buffer.from(JSON.stringify(newConfig), 'utf-8').toString(
        'base64'
      );

      // 2回目の呼び出し（新しい設定が読み込まれる）
      const result2 = getShadowConfig();

      expect(result1).not.toBe(result2);
      expect(result2.$schemaVersion).toBe('2.0');
      expect(result2.resources.tasks).toBeDefined();
    });
  });
});
