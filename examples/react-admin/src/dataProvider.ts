/**
 * React Admin Data Provider
 * Uses @exabugs/dynamodb-client/integrations/react-admin
 *
 * Get FUNCTION_URL from Terraform output:
 *   cd ../terraform
 *   terraform output function_url
 *
 * Then set it in .env file:
 *   VITE_FUNCTION_URL=<your-function-url>
 */
import { createDataProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
import type { TokenProvider } from '@exabugs/dynamodb-client/integrations/react-admin';

import { getIdToken } from './authProvider';

/**
 * Validate required environment variables
 */
const FUNCTION_URL = import.meta.env.VITE_FUNCTION_URL;

if (!FUNCTION_URL) {
  throw new Error(
    'VITE_FUNCTION_URL is required. Get it from Terraform output: terraform output function_url',
  );
}

/**
 * Cognito Token Provider
 */
const cognitoTokenProvider: TokenProvider = {
  getToken: async () => {
    const token = await getIdToken();
    if (!token) {
      throw new Error('No authentication token found');
    }
    return token;
  },
};

/**
 * Create Data Provider
 */
export const dataProvider = createDataProvider({
  apiUrl: FUNCTION_URL,
  databaseName: 'myapp',
  tokenProvider: cognitoTokenProvider,
  defaultPerPage: 25,
  defaultSortField: 'updatedAt',
  defaultSortOrder: 'DESC',
});
