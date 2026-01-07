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
export type {
  DataProviderOptions,
  ReferenceManyToManyFieldProps,
  ReferenceManyToManyInputProps,
  TokenProvider,
} from './types.js';
export { ReferenceManyToManyField, ReferenceManyToManyInput } from './components/index.js';
export { useManyToManyTransform } from './hooks/useManyToManyTransform.js';
export type { ManyToManyConfig } from './hooks/useManyToManyTransform.js';
