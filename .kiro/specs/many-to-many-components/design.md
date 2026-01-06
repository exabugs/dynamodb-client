# React-Admin 多対多関係コンポーネント - 設計文書

## 参照

- **要件**: `.kiro/specs/many-to-many-components/requirements.md`

## 概要

dynamodb-clientライブラリに、React-Adminで多対多関係を扱うための専用コンポーネントを追加する。React-Admin Enterprise Edition（有料版）を使用せずに、中間テーブルを透過的に扱える`ReferenceManyToManyField`と`ReferenceManyToManyInput`を提供する。

## アーキテクチャ

### コンポーネント構成

```
src/integrations/react-admin/
├── components/
│   ├── ReferenceManyToManyField.tsx    # 表示用コンポーネント
│   ├── ReferenceManyToManyInput.tsx    # 編集用コンポーネント
│   └── index.ts                        # コンポーネントエクスポート
├── dataProvider.ts                     # 既存DataProvider（拡張）
├── types.ts                            # 型定義
└── index.ts                            # メインエクスポート
```

### データフロー

```
ReferenceManyToManyField
  ↓ useRecordContext() で起点レコード取得
  ↓ dataProvider.getList(through) で中間レコード取得
  ↓ dataProvider.getMany(reference) でターゲットレコード取得
  ↓ 子コンポーネントにデータを渡す

ReferenceManyToManyInput
  ↓ useRecordContext() で起点レコード取得
  ↓ dataProvider.getList(through) で現在の関連取得
  ↓ ユーザーが関連を追加/削除
  ↓ dataProvider.createMany(through) で関連追加
  ↓ dataProvider.deleteMany(through) で関連削除
```

## コンポーネント設計

### ReferenceManyToManyField

#### プロパティ

```typescript
interface ReferenceManyToManyFieldProps {
  /** ターゲットリソース名（例: 'users'） */
  reference: string;
  
  /** 中間テーブル名（例: 'venueManagers'） */
  through: string;
  
  /** キーのペア（例: 'venueId,userId'） */
  using: string;
  
  /** 起点フィールド名（デフォルト: 'id'） */
  source?: string;
  
  /** 子コンポーネント（例: <Datagrid>） */
  children: ReactElement;
  
  /** ラベル */
  label?: string;
  
  /** ソート設定 */
  sort?: { field: string; order: 'ASC' | 'DESC' };
  
  /** ページネーション設定 */
  perPage?: number;
}
```

#### 実装

```typescript
import { useRecordContext, useDataProvider } from 'react-admin';
import { useState, useEffect, cloneElement, ReactElement } from 'react';

export const ReferenceManyToManyField = (props: ReferenceManyToManyFieldProps) => {
  const {
    reference,
    through,
    using,
    source = 'id',
    children,
    sort = { field: 'id', order: 'ASC' },
    perPage = 25,
  } = props;

  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!record) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // usingプロパティをパース（例: "venueId,userId" → ["venueId", "userId"]）
        const [sourceKey, targetKey] = using.split(',').map(k => k.trim());
        if (!sourceKey || !targetKey) {
          throw new Error(`Invalid using format: "${using}". Expected "sourceKey,targetKey"`);
        }

        const sourceId = record[source];
        if (!sourceId) {
          throw new Error(`Source field "${source}" not found in record`);
        }

        // 1. 中間テーブルから関連IDを取得
        const { data: junctionRecords } = await dataProvider.getList(through, {
          filter: { [sourceKey]: sourceId },
          pagination: { page: 1, perPage: 1000 },
          sort,
        });

        if (junctionRecords.length === 0) {
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
        setError(err as Error);
        setData([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [record, reference, through, using, source, dataProvider, sort, perPage]);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (error) {
    return <div>エラー: {error.message}</div>;
  }

  // 子コンポーネントにデータを渡す
  return cloneElement(children, {
    data,
    total,
    loaded: true,
    loading: false,
  });
};
```

### ReferenceManyToManyInput

#### プロパティ

```typescript
interface ReferenceManyToManyInputProps {
  /** ターゲットリソース名（例: 'users'） */
  reference: string;
  
  /** 中間テーブル名（例: 'venueManagers'） */
  through: string;
  
  /** キーのペア（例: 'venueId,userId'） */
  using: string;
  
  /** 起点フィールド名（デフォルト: 'id'） */
  source?: string;
  
  /** 子コンポーネント（例: <AutocompleteArrayInput>） */
  children: ReactElement;
  
  /** ラベル */
  label?: string;
}
```

