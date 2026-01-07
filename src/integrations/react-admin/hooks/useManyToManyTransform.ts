/**
 * useManyToManyTransform - 多対多関係の保存時処理フック
 *
 * フォーム保存時に中間テーブルを更新するためのtransform関数を提供します。
 *
 * @example
 * ```typescript
 * const transform = useManyToManyTransform([
 *   { through: 'venueManagers', sourceKey: 'venueId', targetKey: 'userId' },
 * ]);
 *
 * <Edit transform={transform}>
 *   <SimpleForm>
 *     <ReferenceManyToManyInput
 *       reference="users"
 *       through="venueManagers"
 *       using="venueId,userId"
 *     >
 *       <AutocompleteArrayInput optionText="nickname" />
 *     </ReferenceManyToManyInput>
 *   </SimpleForm>
 * </Edit>
 * ```
 */
import { useCallback } from 'react';
import { useDataProvider, useNotify } from 'react-admin';

/**
 * 多対多関係の設定
 */
export interface ManyToManyConfig {
  /** 中間テーブル名 */
  through: string;
  /** 起点キー名 */
  sourceKey: string;
  /** ターゲットキー名 */
  targetKey: string;
}

/**
 * 多対多関係の保存時処理フック
 *
 * @param configs - 多対多関係の設定配列
 * @returns transform関数
 */
export const useManyToManyTransform = (configs: ManyToManyConfig[]) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();

  return useCallback(
    async (data: any) => {
      const cleanData = { ...data };

      // 各多対多関係を処理
      for (const config of configs) {
        const { through, sourceKey, targetKey } = config;
        const fieldName = `__manyToMany_${through}_${targetKey}`;
        const newIds = cleanData[fieldName];

        // フィールドが存在しない場合はスキップ
        if (newIds === undefined) {
          continue;
        }

        // フィールドを削除（DBに保存しない）
        delete cleanData[fieldName];

        // レコードIDが存在しない場合はスキップ（新規作成時）
        if (!cleanData.id) {
          console.warn(`[useManyToManyTransform] Skipping ${through} update: record ID not found`);
          continue;
        }

        try {
          await updateManyToManyRelations(
            dataProvider,
            through,
            sourceKey,
            targetKey,
            cleanData.id,
            newIds
          );
        } catch (error) {
          notify(`関連の更新に失敗しました (${through}): ${(error as Error).message}`, {
            type: 'error',
          });
          throw error;
        }
      }

      return cleanData;
    },
    [dataProvider, notify, configs]
  );
};

/**
 * 多対多関係を更新する内部関数
 */
async function updateManyToManyRelations(
  dataProvider: any,
  through: string,
  sourceKey: string,
  targetKey: string,
  sourceId: string,
  newIds: string[]
) {
  // 現在の関連を取得
  const { data: currentJunctions } = await dataProvider.getList(through, {
    filter: { [sourceKey]: sourceId },
    pagination: { page: 1, perPage: 1000 },
    sort: { field: 'id', order: 'ASC' },
  });

  const currentIds = currentJunctions.map((r: any) => r[targetKey]) as string[];

  // 追加された関連
  const addedIds = newIds.filter((id: string) => !currentIds.includes(id));

  // 削除された関連
  const removedIds = currentIds.filter((id: string) => !newIds.includes(id));

  // 追加処理
  if (addedIds.length > 0) {
    for (const targetId of addedIds) {
      await dataProvider.create(through, {
        data: { [sourceKey]: sourceId, [targetKey]: targetId },
      });
    }
  }

  // 削除処理
  if (removedIds.length > 0) {
    const junctionsToDelete = currentJunctions.filter((r: any) =>
      removedIds.includes(r[targetKey])
    );
    const idsToDelete = junctionsToDelete.map((r: any) => r.id);

    if (idsToDelete.length > 0) {
      await dataProvider.deleteMany(through, { ids: idsToDelete });
    }
  }
}
