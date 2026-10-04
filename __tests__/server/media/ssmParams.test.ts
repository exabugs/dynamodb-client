/**
 * ssmParams.ts のユニットテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SSMClient } from '@aws-sdk/client-ssm';

import {
  clearSsmParamsCache,
  getImagePolicy,
  getSigningPrivateKey,
} from '../../../src/server/media/ssmParams.js';

function fakeSsmClient(value: string | undefined): SSMClient {
  return {
    send: vi
      .fn()
      .mockResolvedValue({ Parameter: value !== undefined ? { Value: value } : undefined }),
  } as unknown as SSMClient;
}

describe('ssmParams', () => {
  beforeEach(() => {
    clearSsmParamsCache();
  });

  describe('getImagePolicy', () => {
    it('正しいJSONを取得・パースする', async () => {
      const policy = {
        masterMaxDimension: 4096,
        allowedContentTypes: ['image/jpeg'],
        maxUploadSize: 10_000_000,
      };
      const client = fakeSsmClient(JSON.stringify(policy));

      const result = await getImagePolicy(client, '/app/dev/media/image-policy');
      expect(result).toEqual(policy);
    });

    it('2回目の呼び出しはキャッシュを使いSSMを呼ばない', async () => {
      const policy = {
        masterMaxDimension: 4096,
        allowedContentTypes: ['image/jpeg'],
        maxUploadSize: 10_000_000,
      };
      const client = fakeSsmClient(JSON.stringify(policy));

      await getImagePolicy(client, '/app/dev/media/image-policy');
      await getImagePolicy(client, '/app/dev/media/image-policy');

      expect(client.send).toHaveBeenCalledTimes(1);
    });

    it('fail-closed: パラメータ未登録なら例外を投げる', async () => {
      const client = fakeSsmClient(undefined);
      await expect(getImagePolicy(client, '/app/dev/media/image-policy')).rejects.toThrow(
        'not found'
      );
    });

    it('fail-closed: 不正なJSONなら例外を投げる', async () => {
      const client = fakeSsmClient('not-json{{{');
      await expect(getImagePolicy(client, '/app/dev/media/image-policy')).rejects.toThrow(
        'not valid JSON'
      );
    });

    it('fail-closed: 必須フィールド欠落なら例外を投げる', async () => {
      const client = fakeSsmClient(JSON.stringify({ masterMaxDimension: 4096 }));
      await expect(getImagePolicy(client, '/app/dev/media/image-policy')).rejects.toThrow(
        'invalid shape'
      );
    });
  });

  describe('getSigningPrivateKey', () => {
    it('秘密鍵を取得する', async () => {
      const client = fakeSsmClient('-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----');
      const key = await getSigningPrivateKey(client, '/app/dev/media/private-key');
      expect(key).toContain('BEGIN PRIVATE KEY');
    });

    it('2回目の呼び出しはキャッシュを使う', async () => {
      const client = fakeSsmClient('key-value');
      await getSigningPrivateKey(client, '/app/dev/media/private-key');
      await getSigningPrivateKey(client, '/app/dev/media/private-key');
      expect(client.send).toHaveBeenCalledTimes(1);
    });

    it('fail-closed: パラメータ未登録なら例外を投げる', async () => {
      const client = fakeSsmClient(undefined);
      await expect(getSigningPrivateKey(client, '/app/dev/media/private-key')).rejects.toThrow(
        'not found'
      );
    });
  });
});
