/**
 * Records Lambda - エントリーポイント
 *
 * HTTP API（Lambda Function URL）経由でCRUD操作を提供
 * MongoDB 風の10操作をサポート
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

import { isAppError } from '../errors.js';
import { createLogger } from '../logger.js';
import { handleDeleteMany } from './operations/deleteMany.js';
import { handleDeleteOne } from './operations/deleteOne.js';
import { handleFind } from './operations/find.js';
import { handleFindMany } from './operations/findMany.js';
// 操作ハンドラーのインポート
import { handleFindManyReference } from './operations/findManyReference.js';
import { handleFindOne } from './operations/findOne.js';
import { handleInsertMany } from './operations/insertMany.js';
import { handleInsertOne } from './operations/insertOne.js';
import { handleUpdateMany } from './operations/updateMany.js';
import { handleUpdateOne } from './operations/updateOne.js';
import type {
  ApiErrorResponse,
  ApiOperation,
  ApiRequest,
  ApiSuccessResponse,
  DeleteManyParams,
  DeleteOneParams,
  FindManyParams,
  FindManyReferenceParams,
  FindOneParams,
  FindParams,
  InsertManyParams,
  InsertOneParams,
  UpdateManyParams,
  UpdateOneParams,
} from './types.js';
import { verifyAuthHeader } from './utils/auth.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'records-lambda',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

// 起動時にログ出力（コールドスタート時のみ実行される）
logger.info('Records Lambda started with automatic shadow field detection');

/**
 * CORS ヘッダー
 * Lambda Function URLのCORS設定を使用するため、ここでは空のオブジェクトにする
 */
const CORS_HEADERS = {};

/**
 * Lambda ハンドラー（HTTP対応）
 *
 * HTTPリクエストを受け取り、操作に応じた処理を実行してレスポンスを返す。
 * react-admin完全準拠の10操作をサポート。
 *
 * @param event - Lambda Function URL イベント
 * @returns HTTP レスポンス
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;

  logger.info('Received request', {
    requestId,
    method: event.requestContext.http.method,
    path: event.requestContext.http.path,
  });

  try {
    // CORS プリフライトリクエスト処理
    if (event.requestContext.http.method === 'OPTIONS') {
      return createCorsResponse(200);
    }

    // POST メソッドのみ許可
    if (event.requestContext.http.method !== 'POST') {
      return createErrorResponse(
        'METHOD_NOT_ALLOWED',
        'Only POST method is allowed',
        405,
        requestId
      );
    }

    // 認証チェック: IAM または Cognito JWT
    // Lambda Function URL が NONE の場合、両方の認証方式をサポート
    const authHeader = event.headers.authorization || event.headers.Authorization;

    // AWS SigV4 署名の検出（複数のヘッダーで判定）
    const hasAmzDate = event.headers['x-amz-date'] || event.headers['X-Amz-Date'];
    const hasAmzContentSha =
      event.headers['x-amz-content-sha256'] || event.headers['X-Amz-Content-Sha256'];
    const hasAwsSigV4Auth = authHeader?.startsWith('AWS4-HMAC-SHA256');

    // デバッグ: ヘッダーをログ出力
    logger.debug('Authentication check', {
      requestId,
      hasAuthHeader: !!authHeader,
      hasAmzDate: !!hasAmzDate,
      hasAmzContentSha: !!hasAmzContentSha,
      hasAwsSigV4Auth: !!hasAwsSigV4Auth,
      authHeaderPrefix: authHeader?.substring(0, 20),
    });

    // IAM 認証チェック（AWS SigV4 署名の特徴的なヘッダーで判定）
    // 以下のいずれかの条件を満たす場合、IAM 認証とみなす:
    // 1. Authorization ヘッダーが AWS4-HMAC-SHA256 で始まる
    // 2. x-amz-date と x-amz-content-sha256 の両方が存在する
    const isIAMAuth = hasAwsSigV4Auth || !!(hasAmzDate && hasAmzContentSha);

    if (isIAMAuth) {
      // IAM 認証（スクリプトからのアクセス）
      // Lambda Function URL が NONE の場合、署名検証は行われないため、
      // ここでは IAM 認証として扱うが、実際の検証は AWS 側で行われる
      logger.info('IAM authenticated request', {
        requestId,
        sourceIp: event.requestContext.http.sourceIp,
      });
    } else {
      // Cognito JWT 認証（ブラウザからのアクセス）
      const userPoolId = process.env.COGNITO_USER_POOL_ID;
      const clientId = process.env.COGNITO_CLIENT_ID; // オプション

      if (!userPoolId) {
        throw new Error('COGNITO_USER_POOL_ID environment variable is required');
      }

      const jwtPayload = await verifyAuthHeader(authHeader, userPoolId, clientId);

      logger.debug('Cognito JWT verified', {
        requestId,
        sub: jwtPayload.sub,
        email: jwtPayload.email,
      });

      // TODO: テナント境界の実装
      // jwtPayload.sub をレコードの userId フィールドと照合する
    }

    // リクエストボディのパース（2つの API 形式をサポート）
    const request = parseRequestBody(event.body);

    logger.info('Parsed request', {
      requestId,
      operation: request.op,
      resource: request.resource,
    });

    // 操作の実行
    const result = await executeOperation(request, requestId);

    // 成功レスポンスの生成
    return createSuccessResponse(result, requestId);
  } catch (error) {
    // エラーハンドリング
    return handleError(error, requestId);
  }
}

/**
 * MongoDB 風 API リクエスト
 */