#### 実装

```typescript
import {
  useRecordContext,
  useDataProvider,
  useNotify,
  useRefresh,
  useInput,
} from 'react-admin';
import { useState, useEffect, cloneElement, ReactElement } from 'react';

export const ReferenceManyToManyInput = (props: ReferenceManyToManyInputProps) => {
  const {
    reference,
    through,
    using,
    source = 'id',
    children,
    label,
  } = props;

  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [currentIds, setCurrentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // usingプロパティをパース
  const [sourceKey, targetKey] = using.split(',').map(k => k.trim());

  useEffect(() => {
    if (!record) return;

    const fetchCurrentRelations = async () => {
      try {
        setLoading(true);

        const sourceId = record[source];
        if (!sourceId) return;

        // 現在の関連を取得
        const { data: junctionRecords } = await dataProvider.getList(through, {
          filter: { [sourceKey]: sourceId },
          pagination: { page: 1, perPage: 1000 },
          sort: { field: 'id', order: 'ASC' },
        });

        const ids = junctionRecords.map((r: any) => r[targetKey]).filter(Boolean);
        setCurrentIds(ids);
      } catch (error) {
        notify(`関連の取得に失敗しました: ${error}`, { type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentRelations();
  }, [record, through, using, source, dataProvider, sourceKey, targetKey, notify]);

  const handleChange = async (newIds: string[]) => {
    if (!record) return;

    const sourceId = record[source];
    if (!sourceId) return;

    try {
      // 追加された関連
      const addedIds = newIds.filter(id => !currentIds.includes(id));
      
      // 削除された関連
      const removedIds = currentIds.filter(id => !newIds.includes(id));

      // 追加処理
      if (addedIds.length > 0) {
        const junctionRecords = addedIds.map(targetId => ({
          [sourceKey]: sourceId,
          [targetKey]: targetId,
        }));

        await dataProvider.createMany(through, { data: junctionRecords });
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
    } catch (error) {
      notify(`関連の更新に失敗しました: ${error}`, { type: 'error' });
    }
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  // 子コンポーネントにデータを渡す
  return cloneElement(children, {
    source: 'relatedIds',
    label,
    value: currentIds,
    onChange: handleChange,
    reference,
  });
};
```

## DataProvider拡張

既存のDataProviderは既に`getMany`、`createMany`、`deleteMany`をサポートしているため、追加の拡張は不要。

### 確認事項

- ✅ `getMany`: 複数IDでレコード取得（実装済み）
- ✅ `createMany`: 複数レコード作成（`create`を複数回呼ぶ実装が必要）
- ✅ `deleteMany`: 複数レコード削除（実装済み）

### createManyの追加実装

現在のDataProviderには`createMany`がないため、追加が必要：

```typescript
/**
 * createMany - 複数レコード一括作成
 */
createMany: async <RecordType extends { id: string | number } = any>(
  resource: string,
  params: { data: Partial<RecordType>[] }
) => {
  const client = createClient();
  await client.connect();

  try {
    const db = client.db();
    const collection = db.collection(resource);

    // 複数レコードを挿入
    const result = await collection.insertMany(params.data);

    // 挿入されたレコードを取得
    const items = await collection
      .find({ id: { $in: result.insertedIds } })
      .toArray();

    return { data: items as RecordType[] };
  } finally {
    await client.close();
  }
},
```

## 型定義

```typescript
// src/integrations/react-admin/types.ts に追加

import { ReactElement } from 'react';

/**
 * ReferenceManyToManyField プロパティ
 */
export interface ReferenceManyToManyFieldProps {
  reference: string;
  through: string;
  using: string;
  source?: string;
  children: ReactElement;
  label?: string;
  sort?: { field: string; order: 'ASC' | 'DESC' };
  perPage?: number;
}

/**
 * ReferenceManyToManyInput プロパティ
 */
export interface ReferenceManyToManyInputProps {
  reference: string;
  through: string;
  using: string;
  source?: string;
  children: ReactElement;
  label?: string;
}
```

## エクスポート構造

```typescript
// src/integrations/react-admin/components/index.ts
export { ReferenceManyToManyField } from './ReferenceManyToManyField';
export { ReferenceManyToManyInput } from './ReferenceManyToManyInput';

// src/integrations/react-admin/index.ts
export { createDataProvider } from './dataProvider';
export type { DataProviderOptions, TokenProvider } from './types';
export { ReferenceManyToManyField, ReferenceManyToManyInput } from './components';
export type {
  ReferenceManyToManyFieldProps,
  ReferenceManyToManyInputProps,
} from './types';
```

