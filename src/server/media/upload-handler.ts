/**
 * presign発行・署名付きURL発行を扱うLambda Function URL用ハンドラー（標準実装）
 *
 * 「誰にpresign/署名URLを発行してよいか」の判断はこのライブラリの関心事ではない
 * （詳細: docs/media-design.md）。このハンドラーは`authorize`フックを通じて
 * 呼び出し側アプリの認証・認可ロジックを注入できるようにする。
 *
 * より高度な認可（例: リソース単位の権限チェック）が必要な場合、呼び出し側は
 * このハンドラーを使わず、`./presign.js`・`./sign.js`を自前のルーティング・
 * 認可レイヤーから直接呼び出すこともできる。
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';

import { createLogger } from '../../shared/index.js';
import { generatePresignedUpload } from './presign.js';
import { signMediaUrl } from './sign.js';
import { getImagePolicy, getSigningPrivateKey } from './ssmParams.js';

const logger = createLogger({ service: 'media-upload-handler' });

const DEFAULT_SIGN_EXPIRES_IN_SECONDS = 3600;

/**
 * リクエストを認可し、presign発行時にpolicyへ固定するメタデータを返す。
 * 認可できない場合はnullを返す（401を返す）。
 */
export type AuthorizeFn = (event: APIGatewayProxyEventV2) => Promise<Record<string, string> | null>;

export interface UploadHandlerConfig {
  bucket: string;
  imagePolicyParam: string;
  signingPrivateKeyParam: string;
  keyPairId: string;
  baseUrl: string;
  authorize: AuthorizeFn;
  signExpiresInSeconds?: number;
  s3Client?: S3Client;
  ssmClient?: SSMClient;
}

interface PresignRequestBody {
  contentType?: string;
  originalFilename?: string;
  fileSize?: number;
}

interface SignRequestBody {
  items?: Array<{ fileId?: string; width?: number }>;
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  return JSON.parse(raw) as T;
}

async function handlePresign(
  event: APIGatewayProxyEventV2,
  config: UploadHandlerConfig,
  s3Client: S3Client,
  ssmClient: SSMClient,
  metadata: Record<string, string>,
  requestId: string
): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<PresignRequestBody>(event);
  if (!body.contentType || !body.fileSize) {
    return jsonResponse(400, { error: 'contentType and fileSize are required' });
  }

  const imagePolicy = await getImagePolicy(ssmClient, config.imagePolicyParam);

  const result = await generatePresignedUpload({
    s3Client,
    bucket: config.bucket,
    contentType: body.contentType,
    originalFilename: body.originalFilename,
    fileSize: body.fileSize,
    allowedContentTypes: imagePolicy.allowedContentTypes,
    maxUploadSize: imagePolicy.maxUploadSize,
    metadata,
  });

  logger.info('Presign issued', { requestId, fileId: result.fileId });
  return jsonResponse(200, result);
}

async function handleSign(
  event: APIGatewayProxyEventV2,
  config: UploadHandlerConfig,
  ssmClient: SSMClient,
  requestId: string
): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<SignRequestBody>(event);
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse(400, { error: 'items is required and must be non-empty' });
  }

  const privateKey = await getSigningPrivateKey(ssmClient, config.signingPrivateKeyParam);
  const expiresInSeconds = config.signExpiresInSeconds ?? DEFAULT_SIGN_EXPIRES_IN_SECONDS;

  const items = body.items.map((item) => {
    if (!item.fileId) {
      throw new Error('Each item must have fileId');
    }
    return signMediaUrl({
      fileId: item.fileId,
      width: item.width,
      keyPairId: config.keyPairId,
      privateKey,
      baseUrl: config.baseUrl,
      expiresInSeconds,
    });
  });

  logger.info('Media URLs signed', { requestId, count: items.length });
  return jsonResponse(200, { items });
}

/**
 * 設定を注入してLambda Function URLハンドラーを生成する。
 *
 * @example
 * ```ts
 * export const handler = createUploadHandler({
 *   bucket: process.env.MEDIA_BUCKET!,
 *   imagePolicyParam: process.env.IMAGE_POLICY_PARAM!,
 *   signingPrivateKeyParam: process.env.SIGNING_PRIVATE_KEY_PARAM!,
 *   keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID!,
 *   baseUrl: process.env.MEDIA_BASE_URL!,
 *   authorize: async (event) => {
 *     const userId = await verifyMyAppJwt(event.headers.authorization);
 *     return userId ? { ownerId: userId } : null;
 *   },
 * });
 * ```
 */
export function createUploadHandler(
  config: UploadHandlerConfig
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2> {
  const s3Client = config.s3Client ?? new S3Client({ region: process.env.AWS_REGION });
  const ssmClient = config.ssmClient ?? new SSMClient({ region: process.env.AWS_REGION });

  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const requestId = event.requestContext.requestId;
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    try {
      const metadata = await config.authorize(event);
      if (!metadata) {
        return jsonResponse(401, { error: 'Unauthorized' });
      }

      if (method === 'POST' && path.endsWith('/presign')) {
        return await handlePresign(event, config, s3Client, ssmClient, metadata, requestId);
      }
      if (method === 'POST' && path.endsWith('/sign')) {
        return await handleSign(event, config, ssmClient, requestId);
      }

      return jsonResponse(404, { error: 'Not found' });
    } catch (error) {
      logger.error('Upload handler error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonResponse(400, {
        error: error instanceof Error ? error.message : 'Bad request',
      });
    }
  };
}
