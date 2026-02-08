/**
 * parameterConverter のテスト
 * MongoDB風APIパラメータの変換ロジックをテスト
 */
import { describe, expect, it } from 'vitest';

import {
  convertDeleteManyParams,
  convertDeleteOneParams,
  convertFindManyParams,
  convertFindOneParams,
  convertFindParams,
  convertInsertManyParams,
  convertInsertOneParams,
  convertUpdateManyParams,
  convertUpdateOneParams,
} from '../../../src/server/operations/parameterConverter.js';

describe('parameterConverter', () => {
  describe('convertFindParams', () => {
    it('基本的なフィルターを変換できる', () => {
      const result = convertFindParams({
        filter: { status: 'active' },
      });

      expect(result).toEqual({
        filter: { status: 'active' },
      });
    });

    it('ソート条件を変換できる（asc）', () => {
      const result = convertFindParams({
        filter: {},
        options: {
          sort: { createdAt: 'asc' },
        },
      });

      expect(result).toEqual({
        filter: {},
        sort: {
          field: 'createdAt',
          order: 'ASC',
        },
      });
    });

    it('ソート条件を変換できる（desc）', () => {
      const result = convertFindParams({
        filter: {},
        options: {
          sort: { createdAt: 'desc' },
        },
      });

      expect(result).toEqual({
        filter: {},
        sort: {
          field: 'createdAt',
          order: 'DESC',
        },
      });
    });

    it('ソート条件を変換できる（数値形式）', () => {
      const result = convertFindParams({
        filter: {},
        options: {
          sort: { createdAt: 1 },
        },
      });

      expect(result).toEqual({
        filter: {},
        sort: {
          field: 'createdAt',
          order: 'ASC',
        },
      });
    });

    it('ページネーション条件を変換できる', () => {
      const result = convertFindParams({
        filter: {},
        options: {
          limit: 10,
          nextToken: 'token123',
        },
      });

      expect(result).toEqual({
        filter: {},
        pagination: {
          perPage: 10,
          nextToken: 'token123',
        },
      });
    });

    it('すべての条件を同時に変換できる', () => {
      const result = convertFindParams({
        filter: { status: 'active' },
        options: {
          sort: { createdAt: 'desc' },
          limit: 20,
          nextToken: 'token456',
        },
      });

      expect(result).toEqual({
        filter: { status: 'active' },
        sort: {
          field: 'createdAt',
          order: 'DESC',
        },
        pagination: {
          perPage: 20,
          nextToken: 'token456',
        },
      });
    });
  });

  describe('convertFindOneParams', () => {
    it('idを使用してfindOneパラメータを変換できる', () => {
      const result = convertFindOneParams({
        filter: { id: 'user123' },
      });

      expect(result).toEqual({
        id: 'user123',
      });
    });

    it('filter全体を使用してfindOneパラメータを変換できる', () => {
      const result = convertFindOneParams({
        filter: { email: 'test@example.com' },
      });

      expect(result).toEqual({
        filter: { email: 'test@example.com' },
      });
    });

    it('filterが存在しない場合はエラーをスローする', () => {
      expect(() => {
        convertFindOneParams({});
      }).toThrow('findOne requires filter');
    });
  });

  describe('convertFindManyParams', () => {
    it('filter.id.$inを使用してfindManyパラメータを変換できる', () => {
      const result = convertFindManyParams({
        filter: { id: { $in: ['id1', 'id2', 'id3'] } },
      });

      expect(result).toEqual({
        ids: ['id1', 'id2', 'id3'],
      });
    });

    it('filter全体を使用してfindManyパラメータを変換できる', () => {
      const result = convertFindManyParams({
        filter: { status: 'active' },
      });

      expect(result).toEqual({
        filter: { status: 'active' },
      });
    });

    it('filterが存在しない場合はエラーをスローする', () => {
      expect(() => {
        convertFindManyParams({});
      }).toThrow('findMany requires either ids or filter');
    });
  });

  describe('convertInsertOneParams', () => {
    it('dataを使用してinsertOneパラメータを変換できる', () => {
      const result = convertInsertOneParams({
        data: { name: 'Alice', email: 'alice@example.com' },
      });

      expect(result).toEqual({
        data: { name: 'Alice', email: 'alice@example.com' },
      });
    });

    it('dataが存在しない場合はエラーをスローする', () => {
      expect(() => {
        convertInsertOneParams({});
      }).toThrow('insertOne requires data');
    });
  });

  describe('convertUpdateOneParams', () => {
    it('idと$setを使用してupdateOneパラメータを変換できる', () => {
      const result = convertUpdateOneParams({
        filter: { id: 'user123' },
        update: { $set: { name: 'Bob' } },
      });

      expect(result).toEqual({
        id: 'user123',
        data: { $set: { name: 'Bob' } },
        options: undefined,
      });
    });

    it('$setOnInsertを含むupdateパラメータを変換できる', () => {
      const result = convertUpdateOneParams({
        filter: { id: 'user123' },
        update: {
          $set: { name: 'Bob' },
          $setOnInsert: { status: 'active' },
        },
      });

      expect(result).toEqual({
        id: 'user123',
        data: {
          $set: { name: 'Bob' },
          $setOnInsert: { status: 'active' },
        },
        options: undefined,
      });
    });

    it('通常のパッチ形式のupdateを変換できる', () => {
      const result = convertUpdateOneParams({
        filter: { id: 'user123' },
        update: { name: 'Bob', email: 'bob@example.com' },
      });

      expect(result).toEqual({
        id: 'user123',
        data: { name: 'Bob', email: 'bob@example.com' },
        options: undefined,
      });
    });

    it('upsertオプションを含むupdateパラメータを変換できる', () => {
      const result = convertUpdateOneParams({
        filter: { id: 'user123' },
        update: { $set: { name: 'Bob' } },
        options: { upsert: true },
      });

      expect(result).toEqual({
        id: 'user123',
        data: { $set: { name: 'Bob' } },
        options: { upsert: true },
      });
    });

    it('filter全体を使用してupdateOneパラメータを変換できる', () => {
      const result = convertUpdateOneParams({
        filter: { email: 'test@example.com' },
        update: { $set: { name: 'Charlie' } },
      });

      expect(result).toEqual({
        filter: { email: 'test@example.com' },
        data: { $set: { name: 'Charlie' } },
        options: undefined,
      });
    });

    it('filterが存在しない場合はエラーをスローする', () => {
      expect(() => {
        convertUpdateOneParams({
          update: { $set: { name: 'Bob' } },
        });
      }).toThrow('updateOne requires filter');
    });
  });

  describe('convertUpdateManyParams', () => {
    it('filter.id.$inと$setを使用してupdateManyパラメータを変換できる', () => {
      const result = convertUpdateManyParams({
        filter: { id: { $in: ['id1', 'id2'] } },
        update: { $set: { status: 'inactive' } },
      });

      expect(result).toEqual({
        ids: ['id1', 'id2'],
        data: { status: 'inactive' },
        options: undefined,
      });
    });

    it('通常のパッチ形式のupdateを変換できる', () => {
      const result = convertUpdateManyParams({
        filter: { id: { $in: ['id1', 'id2'] } },
        update: { status: 'inactive' },
      });

      expect(result).toEqual({
        ids: ['id1', 'id2'],
        data: { status: 'inactive' },
        options: undefined,
      });
    });

    it('upsertオプションを含むupdateManyパラメータを変換できる', () => {
      const result = convertUpdateManyParams({
        filter: { id: { $in: ['id1', 'id2'] } },
        update: { $set: { status: 'inactive' } },
        options: { upsert: true },
      });

      expect(result).toEqual({
        ids: ['id1', 'id2'],
        data: { status: 'inactive' },
        options: { upsert: true },
      });
    });

    it('filterが存在しない場合は空配列を返す', () => {
      const result = convertUpdateManyParams({
        update: { $set: { status: 'inactive' } },
      });

      expect(result).toEqual({
        ids: [],
        data: { status: 'inactive' },
        options: undefined,
      });
    });
  });

  describe('convertDeleteOneParams', () => {
    it('filter.idを使用してdeleteOneパラメータを変換できる', () => {
      const result = convertDeleteOneParams({
        filter: { id: 'user123' },
      });

      expect(result).toEqual({
        id: 'user123',
      });
    });

    it('filter.idが存在しない場合はエラーをスローする', () => {
      expect(() => {
        convertDeleteOneParams({
          filter: { email: 'test@example.com' },
        });
      }).toThrow('deleteOne requires filter.id');
    });

    it('filterが存在しない場合はエラーをスローする', () => {
      expect(() => {
        convertDeleteOneParams({});
      }).toThrow('deleteOne requires filter.id');
    });
  });

  describe('convertDeleteManyParams', () => {
    it('filter.id.$inを使用してdeleteManyパラメータを変換できる', () => {
      const result = convertDeleteManyParams({
        filter: { id: { $in: ['id1', 'id2', 'id3'] } },
      });

      expect(result).toEqual({
        ids: ['id1', 'id2', 'id3'],
      });
    });

    it('filterが存在しない場合は空配列を返す', () => {
      const result = convertDeleteManyParams({});

      expect(result).toEqual({
        ids: [],
      });
    });
  });

  describe('convertInsertManyParams', () => {
    it('dataを使用してinsertManyパラメータを変換できる', () => {
      const result = convertInsertManyParams({
        data: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
      });

      expect(result).toEqual({
        data: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
      });
    });

    it('dataが存在しない場合はエラーをスローする', () => {
      expect(() => {
        convertInsertManyParams({});
      }).toThrow('insertMany requires data');
    });
  });
});
