/**
 * シャドウ設定生成スクリプトのテスト
 *
 * 生成される設定ファイルの構造を検証する。
 */
import { describe, expect, it } from 'vitest';

import type { SchemaRegistryConfig } from '../../schema.js';

/**
 * 生成される設定ファイルの構造
 */
interface ShadowConfig {
  $schemaVersion: string;
  $generatedAt: string;
  $generatedFrom: string;
  resources: Record<
    string,
    {
      shadows: Record<string, { type: string }>;
      sortDefaults: {
        field: string;
        order: 'ASC' | 'DESC';
      };
    }
  >;
}

/**
 * スキーマレジストリから設定を生成する（テスト用の簡易版）
 */
function generateConfigFromSchema(schemaRegistry: SchemaRegistryConfig): ShadowConfig {
  const resources: ShadowConfig['resources'] = {};

  for (const [resourceName, schema] of Object.entries(schemaRegistry.resources)) {
    const schemaAny = schema as any;

    // ソート可能フィールドを変換
    const shadows: Record<string, { type: string }> = {};
    for (const [fieldName, fieldDef] of Object.entries(schemaAny.shadows.sortableFields)) {
      const fieldDefAny = fieldDef as any;
      shadows[fieldName] = {
        type: fieldDefAny.type as string,
      };
    }

    // デフォルトソート設定を決定
    const sortableFieldNames = Object.keys(shadows);
    const defaultSortField = 'updatedAt' in shadows ? 'updatedAt' : sortableFieldNames[0];
    const defaultSortOrder = 'updatedAt' in shadows ? 'DESC' : 'ASC';

    resources[resourceName] = {
      shadows,
      sortDefaults: {
        field: defaultSortField,
        order: defaultSortOrder,
      },
    };
  }

  return {
    $schemaVersion: '2.0',
    $generatedAt: new Date().toISOString(),
    $generatedFrom: 'packages/api-types/src/schema.ts',
    resources,
  };
}

