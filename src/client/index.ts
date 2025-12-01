/**
 * DynamoDBクライアントSDK（共通エクスポート）
 *
 * 認証方式ごとの専用クライアントを使用してください：
 * - IAM認証: '@exabugs/dynamodb-client/client/iam'
 * - Cognito認証: '@exabugs/dynamodb-client/client/cognito'
 * - Token認証: '@exabugs/dynamodb-client/client/token'
 */

export { Database } from './Database.js';
export { Collection, type InputBase, type ResultBase } from './Collection.js';
export { FindCursor } from './FindCursor.js';
