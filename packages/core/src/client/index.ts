/**
 * DynamoDBクライアントSDK（共通エクスポート）
 *
 * 認証方式ごとの専用クライアントを使用してください：
 * - IAM認証: '@ainews/core/client/iam'
 * - Cognito認証: '@ainews/core/client/cognito'
 * - Token認証: '@ainews/core/client/token'
 */

export { Database } from './Database.js';
export { Collection } from './Collection.js';
export { FindCursor } from './FindCursor.js';