interface MongoDBStyleRequest {
  operation: string;
  collection: string;
  params: unknown;
}

/**
 * リクエストボディをパースする（MongoDB 風 API）
 *
 * @param body - HTTPリクエストボディ（JSON文字列）
 * @returns パース済みリクエスト
 * @throws {Error} パースに失敗した場合
 */
function parseRequestBody(body: string | undefined): ApiRequest {
  if (!body) {
    throw new Error('Request body is required');
  }

  try {
    const parsed = JSON.parse(body) as MongoDBStyleRequest;

    // 必須フィールドの検証
    if (!parsed.operation) {
      throw new Error('Missing required field: operation');
    }
    if (!parsed.collection) {
      throw new Error('Missing required field: collection');
    }
    if (parsed.params === undefined) {
      throw new Error('Missing required field: params');
    }

    // MongoDB 風の operation 名をそのまま使用（変換なし）
    const op = parsed.operation as ApiOperation;

    return {
      op,
      resource: parsed.collection,
      params: parsed.params,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in request body');
    }
    throw error;
  }
}

/**
 * 操作を実行する（MongoDB 風 API）
 *
 * @param request - API リクエスト
 * @param requestId - リクエストID
 * @returns 操作結果
 */
async function executeOperation(request: ApiRequest, requestId: string): Promise<unknown> {
  const { op, resource } = request;

  logger.debug('Executing operation', {
    requestId,
    operation: op,
    resource,
  });

  // MongoDB 風の operation 名で処理を実行
  // MongoDB 風の params を内部形式に変換してから各ハンドラーを呼び出す

  // MongoDB風のパラメータ型定義
  interface MongoFindParams {
    filter?: Record<string, unknown>;
    options?: {
      sort?: Record<string, 'asc' | 'desc' | 1 | -1>;
      limit?: number;
      nextToken?: string;
    };
  }

  interface MongoFilterParams {
    filter?: {
      id?: string | { in?: string[] };
    };
  }

  interface MongoUpdateParams extends MongoFilterParams {
    update?:
      | {
          set?: Record<string, unknown>;
        }
      | Record<string, unknown>;
  }

  interface MongoDocumentParams {
    document?: Record<string, unknown>;
  }

  interface MongoDocumentsParams {
    documents?: Array<Record<string, unknown>>;
  }

  switch (op as ApiOperation) {
    case 'find': {
      // MongoDB: { filter, options: { sort, limit, nextToken } } -> 内部: { filter, sort, pagination }
      const mongoParams = request.params as MongoFindParams;
      const { filter = {}, options = {} } = mongoParams;
      const { sort, limit, nextToken } = options;

      // デバッグログ
      logger.debug('Processing find operation', {
        requestId,
        hasSort: !!sort,
        sortType: typeof sort,
        sortKeys: sort ? Object.keys(sort) : [],
        sortValues: sort ? Object.values(sort) : [],
        sort,
        hasNextToken: !!nextToken,
      });

      const internalParams: FindParams = {
        filter,
        ...(sort &&
          Object.keys(sort).length > 0 && {
            sort: {
              field: Object.keys(sort)[0],
              order: Object.values(sort)[0] === 'desc' ? 'DESC' : 'ASC',
            },
          }),
        ...((limit || nextToken) && {
          pagination: {
            ...(limit && { perPage: limit }),
            ...(nextToken && { nextToken }),
          },
        }),
      };

      return await handleFind(resource, internalParams, requestId);
    }

    case 'findOne': {
      // MongoDB: { filter: { id: ... } } -> 内部: { id: ... }
      const mongoParams = request.params as MongoFilterParams;
      const id = typeof mongoParams.filter?.id === 'string' ? mongoParams.filter.id : undefined;
      if (!id) {
        throw new Error('findOne requires filter.id');
      }
      const internalParams: FindOneParams = { id };
      return await handleFindOne(resource, internalParams, requestId);
    }

    case 'findMany': {
      // MongoDB: { filter: { id: { in: [...] } } } -> 内部: { ids: [...] }
      const mongoParams = request.params as MongoFilterParams;
      const idFilter = mongoParams.filter?.id;
      const ids =
        typeof idFilter === 'object' && idFilter !== null && 'in' in idFilter
          ? idFilter.in || []
          : [];
      const internalParams: FindManyParams = { ids };
      return await handleFindMany(resource, internalParams, requestId);
    }

    case 'findManyReference':
      return await handleFindManyReference(
        resource,
        request.params as FindManyReferenceParams,
        requestId
      );

    case 'insertOne': {
      // MongoDB: { document: {...} } -> 内部: { data: {...} }
      const mongoParams = request.params as MongoDocumentParams;
      if (!mongoParams.document) {
        throw new Error('insertOne requires document');
      }
      const internalParams: InsertOneParams = {
        data: mongoParams.document,
      };
      return await handleInsertOne(resource, internalParams, requestId);
    }

    case 'updateOne': {
      // MongoDB: { filter: { id: ... }, update: { set: {...} } } -> 内部: { id: ..., data: {...} }
      const mongoParams = request.params as MongoUpdateParams;
      const id = typeof mongoParams.filter?.id === 'string' ? mongoParams.filter.id : undefined;
      if (!id) {
        throw new Error('updateOne requires filter.id');
      }
      const updateData: Record<string, unknown> =
        mongoParams.update && typeof mongoParams.update === 'object'
          ? 'set' in mongoParams.update
            ? (mongoParams.update.set as Record<string, unknown>) || {}
            : (mongoParams.update as Record<string, unknown>)
          : {};
      const internalParams: UpdateOneParams = {
        id,
        data: updateData,
      };
      return await handleUpdateOne(resource, internalParams, requestId);
    }

    case 'updateMany': {
      // MongoDB: { filter: { id: { in: [...] } }, update: { set: {...} } } -> 内部: { ids: [...], data: {...} }
      const mongoParams = request.params as MongoUpdateParams;
      const idFilter = mongoParams.filter?.id;
      const ids =
        typeof idFilter === 'object' && idFilter !== null && 'in' in idFilter
          ? idFilter.in || []
          : [];
      const updateData: Record<string, unknown> =
        mongoParams.update && typeof mongoParams.update === 'object'
          ? 'set' in mongoParams.update
            ? (mongoParams.update.set as Record<string, unknown>) || {}
            : (mongoParams.update as Record<string, unknown>)
          : {};
      const internalParams: UpdateManyParams = {
        ids,
        data: updateData,
      };
      return await handleUpdateMany(resource, internalParams, requestId);
    }

    case 'deleteOne': {
      // MongoDB: { filter: { id: ... } } -> 内部: { id: ... }
      const mongoParams = request.params as MongoFilterParams;
      const id = typeof mongoParams.filter?.id === 'string' ? mongoParams.filter.id : undefined;
      if (!id) {
        throw new Error('deleteOne requires filter.id');
      }
      const internalParams: DeleteOneParams = { id };
      return await handleDeleteOne(resource, internalParams, requestId);
    }

    case 'deleteMany': {
      // MongoDB: { filter: { id: { in: [...] } } } -> 内部: { ids: [...] }
      const mongoParams = request.params as MongoFilterParams;
      const idFilter = mongoParams.filter?.id;
      const ids =
        typeof idFilter === 'object' && idFilter !== null && 'in' in idFilter
          ? idFilter.in || []
          : [];
      const internalParams: DeleteManyParams = { ids };
      return await handleDeleteMany(resource, internalParams, requestId);
    }

    case 'insertMany': {
      // MongoDB: { documents: [...] } -> 内部: { data: [...] }
      const mongoParams = request.params as MongoDocumentsParams;
      if (!mongoParams.documents) {
        throw new Error('insertMany requires documents');
      }
      const internalParams: InsertManyParams = {
        data: mongoParams.documents,
      };
      return await handleInsertMany(resource, internalParams, requestId);
    }

    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}

/**
 * 成功レスポンスを生成する
 *
 * @param data - レスポンスデータ
 * @param requestId - リクエストID
 * @returns HTTP レスポンス
 */
function createSuccessResponse(data: unknown, requestId: string): APIGatewayProxyResultV2 {
  const response: ApiSuccessResponse<unknown> = {
    success: true,
    data,
  };

  logger.info('Request succeeded', { requestId });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(response),
  };
}

