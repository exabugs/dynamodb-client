import { useQueryClient } from '@tanstack/react-query';

import { cloneElement, useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  ReferenceArrayInput,
  useGetList,
  useRecordContext,
  useRegisterMutationMiddleware,
} from 'react-admin';

import { DEFAULT_SORT, parseUsing } from './types.js';
import type { ReferenceManyToManyInputProps } from './types.js';

export const ReferenceManyToManyInput = (props: ReferenceManyToManyInputProps): ReactElement => {
  const { reference, through, using, source = 'id', children, label, filter } = props;

  const record = useRecordContext();
  const recordId = record?.[source] as string | undefined;

  const [sourceKey, targetKey] = parseUsing(using);

  // crudRouter が __manyToMany:{through}:{sourceKey}:{targetKey} 形式を解釈して中間テーブルを更新する
  const fieldName = `__manyToMany:${through}:${sourceKey}:${targetKey}`;

  const {
    data: junctionRecords,
    isPending,
    error,
  } = useGetList(
    through,
    {
      filter: { [sourceKey]: recordId },
      pagination: { page: 1, perPage: 1000 },
      sort: DEFAULT_SORT,
    },
    { enabled: !!recordId }
  );

  const initialIds = useMemo(
    () => (junctionRecords ?? []).map((r) => r[targetKey] as string).filter(Boolean),
    [junctionRecords, targetKey]
  );

  // 保存後に中間テーブルのキャッシュだけをピンポイント invalidate する。
  // onSuccess で渡すとデフォルトの redirect/notify が失われるため、middleware で割り込む。
  const queryClient = useQueryClient();
  const middleware = useCallback(
    async (
      resource: string,
      params: unknown,
      next: (resource: string, params: unknown) => Promise<unknown>
    ) => {
      const result = await next(resource, params);
      queryClient.invalidateQueries({ queryKey: [through] });
      return result;
    },
    [through, queryClient]
  );
  useRegisterMutationMiddleware(middleware);

  if (isPending && !!recordId) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {(error as Error).message}</div>;

  return (
    <ReferenceArrayInput source={fieldName} reference={reference} label={label} filter={filter}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {cloneElement(children, { defaultValue: initialIds } as any)}
    </ReferenceArrayInput>
  );
};
