/**
 * リクエストパーサー
 *
 * HTTPリクエストボディをパースしてAPIリクエスト形式に変換する
 */
import { VALIDATION_ERROR_MESSAGES } from '../../shared/constants/validation.js';
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
    throw new Error(VALIDATION_ERROR_MESSAGES.REQUEST_BODY_REQUIRED);
  }

  try {
    const parsed = JSON.parse(body) as MongoDBStyleRequest;

    // 必須フィールドの検証
    if (!parsed.operation) {
      throw new Error(VALIDATION_ERROR_MESSAGES.MISSING_OPERATION);
    }
    if (!parsed.collection) {
      throw new Error(VALIDATION_ERROR_MESSAGES.MISSING_COLLECTION);
    }
    if (parsed.params === undefined) {
      throw new Error(VALIDATION_ERROR_MESSAGES.MISSING_PARAMS);
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
      throw new Error(VALIDATION_ERROR_MESSAGES.INVALID_JSON);
    }
    throw error;
  }
}