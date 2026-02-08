/**
 * ReferenceManyToManyInput - 多対多関係編集コンポーネント
 *
 * 中間テーブルを経由して関連レコードを編集します。
 * React-Admin Enterprise Editionを使用せずに多対多関係をサポートします。
 *
 * **重要**: このコンポーネントはフォーム保存時に自動的に中間テーブルを更新します。
 * DataProviderが自動的に処理するため、transform関数を書く必要はありません。
 *
 * NOTE: react-adminの型定義による any の使用
 *
 * このファイルでは、react-adminのDataProviderとコンポーネントの型定義の制約により、
 * 一部で any 型を使用しています。これはreact-adminの設計上の制約です。
 *
 * 実行時の型安全性は以下により確保されています：
 * 1. DataProviderのgetListメソッドは中間テーブルのレコードを返す
 * 2. cloneElementのpropsはreact-adminの標準プロパティ
 * 3. 実際のデータ型は実行時に検証される
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { cloneElement, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { ReferenceArrayInput, useDataProvider, useNotify, useRecordContext } from 'react-admin';

import type { ReferenceManyToManyInputProps } from '../types.js';

/**
 * ReferenceManyToManyInput コンポーネント
 *
 * 多対多関係を編集するための入力コンポーネント。
 * DataProviderが保存時に自動的に中間テーブルを更新します。
 */
export const ReferenceManyToManyInput = (props: ReferenceManyToManyInputProps): ReactElement => {
  const { reference, through, using, source = 'id', children, label, filter } = props;

  // デバッグ: filterを確認
  console.log('ReferenceManyToManyInput filter:', JSON.stringify(filter, null, 2));

  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // usingプロパティをパース
  const keys = using.split(',').map((k) => k.trim());
  if (keys.length !== 2) {
    throw new Error(`Invalid using format: "${using}". Expected "sourceKey,targetKey"`);
  }
  const [sourceKey, targetKey] = keys;

  // recordIdを安定した値として取得
  const recordId = useMemo(() => record?.[source], [record, source]);

  // フィールド名を特殊な形式にして、DataProviderで識別できるようにする
  // フォーマット: __manyToMany_{through}_{sourceKey}_{targetKey}
  const fieldName = `__manyToMany_${through}_${sourceKey}_${targetKey}`;

  // 初期値を取得（マウント時またはrecordIdが変わった時のみ）
  useEffect(() => {
    if (!recordId) {
      setLoading(false);
      setInitialIds([]);
      return;
    }

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
  }, [recordId, through, using]);

  // ローディング中
  if (loading) {
    return <div>読み込み中...</div>;
  }

  // エラー発生時
  if (error) {
    return <div>エラー: {error.message}</div>;
  }

  // フォーム状態として管理
  // DataProviderのupdateメソッドが自動的に中間テーブルを更新します
  return (
    <ReferenceArrayInput source={fieldName} reference={reference} label={label} filter={filter}>
      {cloneElement(children, {
        defaultValue: initialIds,
      } as any)}
    </ReferenceArrayInput>
  );
};