## 使用例

### VenueShow（表示）

```typescript
import { Show, SimpleShowLayout, TextField } from 'react-admin';
import { ReferenceManyToManyField } from '@exabugs/dynamodb-client/integrations/react-admin';

export const VenueShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="name" label="開催地名" />
      
      <ReferenceManyToManyField
        reference="users"
        through="venueManagers"
        using="venueId,userId"
        label="管理者"
      >
        <Datagrid>
          <TextField source="nickname" label="ニックネーム" />
          <TextField source="email" label="メール" />
        </Datagrid>
      </ReferenceManyToManyField>
    </SimpleShowLayout>
  </Show>
);
```

### VenueEdit（編集）

```typescript
import { Edit, SimpleForm, TextInput, AutocompleteArrayInput } from 'react-admin';
import { ReferenceManyToManyInput } from '@exabugs/dynamodb-client/integrations/react-admin';

export const VenueEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" label="開催地名" />
      
      <ReferenceManyToManyInput
        reference="users"
        through="venueManagers"
        using="venueId,userId"
        label="管理者"
      >
        <AutocompleteArrayInput
          optionText="nickname"
          filterToQuery={searchText => ({ nickname: searchText })}
        />
      </ReferenceManyToManyInput>
    </SimpleForm>
  </Edit>
);
```

### UserShow（逆方向）

```typescript
import { Show, SimpleShowLayout, TextField } from 'react-admin';
import { ReferenceManyToManyField } from '@exabugs/dynamodb-client/integrations/react-admin';

export const UserShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="nickname" label="ニックネーム" />
      
      <ReferenceManyToManyField
        reference="venues"
        through="venueManagers"
        using="userId,venueId"
        label="管理している開催地"
      >
        <Datagrid>
          <TextField source="name" label="開催地名" />
          <TextField source="location.address" label="住所" />
        </Datagrid>
      </ReferenceManyToManyField>
    </SimpleShowLayout>
  </Show>
);
```

## エラーハンドリング

### エラーケース

1. **usingプロパティの形式が無効**
   ```typescript
   throw new Error(`Invalid using format: "${using}". Expected "sourceKey,targetKey"`);
   ```

2. **起点フィールドが見つからない**
   ```typescript
   throw new Error(`Source field "${source}" not found in record`);
   ```

3. **中間テーブルが存在しない**
   ```typescript
   // DataProviderが404エラーを返す
   notify(`中間テーブル "${through}" が見つかりません`, { type: 'error' });
   ```

4. **ターゲットリソースが存在しない**
   ```typescript
   // DataProviderが404エラーを返す
   notify(`リソース "${reference}" が見つかりません`, { type: 'error' });
   ```

5. **ネットワークエラー**
   ```typescript
   notify(`ネットワークエラーが発生しました: ${error.message}`, { type: 'error' });
   ```

## パフォーマンス最適化

### 1. バッチクエリ

中間テーブルのクエリは1回で実行：

```typescript
const { data: junctionRecords } = await dataProvider.getList(through, {
  filter: { [sourceKey]: sourceId },
  pagination: { page: 1, perPage: 1000 },
  sort,
});
```

### 2. getMany使用

ターゲットレコードは`getMany`で一括取得：

```typescript
const { data: targetRecords } = await dataProvider.getMany(reference, {
  ids: targetIds,
});
```

### 3. リクエストキャンセル

コンポーネントがアンマウントされた場合、保留中のリクエストをキャンセル：

```typescript
useEffect(() => {
  const controller = new AbortController();
  
  const fetchData = async () => {
    // ... fetch logic with signal: controller.signal
  };
  
  fetchData();
  
  return () => controller.abort();
}, [dependencies]);
```

### 4. キャッシュ活用

React-Adminの内部キャッシュを活用（`useDataProvider`が自動的に処理）

## テスト戦略

### ユニットテスト

1. **ReferenceManyToManyField**
   - usingプロパティのパース
   - 中間レコードの取得
   - ターゲットレコードの取得
   - エラーハンドリング

2. **ReferenceManyToManyInput**
   - 現在の関連の取得
   - 関連の追加
   - 関連の削除
   - エラーハンドリング

3. **DataProvider**
   - createManyの動作確認

### 統合テスト

