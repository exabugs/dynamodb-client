/**
 * sign.ts のユニットテスト
 *
 * テスト専用に生成した使い捨てRSA鍵（本番・いかなる環境でも使用しない）で
 * 実際にCloudFront Canned Policy署名を計算し、URL構造・有効期限の丸め込みを検証する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signMediaUrl } from '../../../src/server/media/sign.js';

// テスト専用使い捨て鍵（本番非使用）
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDTwpPDKAHiynlV
gpGUqwR/WXIxaTQj2Gt7WuwH1JoKSz3/n77upEZNNhNK5cLhfRsr/1Xy4Xm6hJnE
VilU7t+iaaQaFnxyEoYPeuV1MKMiXN4DfPlCsahY/TOP6oaF8c98NMljH7U0QhLe
uQAQJ/jFlZMUwR5l5Is0kPNU2VnF3EM8FPYXaUzqch1pD6JMJfy6BqMMLeLDrMYh
JJHJTeaP80n2lPrnpXNDOd50UFQN8+u6FmfsDPggnvTgqX6qhjhd6gNTl26Lz3Fi
h44qPavwDp+JRi6aziLdXFC1oaVtOKwY2kO9R2BXyz53WptKPH75e4D10ME3O9IZ
JfEmpIV5AgMBAAECggEAFxzIpedK9WbmAVhD7XcRAZlQpmX2I+duK8OLuXsR6Qe3
V5wm6cMSTUEWr/kN4TCXc6Dlz6GeeKYaZlyFHFkKHZ7sI1DK+mRdL3lZbAYH+Css
rDLKveXIGxZft1iAoEP5QnQ8es4uJ+sCRj7o69qBA4fEyuIdID/mlbEwbdVfQAIM
eC2/l7LcI8VhMp5jmUIpkqjOuIu0KUDzInIUUTNS93MSQG65r8J1ppxDhPST3OyE
blBWLoPI4KPPR/CElZ8EZa8cfPFX0O46Aj1IzXZMgsmVljvQr/h39YCuKSCFA82B
cnfSINpqeOL/jvTw+gaf6uM/6cO8Rv5LGSnEFxY8gQKBgQD7GFWztd0hbvcSLZa0
waCYHCTg7HQ+js5Ugkii4iMIJafH/T7Fbbqy0utAjAGCw+elzNjaXIjR3oF2ndo1
0CXxfeIQPlUUF0VMYC98uY6QY02juYgWBdwX32+JHqqW6FC4tAYL2/aMvSpcNR9w
8yjR6uifVUc/3rJoFTekAMDCqQKBgQDX5YmnwXttIgZfTRhut4RA+iH8e8J96eL5
pBzKrKETEbci74gF7kxViK697lEmfD8d66NkKGimOaT1RNtc0YO+R0zovPAC1WI0
vV4mmcQwO53KG1nIIqpAmui/XXaasZ+4IL+VFjp7hBmoCAUgSNjXMsApa3BFuxRq
gARNebI+UQKBgFS4ATKBSfrd1b7sYszaB7VKyaaaIR56UGNzEc7jPa6iBdoUN/mk
7DkpsPY2Rsw4DRCD7Sa/0en9iPDckaNWd3bjYkLYxRviPh9m1J7gfJl659c14hSM
JZZobNl231fLSnEHTILz1Fvn90LlKZaSdFNfTt1ziHakTM2RWxSarG8BAoGBANYv
2QNfBo5cpSnDGKwu0LyN603LkkbM1OuKDy5bWWnLt36nWLFZms14zrOLTWL6/Ls4
XV8uX7QZmDfkWiSZjzQlFH4Jg6ur+sQL4u40utiHLKGnxMiy62kwxhukI9iQw74u
byL/bIHBqppzanJ/EvFcXhw5hKcJVNXbr2kVhOohAoGBAPoiKTdinnQaDTpTjFP2
eU3D3UARsOJDl6fnCoGoEOvRk7RzKhdylM2ptv0grshJoFYiSQQ173pBz8OxzBRD
2m9k1IlvKaE0cywjZnGQWfw/o2+ris6+ymHpyZTdrDcdEf4rk11qIWzSCYM39La3
cP25MXeE8BBBdAkp8mZtKxfo
-----END PRIVATE KEY-----`;

describe('signMediaUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('widthを指定した場合は /resize/{fileId}?width=N に署名する', () => {
    vi.setSystemTime(new Date('2026-01-01T10:15:00.000Z'));

    const result = signMediaUrl({
      fileId: 'file-1',
      width: 320,
      keyPairId: 'KPID123',
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: 'https://media.example.com',
      expiresInSeconds: 3600,
    });

    expect(result.url.startsWith('https://media.example.com/resize/file-1?width=320')).toBe(true);
    expect(result.url).toContain('Key-Pair-Id=KPID123');
    expect(result.url).toContain('Expires=');
    expect(result.url).toContain('Signature=');
  });

  it('widthを省略した場合は /master/{fileId} に署名する', () => {
    vi.setSystemTime(new Date('2026-01-01T10:15:00.000Z'));

    const result = signMediaUrl({
      fileId: 'file-1',
      keyPairId: 'KPID123',
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: 'https://media.example.com',
      expiresInSeconds: 3600,
    });

    expect(result.url.startsWith('https://media.example.com/master/file-1')).toBe(true);
    expect(result.url).not.toContain('/resize/');
  });

  it('baseUrlの末尾スラッシュを許容する', () => {
    vi.setSystemTime(new Date('2026-01-01T10:15:00.000Z'));

    const result = signMediaUrl({
      fileId: 'file-1',
      keyPairId: 'KPID123',
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: 'https://media.example.com/',
      expiresInSeconds: 3600,
    });

    expect(result.url.startsWith('https://media.example.com/master/file-1')).toBe(true);
    expect(result.url).not.toContain('.com//master');
  });

  it('有効期限は「現在時刻+TTL」を粒度（TTL）単位に切り上げる', () => {
    // 10:15:00 + TTL(3600秒) = 11:15:00 → 3600秒粒度で切り上げ → 12:00:00
    vi.setSystemTime(new Date('2026-01-01T10:15:00.000Z'));

    const result = signMediaUrl({
      fileId: 'file-1',
      keyPairId: 'KPID123',
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: 'https://media.example.com',
      expiresInSeconds: 3600,
    });

    const expectedExpiresAt = Math.floor(new Date('2026-01-01T12:00:00.000Z').getTime() / 1000);
    expect(result.expiresAt).toBe(expectedExpiresAt);
  });

  it('TTL境界の直前に発行しても、有効期間がTTLより短くならない（回帰テスト）', () => {
    // 10:59:59 発行、TTL=3600秒。「現在時刻を切り上げる」実装だと11:00:00になり
    // 有効期間が1秒になってしまう。正しくは [TTL, 2*TTL) の範囲を保証する。
    vi.setSystemTime(new Date('2026-01-01T10:59:59.000Z'));

    const result = signMediaUrl({
      fileId: 'file-1',
      keyPairId: 'KPID123',
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: 'https://media.example.com',
      expiresInSeconds: 3600,
    });

    const issuedAt = Math.floor(new Date('2026-01-01T10:59:59.000Z').getTime() / 1000);
    expect(result.expiresAt - issuedAt).toBeGreaterThanOrEqual(3600);
    expect(result.expiresAt - issuedAt).toBeLessThan(7200);
  });

  it('同じ時間帯内であれば同一のExpiresになる（ブラウザキャッシュが効く）', () => {
    vi.setSystemTime(new Date('2026-01-01T10:05:00.000Z'));
    const r1 = signMediaUrl({
      fileId: 'file-1',
      width: 320,
      keyPairId: 'KPID123',
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: 'https://media.example.com',
      expiresInSeconds: 3600,
    });

    vi.setSystemTime(new Date('2026-01-01T10:45:00.000Z'));
    const r2 = signMediaUrl({
      fileId: 'file-1',
      width: 320,
      keyPairId: 'KPID123',
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: 'https://media.example.com',
      expiresInSeconds: 3600,
    });

    expect(r1.expiresAt).toBe(r2.expiresAt);
    expect(r1.url).toBe(r2.url);
  });

  it('widthが1未満の場合は拒否する', () => {
    expect(() =>
      signMediaUrl({
        fileId: 'file-1',
        width: 0,
        keyPairId: 'KPID123',
        privateKey: TEST_PRIVATE_KEY,
        baseUrl: 'https://media.example.com',
        expiresInSeconds: 3600,
      })
    ).toThrow('Invalid width');
  });
});
