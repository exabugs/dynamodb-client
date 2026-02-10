/**
 * insertOne 操作
 * 単一レコードを作成する
 *
 * 要件: 4.1, 4.2, 5.2, 5.3
 *
 * リファクタリング: insertManyを内部で使用
 */
import { createLogger } from '../../shared/index.js';
import type { InsertOneParams, InsertOneResult } from '../types.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * insertOne 操作を実行する
 *
 * 処理フロー:
 * 1. insertMany([data])を呼び出す
 * 2. 結果を検証し、失敗した場合は通常のErrorをスロー
 * 3. 成功した場合は作成されたレコードをfindOneで取得して返却
 *
 * @param resource - リソース名
 * @param params - insertOneパラメータ
 * @param requestId - リクエストID
 * @returns 作成されたレコード
 * @throws {Error} レコード作成に失敗した場合
 */
export async function handleInsertOne(
  resource: string,
  params: InsertOneParams,
  requestId: string
): Promise<InsertOneResult> {
  logger.debug('Executing insertOne', {
    requestId,
    resource,
  });

  // insertManyをインポート
  const { handleInsertMany } = await import('./insertMany.js');

  // insertMany([data])を呼び出す
  const insertManyResult = await handleInsertMany(
    resource,
    {
      data: [params.data],
    },
    requestId
  );

  // 結果を検証
  if (insertManyResult.count === 0) {
    // 作成に失敗した場合
    const error = Object.values(insertManyResult.errors || {})[0];
    if (error) {
      throw new Error(`Failed to create record: ${error.message}`);
    } else {
      throw new Error('Failed to create record');
    }
  }

  // 成功した場合は作成されたレコードのIDを取得
  const createdId = Object.values(insertManyResult.successIds || {})[0];
  if (!createdId) {
    throw new Error('Failed to get created record ID');
  }

  // 既存のインターフェースを維持: 作成されたレコードを取得して返す
  const { handleFindOne } = await import('./findOne.js');
  const createdRecord = await handleFindOne(resource, { id: createdId }, requestId);

  logger.info('insertOne succeeded', {
    requestId,
    resource,
    id: createdId,
  });

  // コスト情報を含めて返却
  return {
    acknowledged: true,
    insertedId: createdId,
    id: createdId,
    ...createdRecord,
    consumedCapacity: insertManyResult.consumedCapacity,
  };
}
