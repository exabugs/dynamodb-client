/**
 * dynamodb_updateOne ツール定義
 * DynamoDBの単一レコードを更新します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_updateOne ツール
 *
 * DynamoDBの単一レコードを更新します。
 */
export const updateOneTool: Tool = {
  name: 'dynamodb_updateOne',
  description: 'DynamoDBの単一レコードを更新します。',
  inputSchema: {
    type: 'object',
    properties: {
      collection: {
        type: 'string',
        description: 'コレクション名（例: venues, users）',
      },
      id: {
        type: 'string',
        description: 'レコードID',
      },
      data: {
        type: 'object',
        description: '作成または更新するデータ',
      },
      options: {
        type: 'object',
        description: '操作オプション',
        properties: {
          upsert: {
            type: 'boolean',
            description: 'レコードが存在しない場合に新規作成するか（デフォルト: false）',
          },
        },
      },
    },
    required: ['collection'],
  },
};
