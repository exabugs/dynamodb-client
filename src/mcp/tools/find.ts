/**
 * dynamodb_find ツール定義
 * DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_find ツール
 * 
 * DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。
 */
export const findTool: Tool = {
  "name": "dynamodb_find",
  "description": "DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "collection": {
        "type": "string",
        "description": "コレクション名（例: venues, users）"
      },
      "filter": {
        "type": "object",
        "description": "フィルター条件（MongoDB形式）。例: { status: \"active\", age: { $gte: 18 } }"
      },
      "sort": {
        "type": "object",
        "description": "ソート条件",
        "properties": {
          "field": {
            "type": "string",
            "description": "ソート対象フィールド名"
          },
          "order": {
            "type": "string",
            "enum": [
              "ASC",
              "DESC"
            ],
            "description": "ソート順序（ASC: 昇順, DESC: 降順）"
          }
        },
        "required": [
          "field",
          "order"
        ]
      },
      "pagination": {
        "type": "object",
        "description": "ページネーション設定",
        "properties": {
          "perPage": {
            "type": "number",
            "description": "1ページあたりの件数（最大50件）",
            "minimum": 1,
            "maximum": 50
          },
          "nextToken": {
            "type": "string",
            "description": "次ページトークン（前回のレスポンスから取得）"
          }
        }
      }
    },
    "required": [
      "collection"
    ]
  }
};
