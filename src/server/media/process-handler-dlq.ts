/**
 * process-handler の失敗（Lambda非同期呼び出しのリトライが尽きた場合）を
 * 受け取るDLQ（SQS）ハンドラー
 *
 * process-handler本体が例外を投げ続けてLambdaのリトライが尽きると、
 * on-failure宛先として設定したこのSQSキューにメッセージが送られる。
 * ここでは呼び出し側に「処理が永久に終わらない」状態（クライアントが
 * 無限ポーリングし続ける）を解消するため、status:'failed'レコードを書き込む。
 *
 * 上書き防止: S3イベントの重複配信により、process-handler本体が先に
 * completedを書き込んだ後にDLQ経由の古いリトライがfailedで上書きする
 * 可能性があるため、書き込み前に既存レコードを確認する。
 */
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { SQSEvent, SQSHandler } from 'aws-lambda';

import { createLogger } from '../../shared/index.js';
import { extractAppMetadata, decodeOriginalFilename } from './metadata.js';
import { handleFindMany } from '../operations/findMany.js';
import { handleUpdateOne } from '../operations/updateOne.js';
import type { MediaRecord } from './types.js';

const logger = createLogger({ service: 'media-process-handler-dlq' });

const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * Lambda非同期呼び出し失敗時のon-failure宛先（SQS）に送られるメッセージの形式。
 * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations
 */
interface AsyncInvocationFailureEnvelope {
  requestContext?: { condition?: string };
  requestPayload?: {
    Records?: Array<{ s3?: { bucket?: { name?: string }; object?: { key?: string } } }>;
  };
  responsePayload?: unknown;
}

interface S3ObjectRef {
  bucket: string;
  key: string;
  fileId: string;
}

function extractS3Ref(envelope: AsyncInvocationFailureEnvelope): S3ObjectRef | undefined {
  const record = envelope.requestPayload?.Records?.[0];
  const bucket = record?.s3?.bucket?.name;
  const rawKey = record?.s3?.object?.key;
  if (!bucket || !rawKey) return undefined;
  const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
  return { bucket, key, fileId: key.replace(/^raw\//, '') };
}

async function processMessage(body: string): Promise<void> {
  let envelope: AsyncInvocationFailureEnvelope;
  try {
    envelope = JSON.parse(body);
  } catch {
    logger.error('DLQ message is not valid JSON', { body });
    return;
  }

  const ref = extractS3Ref(envelope);
  if (!ref) {
    logger.error('Could not extract S3 reference from DLQ message', { envelope });
    return;
  }
  const { bucket, key, fileId } = ref;

  const requestId = `dlq-${fileId}`;

  const existing = await handleFindMany('media', { ids: [fileId] }, requestId);
  const existingRecord = existing[0] as MediaRecord | undefined;
  if (existingRecord?.status === 'completed') {
    logger.info('Media already completed, skipping DLQ failure write', { requestId, fileId });
    return;
  }

  // 呼び出し側のアプリ固有メタデータ（ownerId等）を再取得する。これが無いと、
  // 呼び出し側が権限スコープ付きのポーリングでこのfailedレコードを読めず、
  // クライアントが無限ポーリングし続けることになる（詳細: docs/adr/0002-media-design.md）。
  // raw/{fileId}が既に削除されている等でHeadObjectが失敗しても、処理全体は
  // 失敗させず、メタデータ無しでfailedレコードを書き込む（fail-soft）。
  let appMetadata: Record<string, string> = {};
  let originalFilename: string | undefined;
  try {
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const metadata = head.Metadata || {};
    appMetadata = extractAppMetadata(metadata);
    originalFilename = decodeOriginalFilename(metadata['original-filename']);
  } catch (error) {
    logger.warn('Failed to re-fetch metadata for DLQ failure record', {
      requestId,
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const now = new Date().toISOString();
  await handleUpdateOne(
    'media',
    {
      id: fileId,
      data: {
        $set: {
          status: 'failed',
          error: 'Processing failed after exhausting retries',
          updatedAt: now,
          ...(originalFilename ? { originalFilename } : {}),
          ...appMetadata,
        },
        $setOnInsert: { createdAt: now },
      },
      options: { upsert: true },
    },
    requestId
  );

  logger.warn('Media marked as failed via DLQ', { requestId, fileId });
}

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    await processMessage(record.body);
  }
};
