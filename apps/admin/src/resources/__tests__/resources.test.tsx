/**
 * リソース整合性テスト
 *
 * react-adminのリソース定義とTypeScript型定義の整合性を検証する。
 * 各リソースに対して同じテストを実行する。
 */
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import {
  extractFieldsFromInterface,
  extractSchemaResource,
  testRecordRepresentation,
  testResourceName,
  testSchemaResourceMatch,
  testSourceIntegrity,
} from './helpers/resourceIntegrity';

/**
 * リソース定義（最小限のパラメータ）
 */
interface ResourceDefinition {
  /** リソースファイル名（例: 'articles.tsx'） */
  resourceFile: string;
  /** 型定義ファイル名（例: 'Article.ts'） */
  typeFile: string;
}

/**
 * テスト対象のリソース一覧
 */
const resources: ResourceDefinition[] = [
  {
    resourceFile: 'articles.tsx', //
    typeFile: 'Article.ts',
  },
  {
    resourceFile: 'tasks.tsx', //
    typeFile: 'Task.ts',
  },
  {
    resourceFile: 'fetchLogs.tsx', //
    typeFile: 'FetchLog.ts',
  },
];

/**
 * 各リソースに対してテストを実行
 */
resources.forEach(({ resourceFile, typeFile }) => {
  // 型定義ファイル名からインターフェース名を導出（拡張子を除去）
  const interfaceName = typeFile.replace('.ts', '');

  describe(`${interfaceName} Resource`, () => {
    const resourceFilePath = path.join(__dirname, '..', resourceFile);
    const typeFilePath = path.join(
      __dirname,
      '../../../../../packages/api-types/src/models',
      typeFile
    );

    // 派生値を計算
    const schemaName = `${interfaceName}Schema`;
    const fields = extractFieldsFromInterface(typeFilePath, interfaceName);
    const resourceName = extractSchemaResource(typeFilePath, schemaName);

    describe('型定義との整合性', () => {
      it(`${interfaceName}型のフィールドを取得できる`, () => {
        expect(fields.length).toBeGreaterThan(0);
        expect(fields).toContain('id');
        expect(fields).toContain('name');
      });

      it('スキーマからresource名を取得できる', () => {
        expect(resourceName).toBeDefined();
      });

      if (!resourceName) {
        throw new Error(`Resource name not found for ${schemaName}`);
      }

      testSourceIntegrity(resourceFilePath, fields, resourceName);
    });

    describe('recordRepresentationの整合性', () => {
      testRecordRepresentation(resourceFilePath, fields, interfaceName);
    });

    describe('リソース名の整合性', () => {
      if (!resourceName) {
        throw new Error(`Resource name not found for ${schemaName}`);
      }
      testResourceName(resourceFilePath, resourceName);
    });

    describe('スキーマとの整合性', () => {
      testSchemaResourceMatch(resourceFilePath, typeFilePath, schemaName);
    });
  });
});
