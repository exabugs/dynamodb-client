/**
 * ReferenceManyToManyInput - 多対多関係編集コンポーネント
 *
 * 中間テーブルを経由して関連レコードを編集します。
 * React-Admin Enterprise Editionを使用せずに多対多関係をサポートします。
 *
 * **重要**: このコンポーネントはフォーム状態のみを管理します。
 * 実際のDB更新は親フォームの保存時に行われます。
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
import { ReferenceArrayInput, useDataProvider, useNotify, useRecordContext } from 'react-admin';

import type { ReferenceManyToManyInputProps } from '../types.js';

/**
 * レート制限: 同じリクエストを連続して実行しないための最小間隔（ミリ秒）
 */
const RATE_LIMIT_MS = 1000;

/**
 * ReferenceManyToManyInput コンポーネント
 *
 * 多対多関係を編集するための入力コンポーネント。
 * フォーム状態のみを管理し、実際のDB更新は親フォームの保存時に行われます。
 */
export const ReferenceManyToManyInput = (props: ReferenceManyToManyInputProps): ReactElement => {
  const { reference, through, using, source = 'id', children, label } = props;

  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [initialIds, setInitialIds] = useState<string[]>([]);
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

  // recordIdを安定した値として取得
  const recordId = useMemo(() => record?.[source], [record, source]);

  // 初期値を取得（マウント時またはrecordIdが変わった時のみ）
  useEffect(() => {
    if (!recordId) {
      setLoading(false);
      setInitialIds([]);
      return;
    }

    // レート制限
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

    if (fetchCount.current > 10) {
      console.error(`[ReferenceManyToManyInput] WARNING: Too many fetches (${fetchCount.current})`);
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
        setInitialIds(ids);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err as Error);
        notify(`関連の取得に失敗しました: ${(err as Error).message}`, { type: 'error' });
        setInitialIds([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentRelations();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, through, using]);

  // ローディング中
  if (loading) {
    return <div>読み込み中...</div>;
  }

  // エラー発生時
  if (error) {
    return <div>エラー: {error.message}</div>;
  }

  // フォーム状態として管理（DB更新はしない）
  // フィールド名を特殊な形式にして、transform関数で識別できるようにする
  const fieldName = `__manyToMany_${through}_${targetKey}`;

  return (
    <ReferenceArrayInput source={fieldName} reference={reference} label={label}>
      {cloneElement(children, {
        defaultValue: initialIds,
      } as any)}
    </ReferenceArrayInput>
  );
};
