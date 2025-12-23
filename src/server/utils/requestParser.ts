/**
 * リクエストパーサー
 *
 * HTTPリクエストボディをパースしてAPIリクエスト形式に変換する
 */
import type { ApiOperation, ApiRequest } from '../types.js';

/**
 * MongoDB風APIリクエスト
 */
interface MongoDBStyleRequest {
  operation: string;
  collection: string;
  params: unknown;
}

/**
 * リクエストボディをパースする（MongoDB風API）
 *
 * @param body - HTTPリクエストボディ（JSON文字列）
 * @returns パース済みリクエスト
 * @throws {Error} パースに失敗した場合
 */
export function parseRequestBody(body: string | undefined): ApiRequest {
  if (!body) {
    throw new Error('Request body is required');
  }

  try {
    const parsed = JSON.parse(body) as MongoDBStyleRequest;

    // 必須フィールドの検証
    if (!parsed.operation) {
      throw new Error('Missing required field: operation');
    }
    if (!parsed.collection) {
      throw new Error('Missing required field: collection');
    }
    if (parsed.params === undefined) {
      throw new Error('Missing required field: params');
    }

    // MongoDB風のoperation名をそのまま使用（変換なし）
    const op = parsed.operation as ApiOperation;

    return {
      op,
      resource: parsed.collection,
      params: parsed.params,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in request body');
    }
    throw error;
  }
}