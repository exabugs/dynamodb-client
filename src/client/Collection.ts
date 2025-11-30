/**
 * Collection（共通実装）
 *
 * 認証ハンドラーは外部から注入されます。
 */
import type {
  DeleteResult,
  Filter,
  FindOptions,
  InsertManyResult,
  InsertOneResult,
  UpdateOperators,
  UpdateResult,
} from '../types.js';
import type { ClientOptions } from './DynamoClient.js';
import { FindCursor } from './FindCursor.js';

/**
 * 認証ハンドラー関数の型
 */
export type AuthHeadersGetter<TAuthOptions = unknown> = (
  endpoint: string,
  body: string,
  authOptions?: TAuthOptions
) => Promise<Record<string, string>>;

/**
 * ドキュメント入力型の基本インターフェース（id はオプショナル）
 */
export interface InputBase {
  id?: string;
  [key: string]: unknown;
}

/**
 * ドキュメント結果型の基本インターフェース（id は必須）
 */
export interface ResultBase {
  id: string;
  [key: string]: unknown;
}

/**
 * コレクション
 *
 * MongoDB風のCRUD操作を提供します。
 * 型安全なフィルタとクエリAPIでDynamoDBを操作できます。
 *
 * @template TSchema - コレクションのドキュメント型（ResultBase を extends）
 * @template TAuthOptions - 認証オプションの型
 */
export class Collection<TSchema extends ResultBase = ResultBase, TAuthOptions = unknown> {
  constructor(
    private endpoint: string,
    private databaseName: string,
    private collectionName: string,
    private authToken: string | undefined,
    private authOptions: TAuthOptions | undefined,
    private clientOptions: ClientOptions | undefined,
    private getAuthHeaders: AuthHeadersGetter<TAuthOptions>
  ) {}

  getName(): string {
    return this.collectionName;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  getDatabaseName(): string {
    return this.databaseName;
  }

  getAuthToken(): string | undefined {
    return this.authToken;
  }

  getAuthOptions(): TAuthOptions | undefined {
    return this.authOptions;
  }

  /**
   * HTTPリクエストを送信（内部使用）
   */
  private async request(operation: string, params: Record<string, unknown>): Promise<unknown> {
    const requestBody = JSON.stringify({
      operation,
      database: this.databaseName,
      collection: this.collectionName,
      params,
    });

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 認証ヘッダーを追加（注入された関数を使用）
    const authHeaders = await this.getAuthHeaders(this.endpoint, requestBody, this.authOptions);
    headers = { ...headers, ...authHeaders };

    // 後方互換性: authTokenが直接指定されている場合（非推奨）
    if (this.authToken && !this.authOptions) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // タイムアウト設定
    const controller = new AbortController();
    const timeout = this.clientOptions?.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = (await response.json().catch(() => ({ message: response.statusText }))) as {
          message?: string;
        };
        throw new Error(`Request failed: ${error.message || response.statusText}`);
      }

      const result = (await response.json()) as { data: unknown };
      return result.data;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  find(filter: Filter<TSchema> = {}, options?: FindOptions): FindCursor<TSchema, TAuthOptions> {
    return new FindCursor<TSchema, TAuthOptions>(
      this.endpoint,
      this.databaseName,
      this.collectionName,
      filter,
      options,
      this.authToken,
      this.authOptions,
      this.clientOptions,
      this.getAuthHeaders
    );
  }

  async findOne(filter: Filter<TSchema>): Promise<TSchema | null> {
    const response = await this.request('findOne', { filter });
    // Records Lambda は直接レコードを返す（{ document: ... } ではない）
    // 空オブジェクトの場合はnullを返す
    if (!response || (typeof response === 'object' && Object.keys(response).length === 0)) {
      return null;
    }
    return response as TSchema;
  }

  async findMany(ids: string[]): Promise<TSchema[]> {
    const response = await this.request('findMany', { filter: { id: { in: ids } } });
    // Records Lambdaは配列を直接返す
    if (Array.isArray(response)) {
      return response as TSchema[];
    }
    const responseObj = response as { items?: TSchema[] };
    return responseObj.items || [];
  }

  async insertOne(document: InputBase & Omit<TSchema, 'id'>): Promise<InsertOneResult> {
    const response = await this.request('insertOne', { document });
    const result = response as { insertedId: string };
    return {
      acknowledged: true,
      insertedId: result.insertedId,
    };
  }

  async insertMany(documents: (InputBase & Omit<TSchema, 'id'>)[]): Promise<InsertManyResult> {
    const response = await this.request('insertMany', { documents });
    // Records Lambdaは統一形式 { count, successIds, failedIds, errors } を返す
    // MongoDB互換形式に変換
    const result = response as {
      count?: number;
      successIds?: Record<number, string>;
      failedIds?: string[];
      errors?: Array<{ id: string; code: string; message: string }>;
    };
    return {
      acknowledged: true,
      insertedCount: result.count || 0,
      insertedIds: result.successIds || {},
      failedIds: result.failedIds,
      errors: result.errors,
    };
  }

  async updateOne(
    filter: Filter<TSchema>,
    update: UpdateOperators<TSchema>
  ): Promise<UpdateResult> {
    const response = await this.request('updateOne', { filter, update });
    const result = response as {
      matchedCount: number;
      modifiedCount: number;
      upsertedId?: string;
    };
    return {
      acknowledged: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedId: result.upsertedId,
    };
  }

  async updateMany(
    filter: Filter<TSchema>,
    update: UpdateOperators<TSchema>
  ): Promise<UpdateResult> {
    const response = await this.request('updateMany', { filter, update });
    // Records Lambdaは統一形式 { count, successIds, failedIds, errors } を返す
    // MongoDB互換形式に変換
    const result = response as {
      count?: number;
      successIds?: Record<string, string>;
      failedIds?: Record<string, string>;
    };
    const successCount = Object.keys(result.successIds || {}).length;
    const failedCount = Object.keys(result.failedIds || {}).length;
    return {
      acknowledged: true,
      matchedCount: successCount + failedCount, // 成功 + 失敗の合計
      modifiedCount: result.count || 0, // 実際に更新された件数
    };
  }

  async deleteOne(filter: Filter<TSchema>): Promise<DeleteResult> {
    const response = await this.request('deleteOne', { filter });
    const result = response as { deletedCount: number };
    return {
      acknowledged: true,
      deletedCount: result.deletedCount,
    };
  }

  async deleteMany(filter: Filter<TSchema>): Promise<DeleteResult> {
    const response = await this.request('deleteMany', { filter });
    // Records Lambdaは統一形式 { count, successIds, failedIds, errors } を返す
    // MongoDB互換形式に変換
    const result = response as { count?: number };
    return {
      acknowledged: true,
      deletedCount: result.count || 0, // 実際に削除された件数
    };
  }
}
