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
import type { SQSEvent, SQSHandler } from 'aws-lambda';

import { createLogger } from '../../shared/index.js';
import { handleFindMany } from '../operations/findMany.js';
import { handleUpdateOne } from '../operations/updateOne.js';
import type { MediaRecord } from './types.js';

const logger = createLogger({ service: 'media-process-handler-dlq' });

/**
 * Lambda非同期呼び出し失敗時のon-failure宛先（SQS）に送られるメッセージの形式。
 * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations
 */
interface AsyncInvocationFailureEnvelope {
  requestContext?: { condition?: string };
  requestPayload?: {
    Records?: Array<{ s3?: { object?: { key?: string } } }>;
  };
  responsePayload?: unknown;
}

function extractFileId(envelope: AsyncInvocationFailureEnvelope): string | undefined {
  const key = envelope.requestPayload?.Records?.[0]?.s3?.object?.key;
  if (!key) return undefined;
  return decodeURIComponent(key.replace(/\+/g, ' ')).replace(/^raw\//, '');
}

async function processMessage(body: string): Promise<void> {
  let envelope: AsyncInvocationFailureEnvelope;
  try {
    envelope = JSON.parse(body);
  } catch {
    logger.error('DLQ message is not valid JSON', { body });
    return;
  }

  const fileId = extractFileId(envelope);
  if (!fileId) {
    logger.error('Could not extract fileId from DLQ message', { envelope });
    return;
  }

  const requestId = `dlq-${fileId}`;

  const existing = await handleFindMany('media', { ids: [fileId] }, requestId);
  const existingRecord = existing[0] as MediaRecord | undefined;
  if (existingRecord?.status === 'completed') {
    logger.info('Media already completed, skipping DLQ failure write', { requestId, fileId });
    return;
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
