/**
 * operationDispatcher.ts のユニットテスト
 * 操作ディスパッチャーの動作をテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeOperation } from '../../../src/server/operations/operationDispatcher.js';
import type { ApiRequest } from '../../../src/server/types.js';

// 各ハンドラーをモック
vi.mock('../../../src/server/operations/find.js', () => ({
  handleFind: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock('../../../src/server/operations/findOne.js', () => ({
  handleFindOne: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock('../../../src/server/operations/findMany.js', () => ({
  handleFindMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock('../../../src/server/operations/findManyReference.js', () => ({
  handleFindManyReference: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock('../../../src/server/operations/insertOne.js', () => ({
  handleInsertOne: vi.fn().mockResolvedValue({ data: { id: '123' } }),
}));

vi.mock('../../../src/server/operations/updateOne.js', () => ({
  handleUpdateOne: vi.fn().mockResolvedValue({ data: { id: '123' } }),
}));

vi.mock('../../../src/server/operations/updateMany.js', () => ({
  handleUpdateMany: vi.fn().mockResolvedValue({ items: [], failedIds: [], errors: [] }),
}));

vi.mock('../../../src/server/operations/deleteOne.js', () => ({
  handleDeleteOne: vi.fn().mockResolvedValue({ data: { id: '123' } }),
}));

vi.mock('../../../src/server/operations/deleteMany.js', () => ({
  handleDeleteMany: vi.fn().mockResolvedValue({ deletedIds: [], failedIds: [], errors: [] }),
}));

vi.mock('../../../src/server/operations/insertMany.js', () => ({
  handleInsertMany: vi.fn().mockResolvedValue({ items: [], failedIds: [], errors: [] }),
}));

describe('operationDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeOperation', () => {
    it('find操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'find',
        resource: 'users',
        params: { filter: { status: 'active' } },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('findOne操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'findOne',
        resource: 'users',
        params: { filter: { id: '123' } },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ data: null });
    });

    it('findMany操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'findMany',
        resource: 'users',
        params: { filter: { id: { $in: ['123', '456'] } } },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('findManyReference操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'findManyReference',
        resource: 'users',
        params: {
          target: 'posts',
          id: '123',
          filter: {},
        },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('insertOne操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'insertOne',
        resource: 'users',
        params: { data: { name: 'Test User' } },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ data: { id: '123' } });
    });

    it('updateOne操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'updateOne',
        resource: 'users',
        params: {
          filter: { id: '123' },
          update: { $set: { name: 'Updated User' } },
        },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ data: { id: '123' } });
    });

    it('updateMany操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'updateMany',
        resource: 'users',
        params: {
          filter: { id: { $in: ['123', '456'] } },
          update: { $set: { status: 'inactive' } },
        },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ items: [], failedIds: [], errors: [] });
    });

    it('deleteOne操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'deleteOne',
        resource: 'users',
        params: { filter: { id: '123' } },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ data: { id: '123' } });
    });

    it('deleteMany操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'deleteMany',
        resource: 'users',
        params: { filter: { id: { $in: ['123', '456'] } } },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ deletedIds: [], failedIds: [], errors: [] });
    });

    it('insertMany操作を正しくディスパッチする', async () => {
      const request: ApiRequest = {
        op: 'insertMany',
        resource: 'users',
        params: {
          data: [{ name: 'User 1' }, { name: 'User 2' }],
        },
      };

      const result = await executeOperation(request, 'test-request-id');

      expect(result).toEqual({ items: [], failedIds: [], errors: [] });
    });

    it('未知の操作でエラーをスローする', async () => {
      const request: ApiRequest = {
        op: 'unknownOperation' as any,
        resource: 'users',
        params: {},
      };

      await expect(executeOperation(request, 'test-request-id')).rejects.toThrow(
        'Unknown operation: unknownOperation'
      );
    });
  });
});
