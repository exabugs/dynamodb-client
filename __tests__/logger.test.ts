import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../src/logger.js';

describe('createLogger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // console.logとconsole.errorをスパイ
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // スパイをリストア
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('JSON形式でログを出力する', () => {
    const logger = createLogger({ level: 'info' });
    logger.info('Test message');

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      level: 'info',
      message: 'Test message',
    });
    expect(parsed.timestamp).toBeDefined();
  });

  it('メタデータを含むログを出力する', () => {
    const logger = createLogger({ level: 'info' });
    logger.info('Test message', { requestId: '123', resource: 'articles' });

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      level: 'info',
      message: 'Test message',
      requestId: '123',
      resource: 'articles',
    });
  });

  it('サービス名と環境名を含むログを出力する', () => {
    const logger = createLogger({
      level: 'info',
      service: 'records-lambda',
      env: 'dev',
    });
    logger.info('Test message');

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      level: 'info',
      message: 'Test message',
      service: 'records-lambda',
      env: 'dev',
    });
  });

  it('debugレベルのログを出力する', () => {
    const logger = createLogger({ level: 'debug' });
    logger.debug('Debug message');

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe('debug');
    expect(parsed.message).toBe('Debug message');
  });

  it('warnレベルのログを出力する', () => {
    const logger = createLogger({ level: 'warn' });
    logger.warn('Warning message');

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('Warning message');
  });

  it('errorレベルのログをconsole.errorに出力する', () => {
    const logger = createLogger({ level: 'error' });
    logger.error('Error message');

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const output = consoleErrorSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Error message');
  });

  it('設定されたログレベルより低いログをフィルタリングする', () => {
    const logger = createLogger({ level: 'warn' });

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    // debugとinfoはフィルタリングされる
    expect(consoleLogSpy).toHaveBeenCalledOnce(); // warn
    expect(consoleErrorSpy).toHaveBeenCalledOnce(); // error
  });

  it('環境変数からログレベルを読み取る', () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'error';

    const logger = createLogger();
    logger.info('Info message');
    logger.error('Error message');

    // infoはフィルタリングされる
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledOnce();

    // 環境変数を元に戻す
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  it('環境変数からサービス名と環境名を読み取る', () => {
    const originalServiceName = process.env.SERVICE_NAME;
    const originalEnv = process.env.ENV;

    process.env.SERVICE_NAME = 'test-service';
    process.env.ENV = 'test';

    const logger = createLogger({ level: 'info' });
    logger.info('Test message');

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.service).toBe('test-service');
    expect(parsed.env).toBe('test');

    // 環境変数を元に戻す
    if (originalServiceName !== undefined) {
      process.env.SERVICE_NAME = originalServiceName;
    } else {
      delete process.env.SERVICE_NAME;
    }
    if (originalEnv !== undefined) {
      process.env.ENV = originalEnv;
    } else {
      delete process.env.ENV;
    }
  });

  it('複雑なメタデータオブジェクトを処理する', () => {
    const logger = createLogger({ level: 'info' });
    logger.info('Complex metadata', {
      nested: { key: 'value' },
      array: [1, 2, 3],
      number: 42,
      boolean: true,
      null: null,
    });

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.nested).toEqual({ key: 'value' });
    expect(parsed.array).toEqual([1, 2, 3]);
    expect(parsed.number).toBe(42);
    expect(parsed.boolean).toBe(true);
    expect(parsed.null).toBeNull();
  });
});
