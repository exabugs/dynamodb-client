/**
 * react-admin データプロバイダー
 * @exabugs/dynamodb-client/integrations/react-admin を使用
 */
import { createDataProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
import type { TokenProvider } from '@exabugs/dynamodb-client/integrations/react-admin';

import { getIdToken } from './authProvider';

/**
 * Cognito用のTokenProvider実装
 */
const cognitoTokenProvider: TokenProvider = {
  getToken: async () => {
    const token = await getIdToken();
    if (!token) {
      throw new Error('認証トークンが見つかりません');
    }
    return token;
  },
};

/**
 * DataProviderを作成
 */
export const dataProvider = createDataProvider({
  apiUrl: import.meta.env.VITE_RECORDS_API_URL,
  databaseName: 'ainews',
  tokenProvider: cognitoTokenProvider,
  defaultPerPage: 25,
  defaultSortField: 'updatedAt',
  defaultSortOrder: 'DESC',
});
