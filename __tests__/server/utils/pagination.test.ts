/**
 * pagination.ts のユニットテスト
 * nextToken のエンコード/デコード機能をテスト
 */
import { describe, expect, it } from 'vitest';

import { InvalidTokenError } from '../../../src/index.js';
import { decodeNextToken, encodeNextToken } from '../../../src/server/utils/pagination.js';

describe('pagination', () => {
  describe('encodeNextToken', () => {
    it('基本的なPK/SKをエンコードできる', () => {
      const token = encodeNextToken('USER#123', 'PROFILE#456');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('特殊文字を含むPK/SKをエンコードできる', () => {
      const token = encodeNextToken('USER#test@example.com', 'PROFILE#日本語');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('長い文字列をエンコードできる', () => {
      const longPK = 'A'.repeat(1000);
      const longSK = 'B'.repeat(1000);
      const token = encodeNextToken(longPK, longSK);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('Base64URL形式（+, /, = が含まれない）であることを確認', () => {
      const token = encodeNextToken('USER#123', 'PROFILE#456');
      expect(token).not.toContain('+');
      expect(token).not.toContain('/');
      expect(token).not.toContain('=');
    });

    it('同じ入力に対して同じ出力を返す（冪等性）', () => {
      const token1 = encodeNextToken('USER#123', 'PROFILE#456');
      const token2 = encodeNextToken('USER#123', 'PROFILE#456');
      expect(token1).toBe(token2);
    });
  });

  describe('decodeNextToken', () => {
    it('正常なトークンをデコードできる', () => {
      const token = encodeNextToken('USER#123', 'PROFILE#456');
      const payload = decodeNextToken(token);
      expect(payload.PK).toBe('USER#123');
      expect(payload.SK).toBe('PROFILE#456');
    });

    it('特殊文字を含むトークンをデコードできる', () => {
      const token = encodeNextToken('USER#test@example.com', 'PROFILE#日本語');
      const payload = decodeNextToken(token);
      expect(payload.PK).toBe('USER#test@example.com');
      expect(payload.SK).toBe('PROFILE#日本語');
    });

    it('パディングなしのトークンをデコードできる', () => {
      // 実際にエンコードしてパディングを削除したトークンを使用
      const token = encodeNextToken('USER', 'PROFILE');
      const payload = decodeNextToken(token);
      expect(payload.PK).toBe('USER');
      expect(payload.SK).toBe('PROFILE');
    });

    it('パディングありのトークンをデコードできる', () => {
      // 通常のBase64エンコード（パディングあり）をBase64URLに変換
      const base64 = Buffer.from(JSON.stringify({ PK: 'USER#1', SK: 'PROFILE#1' })).toString(
        'base64'
      );
      const token = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const payload = decodeNextToken(token);
      expect(payload.PK).toBe('USER#1');
      expect(payload.SK).toBe('PROFILE#1');
    });

    it('エンコード→デコードで元の値に戻る（往復変換）', () => {
      const originalPK = 'USER#test@example.com';
      const originalSK = 'PROFILE#日本語テスト';

      const token = encodeNextToken(originalPK, originalSK);
      const payload = decodeNextToken(token);

      expect(payload.PK).toBe(originalPK);
      expect(payload.SK).toBe(originalSK);
    });
  });

  describe('decodeNextToken - エラーケース', () => {
    it('不正なBase64文字列でエラーをスローする', () => {
      expect(() => decodeNextToken('!!!invalid!!!')).toThrow(InvalidTokenError);
    });

    it('不正なJSON文字列でエラーをスローする', () => {
      // 有効なBase64だが不正なJSON
      const invalidJson = Buffer.from('not a json').toString('base64');
      const token = invalidJson.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      expect(() => decodeNextToken(token)).toThrow(InvalidTokenError);
    });

    it('PKが欠落している場合にエラーをスローする', () => {
      const invalidPayload = JSON.stringify({ SK: 'PROFILE#456' });
      const token = Buffer.from(invalidPayload)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      expect(() => decodeNextToken(token)).toThrow(InvalidTokenError);
    });

    it('SKが欠落している場合にエラーをスローする', () => {
      const invalidPayload = JSON.stringify({ PK: 'USER#123' });
      const token = Buffer.from(invalidPayload)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      expect(() => decodeNextToken(token)).toThrow(InvalidTokenError);
    });

    it('空文字列のトークンでエラーをスローする', () => {
      expect(() => decodeNextToken('')).toThrow(InvalidTokenError);
    });

    it('PKが空文字列の場合にエラーをスローする', () => {
      const invalidPayload = JSON.stringify({ PK: '', SK: 'PROFILE#456' });
      const token = Buffer.from(invalidPayload)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      expect(() => decodeNextToken(token)).toThrow(InvalidTokenError);
    });

    it('SKが空文字列の場合にエラーをスローする', () => {
      const invalidPayload = JSON.stringify({ PK: 'USER#123', SK: '' });
      const token = Buffer.from(invalidPayload)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      expect(() => decodeNextToken(token)).toThrow(InvalidTokenError);
    });
  });
});
