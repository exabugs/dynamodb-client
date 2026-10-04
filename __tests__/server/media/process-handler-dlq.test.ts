/**
 * process-handler-dlq.ts のユニットテスト
 */
import type { SQSEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleFindManyMock = vi.fn();
vi.mock('../../../src/server/operations/findMany.js', () => ({
  handleFindMany: (...args: unknown[]) => handleFindManyMock(...args),
}));

const handleUpdateOneMock = vi.fn().mockResolvedValue({ acknowledged: true });
vi.mock('../../../src/server/operations/updateOne.js', () => ({
  handleUpdateOne: (...args: unknown[]) => handleUpdateOneMock(...args),
}));

const s3SendMock = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: (...args: unknown[]) => s3SendMock(...args) })),
  HeadObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

function makeDlqEvent(body: unknown): SQSEvent {
  return {
    Records: [{ body: typeof body === 'string' ? body : JSON.stringify(body) }],
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  } as any;
}

const failureEnvelope = {
  requestContext: { condition: 'RetriesExhausted' },
  requestPayload: {
    Records: [{ s3: { bucket: { name: 'my-bucket' }, object: { key: 'raw/file-abc' } } }],
  },
  responsePayload: { errorMessage: 'timeout' },
};

describe('process-handler-dlq', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleFindManyMock.mockResolvedValue([]);
    s3SendMock.mockRejectedValue(new Error('NotFound'));
  });

  it('既存レコードが無い場合はfailedレコードを新規作成する', async () => {
    const { handler } = await import('../../../src/server/media/process-handler-dlq.js');
    await handler(makeDlqEvent(failureEnvelope), {} as never, vi.fn());

    expect(handleUpdateOneMock).toHaveBeenCalledTimes(1);
    const [resource, params] = handleUpdateOneMock.mock.calls[0];
    expect(resource).toBe('media');
    expect(params.id).toBe('file-abc');
    expect(params.data.$set.status).toBe('failed');
  });

  it('既にcompletedのレコードがある場合は上書きしない（重複配信対策）', async () => {
    handleFindManyMock.mockResolvedValue([{ id: 'file-abc', status: 'completed' }]);

    const { handler } = await import('../../../src/server/media/process-handler-dlq.js');
    await handler(makeDlqEvent(failureEnvelope), {} as never, vi.fn());

    expect(handleUpdateOneMock).not.toHaveBeenCalled();
  });

  it('既にfailedのレコードがある場合は上書きしてよい', async () => {
    handleFindManyMock.mockResolvedValue([{ id: 'file-abc', status: 'failed' }]);

    const { handler } = await import('../../../src/server/media/process-handler-dlq.js');
    await handler(makeDlqEvent(failureEnvelope), {} as never, vi.fn());

    expect(handleUpdateOneMock).toHaveBeenCalledTimes(1);
  });

  it('不正なJSONメッセージは例外を投げず無視する', async () => {
    const { handler } = await import('../../../src/server/media/process-handler-dlq.js');
    await expect(handler(makeDlqEvent('not-json{{'), {} as never, vi.fn())).resolves.not.toThrow();
    expect(handleUpdateOneMock).not.toHaveBeenCalled();
  });

  it('S3参照（bucket/key）を抽出できないメッセージは無視する', async () => {
    const { handler } = await import('../../../src/server/media/process-handler-dlq.js');
    await handler(makeDlqEvent({ requestPayload: { Records: [] } }), {} as never, vi.fn());
    expect(handleUpdateOneMock).not.toHaveBeenCalled();
  });

  it('【回帰テスト】HeadObjectでメタデータを再取得し、failedレコードに含める', async () => {
    s3SendMock.mockResolvedValue({
      Metadata: { 'owner-id': 'user-1', 'original-filename': encodeURIComponent('日本語.png') },
    });

    const { handler } = await import('../../../src/server/media/process-handler-dlq.js');
    await handler(makeDlqEvent(failureEnvelope), {} as never, vi.fn());

    expect(handleUpdateOneMock).toHaveBeenCalledTimes(1);
    const [, params] = handleUpdateOneMock.mock.calls[0];
    expect(params.data.$set['owner-id']).toBe('user-1');
    expect(params.data.$set.originalFilename).toBe('日本語.png');
    expect(params.data.$set.status).toBe('failed');
  });

  it('【回帰テスト】HeadObjectが失敗してもfailedレコードの書き込みは続行する（fail-soft）', async () => {
    s3SendMock.mockRejectedValue(new Error('NoSuchKey'));

    const { handler } = await import('../../../src/server/media/process-handler-dlq.js');
    await handler(makeDlqEvent(failureEnvelope), {} as never, vi.fn());

    expect(handleUpdateOneMock).toHaveBeenCalledTimes(1);
    const [, params] = handleUpdateOneMock.mock.calls[0];
    expect(params.data.$set.status).toBe('failed');
    expect(params.data.$set.originalFilename).toBeUndefined();
  });
});
