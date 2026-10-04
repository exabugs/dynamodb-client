/**
 * process-handler.ts のユニットテスト
 *
 * S3/sharp/handleUpdateOne/ssmParamsをすべてモックし、分岐ロジック
 * （画像/非画像、マジックナンバー不一致、image policy適用）を検証する。
 */
import type { S3Event } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s3SendMock = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: s3SendMock })),
  HeadObjectCommand: vi.fn().mockImplementation((input) => ({ __type: 'HeadObject', input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ __type: 'GetObject', input })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ __type: 'PutObject', input })),
  CopyObjectCommand: vi.fn().mockImplementation((input) => ({ __type: 'CopyObject', input })),
}));

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn().mockImplementation(() => ({})),
  GetParameterCommand: vi.fn().mockImplementation((input) => ({ __type: 'GetParameter', input })),
}));

const getImagePolicyMock = vi.fn().mockResolvedValue({
  masterMaxDimension: 4096,
  allowedContentTypes: ['image/jpeg', 'image/png'],
  maxUploadSize: 10_000_000,
});
vi.mock('../../../src/server/media/ssmParams.js', () => ({
  getImagePolicy: (...args: unknown[]) => getImagePolicyMock(...args),
}));

const sharpInstanceMock = {
  rotate: vi.fn().mockReturnThis(),
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-jpeg-bytes')),
};
const sharpMock = vi.fn().mockReturnValue(sharpInstanceMock);
vi.mock('sharp', () => ({ default: (...args: unknown[]) => sharpMock(...args) }));

const handleUpdateOneMock = vi.fn().mockResolvedValue({ acknowledged: true });
vi.mock('../../../src/server/operations/updateOne.js', () => ({
  handleUpdateOne: (...args: unknown[]) => handleUpdateOneMock(...args),
}));

function fakeBody(bytes: Buffer) {
  return { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(bytes)) };
}

