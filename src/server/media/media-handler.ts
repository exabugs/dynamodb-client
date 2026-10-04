/**
 * CloudFrontの `/resize/*` ビヘイビア専用オリジン（Lambda Function URL）
 *
 * Function URLは `authorization_type: AWS_IAM` で保護し、CloudFrontからのみ
 * 呼び出せるようにする（詳細: docs/media-design.md、CloudFrontを経由しない
 * 直接呼び出しによる署名検証の迂回を防ぐため）。
 *
 * widthの健全性チェックは「異常値を弾く粗いガード」でよい設計
 * （署名付きURL必須のため、本来の認可はCloudFront側の署名検証で担保される）。
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import sharp from 'sharp';

import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';

import { createLogger } from '../../shared/index.js';
import { getImagePolicy } from './ssmParams.js';

const logger = createLogger({ service: 'media-handler' });

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const ssmClient = new SSMClient({ region: process.env.AWS_REGION });

const MAX_INPUT_PIXELS = 100_000_000;
const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable';
const CACHE_CONTROL_NO_STORE = 'no-store';

function notFoundResponse(message: string): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 404,
    headers: { 'Cache-Control': CACHE_CONTROL_NO_STORE, 'Content-Type': 'text/plain' },
    body: message,
  };
}

function badRequestResponse(message: string): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 400,
    headers: { 'Cache-Control': CACHE_CONTROL_NO_STORE, 'Content-Type': 'text/plain' },
    body: message,
  };
}

function imageResponse(
  body: Buffer,
  contentType: string | undefined
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentType ?? 'application/octet-stream',
      'Cache-Control': CACHE_CONTROL_IMMUTABLE,
    },
    body: body.toString('base64'),
    isBase64Encoded: true,
  };
}

/** パス（例: /resize/{fileId}）からfileIdを取り出す */
function extractFileId(rawPath: string): string {
  return rawPath.replace(/^\/resize\//, '').replace(/^\//, '');
}

/**
 * s3:ListBucketが無いロールでGetObjectが存在しないキーを指すと、S3はNoSuchKey
 * ではなく403 AccessDeniedを返す（存在確認防止のためのAWS仕様）。IAM側で
 * ListBucketを許可済みだが、念のためAccessDeniedも「存在しない」として扱う
 * （IAM設定の将来的な regression に対する防御）。
 */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof NoSuchKey) return true;
  if (error instanceof Error) {
    const name = (error as { name?: string }).name;
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    return name === 'AccessDenied' || statusCode === 403;
  }
  return false;
}

async function tryGetFromS3(bucket: string, key: string): Promise<Buffer | undefined> {
  try {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await (
      result.Body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId = event.requestContext.requestId;
  const bucket = process.env.MEDIA_BUCKET;
  const imagePolicyParam = process.env.IMAGE_POLICY_PARAM;

  if (!bucket || !imagePolicyParam) {
    logger.error('MEDIA_BUCKET or IMAGE_POLICY_PARAM not configured', { requestId });
    return { statusCode: 500, body: 'Server misconfiguration' };
  }

  const fileId = extractFileId(event.rawPath);
  if (!fileId) {
    return badRequestResponse('fileId is required');
  }

  const widthParam = event.queryStringParameters?.width;
  const width = widthParam ? Number(widthParam) : NaN;
  if (!Number.isInteger(width) || width < 1) {
    return badRequestResponse(`Invalid width: ${widthParam}`);
  }

  let imagePolicy;
  try {
    imagePolicy = await getImagePolicy(ssmClient, imagePolicyParam);
  } catch (error) {
    logger.error('Failed to load image policy (fail-closed)', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      headers: { 'Cache-Control': CACHE_CONTROL_NO_STORE },
      body: 'Image policy unavailable',
    };
  }

  if (width > imagePolicy.masterMaxDimension) {
    return badRequestResponse(`width exceeds masterMaxDimension: ${width}`);
  }

  const cacheKey = `cache/${fileId}/${width}`;
  const cached = await tryGetFromS3(bucket, cacheKey);
  if (cached) {
    logger.debug('Cache hit', { requestId, fileId, width });
    return imageResponse(cached, 'image/jpeg');
  }

  const master = await tryGetFromS3(bucket, `master/${fileId}`);
  if (!master) {
    return notFoundResponse('Not found');
  }

  // リサイズは process-handler がラスター画像として正規化した master（常に
  // image/jpeg）にのみ適用できる。非画像ファイル・SVGのmasterはオリジナル
  // バイト列のまま保存されており、sharpで処理すると例外（PDF等）や意図しない
  // ラスタライズ（SVG）を起こすため、ここで明示的に拒否する。
  let resized: Buffer;
  try {
    resized = await sharp(master, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize(width, width, { fit: 'inside', withoutEnlargement: true })
      .jpeg()
      .toBuffer();
  } catch (error) {
    logger.warn('Resize not applicable (master is not a processable raster image)', {
      requestId,
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return badRequestResponse('Resize is not applicable to this file');
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cacheKey,
      Body: resized,
      ContentType: 'image/jpeg',
    })
  );

  logger.debug('Cache miss, generated resize', { requestId, fileId, width });
  return imageResponse(resized, 'image/jpeg');
}
