# DataGrid ソート可能フィールドの自動判定

## 概要

カスタム `DataGrid` コンポーネントは、`config/shadow.config.json` の設定に基づいて、各フィールドのソート可能性を自動的に判定します。

## 判定ルール

### 1. 必須シャドー（常にソート可能）

以下のフィールドは、すべてのリソースで常にソート可能です：

- `id` - レコードID（ULID）
- `name` - レコード名
- `createdAt` - 作成日時
- `updatedAt` - 更新日時

これらのフィールドは、DynamoDB Single-Table設計において、すべてのレコードに自動的にシャドウレコードが生成されます。

### 2. カスタムシャドー（設定に基づく）

`config/shadow.config.json` の `resources.[resourceName].shadows` に定義されたフィールドは、ソート可能として扱われます。

**例: articles リソース**

```json
{
  "resources": {
    "articles": {
      "shadows": {
        "priority": { "type": "number" },
        "category": { "type": "string" },
        "status": { "type": "string" }
      }
    }
  }
}
```

この設定により、`articles` リソースでは以下のフィールドがソート可能になります：

- `id`, `name`, `createdAt`, `updatedAt` （必須シャドー）
- `priority`, `category`, `status` （カスタムシャドー）

## 実装

### DataGrid コンポーネント

`apps/admin/src/components/DataGrid.tsx` で実装されています。

```typescript
/**
 * フィールドがソート可能かどうかを判定する
 */
function isSortableField(resource: string | undefined, field: string): boolean {
  // 必須シャドーは常にソート可能
  const mandatoryShadows = ['id', 'name', 'createdAt', 'updatedAt'];
  if (mandatoryShadows.includes(field)) {
    return true;
  }

  // shadow.config.json の shadows 定義をチェック
  const resourceConfig = shadowConfig.resources?.[resource];
  if (!resourceConfig) return false;

  const shadows = resourceConfig.shadows || {};
  return field in shadows;
}
```

### 使用例

```tsx
import { List, TextField, NumberField, DateField } from 'react-admin';
import { Datagrid } from '../components/DataGrid';

export const ArticleList = () => (
  <List>
    <Datagrid>
      {/* 必須シャドー: 常にソート可能 */}
      <TextField source="id" />
      <TextField source="name" />
      <DateField source="createdAt" />
      <DateField source="updatedAt" />

      {/* カスタムシャドー: shadow.config.json に定義されている場合のみソート可能 */}
      <NumberField source="priority" />
      <TextField source="category" />
      <TextField source="status" />

      {/* シャドーなし: ソート不可 */}
      <TextField source="description" />
    </Datagrid>
  </List>
);
```

## 設定の同期

`shadow.config.json` は `@config` エイリアスを使用して直接インポートされます。

```typescript
import shadowConfigRaw from '@config/shadow.config.json';
```

**重要**: `config/shadow.config.json` を更新した場合、アプリケーションを再ビルドする必要があります。開発サーバーは自動的に変更を検出してリロードします。

### 設定ファイル

- **設定ファイル**: `/config/shadow.config.json`
- **型定義ファイル**: `/config/shadow.config.d.ts`
- **Vite エイリアス**: `@config` → `/../../config` (apps/admin から見た相対パス)
- **TypeScript パス**: `@config/*` → `../../config/*`

## 関連ドキュメント

- [フィルタリングとページネーション](./filtering-and-pagination.md) - 複数フィールドのAND検索と無限スクロールの仕組み

## トラブルシューティング

### フィールドがソート可能にならない

1. `config/shadow.config.json` に該当フィールドが定義されているか確認
2. `DataGrid.tsx` の `shadowConfig` 定数が最新の設定と同期しているか確認
3. リソース名が正しいか確認（例: "article" ではなく "articles"）

### 必須シャドーがソート不可になる

`id`, `name`, `createdAt`, `updatedAt` は常にソート可能です。もしソート不可になっている場合は、`isSortableField` 関数の実装を確認してください。
