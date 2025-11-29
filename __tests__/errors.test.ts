import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConfigError,
  ErrorCode,
  InvalidFilterError,
  InvalidTokenError,
  ItemNotFoundError,
  PartialFailureError,
  VersionConflictError,
  getErrorClass,
  isAppError,
} from '../src/errors.js';

describe('ErrorCode', () => {
  it('すべてのエラーコードが定義されていること', () => {
    expect(ErrorCode.CONFIG_ERROR).toBe('CONFIG_ERROR');
    expect(ErrorCode.INVALID_FILTER).toBe('INVALID_FILTER');
    expect(ErrorCode.INVALID_TOKEN).toBe('INVALID_TOKEN');
    expect(ErrorCode.ITEM_NOT_FOUND).toBe('ITEM_NOT_FOUND');
    expect(ErrorCode.PARTIAL_FAILURE).toBe('PARTIAL_FAILURE');
    expect(ErrorCode.VERSION_CONFLICT).toBe('VERSION_CONFLICT');
  });
});

describe('AppError', () => {
  it('基本的なエラー情報を保持すること', () => {
    const error = new AppError(ErrorCode.CONFIG_ERROR, 'Test error message', 500, { key: 'value' });

    expect(error.code).toBe(ErrorCode.CONFIG_ERROR);
    expect(error.message).toBe('Test error message');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ key: 'value' });
    expect(error.name).toBe('AppError');
  });

  it('デフォルトのステータスコードが500であること', () => {
    const error = new AppError(ErrorCode.CONFIG_ERROR, 'Test error');
    expect(error.statusCode).toBe(500);
  });

  it('JSON形式に変換できること', () => {
    const error = new AppError(ErrorCode.CONFIG_ERROR, 'Test error', 500, { key: 'value' });

    const json = error.toJSON();
    expect(json).toEqual({
      code: ErrorCode.CONFIG_ERROR,
      message: 'Test error',
      statusCode: 500,
      details: { key: 'value' },
    });
  });

  it('detailsがない場合はJSON変換時に含まれないこと', () => {
    const error = new AppError(ErrorCode.CONFIG_ERROR, 'Test error', 500);

    const json = error.toJSON();
    expect(json).toEqual({
      code: ErrorCode.CONFIG_ERROR,
      message: 'Test error',
      statusCode: 500,
    });
    expect(json).not.toHaveProperty('details');
  });
});

describe('ConfigError', () => {
  it('CONFIG_ERRORコードとステータスコード500を持つこと', () => {
    const error = new ConfigError('Configuration is missing');

    expect(error.code).toBe(ErrorCode.CONFIG_ERROR);
    expect(error.message).toBe('Configuration is missing');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('ConfigError');
  });

  it('詳細情報を保持できること', () => {
    const error = new ConfigError('Invalid config', { field: 'PARAM_PATH' });

    expect(error.details).toEqual({ field: 'PARAM_PATH' });
  });
});

describe('InvalidFilterError', () => {
  it('INVALID_FILTERコードとステータスコード400を持つこと', () => {
    const error = new InvalidFilterError('Invalid sort field: unknown');

    expect(error.code).toBe(ErrorCode.INVALID_FILTER);
    expect(error.message).toBe('Invalid sort field: unknown');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('InvalidFilterError');
  });
});

describe('InvalidTokenError', () => {
  it('INVALID_TOKENコードとステータスコード400を持つこと', () => {
    const error = new InvalidTokenError('Failed to decode nextToken');

    expect(error.code).toBe(ErrorCode.INVALID_TOKEN);
    expect(error.message).toBe('Failed to decode nextToken');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('InvalidTokenError');
  });
});

describe('ItemNotFoundError', () => {
  it('ITEM_NOT_FOUNDコードとステータスコード404を持つこと', () => {
    const error = new ItemNotFoundError('Record not found');

    expect(error.code).toBe(ErrorCode.ITEM_NOT_FOUND);
    expect(error.message).toBe('Record not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ItemNotFoundError');
  });

  it('見つからなかったIDを詳細情報に含められること', () => {
    const error = new ItemNotFoundError('Record not found', {
      id: '01HZXY123456789ABCDEFGHIJK',
    });

    expect(error.details).toEqual({ id: '01HZXY123456789ABCDEFGHIJK' });
  });
});