/**
 * エラーレスポンスを生成する
 *
 * @param code - エラーコード
 * @param message - エラーメッセージ
 * @param statusCode - HTTPステータスコード
 * @param requestId - リクエストID
 * @param details - 追加詳細情報
 * @returns HTTP レスポンス
 */
function createErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  requestId: string,
  details?: unknown
): APIGatewayProxyResultV2 {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      statusCode,
      details,
    },
  };

  logger.error('Request failed', {
    requestId,
    code,
    message,
    statusCode,
  });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(response),
  };
}

/**
 * CORS レスポンスを生成する
 *
 * @param statusCode - HTTPステータスコード
 * @returns HTTP レスポンス
 */
function createCorsResponse(statusCode: number): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: '',
  };
}

/**
 * エラーをハンドリングしてレスポンスを生成する
 *
 * @param error - エラーオブジェクト
 * @param requestId - リクエストID
 * @returns HTTP レスポンス
 */
function handleError(error: unknown, requestId: string): APIGatewayProxyResultV2 {
  // AppError（アプリケーション定義エラー）の場合
  if (isAppError(error)) {
    return createErrorResponse(
      error.code,
      error.message,
      error.statusCode,
      requestId,
      error.details
    );
  }

  // 標準Errorの場合
  if (error instanceof Error) {
    // スタックトレースをログ出力
    logger.error('Error stack trace', {
      requestId,
      stack: error.stack,
      message: error.message,
    });

    // バリデーションエラーの判定
    if (
      error.message.includes('Missing required field') ||
      error.message.includes('Invalid JSON') ||
      error.message.includes('Request body is required')
    ) {
      return createErrorResponse('VALIDATION_ERROR', error.message, 400, requestId);
    }

    // 未実装エラーの判定
    if (error.message.includes('not yet implemented')) {
      return createErrorResponse('NOT_IMPLEMENTED', error.message, 501, requestId);
    }

    // 不明な操作エラーの判定
    if (error.message.includes('Unknown operation')) {
      return createErrorResponse('INVALID_OPERATION', error.message, 400, requestId);
    }

    // その他のエラー
    return createErrorResponse('INTERNAL_ERROR', error.message, 500, requestId);
  }

  // 予期しないエラー
  return createErrorResponse('UNKNOWN_ERROR', 'An unexpected error occurred', 500, requestId, {
    error: String(error),
  });
}
