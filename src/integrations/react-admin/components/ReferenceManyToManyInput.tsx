/**
 * ReferenceManyToManyInput - 多対多関係編集コンポーネント
 *
 * 中間テーブルを経由して関連レコードを編集します。
 * React-Admin Enterprise Editionを使用せずに多対多関係をサポートします。
 *
 * @example
 * ```typescript
 * <ReferenceManyToManyInput
 *   reference="users"
 *   through="venueManagers"
 *   using="venueId,userId"
 *   label="管理者"
 * >
 *   <AutocompleteArrayInput optionText="nickname" />
 * </ReferenceManyToManyInput>
 * ```
 */
import { cloneElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useDataProvider, useNotify, useRecordContext, useRefresh } from 'react-admin';

import type { ReferenceManyToManyInputProps } from '../types.js';

/**
 * レート制限: 同じリクエストを連続して実行しないための最小間隔（ミリ秒）
 */
const RATE_LIMIT_MS = 1000;

/**
 * ReferenceManyToManyInput コンポーネント
 *
 * 多対多関係を編集するための入力コンポーネント。
 * 中間テーブルを経由して関連レコードを追加・削除します。
 */
export const ReferenceManyToManyInput = (props: ReferenceManyToManyInputProps): ReactElement => {
  const { reference, through, using, source = 'id', children, label } = props;

  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [currentIds, setCurrentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchTime = useRef<number>(0);
  const fetchCount = useRef<number>(0);

  // usingプロパティをパース
  const keys = using.split(',').map((k) => k.trim());
  if (keys.length !== 2) {
    throw new Error(`Invalid using format: "${using}". Expected "sourceKey,targetKey"`);
  }
  const [sourceKey, targetKey] = keys;

  // recordIdを安定した値として取得（recordオブジェクトの参照が変わってもIDが同じなら再フェッチしない）
  const recordId = useMemo(() => record?.[source], [record, source]);

  useEffect(() => {
    // レコードIDが存在しない場合は何もしない
    if (!recordId) {
      setLoading(false);
      return;
    }

    // レート制限: 前回のフェッチから一定時間経過していない場合はスキップ
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (timeSinceLastFetch < RATE_LIMIT_MS) {
      console.warn(
        `[ReferenceManyToManyInput] Rate limit: skipping fetch (${timeSinceLastFetch}ms since last fetch)`
      );
      return;
    }

    fetchCount.current += 1;
    console.log(`[ReferenceManyToManyInput] Fetch #${fetchCount.current} for record:`, recordId);

    // フェッチ回数が異常に多い場合は警告
    if (fetchCount.current > 10) {
      console.error(
        `[ReferenceManyToManyInput] WARNING: Too many fetches (${fetchCount.current}). Possible infinite loop!`
      );
      setError(new Error('Too many requests. Please refresh the page.'));
      return;
    }

    lastFetchTime.current = now;
    const controller = new AbortController();

    const fetchCurrentRelations = async () => {
      try {
        setLoading(true);
        setError(null);

        const sourceId = recordId;
        if (!sourceId) {
          throw new Error(`Source field "${source}" not found in record`);
        }

        // 現在の関連を取得
        const { data: junctionRecords } = await dataProvider.getList(through, {
          filter: { [sourceKey]: sourceId },
          pagination: { page: 1, perPage: 1000 },
          sort: { field: 'id', order: 'ASC' },
        });

        const ids = junctionRecords.map((r: any) => r[targetKey]).filter(Boolean);
        setCurrentIds(ids);
      } catch (err) {
        // リクエストがキャンセルされた場合はエラーを無視
        if (controller.signal.aborted) {
          return;
        }

        setError(err as Error);
        notify(`関連の取得に失敗しました: ${(err as Error).message}`, { type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentRelations();

    // クリーンアップ: コンポーネントがアンマウントされたらリクエストをキャンセル
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, through, using]);

  const handleChange = async (newIds: string[]) => {
    if (!recordId) {
      notify(`Source field "${source}" not found in record`, { type: 'error' });
      return;
    }

    const sourceId = recordId;

    try {
      // 追加された関連
      const addedIds = newIds.filter((id) => !currentIds.includes(id));

      // 削除された関連
      const removedIds = currentIds.filter((id) => !newIds.includes(id));

      // 追加処理
      if (addedIds.length > 0) {
        const junctionRecords = addedIds.map((targetId) => ({
          [sourceKey]: sourceId,
          [targetKey]: targetId,
        }));

        // createManyがない場合は、個別にcreateを呼ぶ
        for (const junctionRecord of junctionRecords) {
          await dataProvider.create(through, { data: junctionRecord });
        }
      }

      // 削除処理
      if (removedIds.length > 0) {
        // 削除する中間レコードのIDを取得
        const { data: junctionRecords } = await dataProvider.getList(through, {
          filter: {
            [sourceKey]: sourceId,
            [targetKey]: { $in: removedIds },
          },
          pagination: { page: 1, perPage: 1000 },
          sort: { field: 'id', order: 'ASC' },
        });

        const junctionIds = junctionRecords.map((r: any) => r.id);
        if (junctionIds.length > 0) {
          await dataProvider.deleteMany(through, { ids: junctionIds });
        }
      }

      setCurrentIds(newIds);
      notify('関連を更新しました', { type: 'success' });
      refresh();
    } catch (err) {
      notify(`関連の更新に失敗しました: ${(err as Error).message}`, { type: 'error' });
    }
  };

  // ローディング中
  if (loading) {
    return <div>読み込み中...</div>;
  }

  // エラー発生時
  if (error) {
    return <div>エラー: {error.message}</div>;
  }

  // 子コンポーネントにデータを渡す
  return cloneElement(children, {
    source: 'relatedIds',
    label,
    value: currentIds,
    onChange: handleChange,
    reference,
  } as any);
};
