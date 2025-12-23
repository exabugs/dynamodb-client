/**
 * バリデーション関連の定数
 *
 * エラーメッセージやバリデーションパターンの共通定数
 */

/**
 * バリデーションエラーメッセージ
 */
export const VALIDATION_ERROR_MESSAGES = {
  REQUEST_BODY_REQUIRED: 'Request body is required',
  INVALID_JSON: 'Invalid JSON in request body',
  MISSING_OPERATION: 'Missing required field: operation',
  MISSING_COLLECTION: 'Missing required field: collection',
  MISSING_PARAMS: 'Missing required field: params',
  MISSING_TOKEN_FIELDS: 'Missing required fields in token payload',
} as const;

/**
 * バリデーションエラーパターン
 * エラーメッセージからバリデーションエラーを判定するためのパターン
 */
export const VALIDATION_ERROR_PATTERNS = [
  'Missing required field',
  'Invalid JSON',
  'Request body is required',
  'requires filter.id',
  'requires document',
  'requires documents',
] as const;