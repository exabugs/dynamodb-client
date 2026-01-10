/**
 * requestParser.ts のテスト
 *
 * リクエストボディのパース処理をテスト
 */
import { describe, expect, it } from 'vitest';

import { parseRequestBody } from '../../../src/server/utils/requestParser.js';

describe('parseRequestBody', () => {
  it('正常なリクエストボディをパースする', () => {
    const body = JSON.stringify({
      operation: 'findMany',
      collection: 'venues',
      params: { ids: ['123'] },
    });

    const result = parseRequestBody(body);

    expect(result).toEqual({
      op: 'findMany',
      resource: 'venues',
      params: { ids: ['123'] },
    });
  });

  it('bodyがundefinedの場合エラーをスローする', () => {
    expect(() => parseRequestBody(undefined)).toThrow('Request body is required');
  });

  it('不正なJSONの場合エラーをスローする', () => {
    expect(() => parseRequestBody('invalid json')).toThrow('Invalid JSON in request body');
  });

  it('operationが欠けている場合エラーをスローする', () => {
    const body = JSON.stringify({
      collection: 'venues',
      params: { ids: ['123'] },
    });

    expect(() => parseRequestBody(body)).toThrow('Missing required field: operation');
  });

  it('collectionが欠けている場合エラーをスローする', () => {
    const body = JSON.stringify({
      operation: 'findMany',
      params: { ids: ['123'] },
    });

    expect(() => parseRequestBody(body)).toThrow('Missing required field: collection');
  });

  it('paramsが欠けている場合エラーをスローする', () => {
    const body = JSON.stringify({
      operation: 'findMany',
      collection: 'venues',
    });

    expect(() => parseRequestBody(body)).toThrow('Missing required field: params');
  });

  it('paramsが空オブジェクトの場合は正常にパースする', () => {
    const body = JSON.stringify({
      operation: 'findMany',
      collection: 'venues',
      params: {},
    });

    const result = parseRequestBody(body);

    expect(result).toEqual({
      op: 'findMany',
      resource: 'venues',
      params: {},
    });
  });
});
