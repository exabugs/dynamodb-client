/**
 * このファイルは自動生成されています。
 * 直接編集しないでください。
 *
 * 生成元: docs/specs/openapi.yaml
 * 生成日時: 2026-02-08T15:39:32.692Z
 * 生成スクリプト: scripts/generate-mcp-tools-v2.ts
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tools: Tool[] = [
  {
    name: 'dynamodb_find',
    description:
      'DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_findOne',
    description: 'DynamoDBから単一レコードを取得します。IDで指定。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_findMany',
    description: 'DynamoDBから複数レコードをIDで取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_findManyReference',
    description: 'DynamoDBから参照フィールドでレコードを取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_insertOne',
    description: 'DynamoDBに単一レコードを作成します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_insertMany',
    description: 'DynamoDBに複数レコードを作成します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_updateOne',
    description: 'DynamoDBの単一レコードを更新します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_updateMany',
    description: 'DynamoDBの複数レコードを更新します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_deleteOne',
    description: 'DynamoDBから単一レコードを削除します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'dynamodb_deleteMany',
    description: 'DynamoDBから複数レコードを削除します。',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'コレクション名（例: venues, users）',
        },
      },
      required: ['collection'],
    },
  },
];
