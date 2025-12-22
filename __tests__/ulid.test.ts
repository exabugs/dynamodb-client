import { describe, expect, it } from 'vitest';

import { decodeTime, ulid, ulidWithTime } from '../src/shared/index.js';

describe('ulid', () => {
  it('ULIDを生成できること', () => {
    const id = ulid();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(26);
  });

  it('生成されたULIDが大文字英数字のみで構成されていること', () => {
    const id = ulid();
    // Crockford's Base32: 0-9, A-Z (I, L, O, Uを除く)
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('連続して生成されたULIDが異なること', () => {
    const id1 = ulid();
    const id2 = ulid();
    expect(id1).not.toBe(id2);
  });

  it('連続して生成されたULIDが辞書順でソート可能であること', () => {
    // 異なるタイムスタンプで生成されたULIDは辞書順でソート可能
    const timestamp1 = Date.now() - 1000;
    const timestamp2 = Date.now();

    const id1 = ulidWithTime(timestamp1);
    const id2 = ulidWithTime(timestamp2);

    expect(id1 < id2).toBe(true);
  });
});

describe('ulidWithTime', () => {
  it('指定されたタイムスタンプでULIDを生成できること', () => {
    const timestamp = Date.now();
    const id = ulidWithTime(timestamp);

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(26);
  });

  it('同じタイムスタンプで生成されたULIDが異なること', () => {
    const timestamp = Date.now();
    const id1 = ulidWithTime(timestamp);
    const id2 = ulidWithTime(timestamp);

    expect(id1).not.toBe(id2);
  });

  it('古いタイムスタンプで生成されたULIDが辞書順で前に来ること', () => {
    const oldTimestamp = Date.now() - 10000;
    const newTimestamp = Date.now();

    const oldId = ulidWithTime(oldTimestamp);
    const newId = ulidWithTime(newTimestamp);

    expect(oldId < newId).toBe(true);
  });
});

describe('decodeTime', () => {
  it('ULIDからタイムスタンプを抽出できること', () => {
    const timestamp = Date.now();
    const id = ulidWithTime(timestamp);
    const decoded = decodeTime(id);

    expect(decoded).toBe(timestamp);
  });

  it('現在時刻で生成されたULIDのタイムスタンプが妥当であること', () => {
    const before = Date.now();
    const id = ulid();
    const after = Date.now();

    const decoded = decodeTime(id);

    expect(decoded).toBeGreaterThanOrEqual(before);
    expect(decoded).toBeLessThanOrEqual(after);
  });

  it('無効なULID文字列でエラーをスローすること', () => {
    expect(() => decodeTime('INVALID_ULID_WITH_BAD_CHARS!')).toThrow('Invalid ULID character');
  });
});
