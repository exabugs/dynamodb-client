import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { ListContextProvider, useGetList, useGetMany, useRecordContext } from 'react-admin';

import { BASE_LIST_CONTEXT, DEFAULT_SORT, parseUsing } from './types.js';
import type { ReferenceManyToManyFieldProps } from './types.js';

interface JunctionRecord {
  id: string;
  [key: string]: unknown;
}

interface EnrichedRecord {
  id: string;
  _through: JunctionRecord | null;
  [key: string]: unknown;
}

export const ReferenceManyToManyField = (props: ReferenceManyToManyFieldProps): ReactElement => {
  const { reference, through, using, source = 'id', children, sort = DEFAULT_SORT } = props;

  const record = useRecordContext();
  const recordId = record?.[source] as string | undefined;

  const [sourceKey, targetKey] = parseUsing(using);

  const {
    data: junctionRecords,
    isPending: junctionPending,
    error: junctionError,
  } = useGetList(
    through,
    {
      filter: { [sourceKey]: recordId },
      pagination: { page: 1, perPage: 1000 },
      sort,
    },
    { enabled: !!recordId }
  );

  const { targetIds, junctionMap } = useMemo(() => {
    const ids: string[] = [];
    const map = new Map<string, JunctionRecord>();
    (junctionRecords ?? []).forEach((j) => {
      const targetId = j[targetKey] as string;
      if (targetId) {
        ids.push(targetId);
        map.set(targetId, j as JunctionRecord);
      }
    });
    return { targetIds: ids, junctionMap: map };
  }, [junctionRecords, targetKey]);

  const {
    data: targetRecords,
    isPending: targetPending,
    error: targetError,
  } = useGetMany(reference, { ids: targetIds }, { enabled: targetIds.length > 0 });

  const enrichedRecords = useMemo<EnrichedRecord[]>(
    () =>
      (targetRecords ?? []).map((r) => ({
        ...(r as { id: string; [key: string]: unknown }),
        _through: junctionMap.get(String(r.id)) ?? null,
      })),
    [targetRecords, junctionMap]
  );

  const total = enrichedRecords.length;
  const loading = junctionPending || (targetIds.length > 0 && targetPending);
  const error = junctionError ?? targetError;

  const listContextValue = useMemo(
    () => ({
      ...BASE_LIST_CONTEXT,
      data: enrichedRecords,
      total,
      perPage: total,
      resource: reference,
      sort,
    }),
    [enrichedRecords, total, sort, reference]
  );

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {(error as Error).message}</div>;

  return <ListContextProvider value={listContextValue}>{children}</ListContextProvider>;
};
