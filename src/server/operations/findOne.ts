/**
 * findOne 操作
 * 単一レコードをIDまたはフィルター条件で取得する
 *
 * リファクタリング: findManyを内部で使用してコードの重複を削減
 *
 * 要件: 4.3, 5.4, 5.5
 */
import { ItemNotFoundError, createLogger } from '../../shared/index.js';
import type { FindOneParams, FindOneResult } from '../types.js';
import { handleFindMany } from './findMany.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * findOne 操作を実行する
 *
 * findManyを内部で使用して単一レコードを取得する。
 * idが指定された場合はfindMany([id])を呼び出し、
 * filterが指定された場合はfindMany({ filter })を呼び出して最初の結果を返す。
 *
 * @param resource - リソース名
 * @param params - findOneパラメータ（idまたはfilter）
 * @param requestId - リクエストID
 * @returns レコードデータ（単一レコードオブジェクト）
 * @throws {ItemNotFoundError} レコードが存在しない場合
 */
export async function handleFindOne(
  resource: string,
  params: FindOneParams,
  requestId: string
): Promise<FindOneResult> {
  // idが指定された場合はfindManyを1件のIDで呼び出し
  if ('id' in params) {
    const { id } = params;

    logger.debug('Executing findOne by id (using findMany)', {
      requestId,
      resource,
      id,
    });

    // findManyを呼び出して1件のレコードを取得
    const results = await handleFindMany(resource, { ids: [id] }, requestId);

    // レコードが存在しない場合（既存のインターフェースを維持）
    if (results.length === 0) {
      throw new ItemNotFoundError(`Record not found: ${id}`, { resource, id });
    }

    logger.info('findOne by id succeeded', {
      requestId,
      resource,
      id,
    });

    // 既存のインターフェースを維持: 単一レコードオブジェクトを返す
    return results[0];
  }

  // filterが指定された場合はfindManyをfilterで呼び出し
  if ('filter' in params) {
    const { filter } = params;

    logger.debug('Executing findOne by filter (using findMany)', {
      requestId,
      resource,
      filter,
    });

    // findManyを呼び出してフィルター検索
    const results = await handleFindMany(resource, { filter }, requestId);

    // レコードが存在しない場合（既存のインターフェースを維持）
    if (results.length === 0) {
      throw new ItemNotFoundError(`Record not found with filter`, { resource, filter });
    }

    logger.info('findOne by filter succeeded', {
      requestId,
      resource,
      filter,
    });

    // 既存のインターフェースを維持: 単一レコードオブジェクトを返す
    return results[0];
  }

  // idもfilterも指定されていない場合（型的にはありえないが念のため）
  throw new Error('findOne requires either id or filter');
}