1. **表示フロー**
   - VenueShow画面で管理者一覧が表示される
   - UserShow画面で管理venue一覧が表示される

2. **編集フロー**
   - VenueEdit画面で管理者を追加できる
   - VenueEdit画面で管理者を削除できる

## 正確性プロパティ

*プロパティとは、すべての有効な実行において真であるべき特性や動作のことです。*

### Property 1: usingプロパティのパース

*For any* valid using string in format "sourceKey,targetKey", parsing SHALL produce exactly two non-empty keys

**Validates: Requirements 4.3**

### Property 2: 中間レコード取得の一貫性

*For any* source record with ID, querying junction table SHALL return all junction records where sourceKey matches the source ID

**Validates: Requirements 1.2**

### Property 3: ターゲットレコード取得の完全性

*For any* set of junction records, fetching target records SHALL return all records whose IDs appear in the junction records

**Validates: Requirements 1.3**

### Property 4: 関連追加の冪等性

*For any* source-target pair, adding the same relation twice SHALL result in only one junction record

**Validates: Requirements 2.2**

### Property 5: 関連削除の完全性

*For any* source-target pair, removing a relation SHALL delete the corresponding junction record and no other records

**Validates: Requirements 2.3**

### Property 6: バッチ操作の原子性

*For any* set of relations to add or remove, if any operation fails, all operations SHALL be rolled back

**Validates: Requirements 2.4, 2.5**

### Property 7: エラーメッセージの明確性

*For any* error condition, the error message SHALL include the resource name and operation that failed

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 8: データ整合性の保持

*For any* many-to-many operation, the operation SHALL not affect unrelated records

**Validates: Requirements 10.1, 10.2**

## セキュリティ考慮事項

1. **認証トークンの検証**
   - すべてのDataProvider呼び出しで認証トークンを検証
   - トークンが無効な場合はエラーを返す

2. **権限チェック**
   - Lambda側で権限チェックを実施
   - 不正な操作は403エラーを返す

3. **入力検証**
   - usingプロパティの形式を検証
   - 不正な形式の場合はエラーを返す

## ドキュメント

### README.md に追加

```markdown
## 多対多関係のサポート

dynamodb-clientは、React-Adminで多対多関係を扱うための専用コンポーネントを提供します。

### ReferenceManyToManyField（表示用）

中間テーブルを経由して関連レコードを表示します。

\`\`\`typescript
import { ReferenceManyToManyField } from '@exabugs/dynamodb-client/integrations/react-admin';

<ReferenceManyToManyField
  reference="users"
  through="venueManagers"
  using="venueId,userId"
  label="管理者"
>
  <Datagrid>
    <TextField source="nickname" />
  </Datagrid>
</ReferenceManyToManyField>
\`\`\`

### ReferenceManyToManyInput（編集用）

中間テーブルを経由して関連レコードを編集します。

\`\`\`typescript
import { ReferenceManyToManyInput } from '@exabugs/dynamodb-client/integrations/react-admin';

<ReferenceManyToManyInput
  reference="users"
  through="venueManagers"
  using="venueId,userId"
  label="管理者"
>
  <AutocompleteArrayInput optionText="nickname" />
</ReferenceManyToManyInput>
\`\`\`

### プロパティ

- `reference`: ターゲットリソース名
- `through`: 中間テーブル名
- `using`: キーのペア（"sourceKey,targetKey"形式）
- `source`: 起点フィールド名（デフォルト: "id"）
- `label`: ラベル
- `children`: 子コンポーネント
```

## 実装計画

1. **型定義の追加** (src/integrations/react-admin/types.ts)
   - ReferenceManyToManyFieldProps
   - ReferenceManyToManyInputProps

2. **ReferenceManyToManyFieldの実装** (src/integrations/react-admin/components/ReferenceManyToManyField.tsx)
   - 基本実装
   - エラーハンドリング
   - パフォーマンス最適化

3. **ReferenceManyToManyInputの実装** (src/integrations/react-admin/components/ReferenceManyToManyInput.tsx)
   - 基本実装
   - 関連の追加・削除
   - エラーハンドリング

4. **DataProviderの拡張** (src/integrations/react-admin/dataProvider.ts)
   - createManyの追加

5. **エクスポートの更新** (src/integrations/react-admin/index.ts)
   - 新しいコンポーネントのエクスポート

6. **テストの実装**
   - ユニットテスト
   - 統合テスト

7. **ドキュメントの更新**
   - README.md
   - TypeScript型定義
