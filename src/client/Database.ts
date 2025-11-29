/**
 * データベース（共通実装）
 *
 * 認証ハンドラーは外部から注入されます。
 */
import { type AuthHeadersGetter, Collection } from './Collection.js';
import type { ClientOptions } from './DynamoClient.js';

/**
 * データベース
 *
 * コレクションへのアクセスを提供します。
 *
 * @template TAuthOptions - 認証オプションの型
 */
export class Database<TAuthOptions = unknown> {
  constructor(
    private _endpoint: string,
    private _databaseName: string,
    private _authToken: string | undefined,
    private _authOptions: TAuthOptions | undefined,
    private _clientOptions: ClientOptions | undefined,
    private _getAuthHeaders: AuthHeadersGetter<TAuthOptions>
  ) {}

  getEndpoint(): string {
    return this._endpoint;
  }

  getDatabaseName(): string {
    return this._databaseName;
  }

  getAuthToken(): string | undefined {
    return this._authToken;
  }

  getAuthOptions(): TAuthOptions | undefined {
    return this._authOptions;
  }

  collection<
    TSchema extends { id: string; [key: string]: unknown } = { id: string; [key: string]: unknown },
  >(name: string): Collection<TSchema, TAuthOptions> {
    if (!name || name.trim() === '') {
      throw new Error('Collection name cannot be empty');
    }

    return new Collection<TSchema, TAuthOptions>(
      this._endpoint,
      this._databaseName,
      name,
      this._authToken,
      this._authOptions,
      this._clientOptions,
      this._getAuthHeaders
    );
  }
}
