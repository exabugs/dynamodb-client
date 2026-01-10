/**
 * React Admin dataProvider のテスト
 *
 * DynamoDB Client SDK を使用した react-admin データプロバイダーの動作を検証します。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataProvider } from '../../../src/integrations/react-admin/dataProvider.js';
import type { TokenProvider } from '../../../src/integrations/react-admin/types.js';

// DynamoDB Clientのモック
vi.mock('../../../src/client/index.cognito.js', () => ({
  DynamoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    db: vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnThis(),
        findOne: vi.fn(),
        insertOne: vi.fn(),
        insertMany: vi.fn(),
        updateOne: vi.fn(),
        updateMany: vi.fn(),
        deleteOne: vi.fn(),
        deleteMany: vi.fn(),
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        toArray: vi.fn(),
      }),
    }),
  })),
}));

describe('React Admin dataProvider', () => {
  const mockTokenProvider: TokenProvider = {
    getToken: vi.fn().mockResolvedValue('test-token'),
  };

  const mockCollection = {
    find: vi.fn().mockReturnThis(),
    findOne: vi.fn(),
    insertOne: vi.fn(),
    insertMany: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
    getPageInfo: vi.fn().mockResolvedValue({
      hasNextPage: false,
      hasPreviousPage: false,
    }),
  };

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { DynamoClient } = await import('../../../src/client/index.cognito.js');
    vi.mocked(DynamoClient).mockImplementation(
      () =>
        ({
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          db: vi.fn().mockReturnValue(mockDb),
        }) as any
    );
  });

  describe('createDataProvider', () => {
    it('データプロバイダーを作成できる', () => {
      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      expect(dataProvider).toBeDefined();
      expect(dataProvider.getList).toBeDefined();
      expect(dataProvider.getOne).toBeDefined();
      expect(dataProvider.getMany).toBeDefined();
      expect(dataProvider.getManyReference).toBeDefined();
      expect(dataProvider.create).toBeDefined();
      expect(dataProvider.update).toBeDefined();
      expect(dataProvider.updateMany).toBeDefined();
      expect(dataProvider.delete).toBeDefined();
      expect(dataProvider.deleteMany).toBeDefined();
    });

    it('デフォルトオプションを使用できる', () => {
      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      expect(dataProvider).toBeDefined();
    });

    it('カスタムオプションを使用できる', () => {
      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
        defaultPerPage: 50,
        defaultSortField: 'createdAt',
        defaultSortOrder: 'ASC',
      });

      expect(dataProvider).toBeDefined();
    });
  });

  describe('getList', () => {
    it('レコード一覧を取得できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]);
      mockCollection.getPageInfo.mockResolvedValueOnce({
        hasNextPage: false,
        hasPreviousPage: false,
      });

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'name', order: 'ASC' },
        filter: {},
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.pageInfo).toEqual({
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('フィルターを適用できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        { id: '1', name: 'Active Item', status: 'active' },
      ]);
      mockCollection.getPageInfo.mockResolvedValueOnce({
        hasNextPage: false,
        hasPreviousPage: false,
      });

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'name', order: 'ASC' },
        filter: { status: 'active' },
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('active');
    });

    it('ソートを適用できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        { id: '2', name: 'Item 2' },
        { id: '1', name: 'Item 1' },
      ]);
      mockCollection.getPageInfo.mockResolvedValueOnce({
        hasNextPage: false,
        hasPreviousPage: false,
      });

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'name', order: 'DESC' },
        filter: {},
      });

      // findが呼ばれたことを確認（sortはfindのオプションとして渡される）
      expect(mockCollection.find).toHaveBeenCalled();
    });

    it('ページネーションを適用できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        { id: '11', name: 'Item 11' },
        { id: '12', name: 'Item 12' },
      ]);
      mockCollection.getPageInfo.mockResolvedValueOnce({
        hasNextPage: true,
        hasPreviousPage: true,
      });

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.getList('items', {
        pagination: { page: 2, perPage: 10 },
        sort: { field: 'name', order: 'ASC' },
        filter: {},
      });

      // findが呼ばれたことを確認（limit, skipはfindのオプションとして渡される）
      expect(mockCollection.find).toHaveBeenCalled();
      expect(result.pageInfo).toEqual({
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });

  describe('getOne', () => {
    it('単一レコードを取得できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        {
          id: '1',
          name: 'Item 1',
        },
      ]);

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.getOne('items', { id: '1' });

      expect(result.data.id).toBe('1');
      expect(result.data.name).toBe('Item 1');
    });

    it('レコードが見つからない場合はエラー', async () => {
      mockCollection.toArray.mockResolvedValueOnce([]);

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      await expect(dataProvider.getOne('items', { id: 'non-existent' })).rejects.toThrow();
    });
  });

  describe('getMany', () => {
    it('複数レコードを取得できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]);

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.getMany('items', { ids: ['1', '2'] });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.data[1].id).toBe('2');
    });

    it('空配列の場合は空配列を返す', async () => {
      mockCollection.toArray.mockResolvedValueOnce([]);

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.getMany('items', { ids: [] });

      expect(result.data).toEqual([]);
    });
  });

  describe('create', () => {
    it('レコードを作成できる', async () => {
      mockCollection.insertOne.mockResolvedValueOnce({
        insertedId: '1',
      });
      mockCollection.toArray.mockResolvedValueOnce([
        {
          id: '1',
          name: 'New Item',
        },
      ]);

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.create('items', {
        data: { name: 'New Item' },
      });

      expect(result.data.id).toBe('1');
      expect(result.data.name).toBe('New Item');
    });
  });

  describe('update', () => {
    it('レコードを更新できる', async () => {
      mockCollection.updateOne.mockResolvedValueOnce({
        modifiedCount: 1,
      });
      mockCollection.toArray.mockResolvedValueOnce([
        {
          id: '1',
          name: 'Updated Item',
        },
      ]);

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.update('items', {
        id: '1',
        data: { name: 'Updated Item' },
        previousData: { id: '1', name: 'Old Item' },
      });

      expect(result.data.id).toBe('1');
      expect(result.data.name).toBe('Updated Item');
    });
  });

  describe('updateMany', () => {
    it('複数レコードを更新できる', async () => {
      mockCollection.updateMany.mockResolvedValueOnce({
        items: [
          { id: '1', status: 'active' },
          { id: '2', status: 'active' },
        ],
      });

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.updateMany('items', {
        ids: ['1', '2'],
        data: { status: 'active' },
      });

      expect(result.data).toEqual(['1', '2']);
    });
  });

  describe('delete', () => {
    it('レコードを削除できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        {
          id: '1',
          name: 'Deleted Item',
        },
      ]);
      mockCollection.deleteOne.mockResolvedValueOnce({
        deletedCount: 1,
      });

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.delete('items', {
        id: '1',
        previousData: { id: '1', name: 'Deleted Item' },
      });

      expect(result.data.id).toBe('1');
    });
  });

  describe('deleteMany', () => {
    it('複数レコードを削除できる', async () => {
      mockCollection.deleteMany.mockResolvedValueOnce({
        deletedIds: ['1', '2'],
      });

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.deleteMany('items', {
        ids: ['1', '2'],
      });

      expect(result.data).toEqual(['1', '2']);
    });
  });

  describe('getManyReference', () => {
    it('参照レコードを取得できる', async () => {
      mockCollection.toArray.mockResolvedValueOnce([
        { id: '1', name: 'Item 1', userId: 'user-1' },
        { id: '2', name: 'Item 2', userId: 'user-1' },
      ]);

      const dataProvider = createDataProvider({
        apiUrl: 'https://test.example.com',
        tokenProvider: mockTokenProvider,
      });

      const result = await dataProvider.getManyReference('items', {
        target: 'userId',
        id: 'user-1',
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'name', order: 'ASC' },
        filter: {},
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].userId).toBe('user-1');
    });
  });
});
