/**
 * dynamodb_deleteMany ツール定義
 * DynamoDBから複数レコードを一括削除します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_deleteMany ツール
 *
 * DynamoDBから複数レコードを一括削除します。
 */
export const deleteManyTool: Tool = {
  name: 'dynamodb_deleteMany',
  description: 'DynamoDBから複数レコードを一括削除します。',
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
    },
    required: ['collection'],
  },
};
