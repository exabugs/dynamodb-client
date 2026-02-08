/**
 * dynamodb_findManyReference ツール定義
 * DynamoDBから参照フィールドで関連レコードを取得します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_findManyReference ツール
 * 
 * DynamoDBから参照フィールドで関連レコードを取得します。
 */
export const findManyReferenceTool: Tool = {
  "name": "dynamodb_findManyReference",
  "description": "DynamoDBから参照フィールドで関連レコードを取得します。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "collection": {
        "type": "string",
        "description": "コレクション名（例: venues, users）"
      },
      "target": {
        "type": "string",
        "description": "参照フィールド名（例: userId）"
      },
      "id": {
        "type": "string",
        "description": "レコードID"
      },
      "filter": {
        "type": "object",
        "description": "フィルター条件（MongoDB形式）。例: { status: \"active\", age: { $gte: 18 } }"
      }
    },
    "required": [
      "collection"
    ]
  }
};
