/**
 * DynamoDBクライアントSDK（IAM認証用）
 *
 * Lambda Function URL経由でDynamoDBにアクセスするHTTPクライアント。
 * IAM認証（AWS SigV4）を使用します。Node.js環境専用です。
 */
import {
  type ClientOptions as BaseClientOptions,
  DynamoClient as BaseDynamoClient,
} from './DynamoClient.js';
import { signRequest } from './aws-sigv4.js';

export { Database } from './Database.js';
export { Collection } from './Collection.js';
export { FindCursor } from './FindCursor.js';

/**
 * IAM認証オプション
 */
export interface IAMAuthOptions {
  /** AWSリージョン（必須） */
  region: string;
}

/**
 * クライアントオプション（IAM認証用）
 */
export interface ClientOptions extends Omit<BaseClientOptions<IAMAuthOptions>, 'auth'> {
  /** IAM認証設定（必須） */
  auth: IAMAuthOptions;
}

/**
 * DynamoDBクライアント（IAM認証用）
 *
 * IAM認証（AWS SigV4）を使用してLambda Function URLにアクセスします。
 * Node.js環境専用です。
 */
export class DynamoClient extends BaseDynamoClient<IAMAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    super(endpoint, options, async (url: string, body: string, auth?: IAMAuthOptions) => {
      if (!auth) {
        throw new Error('IAM auth options are required');
      }
      return await signRequest(url, body, auth.region);
    });
  }
}
