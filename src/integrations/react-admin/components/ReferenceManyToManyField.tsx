/**
 * ReferenceManyToManyField - 多対多関係表示コンポーネント
 *
 * 中間テーブルを経由して関連レコードを取得し、表示します。
 * React-Admin Enterprise Editionを使用せずに多対多関係をサポートします。
 *
 * @example
 * ```typescript
 * <ReferenceManyToManyField
 *   reference="users"
 *   through="venueManagers"
 *   using="venueId,userId"
 *   label="管理者"
 * >
 *   <Datagrid>
 *     <TextField source="nickname" />
 *   </Datagrid>
 * </ReferenceManyToManyField>
 * ```
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { ListContextProvider, useDataProvider, useRecordContext } from 'react-admin';

import type { ReferenceManyToManyFieldProps } from '../types.js';

/**
 * レート制限: 同じリクエストを連続して実行しないための最小間隔（ミリ秒）
 */
const RATE_LIMIT_MS = 1000;

/**
 * ReferenceManyToManyField コンポーネント
 *
 * 多対多関係を表示するためのフィールドコンポーネント。
 * 中間テーブルを経由して関連レコードを取得し、子コンポーネントに渡します。
 */
export const ReferenceManyToManyField = (props: ReferenceManyToManyFieldProps): ReactElement => {
  const {
    reference,
    through,
    using,
    source = 'id',
    children,
    sort = { field: 'id', order: 'ASC' },
  } = props;

  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchTime = useRef<number>(0);
  const fetchCount = useRef<number>(0);

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
        `[ReferenceManyToManyField] Rate limit: skipping fetch (${timeSinceLastFetch}ms since last fetch)`
      );
      return;
    }

    fetchCount.current += 1;
    console.log(`[ReferenceManyToManyField] Fetch #${fetchCount.current} for record:`, recordId);

    // フェッチ回数が異常に多い場合は警告
    if (fetchCount.current > 10) {
      console.error(
        `[ReferenceManyToManyField] WARNING: Too many fetches (${fetchCount.current}). Possible infinite loop!`
      );
      setError(new Error('Too many requests. Please refresh the page.'));
      return;
    }

    lastFetchTime.current = now;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // usingプロパティをパース（例: "venueId,userId" → ["venueId", "userId"]）
        const keys = using.split(',').map((k) => k.trim());
        if (keys.length !== 2) {
          throw new Error(`Invalid using format: "${using}". Expected "sourceKey,targetKey"`);
        }

        const [sourceKey, targetKey] = keys;
        if (!sourceKey || !targetKey) {
          throw new Error(`Invalid using format: "${using}". Expected "sourceKey,targetKey"`);
        }

        // 起点レコードのIDを取得
        const sourceId = recordId;
        if (!sourceId) {
          throw new Error(`Source field "${source}" not found in record`);
        }

        // 1. 中間テーブルから関連IDを取得
        const { data: junctionRecords } = await dataProvider.getList(through, {
          filter: { [sourceKey]: sourceId },
          pagination: { page: 1, perPage: 1000 },
          sort,
        });

        // 中間レコードが存在しない場合は空配列を返す
        if (!junctionRecords || junctionRecords.length === 0) {
          setData([]);
          setTotal(0);
          return;
        }

        // 2. ターゲットIDを抽出
        const targetIds = junctionRecords.map((r: any) => r[targetKey]).filter(Boolean);

        if (targetIds.length === 0) {
          setData([]);
          setTotal(0);
          return;
        }

        // 3. ターゲットレコードを取得
        const { data: targetRecords } = await dataProvider.getMany(reference, {
          ids: targetIds,
        });

        setData(targetRecords);
        setTotal(targetRecords.length);
      } catch (err) {
        // リクエストがキャンセルされた場合はエラーを無視
        if (controller.signal.aborted) {
          return;
        }

        setError(err as Error);
        setData([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // クリーンアップ: コンポーネントがアンマウントされたらリクエストをキャンセル
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, reference, through, using]);

  // ローディング中
  if (loading) {
    return <div>読み込み中...</div>;
  }

  // エラー発生時
  if (error) {
    return <div>エラー: {error.message}</div>;
  }

  // 子コンポーネントにデータを渡す
  // ListContextProviderでラップして、Datagridなどのリストコンポーネントが動作するようにする
  return (
    <ListContextProvider
      value={{
        data,
        total,
        isLoading: false,
        isFetching: false,
        isPending: false,
        error: null,
        resource: reference,
        sort,
        page: 1,
        perPage: data.length,
        setSort: () => {},
        setPage: () => {},
        setPerPage: () => {},
        setFilters: () => {},
        displayedFilters: {},
        filterValues: {},
        showFilter: () => {},
        hideFilter: () => {},
        refetch: () => {},
        hasNextPage: false,
        hasPreviousPage: false,
        selectedIds: [],
        onSelect: () => {},
        onSelectAll: () => {},
        onToggleItem: () => {},
        onUnselectItems: () => {},
      }}
    >
      {children}
    </ListContextProvider>
  );
};
