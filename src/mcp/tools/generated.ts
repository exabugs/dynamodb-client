/**
 * このファイルは自動生成されています。
 * 直接編集しないでください。
 *
 * 生成元: docs/specs/openapi.yaml
 * 生成日時: 2026-02-08T03:34:47.972Z
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
        filter: {
          type: 'object',
          description: 'フィルター条件（MongoDB形式）。例: { status: "active", age: { $gte: 18 } }',
        },
        sort: {
          type: 'object',
          description: 'ソート条件',
          properties: {
            field: {
              type: 'string',
              description: 'ソート対象フィールド名',
            },
            order: {
              type: 'string',
              enum: ['ASC', 'DESC'],
              description: 'ソート順序（ASC: 昇順, DESC: 降順）',
            },
          },
          required: ['field', 'order'],
        },
        pagination: {
          type: 'object',
          description: 'ページネーション設定',
          properties: {
            perPage: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              description: '1ページあたりの件数（最大50件）',
            },
            nextToken: {
              type: 'string',
              description: '次ページトークン（前回のレスポンスから取得）',
            },
          },
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
        id: {
          type: 'string',
          description: 'レコードID',
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
        ids: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'レコードIDの配列',
        },
      },
      required: ['collection', 'ids'],
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
        target: {
          type: 'string',
          description: '参照フィールド名（例: userId）',
        },
        id: {
          type: 'string',
          description: '参照先のレコードID',
        },
        filter: {
          type: 'object',
          description: 'フィルター条件（MongoDB形式）',
        },
      },
      required: ['collection', 'target', 'id'],
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
        data: {
          type: 'object',
          description: '作成するデータ',
        },
      },
      required: ['collection', 'data'],
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
        data: {
          type: 'array',
          items: {
            type: 'object',
          },
          description: '作成するデータの配列',
        },
      },
      required: ['collection', 'data'],
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
        id: {
          type: 'string',
          description: 'レコードID',
        },
        data: {
          type: 'object',
          description: '更新するデータ',
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
      required: ['collection', 'id', 'data'],
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
        filter: {
          type: 'object',
          description: 'フィルター条件（MongoDB形式）',
        },
        data: {
          type: 'object',
          description: '更新するデータ',
        },
      },
      required: ['collection', 'filter', 'data'],
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
        id: {
          type: 'string',
          description: 'レコードID',
        },
      },
      required: ['collection', 'id'],
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
        filter: {
          type: 'object',
          description: 'フィルター条件（MongoDB形式）',
        },
      },
      required: ['collection', 'filter'],
    },
  },
];
