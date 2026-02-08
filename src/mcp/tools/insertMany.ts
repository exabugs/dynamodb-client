/**
 * dynamodb_insertMany ツール定義
 * DynamoDBに複数レコードを一括作成します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_insertMany ツール
 *
 * DynamoDBに複数レコードを一括作成します。
 */
export const insertManyTool: Tool = {
  name: 'dynamodb_insertMany',
  description: 'DynamoDBに複数レコードを一括作成します。',
  inputSchema: {
    type: 'object',
    properties: {
      collection: {
        type: 'string',
        description: 'コレクション名（例: venues, users）',
      },
      data: {
        type: 'array',
        description: '作成または更新するデータ',
        items: {
          type: 'object',
          description: 'itemパラメータ',
        },
      },
    },
    required: ['collection'],
  },
};
