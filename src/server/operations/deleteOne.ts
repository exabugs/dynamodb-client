/**
 * deleteOne 操作
 * 単一レコードを削除する
 *
 * 要件: 4.4, 5.2, 5.3
 *
 * リファクタリング: deleteManyを内部で使用
 */
import { createLogger } from '../../shared/index.js';
import type { DeleteOneParams, DeleteOneResult } from '../types.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * deleteOne 操作を実行する
 *
 * 処理フロー:
 * 1. deleteMany([id])を呼び出す（idまたはfilterから対象を特定）
 * 2. 結果を検証し、失敗した場合は通常のErrorをスロー
 * 3. 成功した場合は削除されたIDを返却
 *
 * @param resource - リソース名
 * @param params - deleteOneパラメータ
 * @param requestId - リクエストID
 * @returns 削除されたレコードのID
 * @throws {Error} レコードが存在しない場合、または削除に失敗した場合
 */
export async function handleDeleteOne(
  resource: string,
  params: DeleteOneParams,
  requestId: string
): Promise<DeleteOneResult> {
  // deleteManyをインポート
  const { handleDeleteMany } = await import('./deleteMany.js');

  // idまたはfilterから対象レコードを特定
  let targetId: string | undefined;

  if ('id' in params) {
    // idが指定されている場合
    targetId = params.id;

    logger.debug('Executing deleteOne with id', {
      requestId,
      resource,
      id: targetId,
    });

    // deleteMany([id])を呼び出す
    const deleteManyResult = await handleDeleteMany(
      resource,
      {
        ids: [targetId],
      },
      requestId
    );

    // 結果を検証
    if (deleteManyResult.count === 0) {
      // 削除に失敗した場合
      const error = Object.values(deleteManyResult.errors)[0];
      if (error) {
        throw new Error(`Failed to delete record: ${error.message}`);
      } else {
        throw new Error(`Failed to delete record: ${targetId}`);
      }
    }

    // 既存のインターフェースを維持: { id } を返す
    return { id: targetId };
  } else {
    // filterが指定されている場合
    logger.debug('Executing deleteOne with filter', {
      requestId,
      resource,
      filter: params.filter,
    });

    // deleteMany({ filter })を呼び出す
    const deleteManyResult = await handleDeleteMany(
      resource,
      {
        filter: params.filter,
      },
      requestId
    );

    // 結果を検証
    if (deleteManyResult.count === 0) {
      // 削除に失敗した場合
      const error = Object.values(deleteManyResult.errors)[0];
      if (error) {
        throw new Error(`Failed to delete record: ${error.message}`);
      } else {
        throw new Error(`No records found matching filter`);
      }
    }

    // 成功した場合は削除されたレコードのIDを取得
    const deletedId = Object.values(deleteManyResult.successIds)[0];
    if (!deletedId) {
      throw new Error('Failed to get deleted record ID');
    }

    logger.info('deleteOne succeeded', {
      requestId,
      resource,
      id: deletedId,
    });

    // 既存のインターフェースを維持: { id } を返す
    return { id: deletedId };
  }
}
