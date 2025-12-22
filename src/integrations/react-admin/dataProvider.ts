/**
 * react-admin データプロバイダー
 * DynamoDB Client SDK を使用して Records Lambda Function URL と通信
 * react-admin 完全準拠の10操作を実装
 *
 * MongoDB風のシンプルなAPIでDynamoDBを操作:
 * - collection.find().sort().limit().toArray() でレコード取得
 * - collection.insertOne() / insertMany() でレコード作成
 * - collection.updateOne() / updateMany() でレコード更新
 * - collection.deleteOne() / deleteMany() でレコード削除
 *
 * @example
 * ```typescript
 * import { createDataProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
 * import type { TokenProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
 *
 * const tokenProvider: TokenProvider = {
 *   getToken: async () => {
 *     // 認証トークンを取得するロジック
 *     return 'your-auth-token';
 *   },
 * };
 *
 * const dataProvider = createDataProvider({
 *   apiUrl: 'https://your-lambda-url.amazonaws.com',
 *   tokenProvider,
 *   defaultPerPage: 25,
 *   defaultSortField: 'updatedAt',
 *   defaultSortOrder: 'DESC',
 * });
 * ```
 */

/**
 * NOTE: react-admin の型定義による any の使用
 *
 * react-adminのDataProviderインターフェースは、ジェネリック型パラメータとして
 * `any` を使用することを前提としています。これは、react-adminが様々な型のレコードを
 * 扱うための設計上の制約です。
 *
 * 実行時の型安全性は、以下により確保されています：
 * 1. DynamoDB Client SDK の型チェック
 * 2. TypeScript の型推論（呼び出し側で具体的な型を指定）
 * 3. 実際のレコード型はアプリケーション側で定義
 *
 * 根本的な解決策（TODO）:
 * 1. react-admin v5 の型定義を調査し、より厳密な型付けが可能か確認
 * 2. カスタム型定義を作成して、プロジェクト固有のリソース型を使用
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProvider } from 'react-admin';

import { DynamoClient } from '../../client/index.cognito.js';
import type { Filter } from '../../shared/index.js';
import type { DataProviderOptions } from './types.js';

/**
 * react-adminのフィルタをDynamoDB Client SDKのFilter型に変換
 *
 * @param filter - react-adminのフィルタオブジェクト
 * @returns DynamoDB Client SDKのFilter型
 */
function convertFilter(filter: Record<string, unknown>): Filter<Record<string, unknown>> {
  const converted: Filter<Record<string, unknown>> = {};

  for (const [key, value] of Object.entries(filter)) {
    // 値がオブジェクトの場合、演算子として扱う
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      converted[key] = value;
    } else {
      // 単純な値の場合、等価比較として扱う
      converted[key] = value;
    }
  }

  return converted;
}

/**
 * react-adminのソート順をDynamoDB Client SDKの形式に変換
 *
 * @param field - ソートフィールド
 * @param order - ソート順（'ASC' | 'DESC'）
 * @returns DynamoDB Client SDKのソート形式
 */
function convertSort(field: string, order: string): Record<string, 'asc' | 'desc'> {
  return {
    [field]: order === 'DESC' ? 'desc' : 'asc',
  };
}

/**
 * nextTokenキャッシュの型定義
 */
interface NextTokenCacheEntry {
  [page: number]: string | undefined;
  _cacheKey?: string;
}

/**
 * nextTokenキャッシュ
 * リソースごとに、ページ番号とnextTokenのマッピングを保持
 */
const nextTokenCache: Record<string, NextTokenCacheEntry> = {};

/**
 * nextTokenキャッシュをクリア
 */
function clearNextTokenCache(resource: string): void {
  delete nextTokenCache[resource];
}

/**
 * nextTokenをキャッシュに保存
 */
function cacheNextToken(resource: string, page: number, nextToken: string | undefined): void {
  if (!nextTokenCache[resource]) {
    nextTokenCache[resource] = {};
  }
  nextTokenCache[resource][page] = nextToken;
}

/**
 * キャッシュからnextTokenを取得
 *
 * page=2の場合、1ページ目の結果から得たnextTokenを使用する
 */
function getNextTokenFromCache(resource: string, page: number): string | undefined {
  return nextTokenCache[resource]?.[page];
}

