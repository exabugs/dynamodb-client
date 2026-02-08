/**
 * dynamodb_insertOne ツール定義
 * DynamoDBに単一レコードを作成します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_insertOne ツール
 * 
 * DynamoDBに単一レコードを作成します。
 */
export const insertOneTool: Tool = {
  "name": "dynamodb_insertOne",
  "description": "DynamoDBに単一レコードを作成します。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "collection": {
        "type": "string",
        "description": "コレクション名（例: venues, users）"
      },
      "data": {
        "type": "object",
        "description": "作成または更新するデータ"
      }
    },
    "required": [
      "collection"
    ]
  }
};
