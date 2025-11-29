/**
 * DynamoDBクライアントSDK（Cognito認証用）
 *
 * Lambda Function URL経由でDynamoDBにアクセスするHTTPクライアント。
 * Cognito認証（動的トークン取得）を使用します。
 */
import {
  type ClientOptions as BaseClientOptions,
  DynamoClient as BaseDynamoClient,
} from './DynamoClient.js';

export { Database } from './Database.js';
export { Collection } from './Collection.js';
export { FindCursor } from './FindCursor.js';

/**
 * Cognito認証オプション
 */
export interface CognitoAuthOptions {
  /** トークン取得関数（必須） */
  getToken: () => Promise<string>;
}

/**
 * クライアントオプション（Cognito認証用）
 */
export interface ClientOptions extends Omit<BaseClientOptions<CognitoAuthOptions>, 'auth'> {
  /** Cognito認証設定（必須） */
  auth: CognitoAuthOptions;
}

/**
 * DynamoDBクライアント（Cognito認証用）
 *
 * Cognito認証を使用してLambda Function URLにアクセスします。
 * トークンは動的に取得されます。
 */
export class DynamoClient extends BaseDynamoClient<CognitoAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    super(endpoint, options, async (_url: string, _body: string, auth?: CognitoAuthOptions) => {
      if (!auth) {
        throw new Error('Cognito auth options are required');
      }
      const token = await auth.getToken();
      return {
        Authorization: `Bearer ${token}`,
      };
    });
  }
}
