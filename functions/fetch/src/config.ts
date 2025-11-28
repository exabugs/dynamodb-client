/**
 * Fetch Lambda 設定管理
 *
 * 環境変数の検証と設定値の提供
 */

/**
 * 環境変数の型定義
 */
export interface FetchLambdaConfig {
  /** 環境識別子（dev/stg/prd） */
  env: string;
  /** AWSリージョン */
  region: string;
  /** SSM Parameter Storeパス */
  paramPath: string;
  /** Records Lambda関数名 */
  recordsFunctionName: string;
  /** ログレベル */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 環境変数を検証して設定オブジェクトを返す
 *
 * @throws {Error} 必須の環境変数が設定されていない場合
 */
export function getConfig(): FetchLambdaConfig {
  const env = process.env.ENV;
  const region = process.env.REGION || process.env.AWS_REGION;
  const paramPath = process.env.PARAM_PATH;
  const recordsFunctionName = process.env.RECORDS_FUNCTION_NAME;
  const logLevel = (process.env.LOG_LEVEL || 'info') as FetchLambdaConfig['logLevel'];

  // 必須環境変数の検証
  if (!env) {
    throw new Error('ENV environment variable is required');
  }

  if (!region) {
    throw new Error('REGION or AWS_REGION environment variable is required');
  }

  if (!paramPath) {
    throw new Error('PARAM_PATH environment variable is required');
  }

  if (!recordsFunctionName) {
    throw new Error('RECORDS_FUNCTION_NAME environment variable is required');
  }

  return {
    env,
    region,
    paramPath,
    recordsFunctionName,
    logLevel,
  };
}

/**
 * ログレベルに応じてログを出力する
 */
export function log(level: FetchLambdaConfig['logLevel'], message: string, meta?: any): void {
  const config = getConfig();
  const levels: FetchLambdaConfig['logLevel'][] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(config.logLevel);
  const messageLevelIndex = levels.indexOf(level);

  if (messageLevelIndex >= currentLevelIndex) {
    const logData = meta ? { message, ...meta } : message;
    console.log(JSON.stringify({ level, ...logData }));
  }
}