describe('PartialFailureError', () => {
  it('PARTIAL_FAILUREコードとステータスコード207を持つこと', () => {
    const failedIds = ['id1', 'id2'];
    const errors = [
      { id: 'id1', code: 'VALIDATION_ERROR', message: 'Invalid data' },
      { id: 'id2', code: 'CONFLICT', message: 'Already exists' },
    ];

    const error = new PartialFailureError('Some operations failed', failedIds, errors);

    expect(error.code).toBe(ErrorCode.PARTIAL_FAILURE);
    expect(error.message).toBe('Some operations failed');
    expect(error.statusCode).toBe(207);
    expect(error.name).toBe('PartialFailureError');
    expect(error.failedIds).toEqual(failedIds);
    expect(error.errors).toEqual(errors);
  });

  it('失敗情報がdetailsに含まれること', () => {
    const failedIds = ['id1'];
    const errors = [{ id: 'id1', code: 'ERROR', message: 'Failed' }];

    const error = new PartialFailureError('Partial failure', failedIds, errors);

    expect(error.details).toEqual({
      failedIds,
      errors,
    });
  });

  it('追加の詳細情報を含められること', () => {
    const failedIds = ['id1'];
    const errors = [{ id: 'id1', code: 'ERROR', message: 'Failed' }];

    const error = new PartialFailureError('Partial failure', failedIds, errors, {
      resource: 'articles',
    });

    expect(error.details).toEqual({
      resource: 'articles',
      failedIds,
      errors,
    });
  });
});

describe('VersionConflictError', () => {
  it('VERSION_CONFLICTコードとステータスコード409を持つこと', () => {
    const error = new VersionConflictError('Record was modified by another request');

    expect(error.code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(error.message).toBe('Record was modified by another request');
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe('VersionConflictError');
  });
});

describe('isAppError', () => {
  it('AppErrorインスタンスに対してtrueを返すこと', () => {
    const error = new AppError(ErrorCode.CONFIG_ERROR, 'Test');
    expect(isAppError(error)).toBe(true);
  });

  it('ConfigErrorインスタンスに対してtrueを返すこと', () => {
    const error = new ConfigError('Test');
    expect(isAppError(error)).toBe(true);
  });

  it('通常のErrorに対してfalseを返すこと', () => {
    const error = new Error('Test');
    expect(isAppError(error)).toBe(false);
  });

  it('nullに対してfalseを返すこと', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('undefinedに対してfalseを返すこと', () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it('文字列に対してfalseを返すこと', () => {
    expect(isAppError('error')).toBe(false);
  });
});

describe('getErrorClass', () => {
  it('CONFIG_ERRORに対してConfigErrorクラスを返すこと', () => {
    const ErrorClass = getErrorClass(ErrorCode.CONFIG_ERROR);
    const error = new ErrorClass('Test');
    expect(error).toBeInstanceOf(ConfigError);
  });

  it('INVALID_FILTERに対してInvalidFilterErrorクラスを返すこと', () => {
    const ErrorClass = getErrorClass(ErrorCode.INVALID_FILTER);
    const error = new ErrorClass('Test');
    expect(error).toBeInstanceOf(InvalidFilterError);
  });

  it('INVALID_TOKENに対してInvalidTokenErrorクラスを返すこと', () => {
    const ErrorClass = getErrorClass(ErrorCode.INVALID_TOKEN);
    const error = new ErrorClass('Test');
    expect(error).toBeInstanceOf(InvalidTokenError);
  });

  it('ITEM_NOT_FOUNDに対してItemNotFoundErrorクラスを返すこと', () => {
    const ErrorClass = getErrorClass(ErrorCode.ITEM_NOT_FOUND);
    const error = new ErrorClass('Test');
    expect(error).toBeInstanceOf(ItemNotFoundError);
  });

  it('VERSION_CONFLICTに対してVersionConflictErrorクラスを返すこと', () => {
    const ErrorClass = getErrorClass(ErrorCode.VERSION_CONFLICT);
    const error = new ErrorClass('Test');
    expect(error).toBeInstanceOf(VersionConflictError);
  });
});
