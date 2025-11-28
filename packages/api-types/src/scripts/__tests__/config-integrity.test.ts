/**
 * 実際の設定ファイルとスキーマレジストリの整合性テスト
 *
 * config/shadow.config.json が packages/api-types/src/schema.ts から
 * 正しく生成されていることを検証する。
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SchemaRegistryConfig } from '../../schema.js';

describe('Config Integrity', () => {
  it('実際の設定ファイルがスキーマレジストリと一致する', async () => {
    // 実際の設定ファイルを読み込む
    const configPath = resolve(process.cwd(), '../../config/shadow.config.json');
    const configContent = await readFile(configPath, 'utf-8');
    const actualConfig = JSON.parse(configContent);

    // スキーマレジストリから期待される設定を生成
    const expectedResources: Record<string, any> = {};

    for (const [resourceName, schema] of Object.entries(SchemaRegistryConfig.resources)) {
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

      expectedResources[resourceName] = {
        shadows,
        sortDefaults: {
          field: defaultSortField,
          order: defaultSortOrder,
        },
      };
    }

    // 構造の検証
    expect(actualConfig).toHaveProperty('$schemaVersion');
    expect(actualConfig).toHaveProperty('resources');

    // リソース数の検証
    expect(Object.keys(actualConfig.resources)).toEqual(Object.keys(expectedResources));

    // 各リソースの検証
    for (const resourceName of Object.keys(expectedResources)) {
      const actualResource = actualConfig.resources[resourceName];
      const expectedResource = expectedResources[resourceName];

      // shadowsキーの存在確認（fieldsキーではない）
      expect(actualResource).toHaveProperty('shadows');
      expect(actualResource).not.toHaveProperty('fields');

      // sortDefaultsの検証
      expect(actualResource.sortDefaults).toEqual(expectedResource.sortDefaults);

      // フィールドの検証
      expect(Object.keys(actualResource.shadows)).toEqual(Object.keys(expectedResource.shadows));

      for (const fieldName of Object.keys(expectedResource.shadows)) {
        expect(actualResource.shadows[fieldName]).toEqual(expectedResource.shadows[fieldName]);
      }
    }
  });

  it('すべてのリソースが必須フィールドを持つ', async () => {
    const configPath = resolve(process.cwd(), '../../config/shadow.config.json');
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    const requiredFields = ['name', 'createdAt', 'updatedAt'];

    for (const [resourceName, resourceConfig] of Object.entries(config.resources)) {
      const resourceConfigAny = resourceConfig as any;

      for (const requiredField of requiredFields) {
        expect(
          resourceConfigAny.shadows,
          `Resource '${resourceName}' should have '${requiredField}' field`
        ).toHaveProperty(requiredField);
      }
    }
  });

  it('すべてのリソースがshadowsキーを使用している', async () => {
    const configPath = resolve(process.cwd(), '../../config/shadow.config.json');
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    for (const [resourceName, resourceConfig] of Object.entries(config.resources)) {
      const resourceConfigAny = resourceConfig as any;

      expect(
        resourceConfigAny,
        `Resource '${resourceName}' should use 'shadows' key, not 'fields'`
      ).toHaveProperty('shadows');

      expect(
        resourceConfigAny,
        `Resource '${resourceName}' should not have 'fields' key`
      ).not.toHaveProperty('fields');
    }
  });
});
