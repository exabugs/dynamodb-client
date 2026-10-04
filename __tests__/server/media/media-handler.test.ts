/**
 * media-handler.ts のユニットテスト
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeNoSuchKey extends Error {
  name = 'NoSuchKey';
}

const s3SendMock = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: s3SendMock })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ __type: 'GetObject', input })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ __type: 'PutObject', input })),
  NoSuchKey: FakeNoSuchKey,
}));

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn().mockImplementation(() => ({})),
}));

const getImagePolicyMock = vi.fn();
vi.mock('../../../src/server/media/ssmParams.js', () => ({
  getImagePolicy: (...args: unknown[]) => getImagePolicyMock(...args),
}));

const sharpInstanceMock = {
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized-bytes')),
};
const sharpMock = vi.fn().mockReturnValue(sharpInstanceMock);
vi.mock('sharp', () => ({ default: (...args: unknown[]) => sharpMock(...args) }));

function fakeBody(bytes: Buffer) {
  return { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(bytes)) };
}

function makeEvent(path: string, width?: string): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    queryStringParameters: width !== undefined ? { width } : undefined,
    requestContext: { requestId: 'req-1' },
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  } as any;
}

describe('media-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MEDIA_BUCKET = 'test-bucket';
    process.env.IMAGE_POLICY_PARAM = '/app/dev/media/image-policy';
    getImagePolicyMock.mockResolvedValue({
      masterMaxDimension: 4096,
      allowedContentTypes: ['image/jpeg'],
      maxUploadSize: 10_000_000,
    });
  });

  it('キャッシュがあればそれを返す（master取得・sharp呼び出しなし）', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string; input: { Key: string } }) => {
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'cache/file-1/320') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('cached-bytes')) });
      }
      throw new Error('unexpected call: ' + cmd.input.Key);
    });

    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-1', '320'));

    expect(res.statusCode).toBe(200);
    expect(res.isBase64Encoded).toBe(true);
    expect(Buffer.from(res.body as string, 'base64').toString()).toBe('cached-bytes');
    expect(sharpMock).not.toHaveBeenCalled();
    expect(res.headers?.['Cache-Control']).toContain('immutable');
  });

  it('キャッシュミス時はmasterを取得してリサイズし、cacheへ書き込む', async () => {
    s3SendMock.mockImplementation((cmd: { __type: string; input: { Key: string } }) => {
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'cache/file-1/320') {
        return Promise.reject(new FakeNoSuchKey('not found'));
      }
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'master/file-1') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('master-bytes')) });
      }
      if (cmd.__type === 'PutObject') {
        return Promise.resolve({});
      }
      throw new Error('unexpected call: ' + JSON.stringify(cmd));
    });

    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-1', '320'));

    expect(res.statusCode).toBe(200);
    expect(sharpInstanceMock.resize).toHaveBeenCalledWith(320, 320, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    const putCall = s3SendMock.mock.calls.find((c) => c[0].__type === 'PutObject');
    expect(putCall![0].input.Key).toBe('cache/file-1/320');
  });

  it('masterも無ければ404（Cache-Control: no-store）を返す', async () => {
    s3SendMock.mockImplementation(() => Promise.reject(new FakeNoSuchKey('not found')));

    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-missing', '320'));

    expect(res.statusCode).toBe(404);
    expect(res.headers?.['Cache-Control']).toBe('no-store');
  });

  it('widthが1未満なら400', async () => {
    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-1', '0'));
    expect(res.statusCode).toBe(400);
  });

  it('widthが整数でなければ400', async () => {
    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-1', 'abc'));
    expect(res.statusCode).toBe(400);
  });

  it('widthがmasterMaxDimensionを超える場合は400', async () => {
    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-1', '5000'));
    expect(res.statusCode).toBe(400);
  });

  it('fileIdが無い場合は400', async () => {
    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/', '320'));
    expect(res.statusCode).toBe(400);
  });

  it('image policy取得失敗時はfail-closedで500・no-store（リサイズ要求を拒否）', async () => {
    getImagePolicyMock.mockRejectedValue(new Error('not found'));
    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-1', '320'));
    expect(res.statusCode).toBe(500);
    expect(res.headers?.['Cache-Control']).toBe('no-store');
  });
});
