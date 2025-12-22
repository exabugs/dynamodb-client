/**
 * AWS Lambda関連の定数
 */

/**
 * Lambda実行時間制限（ミリ秒）
 * AWS Lambdaの最大実行時間は15分（900秒）
 */
export const LAMBDA_TIMEOUT_MS = 15 * 60 * 1000; // 15分

/**
 * 警告を出すレコード数の閾値
 * この数を超えるとタイムアウトリスクの警告を出力
 */
export const LARGE_BATCH_WARNING_THRESHOLD = 1000;

/**
 * タイムアウトリスク判定の閾値（残り時間の割合）
 * 残り時間がこの割合未満になると高リスクと判定
 */
export const TIMEOUT_RISK_THRESHOLD = 0.2; // 20%

/**
 * Lambda関数の最大ペイロードサイズ（バイト）
 * 同期呼び出しの場合は6MB、非同期呼び出しの場合は256KB
 */
export const LAMBDA_MAX_PAYLOAD_SIZE_SYNC = 6 * 1024 * 1024; // 6MB
export const LAMBDA_MAX_PAYLOAD_SIZE_ASYNC = 256 * 1024; // 256KB

/**
 * Lambda関数の最大レスポンスサイズ（バイト）
 */
export const LAMBDA_MAX_RESPONSE_SIZE = 6 * 1024 * 1024; // 6MB

/**
 * Lambda関数の最大環境変数サイズ（バイト）
 */
export const LAMBDA_MAX_ENV_VARS_SIZE = 4 * 1024; // 4KB