/**
 * DynamoDB Client ベースの DataProvider を作成
 *
 * @param options - DataProviderオプション
 * @returns react-admin DataProvider
 */
export function createDataProvider(options: DataProviderOptions): DataProvider {
  const {
    apiUrl,
    tokenProvider,
    defaultPerPage = 25,
    defaultSortField = 'id',
    defaultSortOrder = 'ASC',
  } = options;

  /**
   * DynamoDB Client インスタンスを作成
   *
   * Cognito認証を使用してLambda Function URLに接続します。
   */
  function createClient(): DynamoClient {
    return new DynamoClient(apiUrl, {
      auth: {
        getToken: async () => {
          const token = await tokenProvider.getToken();
          if (!token) {
            throw new Error('認証トークンが見つかりません');
          }
          return token;
        },
      },
    });
  }

  return {
    /**
     * getList - リスト取得（フィルター・ソート対応）
     */
    getList: async <RecordType extends { id: string | number } = any>(
      resource: string,
      params: Parameters<DataProvider['getList']>[1]
    ) => {
      const client = createClient();
      await client.connect();

      try {
        const { page = 1, perPage = defaultPerPage } = params.pagination || {};
        const { field = defaultSortField, order = defaultSortOrder } = params.sort || {};
        const filter = params.filter || {};

        const db = client.db();
        const collection = db.collection(resource);

        // フィルターまたはソートが変更された場合、キャッシュをクリア
        // （新しいクエリなので、nextTokenをリセット）
        const filterKey = JSON.stringify(filter);
        const sortKey = `${field}:${order}`;
        const cacheKey = `${filterKey}:${sortKey}`;

        if (!nextTokenCache[resource] || nextTokenCache[resource]._cacheKey !== cacheKey) {
          clearNextTokenCache(resource);
          nextTokenCache[resource] = { _cacheKey: cacheKey };
        }

        // ページ番号からnextTokenを取得
        const nextToken = page > 1 ? getNextTokenFromCache(resource, page) : undefined;

        // MongoDB風のクエリでレコードを取得
        const cursor = collection.find(convertFilter(filter), {
          sort: convertSort(field, order),
          limit: perPage,
          nextToken, // nextTokenを渡す
        });

        const items = await cursor.toArray();
        const pageInfo = await cursor.getPageInfo();

        // 次のページのnextTokenをキャッシュ
        if (pageInfo.nextToken) {
          cacheNextToken(resource, page + 1, pageInfo.nextToken);
        }

        // react-admin v5 の期待する形式で返却
        // pageInfo を使用（total は不要）
        return {
          data: items as RecordType[],
          pageInfo: {
            hasNextPage: pageInfo.hasNextPage,
            hasPreviousPage: page > 1,
          },
        };
      } finally {
        await client.close();
      }
    },

    /**
     * getOne - 単一レコード取得
     */
    getOne: async <RecordType extends { id: string | number } = any>(
      resource: string,
      params: Parameters<DataProvider['getOne']>[1]
    ) => {
      const client = createClient();
      await client.connect();

      try {
        const db = client.db();
        const collection = db.collection(resource);

        // IDでレコードを検索（デフォルトソートを指定）
        const items = await collection
          .find({ id: String(params.id) })
          .sort({ id: 'asc' })
          .limit(1)
          .toArray();

        if (items.length === 0) {
          throw new Error(`Record not found: ${params.id}`);
        }

        return { data: items[0] as RecordType };
      } finally {
        await client.close();
      }
    },

    /**
     * getMany - 複数レコード取得（ID指定）
     */
    getMany: async <RecordType extends { id: string | number } = any>(
      resource: string,
      params: Parameters<DataProvider['getMany']>[1]
    ) => {
      const client = createClient();
      await client.connect();

      try {
        const db = client.db();
        const collection = db.collection(resource);

        // IDの配列でレコードを検索（デフォルトソートを指定）
        const items = await collection
          .find({ id: { in: params.ids.map(String) } })
          .sort({ id: 'asc' })
          .toArray();

        return { data: items as RecordType[] };
      } finally {
        await client.close();
      }
    },

    /**
     * getManyReference - 参照レコード取得（外部キー対応）
     */
    getManyReference: async <RecordType extends { id: string | number } = any>(
      resource: string,
      params: Parameters<DataProvider['getManyReference']>[1]
    ) => {
      const client = createClient();
      await client.connect();

      try {
        const { perPage = defaultPerPage } = params.pagination || {};
        const { field = defaultSortField, order = defaultSortOrder } = params.sort || {};
        const filter = params.filter || {};

        const db = client.db();
        const collection = db.collection(resource);

        // 外部キーフィルタを追加
        const combinedFilter = {
          ...convertFilter(filter),
          [params.target]: String(params.id),
        };

        // MongoDB風のクエリでレコードを取得
        const items = await collection
          .find(combinedFilter)
          .sort(convertSort(field, order))
          .limit(perPage)
          .toArray();

        // hasNextPageの判定はgetListと同じロジック（無限スクロール対応）
        return {
          data: items as RecordType[],
          pageInfo: {
            hasNextPage: items.length === perPage,
            hasPreviousPage: false,
          },
        };
      } finally {
        await client.close();
      }
    },

    /**
     * create - 単一レコード作成
     */
    create: async <RecordType extends { id: string | number } = any>(
      resource: string,
      params: Parameters<DataProvider['create']>[1]
    ) => {
      const client = createClient();
      await client.connect();

      try {
        const db = client.db();
        const collection = db.collection(resource);

        // レコードを挿入
        const result = await collection.insertOne({
          ...params.data,
          id: params.data.id || undefined,
        });

        // 挿入されたレコードを取得して返却
        const items = await collection.find({ id: result.insertedId }).limit(1).toArray();

        return { data: items[0] as RecordType };
      } finally {
        await client.close();
      }
    },

    /**
     * update - 単一レコード更新
     */
    update: async <RecordType extends { id: string | number } = any>(
      resource: string,
      params: Parameters<DataProvider['update']>[1]
    ) => {
      const client = createClient();
      await client.connect();

      try {
        const db = client.db();
        const collection = db.collection(resource);

        // レコードを更新
        await collection.updateOne(
          { id: String(params.id) },
          {
            set: params.data,
          }
        );

        // 更新されたレコードを取得して返却（デフォルトソートを指定）
        const items = await collection
          .find({ id: String(params.id) })
          .sort({ id: 'asc' })
          .limit(1)
          .toArray();

        return { data: items[0] as RecordType };
      } finally {
        await client.close();
      }
    },

    /**
     * updateMany - 複数レコード一括更新
     */
    updateMany: async (resource, params) => {
      const client = createClient();
      await client.connect();

      try {
        const db = client.db();
        const collection = db.collection(resource);

        // 複数レコードを更新
        await collection.updateMany(
          { id: { in: params.ids.map(String) } },
          {
            set: params.data,
          }
        );

        // react-adminは更新されたIDの配列を期待
        return { data: params.ids.map(String) };
      } finally {
        await client.close();
      }
    },

    /**
     * delete - 単一レコード削除
     */
    delete: async <RecordType extends { id: string | number } = any>(
      resource: string,
      params: Parameters<DataProvider['delete']>[1]
    ) => {
      const client = createClient();
      await client.connect();

      try {
        const db = client.db();
        const collection = db.collection(resource);

        // 削除前にレコードを取得（react-adminが削除されたレコードを期待するため、デフォルトソートを指定）
        const items = await collection
          .find({ id: String(params.id) })
          .sort({ id: 'asc' })
          .limit(1)
          .toArray();

        if (items.length === 0) {
          throw new Error(`Record not found: ${params.id}`);
        }

        // レコードを削除
        await collection.deleteOne({ id: String(params.id) });

        return { data: items[0] as RecordType };
      } finally {
        await client.close();
      }
    },

    /**
     * deleteMany - 複数レコード一括削除
     */
    deleteMany: async (resource, params) => {
      const client = createClient();
      await client.connect();

      try {
        const db = client.db();
        const collection = db.collection(resource);

        // 複数レコードを削除
        await collection.deleteMany({ id: { in: params.ids.map(String) } });

        // react-adminは削除されたIDの配列を期待
        return { data: params.ids.map(String) };
      } finally {
        await client.close();
      }
    },
  };
}