describe('Shadow Config Generation', () => {
  // テスト用のモックスキーマレジストリ
  const mockSchemaRegistry: SchemaRegistryConfig = {
    database: {
      name: 'ainews',
      timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      },
    },
    resources: {
      articles: {
        resource: 'articles',
        type: {} as any,
        shadows: {
          sortableFields: {
            name: { type: 'string' as any },
            priority: { type: 'number' as any },
            status: { type: 'string' as any },
            createdAt: { type: 'datetime' as any },
            updatedAt: { type: 'datetime' as any },
          },
        },
      },
      tasks: {
        resource: 'tasks',
        type: {} as any,
        shadows: {
          sortableFields: {
            name: { type: 'string' as any },
            status: { type: 'string' as any },
            dueDate: { type: 'datetime' as any },
            createdAt: { type: 'datetime' as any },
            updatedAt: { type: 'datetime' as any },
          },
        },
      },
    },
  };

  describe('生成される設定ファイルの構造', () => {
    it('shadowsキーを使用する（fieldsキーではない）', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      for (const resourceName of Object.keys(config.resources)) {
        const resourceConfig = config.resources[resourceName];
        expect(resourceConfig).toHaveProperty('shadows');
        expect(resourceConfig).not.toHaveProperty('fields');
      }
    });

    it('すべてのリソースがshadowsキーを持つ', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      for (const resourceName of Object.keys(config.resources)) {
        const resourceConfig = config.resources[resourceName];
        expect(resourceConfig).toHaveProperty('shadows');
        expect(typeof resourceConfig.shadows).toBe('object');
      }
    });

    it('すべてのリソースがsortDefaultsを持つ', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      for (const resourceName of Object.keys(config.resources)) {
        const resourceConfig = config.resources[resourceName];
        expect(resourceConfig).toHaveProperty('sortDefaults');
        expect(resourceConfig.sortDefaults).toHaveProperty('field');
        expect(resourceConfig.sortDefaults).toHaveProperty('order');
        expect(['ASC', 'DESC']).toContain(resourceConfig.sortDefaults.order);
      }
    });

    it('必須フィールド（name, createdAt, updatedAt）が含まれる', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      const articlesConfig = config.resources.articles;
      expect(articlesConfig.shadows).toHaveProperty('name');
      expect(articlesConfig.shadows).toHaveProperty('createdAt');
      expect(articlesConfig.shadows).toHaveProperty('updatedAt');

      const tasksConfig = config.resources.tasks;
      expect(tasksConfig.shadows).toHaveProperty('name');
      expect(tasksConfig.shadows).toHaveProperty('createdAt');
      expect(tasksConfig.shadows).toHaveProperty('updatedAt');
    });

    it('フィールド型が正しく変換される', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);
      const articlesConfig = config.resources.articles;

      expect(articlesConfig.shadows.name.type).toBe('string');
      expect(articlesConfig.shadows.priority.type).toBe('number');
      expect(articlesConfig.shadows.createdAt.type).toBe('datetime');
      expect(articlesConfig.shadows.updatedAt.type).toBe('datetime');
    });

    it('updatedAtが存在する場合、デフォルトソートはupdatedAt DESC', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      const articlesSort = config.resources.articles.sortDefaults;
      expect(articlesSort.field).toBe('updatedAt');
      expect(articlesSort.order).toBe('DESC');

      const tasksSort = config.resources.tasks.sortDefaults;
      expect(tasksSort.field).toBe('updatedAt');
      expect(tasksSort.order).toBe('DESC');
    });

    it('updatedAtが存在しない場合、デフォルトソートは最初のフィールド ASC', () => {
      // updatedAtを持たないリソースを追加
      const schemaWithoutUpdatedAt: SchemaRegistryConfig = {
        ...mockSchemaRegistry,
        resources: {
          ...mockSchemaRegistry.resources,
          categories: {
            resource: 'categories',
            type: {} as any,
            shadows: {
              sortableFields: {
                name: { type: 'string' as any },
                priority: { type: 'number' as any },
              },
            },
          },
        },
      };

      const config = generateConfigFromSchema(schemaWithoutUpdatedAt);
      const categoriesSort = config.resources.categories.sortDefaults;

      expect(categoriesSort.field).toBe('name'); // 最初のフィールド
      expect(categoriesSort.order).toBe('ASC');
    });

    it('メタデータフィールドが含まれる', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      expect(config).toHaveProperty('$schemaVersion');
      expect(config).toHaveProperty('$generatedAt');
      expect(config).toHaveProperty('$generatedFrom');
      expect(config.$schemaVersion).toBe('2.0');
    });
  });

  describe('スキーマレジストリとの整合性', () => {
    it('スキーマレジストリのすべてのリソースが含まれる', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      const schemaResourceNames = Object.keys(mockSchemaRegistry.resources);
      const configResourceNames = Object.keys(config.resources);

      expect(configResourceNames).toEqual(schemaResourceNames);
    });

    it('スキーマレジストリのすべてのフィールドが含まれる', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      for (const [resourceName, schema] of Object.entries(mockSchemaRegistry.resources)) {
        const schemaAny = schema as any;
        const schemaFieldNames = Object.keys(schemaAny.shadows.sortableFields);
        const configFieldNames = Object.keys(config.resources[resourceName].shadows);

        expect(configFieldNames).toEqual(schemaFieldNames);
      }
    });

    it('スキーマレジストリのフィールド型が正しく変換される', () => {
      const config = generateConfigFromSchema(mockSchemaRegistry);

      for (const [resourceName, schema] of Object.entries(mockSchemaRegistry.resources)) {
        const schemaAny = schema as any;

        for (const [fieldName, fieldDef] of Object.entries(schemaAny.shadows.sortableFields)) {
          const fieldDefAny = fieldDef as any;
          const schemaType = fieldDefAny.type;
          const configType = config.resources[resourceName].shadows[fieldName].type;

          expect(configType).toBe(schemaType);
        }
      }
    });
  });
});
