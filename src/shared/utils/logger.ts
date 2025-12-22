/**
 * 構造化ロガー
 * 
 * JSON形式で構造化されたログを出力するロガーを提供します。
 * CloudWatch Logsで解析可能な形式でログを出力します。
 */

/**
 * ログレベル
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * ログメタデータ
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * ロガー設定オプション
 */
export interface LoggerConfig {
  /**
   * ログレベル（デフォルト: 'info'）
   */
  level?: LogLevel;
  /**
   * サービス名（ログに含まれる）
   */
  service?: string;
  /**
   * 環境名（ログに含まれる）
   */
  env?: string;
}

/**
 * 構造化ロガーインターフェース
 */
export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
}

/**
 * ログレベルの優先順位
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * JSON形式で構造化ログを出力するロガーを作成する
 *
 * このロガーは、CloudWatch Logsで解析可能なJSON形式でログを出力する。
 * 各ログエントリには、タイムスタンプ、レベル、メッセージ、およびオプションのメタデータが含まれる。
 *
 * @param config - ロガー設定オプション
 * @returns 構造化ロガーインスタンス
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   level: 'info',
 *   service: 'records-lambda',
 *   env: 'dev'
 * });
 *
 * logger.info('Processing request', { requestId: '123', resource: 'articles' });
 * // 出力: {"timestamp":"2025-11-12T10:00:00.000Z","level":"info","message":"Processing request","service":"records-lambda","env":"dev","requestId":"123","resource":"articles"}
 *
 * logger.error('Failed to process', { error: err.message });
 * ```
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  const {
    level = (process.env.LOG_LEVEL as LogLevel) || 'info',
    service = process.env.SERVICE_NAME,
    env = process.env.ENV,
  } = config;

  const minLevel = LOG_LEVELS[level];

  /**
   * ログエントリを出力する内部関数
   */
  function log(logLevel: LogLevel, message: string, metadata?: LogMetadata): void {
    // 設定されたログレベルより低い場合はスキップ
    if (LOG_LEVELS[logLevel] < minLevel) {
      return;
    }

    // JSON形式のログエントリを構築
    const logEntry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      message,
    };

    // サービス名を追加
    if (service) {
      logEntry.service = service;
    }

    // 環境名を追加
    if (env) {
      logEntry.env = env;
    }

    // メタデータを追加
    if (metadata) {
      Object.assign(logEntry, metadata);
    }

    // JSON文字列として出力
    const output = JSON.stringify(logEntry);

    // ログレベルに応じて適切なストリームに出力
    if (logLevel === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  return {
    debug(message: string, metadata?: LogMetadata): void {
      log('debug', message, metadata);
    },
    info(message: string, metadata?: LogMetadata): void {
      log('info', message, metadata);
    },
    warn(message: string, metadata?: LogMetadata): void {
      log('warn', message, metadata);
    },
    error(message: string, metadata?: LogMetadata): void {
      log('error', message, metadata);
    },
  };
}