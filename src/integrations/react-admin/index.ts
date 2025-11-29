/**
 * react-admin統合
 *
 * DynamoDB ClientをreactAdmin DataProviderとして使用するための統合モジュール。
 *
 * @example
 * ```typescript
 * import { createDataProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
 * import type { TokenProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
 *
 * const tokenProvider: TokenProvider = {
 *   getToken: async () => 'your-auth-token',
 * };
 *
 * const dataProvider = createDataProvider({
 *   apiUrl: 'https://your-lambda-url.amazonaws.com',
 *   databaseName: 'your-database',
 *   tokenProvider,
 * });
 * ```
 */

export { createDataProvider } from './dataProvider.js';
export type { TokenProvider, DataProviderOptions } from './types.js';
