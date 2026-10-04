/**
 * magicBytes.ts のユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { isProcessableImage, verifyMagicBytes } from '../../../src/server/media/magicBytes.js';

describe('verifyMagicBytes', () => {
  it('正しいJPEGマジックナンバーを認める', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(verifyMagicBytes('image/jpeg', buf)).toBe(true);
  });

  it('JPEGと偽ってPNGバイト列を送った場合は拒否する', () => {
    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(verifyMagicBytes('image/jpeg', pngBuf)).toBe(false);
  });

  it('正しいPNGマジックナンバーを認める', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(verifyMagicBytes('image/png', buf)).toBe(true);
  });

  it('WEBPのRIFF+WEBPシグネチャを両方照合する', () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
      Buffer.from([0, 0, 0, 0]), // size (don't care)
      Buffer.from([0x57, 0x45, 0x42, 0x50]), // WEBP
    ]);
    expect(verifyMagicBytes('image/webp', buf)).toBe(true);
  });

  it('WEBPでRIFFはあるがWEBP識別子が無い場合は拒否する', () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from([0x41, 0x56, 0x49, 0x20]), // "AVI "
    ]);
    expect(verifyMagicBytes('image/webp', buf)).toBe(false);
  });

  it('短すぎるバッファは拒否する', () => {
    expect(verifyMagicBytes('image/png', Buffer.from([0x89, 0x50]))).toBe(false);
  });

  it('未知のcontentTypeは常に一致扱いにする（非画像は別の対策で守るため）', () => {
    expect(verifyMagicBytes('application/pdf', Buffer.from([0x01, 0x02]))).toBe(true);
  });
});

describe('isProcessableImage', () => {
  it('image/jpegは処理対象', () => {
    expect(isProcessableImage('image/jpeg')).toBe(true);
  });

  it('image/svg+xmlは処理対象外（XSSリスクのため非画像扱い）', () => {
    expect(isProcessableImage('image/svg+xml')).toBe(false);
  });

  it('非画像は処理対象外', () => {
    expect(isProcessableImage('application/pdf')).toBe(false);
  });
});
