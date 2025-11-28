/**
 * Custom Datagrid コンポーネントのテスト
 *
 * shadow.config.json の構造整合性と sortable プロパティの設定を検証する
 */
import shadowConfig from '@config/shadow.config.json';
import { describe, expect, it } from 'vitest';

describe('Datagrid Component', () => {
  describe('shadow.config.json 構造の検証', () => {
    it('shadowsキーを使用している（fieldsキーではない）', () => {
      const resources = shadowConfig.resources as Record<
        string,
        { shadows?: Record<string, unknown>; fields?: Record<string, unknown> }
      >;

      for (const resourceName of Object.keys(resources)) {
        const resourceConfig = resources[resourceName];

        expect(
          resourceConfig,
          `Resource '${resourceName}' should have 'shadows' key`
        ).toHaveProperty('shadows');

        expect(
          resourceConfig,
          `Resource '${resourceName}' should not have 'fields' key`
        ).not.toHaveProperty('fields');
      }
    });

    it('すべてのリソースがshadowsキーを持つ', () => {
      const resources = shadowConfig.resources as Record<
        string,
        { shadows?: Record<string, unknown> }
      >;

      for (const resourceName of Object.keys(resources)) {
        const resourceConfig = resources[resourceName];
        expect(resourceConfig.shadows).toBeDefined();
        expect(typeof resourceConfig.shadows).toBe('object');
      }
    });

    it('tasksリソースが必須フィールドを持つ', () => {
      const resources = shadowConfig.resources as Record<
        string,
        { shadows?: Record<string, unknown> }
      >;
      const tasksConfig = resources.tasks;

      expect(tasksConfig).toBeDefined();
      expect(tasksConfig.shadows).toHaveProperty('name');
      expect(tasksConfig.shadows).toHaveProperty('createdAt');
      expect(tasksConfig.shadows).toHaveProperty('updatedAt');
    });

    it('articlesリソースが必須フィールドを持つ', () => {
      const resources = shadowConfig.resources as Record<
        string,
        { shadows?: Record<string, unknown> }
      >;
      const articlesConfig = resources.articles;

      expect(articlesConfig).toBeDefined();
      expect(articlesConfig.shadows).toHaveProperty('name');
      expect(articlesConfig.shadows).toHaveProperty('createdAt');
      expect(articlesConfig.shadows).toHaveProperty('updatedAt');
    });
  });

  describe('isSortableField ロジックの検証', () => {
    /**
     * isSortableField 関数のロジックを再現
     * （実際のコンポーネントから抽出）
     */
    function isSortableField(resource: string | undefined, field: string): boolean {
      // id は常にソート可能
      if (field === 'id') return true;

      if (!resource) return false;

      // shadow.config.json から sortableFields を取得
      const resourceConfig = (
        shadowConfig.resources as Record<string, { shadows?: Record<string, unknown> }>
      )?.[resource];
      if (!resourceConfig) return false;

      return field in (resourceConfig.shadows || {});
    }

    it('idフィールドは常にソート可能', () => {
      expect(isSortableField('tasks', 'id')).toBe(true);
      expect(isSortableField('articles', 'id')).toBe(true);
      expect(isSortableField(undefined, 'id')).toBe(true);
    });

    it('shadowsに定義されたフィールドはソート可能', () => {
      expect(isSortableField('tasks', 'name')).toBe(true);
      expect(isSortableField('tasks', 'status')).toBe(true);
      expect(isSortableField('tasks', 'createdAt')).toBe(true);
      expect(isSortableField('tasks', 'updatedAt')).toBe(true);

      expect(isSortableField('articles', 'name')).toBe(true);
      expect(isSortableField('articles', 'status')).toBe(true);
    });

    it('shadowsに定義されていないフィールドはソート不可', () => {
      expect(isSortableField('tasks', 'nonexistent')).toBe(false);
      expect(isSortableField('articles', 'nonexistent')).toBe(false);
    });

    it('存在しないリソースの場合はソート不可', () => {
      expect(isSortableField('nonexistent', 'name')).toBe(false);
      expect(isSortableField(undefined, 'name')).toBe(false);
    });

    it('古いfieldsキーではなくshadowsキーを参照している', () => {
      // この関数は shadows キーを参照するため、
      // fields キーが存在しても無視される
      const resources = shadowConfig.resources as Record<
        string,
        { shadows?: Record<string, unknown>; fields?: Record<string, unknown> }
      >;

      for (const resourceName of Object.keys(resources)) {
        const resourceConfig = resources[resourceName];

        // shadows キーが存在することを確認
        expect(resourceConfig).toHaveProperty('shadows');

        // fields キーが存在しないことを確認
        expect(resourceConfig).not.toHaveProperty('fields');
      }
    });
  });

  describe('実際の設定ファイルとの整合性', () => {
    it('tasksリソースのすべてのソート可能フィールドが正しく設定されている', () => {
      const resources = shadowConfig.resources as Record<
        string,
        { shadows?: Record<string, unknown> }
      >;
      const tasksConfig = resources.tasks;

      const expectedFields = ['name', 'status', 'dueDate', 'createdAt', 'updatedAt'];

      for (const field of expectedFields) {
        expect(tasksConfig.shadows, `Field '${field}' should be in tasks.shadows`).toHaveProperty(
          field
        );
      }
    });

    it('articlesリソースのすべてのソート可能フィールドが正しく設定されている', () => {
      const resources = shadowConfig.resources as Record<
        string,
        { shadows?: Record<string, unknown> }
      >;
      const articlesConfig = resources.articles;

      const expectedFields = ['name', 'category', 'status', 'createdAt', 'updatedAt'];

      for (const field of expectedFields) {
        expect(
          articlesConfig.shadows,
          `Field '${field}' should be in articles.shadows`
        ).toHaveProperty(field);
      }
    });
  });
});
