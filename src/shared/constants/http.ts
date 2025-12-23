/**
 * HTTP関連の定数
 *
 * HTTPリクエストやタイムアウトに関する共通定数
 */

/**
 * デフォルトHTTPタイムアウト（ミリ秒）
 * 30秒のタイムアウトを設定
 */
export const DEFAULT_HTTP_TIMEOUT_MS = 30000;

/**
 * HTTPステータスコード
 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
} as const;

/**
 * HTTPメソッド
 */
export const HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS',
} as const;