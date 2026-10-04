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

  it('s3:ListBucket権限が無い場合にS3が返す403 AccessDeniedも「存在しない」として404を返す（回帰テスト）', async () => {
    // s3:ListBucketが無いロールでGetObjectが存在しないキーを指すと、S3はNoSuchKeyでは
    // なく403 AccessDeniedを返す。これをNoSuchKeyとしてしか扱わないと、cache未生成時の
    // 初回リクエストが常に500になっていた（IAMのListBucket付与漏れに対する防御）。
    class FakeAccessDenied extends Error {
      name = 'AccessDenied';
      $metadata = { httpStatusCode: 403 };
    }
    s3SendMock.mockImplementation(() => Promise.reject(new FakeAccessDenied('Access Denied')));

    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-missing', '320'));

    expect(res.statusCode).toBe(404);
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

  it('masterが処理不能な形式（sharpが例外を投げる）の場合は400を返す', async () => {
    // 非画像ファイル・SVGのmasterはオリジナルバイト列のまま保存されており、
    // sharpで処理するとエラーになる。500ではなく400（リサイズ非対応）を返すべき。
    sharpInstanceMock.toBuffer.mockRejectedValueOnce(
      new Error('Input buffer contains unsupported image format')
    );
    s3SendMock.mockImplementation((cmd: { __type: string; input: { Key: string } }) => {
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'cache/file-pdf/320') {
        return Promise.reject(new FakeNoSuchKey('not found'));
      }
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'master/file-pdf') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('%PDF-1.4...')) });
      }
      throw new Error('unexpected call: ' + JSON.stringify(cmd));
    });

    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-pdf', '320'));

    expect(res.statusCode).toBe(400);
    expect(s3SendMock.mock.calls.find((c) => c[0].__type === 'PutObject')).toBeUndefined();
  });

  it('【回帰テスト】初回品質で閾値超過なら品質を下げて再試行し、閾値以下になった結果をキャッシュへ書き込む', async () => {
    sharpInstanceMock.toBuffer
      .mockResolvedValueOnce(Buffer.alloc(5 * 1024 * 1024)) // quality 80: 閾値(4MB)超過
      .mockResolvedValueOnce(Buffer.alloc(1024)); // quality 60: 閾値以下

    s3SendMock.mockImplementation((cmd: { __type: string; input: { Key: string } }) => {
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'cache/file-big/320') {
        return Promise.reject(new FakeNoSuchKey('not found'));
      }
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'master/file-big') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('master-bytes')) });
      }
      if (cmd.__type === 'PutObject') {
        return Promise.resolve({});
      }
      throw new Error('unexpected call: ' + JSON.stringify(cmd));
    });

    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-big', '320'));

    expect(res.statusCode).toBe(200);
    expect(sharpInstanceMock.jpeg).toHaveBeenNthCalledWith(1, { quality: 80 });
    expect(sharpInstanceMock.jpeg).toHaveBeenNthCalledWith(2, { quality: 60 });
    const putCall = s3SendMock.mock.calls.find((c) => c[0].__type === 'PutObject');
    expect(putCall![0].input.Key).toBe('cache/file-big/320');
  });

  it('【回帰テスト】最低品質でも閾値を超える場合はキャッシュに書き込まず413を返す', async () => {
    sharpInstanceMock.toBuffer
      .mockResolvedValueOnce(Buffer.alloc(5 * 1024 * 1024))
      .mockResolvedValueOnce(Buffer.alloc(5 * 1024 * 1024))
      .mockResolvedValueOnce(Buffer.alloc(5 * 1024 * 1024));

    s3SendMock.mockImplementation((cmd: { __type: string; input: { Key: string } }) => {
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'cache/file-huge/320') {
        return Promise.reject(new FakeNoSuchKey('not found'));
      }
      if (cmd.__type === 'GetObject' && cmd.input.Key === 'master/file-huge') {
        return Promise.resolve({ Body: fakeBody(Buffer.from('master-bytes')) });
      }
      throw new Error('unexpected call: ' + JSON.stringify(cmd));
    });

    const { handler } = await import('../../../src/server/media/media-handler.js');
    const res = await handler(makeEvent('/resize/file-huge', '320'));

    expect(res.statusCode).toBe(413);
    expect(res.headers?.['Cache-Control']).toBe('no-store');
    expect(s3SendMock.mock.calls.find((c) => c[0].__type === 'PutObject')).toBeUndefined();
  });
});
