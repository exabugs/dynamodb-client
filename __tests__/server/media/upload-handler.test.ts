/**
 * upload-handler.ts のユニットテスト
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => ({ S3Client: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/client-ssm', () => ({ SSMClient: vi.fn().mockImplementation(() => ({})) }));

const getImagePolicyMock = vi.fn();
const getSigningPrivateKeyMock = vi.fn();
vi.mock('../../../src/server/media/ssmParams.js', () => ({
  getImagePolicy: (...args: unknown[]) => getImagePolicyMock(...args),
  getSigningPrivateKey: (...args: unknown[]) => getSigningPrivateKeyMock(...args),
}));

const generatePresignedUploadMock = vi.fn();
vi.mock('../../../src/server/media/presign.js', () => ({
  generatePresignedUpload: (...args: unknown[]) => generatePresignedUploadMock(...args),
}));

const signMediaUrlMock = vi.fn();
vi.mock('../../../src/server/media/sign.js', () => ({
  signMediaUrl: (...args: unknown[]) => signMediaUrlMock(...args),
}));

function makeEvent(method: string, path: string, body?: unknown): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    body: body ? JSON.stringify(body) : undefined,
    requestContext: { requestId: 'req-1', http: { method } },
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  } as any;
}

describe('upload-handler (createUploadHandler)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getImagePolicyMock.mockResolvedValue({
      masterMaxDimension: 4096,
      allowedContentTypes: ['image/jpeg'],
      maxUploadSize: 10_000_000,
    });
    getSigningPrivateKeyMock.mockResolvedValue('private-key');
    generatePresignedUploadMock.mockResolvedValue({
      fileId: 'file-1',
      uploadUrl: 'https://bucket.s3.amazonaws.com/',
      fields: {},
    });
    signMediaUrlMock.mockImplementation(({ fileId, width }) => ({
      fileId,
      width,
      url: `https://media.example.com/${fileId}`,
      expiresAt: 123,
    }));
  });

  async function buildHandler(authorize = vi.fn().mockResolvedValue({ ownerId: 'user-1' })) {
    const { createUploadHandler } = await import('../../../src/server/media/upload-handler.js');
    return createUploadHandler({
      bucket: 'test-bucket',
      imagePolicyParam: '/app/dev/media/image-policy',
      signingPrivateKeyParam: '/app/dev/media/private-key',
      keyPairId: 'KPID',
      baseUrl: 'https://media.example.com',
      authorize,
    });
  }

  it('authorizeがnullを返す場合は401', async () => {
    const handler = await buildHandler(vi.fn().mockResolvedValue(null));
    const res = await handler(
      makeEvent('POST', '/presign', { contentType: 'image/jpeg', fileSize: 100 })
    );
    expect(res.statusCode).toBe(401);
  });

  it('POST /presign で presign を発行する', async () => {
    const handler = await buildHandler();
    const res = await handler(
      makeEvent('POST', '/presign', { contentType: 'image/jpeg', fileSize: 100 })
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.fileId).toBe('file-1');

    const callArgs = generatePresignedUploadMock.mock.calls[0][0];
    expect(callArgs.metadata).toEqual({ ownerId: 'user-1' });
    expect(callArgs.allowedContentTypes).toEqual(['image/jpeg']);
  });

  it('POST /presign で必須フィールドが無ければ400', async () => {
    const handler = await buildHandler();
    const res = await handler(makeEvent('POST', '/presign', {}));
    expect(res.statusCode).toBe(400);
    expect(generatePresignedUploadMock).not.toHaveBeenCalled();
  });

  it('POST /sign でバッチ署名を発行する', async () => {
    const handler = await buildHandler();
    const res = await handler(
      makeEvent('POST', '/sign', {
        items: [{ fileId: 'file-1', width: 320 }, { fileId: 'file-2' }],
      })
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.items).toHaveLength(2);
    expect(signMediaUrlMock).toHaveBeenCalledTimes(2);
  });

  it('POST /sign でitemsが空なら400', async () => {
    const handler = await buildHandler();
    const res = await handler(makeEvent('POST', '/sign', { items: [] }));
    expect(res.statusCode).toBe(400);
  });

  it('未知のパスには404を返す', async () => {
    const handler = await buildHandler();
    const res = await handler(makeEvent('GET', '/unknown'));
    expect(res.statusCode).toBe(404);
  });

  it('presign発行が拒否されると400でエラーメッセージを返す', async () => {
    generatePresignedUploadMock.mockRejectedValue(new Error('Content type not allowed'));
    const handler = await buildHandler();
    const res = await handler(
      makeEvent('POST', '/presign', { contentType: 'application/x-executable', fileSize: 100 })
    );
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body as string);
    expect(body.error).toContain('Content type not allowed');
  });
});
