/**
 * presign.ts のユニットテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { S3Client } from '@aws-sdk/client-s3';

import { generatePresignedUpload } from '../../../src/server/media/presign.js';

const createPresignedPostMock = vi.fn().mockResolvedValue({
  url: 'https://bucket.s3.amazonaws.com/',
  fields: { key: 'raw/fileId', policy: 'xxx', 'x-amz-signature': 'yyy' },
});
vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: (...args: unknown[]) => createPresignedPostMock(...args),
}));

describe('generatePresignedUpload', () => {
  const s3Client = {} as S3Client;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('許可されたcontentTypeなら presign を発行する', async () => {
    const result = await generatePresignedUpload({
      s3Client,
      bucket: 'test-bucket',
      contentType: 'image/jpeg',
      fileSize: 1000,
      allowedContentTypes: ['image/jpeg', 'image/png'],
      maxUploadSize: 10_000_000,
      metadata: { 'owner-id': 'user-1' },
    });

    expect(result.fileId).toBeTruthy();
    expect(result.uploadUrl).toBe('https://bucket.s3.amazonaws.com/');
    expect(createPresignedPostMock).toHaveBeenCalledTimes(1);
  });

  it('許可されていないcontentTypeを拒否する', async () => {
    await expect(
      generatePresignedUpload({
        s3Client,
        bucket: 'test-bucket',
        contentType: 'application/x-executable',
        fileSize: 1000,
        allowedContentTypes: ['image/jpeg'],
        maxUploadSize: 10_000_000,
        metadata: {},
      })
    ).rejects.toThrow('Content type not allowed');
    expect(createPresignedPostMock).not.toHaveBeenCalled();
  });

  it('maxUploadSizeを超えるfileSizeを拒否する', async () => {
    await expect(
      generatePresignedUpload({
        s3Client,
        bucket: 'test-bucket',
        contentType: 'image/jpeg',
        fileSize: 20_000_000,
        allowedContentTypes: ['image/jpeg'],
        maxUploadSize: 10_000_000,
        metadata: {},
      })
    ).rejects.toThrow('File size out of range');
    expect(createPresignedPostMock).not.toHaveBeenCalled();
  });

  it('fileSizeが0以下の場合を拒否する', async () => {
    await expect(
      generatePresignedUpload({
        s3Client,
        bucket: 'test-bucket',
        contentType: 'image/jpeg',
        fileSize: 0,
        allowedContentTypes: ['image/jpeg'],
        maxUploadSize: 10_000_000,
        metadata: {},
      })
    ).rejects.toThrow('File size out of range');
  });

  it('クライアント指定のメタデータをeq条件としてpolicyに固定する（サーバー側が値を強制する）', async () => {
    await generatePresignedUpload({
      s3Client,
      bucket: 'test-bucket',
      contentType: 'image/jpeg',
      fileSize: 1000,
      allowedContentTypes: ['image/jpeg'],
      maxUploadSize: 10_000_000,
      metadata: { 'owner-id': 'user-1', 'venue-id': 'venue-1' },
    });

    const callArgs = createPresignedPostMock.mock.calls[0][1];
    expect(callArgs.Fields['x-amz-meta-owner-id']).toBe('user-1');
    expect(callArgs.Fields['x-amz-meta-venue-id']).toBe('venue-1');
    expect(callArgs.Conditions).toContainEqual({ 'x-amz-meta-owner-id': 'user-1' });
    expect(callArgs.Conditions).toContainEqual({ 'x-amz-meta-venue-id': 'venue-1' });
  });

  it('大文字を含むメタデータキーは拒否する（S3がキーを小文字化するため、サイレントな不一致を防ぐ）', async () => {
    await expect(
      generatePresignedUpload({
        s3Client,
        bucket: 'test-bucket',
        contentType: 'image/jpeg',
        fileSize: 1000,
        allowedContentTypes: ['image/jpeg'],
        maxUploadSize: 10_000_000,
        metadata: { ownerId: 'user-1' },
      })
    ).rejects.toThrow('Invalid metadata key');
    expect(createPresignedPostMock).not.toHaveBeenCalled();
  });

  it('originalFilenameを指定した場合はメタデータに含める', async () => {
    await generatePresignedUpload({
      s3Client,
      bucket: 'test-bucket',
      contentType: 'image/jpeg',
      originalFilename: 'photo.jpg',
      fileSize: 1000,
      allowedContentTypes: ['image/jpeg'],
      maxUploadSize: 10_000_000,
      metadata: {},
    });

    const callArgs = createPresignedPostMock.mock.calls[0][1];
    expect(callArgs.Fields['x-amz-meta-original-filename']).toBe('photo.jpg');
  });

  it('Keyが raw/{fileId} になっている', async () => {
    await generatePresignedUpload({
      s3Client,
      bucket: 'test-bucket',
      contentType: 'image/jpeg',
      fileSize: 1000,
      allowedContentTypes: ['image/jpeg'],
      maxUploadSize: 10_000_000,
      metadata: {},
    });

    const callArgs = createPresignedPostMock.mock.calls[0][1];
    expect(callArgs.Key).toMatch(/^raw\//);
  });
});