function makeEvent(key: string, bucket = 'test-bucket'): S3Event {
  return {
    Records: [
      {
        s3: { bucket: { name: bucket }, object: { key } },
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    ] as any,
  };
}

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('process-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getImagePolicyMock.mockResolvedValue({
      masterMaxDimension: 4096,
      allowedContentTypes: ['image/jpeg', 'image/png'],
      maxUploadSize: 10_000_000,
    });
    sharpMock.mockReturnValue(sharpInstanceMock);
    sharpInstanceMock.metadata.mockResolvedValue({ width: 800, height: 600 });
    sharpInstanceMock.toBuffer.mockResolvedValue(Buffer.from('processed-jpeg-bytes'));
    process.env.IMAGE_POLICY_PARAM = '/app/dev/media/image-policy';
  });

  it('画像ファイルを処理してmasterへPutObjectし、completedレコードを書き込む', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({ ContentType: 'image/jpeg', Metadata: {}, ContentLength: 6 });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(JPEG_BYTES) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file-abc'), {} as never, vi.fn());

    const putCall = s3SendMock.mock.calls.find((c) => c[0].__type === 'PutObject');
    expect(putCall).toBeDefined();
    expect(putCall![0].input.Key).toBe('master/file-abc');
    expect(putCall![0].input.ContentType).toBe('image/jpeg');

    expect(handleUpdateOneMock).toHaveBeenCalledTimes(1);
    const [resource, params] = handleUpdateOneMock.mock.calls[0];
    expect(resource).toBe('media');
    expect(params.id).toBe('file-abc');
    expect(params.data.$set.status).toBe('completed');
    expect(params.data.$set.outputContentType).toBe('image/jpeg');
    expect(params.data.$set.dimensions).toEqual({ width: 800, height: 600 });
    expect(params.options.upsert).toBe(true);
  });

  it('masterMaxDimensionを超える画像はresizeしてから保存する', async () => {
    sharpInstanceMock.metadata.mockResolvedValueOnce({ width: 8000, height: 6000 });
    getImagePolicyMock.mockResolvedValue({
      masterMaxDimension: 4096,
      allowedContentTypes: ['image/jpeg'],
      maxUploadSize: 10_000_000,
    });
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({ ContentType: 'image/jpeg', Metadata: {} });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(JPEG_BYTES) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file-big'), {} as never, vi.fn());

    expect(sharpInstanceMock.resize).toHaveBeenCalledWith(4096, 4096, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  it('画像サイズが上限以下ならresizeしない', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({ ContentType: 'image/jpeg', Metadata: {} });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(JPEG_BYTES) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file-small'), {} as never, vi.fn());

    expect(sharpInstanceMock.resize).not.toHaveBeenCalled();
  });

  it('非画像ファイルはCopyObjectでContent-Disposition: attachmentを付与する', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({
          ContentType: 'application/pdf',
          Metadata: { 'original-filename': 'doc.pdf' },
          ContentLength: 12345,
        });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('%PDF-1.4...')) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file-pdf'), {} as never, vi.fn());

    const copyCall = s3SendMock.mock.calls.find((c) => c[0].__type === 'CopyObject');
    expect(copyCall).toBeDefined();
    expect(copyCall![0].input.ContentDisposition).toBe('attachment; filename="doc.pdf"');
    expect(copyCall![0].input.MetadataDirective).toBe('REPLACE');
    expect(sharpMock).not.toHaveBeenCalled();

    const [, params] = handleUpdateOneMock.mock.calls[0];
    expect(params.data.$set.outputContentType).toBe('application/pdf');
  });

  it('image/svg+xmlは非画像として扱う（XSSリスク回避）', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({ ContentType: 'image/svg+xml', Metadata: {} });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('<svg></svg>')) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file-svg'), {} as never, vi.fn());

    expect(sharpMock).not.toHaveBeenCalled();
    const copyCall = s3SendMock.mock.calls.find((c) => c[0].__type === 'CopyObject');
    expect(copyCall).toBeDefined();
  });

  it('マジックナンバー不一致ならfailedレコードを書き込み、masterへは何も書かない', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        // image/jpeg と申告しているが、実体はPNG
        return Promise.resolve({ ContentType: 'image/jpeg', Metadata: {} });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(PNG_BYTES) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file-spoofed'), {} as never, vi.fn());

    expect(s3SendMock.mock.calls.find((c) => c[0].__type === 'PutObject')).toBeUndefined();
    expect(s3SendMock.mock.calls.find((c) => c[0].__type === 'CopyObject')).toBeUndefined();

    const [, params] = handleUpdateOneMock.mock.calls[0];
    expect(params.data.$set.status).toBe('failed');
    expect(params.data.$set.error).toContain('does not match file signature');
  });

  it('S3キーのURLエンコード（スペース等）を正しくデコードしてfileIdを取り出す', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({ ContentType: 'application/pdf', Metadata: {} });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('data')) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file%2Bid'), {} as never, vi.fn());

    const [, params] = handleUpdateOneMock.mock.calls[0];
    expect(params.id).toBe('file+id');
  });

  it('IMAGE_POLICY_PARAM未設定で画像処理を試みると例外を投げる（fail-closed）', async () => {
    delete process.env.IMAGE_POLICY_PARAM;
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({ ContentType: 'image/jpeg', Metadata: {} });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(JPEG_BYTES) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await expect(handler(makeEvent('raw/file-noparam'), {} as never, vi.fn())).rejects.toThrow(
      'IMAGE_POLICY_PARAM'
    );
  });

  it('アプリ固有のS3メタデータ（original-filename以外）をそのままレコードに書き込む', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === 'HeadObject') {
        return Promise.resolve({
          ContentType: 'image/jpeg',
          Metadata: { 'owner-id': 'user-1', 'venue-id': 'venue-1' },
        });
      }
      if (cmd.__type === 'GetObject') {
        return Promise.resolve({ Body: fakeBody(JPEG_BYTES) });
      }
      return Promise.resolve({});
    });

    const { handler } = await import('../../../src/server/media/process-handler.js');
    await handler(makeEvent('raw/file-meta'), {} as never, vi.fn());

    const [, params] = handleUpdateOneMock.mock.calls[0];
    expect(params.data.$set['owner-id']).toBe('user-1');
    expect(params.data.$set['venue-id']).toBe('venue-1');
  });
});
