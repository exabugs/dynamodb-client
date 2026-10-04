/**
 * S3 ObjectCreated（raw/*）イベントハンドラー
 *
 * アップロードされたファイルを検証・処理し、masterとしてS3に配置した上で
 * 呼び出し側の既存テーブルにMediaRecordを作成/更新する（詳細: docs/media-design.md）。
 *
 * presign発行時点ではDynamoDBに一切触れない設計のため、DynamoDBレコードが
 * 作られるのはこのハンドラーが成功した時点が初めて。
 */
import type { S3Event, S3Handler } from 'aws-lambda';
import sharp from 'sharp';

import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';

import { createLogger } from '../../shared/index.js';
import { handleUpdateOne } from '../operations/updateOne.js';
import { isProcessableImage, verifyMagicBytes } from './magicBytes.js';
import { buildContentDisposition, decodeOriginalFilename, extractAppMetadata } from './metadata.js';
import { getImagePolicy } from './ssmParams.js';

const logger = createLogger({ service: 'media-process-handler' });

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const ssmClient = new SSMClient({ region: process.env.AWS_REGION });

/** sharp のDoS対策（極端に大きい画素数の画像を拒否） */
const MAX_INPUT_PIXELS = 100_000_000;

/**
 * マジックナンバー照合に必要な先頭バイト数。現状の照合表（magicBytes.ts）は
 * 最大12バイト程度までしか見ないが、将来の形式追加を見込んで余裕を持たせる。
 */
const MAGIC_BYTES_CHECK_RANGE = 255;

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const bytes = await (
    body as { transformToByteArray: () => Promise<Uint8Array> }
  ).transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * マジックナンバー照合用に、先頭の一部バイトだけを取得する。
 *
 * 非画像ファイル（CopyObjectで足りる）は、これ以上ファイル全体をメモリに
 * 読み込む必要が無い。大きな動画・PDF等でも、この先頭バイトの取得だけで
 * 検証が完結し、Lambdaのメモリを無駄に消費しない（詳細: docs/adr/0002-media-design.md）。
 */
async function getHeadBytes(bucket: string, key: string): Promise<Buffer> {
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${MAGIC_BYTES_CHECK_RANGE}` })
  );
  return streamToBuffer(result.Body);
}

async function writeMediaRecord(
  fileId: string,
  fields: Record<string, unknown>,
  requestId: string
): Promise<void> {
  const now = new Date().toISOString();
  await handleUpdateOne(
    'media',
    {
      id: fileId,
      data: {
        $set: { ...fields, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      options: { upsert: true },
    },
    requestId
  );
}

async function processRecord(bucket: string, rawKey: string): Promise<void> {
  const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
  const fileId = key.replace(/^raw\//, '');
  const requestId = `s3-event-${fileId}`;

  const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const contentType = head.ContentType || 'application/octet-stream';
  const metadata = head.Metadata || {};
  const originalFilename = decodeOriginalFilename(metadata['original-filename']);

  // マジックナンバー照合は先頭バイトのみで完結する。非画像（CopyObjectで足りる）
  // の場合、このあとファイル全体を読み込む必要が無い
  const headBytes = await getHeadBytes(bucket, key);

  if (!verifyMagicBytes(contentType, headBytes)) {
    logger.warn('Content type does not match file signature', { requestId, fileId, contentType });
    await writeMediaRecord(
      fileId,
      {
        status: 'failed',
        contentType,
        error: 'Content type does not match file signature',
      },
      requestId
    );
    return;
  }

  const masterKey = `master/${fileId}`;
  const appMetadata = extractAppMetadata(metadata);

  if (isProcessableImage(contentType)) {
    const imagePolicyParam = process.env.IMAGE_POLICY_PARAM;
    if (!imagePolicyParam) {
      throw new Error('IMAGE_POLICY_PARAM environment variable is not set');
    }
    const imagePolicy = await getImagePolicy(ssmClient, imagePolicyParam);

    // 画像処理にはファイル全体が必要なため、ここで改めて全量を取得する
    const getResult = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buffer = await streamToBuffer(getResult.Body);

    const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    const inputMeta = await image.metadata();
    const maxDim = imagePolicy.masterMaxDimension;
    if ((inputMeta.width ?? 0) > maxDim || (inputMeta.height ?? 0) > maxDim) {
      image.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
    }

    const outputBuffer = await image.jpeg().toBuffer();
    const outputMeta = await sharp(outputBuffer).metadata();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: masterKey,
        Body: outputBuffer,
        ContentType: 'image/jpeg',
      })
    );

    await writeMediaRecord(
      fileId,
      {
        status: 'completed',
        contentType,
        outputContentType: 'image/jpeg',
        dimensions: { width: outputMeta.width ?? 0, height: outputMeta.height ?? 0 },
        size: outputBuffer.length,
        ...(originalFilename ? { originalFilename } : {}),
        ...appMetadata,
      },
      requestId
    );
  } else {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: masterKey,
        CopySource: `${bucket}/${key}`,
        MetadataDirective: 'REPLACE',
        ContentType: contentType,
        ContentDisposition: buildContentDisposition(originalFilename),
      })
    );

    await writeMediaRecord(
      fileId,
      {
        status: 'completed',
        contentType,
        outputContentType: contentType,
        size: head.ContentLength ?? 0,
        ...(originalFilename ? { originalFilename } : {}),
        ...appMetadata,
      },
      requestId
    );
  }

  logger.info('Media processed', { requestId, fileId, contentType });
}

export const handler: S3Handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;
    try {
      await processRecord(bucket, key);
    } catch (error) {
      logger.error('Failed to process media', {
        bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      // 再スロー: Lambda非同期呼び出しのリトライに乗せ、尽きたらon-failure宛先（DLQ）へ送る
      throw error;
    }
  }
};
