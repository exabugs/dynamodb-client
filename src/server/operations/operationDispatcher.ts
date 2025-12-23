/**
 * 操作ディスパッチャー
 *
 * MongoDB風APIの操作を適切なハンドラーに振り分ける
 */
import { createLogger } from '../../shared/index.js';
import { handleDeleteMany } from './deleteMany.js';
import { handleDeleteOne } from './deleteOne.js';
import { handleFind } from './find.js';
import { handleFindMany } from './findMany.js';
import { handleFindManyReference } from './findManyReference.js';
import { handleFindOne } from './findOne.js';
import { handleInsertMany } from './insertMany.js';
import { handleInsertOne } from './insertOne.js';
import { handleUpdateMany } from './updateMany.js';
import { handleUpdateOne } from './updateOne.js';
import {
  convertDeleteManyParams,
  convertDeleteOneParams,
  convertFindManyParams,
  convertFindOneParams,
  convertFindParams,
  convertInsertManyParams,
  convertInsertOneParams,
  convertUpdateManyParams,
  convertUpdateOneParams,
} from './parameterConverter.js';
import type { ApiOperation, ApiRequest, FindManyReferenceParams } from '../types.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'operation-dispatcher',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * 操作を実行する（MongoDB風API）
 *
 * @param request - APIリクエスト
 * @param requestId - リクエストID
 * @returns 操作結果
 */
export async function executeOperation(request: ApiRequest, requestId: string): Promise<unknown> {
  const { op, resource } = request;

  logger.debug('Executing operation', {
    requestId,
    operation: op,
    resource,
  });

  // MongoDB風の操作名で処理を実行
  // MongoDB風のparamsを内部形式に変換してから各ハンドラーを呼び出す
  switch (op as ApiOperation) {
    case 'find': {
      const internalParams = convertFindParams(request.params as any);
      return await handleFind(resource, internalParams, requestId);
    }

    case 'findOne': {
      const internalParams = convertFindOneParams(request.params as any);
      return await handleFindOne(resource, internalParams, requestId);
    }

    case 'findMany': {
      const internalParams = convertFindManyParams(request.params as any);
      return await handleFindMany(resource, internalParams, requestId);
    }

    case 'findManyReference':
      return await handleFindManyReference(
        resource,
        request.params as FindManyReferenceParams,
        requestId
      );

    case 'insertOne': {
      const internalParams = convertInsertOneParams(request.params as any);
      return await handleInsertOne(resource, internalParams, requestId);
    }

    case 'updateOne': {
      const internalParams = convertUpdateOneParams(request.params as any);
      return await handleUpdateOne(resource, internalParams, requestId);
    }

    case 'updateMany': {
      const internalParams = convertUpdateManyParams(request.params as any);
      return await handleUpdateMany(resource, internalParams, requestId);
    }

    case 'deleteOne': {
      const internalParams = convertDeleteOneParams(request.params as any);
      return await handleDeleteOne(resource, internalParams, requestId);
    }

    case 'deleteMany': {
      const internalParams = convertDeleteManyParams(request.params as any);
      return await handleDeleteMany(resource, internalParams, requestId);
    }

    case 'insertMany': {
      const internalParams = convertInsertManyParams(request.params as any);
      return await handleInsertMany(resource, internalParams, requestId);
    }

    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}