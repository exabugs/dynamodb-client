/**
 * updateOne 操作
 * 単一レコードを更新する（JSON Merge Patch形式）
 *
 * 要件: 4.2, 4.4, 5.2, 5.3
 *
 * リファクタリング: updateManyを内部で使用
 */
import { createLogger } from '../../shared/index.js';
import type { UpdateOneParams, UpdateOneResult } from '../types.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * updateOne 操作を実行する
 *
 * 処理フロー:
 * 1. updateMany([id], data)を呼び出す（idまたはfilterから対象を特定）
 * 2. 結果を検証し、失敗した場合は通常のErrorをスロー
 * 3. 成功した場合は items[0] を返却（更新したフィールドのみ）
 *
 * セキュリティ: ADR 001に基づき、更新したフィールドのみを返却
 * - read権限なしでupdate権限のみの場合の情報漏洩を防止
 * - findOneの追加クエリを削減してパフォーマンス向上
 * - updateManyが更新したフィールドを返すため、updateOneは単純にitems[0]を返すだけ
 *
 * @param resource - リソース名
 * @param params - updateOneパラメータ
 * @param requestId - リクエストID
 * @returns 更新されたレコード（idと更新したフィールドのみ）
 * @throws {Error} レコードが存在しない場合、または更新に失敗した場合
 */
export async function handleUpdateOne(
  resource: string,
  params: UpdateOneParams,
  requestId: string
): Promise<UpdateOneResult> {
  const { data: patchData, options } = params;

  // updateManyをインポート
  const { handleUpdateMany } = await import('./updateMany.js');

  // idまたはfilterから対象レコードを特定
  if ('id' in params) {
    // idが指定されている場合
    const targetId = params.id;

    logger.debug('Executing updateOne with id', {
      requestId,
      resource,
      id: targetId,
      upsert: options?.upsert,
    });

    // updateMany([id], data)を呼び出す
    const updateManyResult = await handleUpdateMany(
      resource,
      {
        ids: [targetId],
        data: patchData,
        options,
      },
      requestId
    );

    // 結果を検証
    if (updateManyResult.count === 0) {
      // 更新に失敗した場合
      const error = Object.values(updateManyResult.errors || {})[0];
      if (error) {
        throw new Error(`Failed to update record: ${error.message}`);
      } else {
        throw new Error(`Failed to update record: ${targetId}`);
      }
    }

    // 成功した場合は items[0] を返却（updateManyが更新したフィールドのみを返す）
    if (!updateManyResult.items || updateManyResult.items.length === 0) {
      throw new Error('updateMany did not return items');
    }

    const updatedItem = updateManyResult.items[0];
    if (!updatedItem) {
      throw new Error('updateMany returned empty item');
    }

    // コスト情報を含めて返却
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      id: targetId,
      ...updatedItem,
      consumedCapacity: updateManyResult.consumedCapacity,
    };
  } else {
    // filterが指定されている場合
    logger.debug('Executing updateOne with filter', {
      requestId,
      resource,
      filter: params.filter,
      upsert: options?.upsert,
    });

    // updateMany({ filter }, data)を呼び出す
    const updateManyResult = await handleUpdateMany(
      resource,
      {
        filter: params.filter,
        data: patchData,
        options,
      },
      requestId
    );

    // 結果を検証
    if (updateManyResult.count === 0) {
      // 更新に失敗した場合
      const error = Object.values(updateManyResult.errors || {})[0];
      if (error) {
        throw new Error(`Failed to update record: ${error.message}`);
      } else {
        throw new Error(`No records found matching filter`);
      }
    }

    // 成功した場合は items[0] を返却（updateManyが更新したフィールドのみを返す）
    if (!updateManyResult.items || updateManyResult.items.length === 0) {
      throw new Error('updateMany did not return items');
    }

    const updatedItem = updateManyResult.items[0];
    if (!updatedItem) {
      throw new Error('updateMany returned empty item');
    }

    // 成功した場合は削除されたレコードのIDを取得
    const updatedId = updatedItem.id as string;
    if (!updatedId) {
      throw new Error('Failed to get updated record ID');
    }

    // コスト情報を含めて返却
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      id: updatedId,
      ...updatedItem,
      consumedCapacity: updateManyResult.consumedCapacity,
    };
  }
}
