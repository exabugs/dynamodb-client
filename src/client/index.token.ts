/**
 * DynamoDBクライアントSDK（Token認証用）
 *
 * Lambda Function URL経由でDynamoDBにアクセスするHTTPクライアント。
 * 固定トークン認証を使用します。
 */
import {
  type ClientOptions as BaseClientOptions,
  DynamoClient as BaseDynamoClient,
} from './DynamoClient.js';

export { Database } from './Database.js';
export { Collection } from './Collection.js';
export { FindCursor } from './FindCursor.js';

/**
 * Token認証オプション
 */
export interface TokenAuthOptions {
  /** 認証トークン（必須） */
  token: string;
}

/**
 * クライアントオプション（Token認証用）
 */
export interface ClientOptions extends Omit<BaseClientOptions<TokenAuthOptions>, 'auth'> {
  /** Token認証設定（必須） */
  auth: TokenAuthOptions;
}

/**
 * DynamoDBクライアント（Token認証用）
 *
 * 固定トークン認証を使用してLambda Function URLにアクセスします。
 */
export class DynamoClient extends BaseDynamoClient<TokenAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    super(endpoint, options, async (_url: string, _body: string, auth?: TokenAuthOptions) => {
      if (!auth) {
        throw new Error('Token auth options are required');
      }
      return {
        Authorization: `Bearer ${auth.token}`,
      };
    });
  }
}
