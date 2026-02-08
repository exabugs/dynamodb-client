/**
 * dynamodb_updateMany ツール定義
 * DynamoDBの複数レコードを一括更新します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_updateMany ツール
 *
 * DynamoDBの複数レコードを一括更新します。
 */
export const updateManyTool: Tool = {
  name: 'dynamodb_updateMany',
  description: 'DynamoDBの複数レコードを一括更新します。',
  inputSchema: {
    type: 'object',
    properties: {
      collection: {
        type: 'string',
        description: 'コレクション名（例: venues, users）',
      },
      filter: {
        type: 'object',
        description: 'フィルター条件（MongoDB形式）。例: { status: "active", age: { $gte: 18 } }',
      },
      data: {
        type: 'object',
        description: '作成または更新するデータ',
      },
    },
    required: ['collection'],
  },
};
