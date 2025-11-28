---
inclusion: always
---

# シャドウ設定の自動生成

## 概要

`shadow.config.json` は TypeScript のスキーマ定義（`SchemaRegistryConfig`）から自動生成されます。手動で編集しないでください。

## Single Source of Truth

**`packages/api-types/src/schema.ts` の `SchemaRegistryConfig` が唯一の情報源です。**

すべてのリソーススキーマはここで定義され、ビルド時に `config/shadow.config.json` が自動生成されます。

## 生成プロセス

### ビルド時の自動生成

```bash
cd packages/api-types
pnpm build
```

ビルド時に以下が実行されます：

1. TypeScript のコンパイル（`tsc`）
2. `src/scripts/generate-shadow-config.ts` の実行
3. `config/shadow.config.json` の生成

### 生成スクリプト

- **TypeScript ソース**: `packages/api-types/src/scripts/generate-shadow-config.ts`
- **コンパイル済み**: `packages/api-types/dist/scripts/generate-shadow-config.js`

スクリプトは以下を実行します：

1. コンパイル済みの `SchemaRegistryConfig` を動的インポート
2. リソーススキーマを `shadow.config.json` 形式に変換
3. プロジェクトルートの `config/shadow.config.json` に出力

## 命名規則

リソースを追加する際は、以下の命名規則に従ってください。

### ファイル名とインターフェース名の対応

| 要素 | 命名規則 | 例 |
|------|---------|-----|
| **インターフェース名** | 大文字単数形（PascalCase） | `Article`, `Task`, `Video` |
| **型定義ファイル名** | インターフェース名 + `.ts` | `Article.ts`, `Task.ts`, `Video.ts` |
| **スキーマ名** | インターフェース名 + `Schema` | `ArticleSchema`, `TaskSchema`, `VideoSchema` |
| **リソース名（resource）** | 小文字複数形 | `articles`, `tasks`, `videos` |
| **リソースファイル名（react-admin）** | リソース名 + `.tsx` | `articles.tsx`, `tasks.tsx`, `videos.tsx` |

### 命名規則の重要性

これらの命名規則は以下の理由で重要です：

1. **自動テスト**: リソース整合性テストが命名規則に基づいて自動的にファイルを検索
2. **一貫性**: プロジェクト全体で統一された命名により、コードの可読性が向上
3. **保守性**: 新しいリソースを追加する際の迷いを排除

### 不規則な複数形の扱い

英語の不規則な複数形（person→people、child→childrenなど）を使用する場合は、スキーマ定義の`resource`フィールドで明示的に指定してください：

```typescript
export const PersonSchema: SchemaDefinition<Person> = {
  resource: 'people', // 不規則な複数形を明示
  // ...
};
```

## 新しいリソースの追加

### 1. モデル定義を作成

`packages/api-types/src/models/YourResource.ts`:

```typescript
import { SchemaDefinition, ShadowFieldType } from '../schema.js';

export interface YourResource {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const YourResourceSchema: SchemaDefinition<YourResource> = {
  resource: 'yourResources',
  type: {} as YourResource,
  shadows: {
    sortableFields: {
      name: { type: 'string' as ShadowFieldType.String },
      status: { type: 'string' as ShadowFieldType.String },
      createdAt: { type: 'datetime' as ShadowFieldType.Datetime },
      updatedAt: { type: 'datetime' as ShadowFieldType.Datetime },
    },
  },
};
```

### 2. スキーマレジストリに登録

`packages/api-types/src/schema.ts`:

```typescript
import { YourResourceSchema } from './models/YourResource.js';

export const SchemaRegistryConfig: SchemaRegistryConfig = {
  database: {
    name: 'ainews',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  resources: {
    articles: ArticleSchema,
    tasks: TaskSchema,
    yourResources: YourResourceSchema, // 追加
  },
};
```

### 3. エクスポート

`packages/api-types/src/index.ts`:

```typescript
export * from './models/YourResource.js';
```

### 4. ビルド

```bash
cd packages/api-types
pnpm build
```

これで `config/shadow.config.json` が自動的に更新されます。

## 重要な注意事項

### 循環依存の回避

スキーマ定義では、`ShadowFieldType` enum を直接使用せず、文字列リテラルとして型アサーションを使用してください：

```typescript
// ✅ 正しい（循環依存を回避）
sortableFields: {
  name: { type: 'string' as ShadowFieldType.String },
  createdAt: { type: 'datetime' as ShadowFieldType.Datetime },
}

// ❌ 間違い（循環依存エラーが発生）
sortableFields: {
  name: { type: ShadowFieldType.String },
  createdAt: { type: ShadowFieldType.Datetime },
}
```

**理由**: スキーマ定義時に enum 値を評価すると、`schema.js` → `Article.js` → `schema.js` の循環依存が発生します。文字列リテラルを使用することで、実行時の評価を遅延させ、循環依存を回避します。

### デフォルトソート設定

デフォルトソート設定は自動的に決定されます：

- `updatedAt` フィールドが存在する場合: `updatedAt DESC`（最新更新順）
- `updatedAt` フィールドが存在しない場合: 最初のソート可能フィールド `ASC`

### 生成ファイルの編集禁止

`config/shadow.config.json` は自動生成されるため、**直接編集しないでください**。

変更が必要な場合は、`packages/api-types/src/schema.ts` または各モデルファイルを編集してください。

## トラブルシューティング

### 設定が更新されない

```bash
cd packages/api-types
rm -rf dist
pnpm build
```

### 循環依存エラー

```
TypeError: Cannot read properties of undefined (reading 'String')
```

スキーマ定義で `ShadowFieldType.String` を直接使用していないか確認してください。文字列リテラル（`'string' as ShadowFieldType.String`）を使用してください。

### パスエラー

```
Error: ENOENT: no such file or directory, open '.../config/shadow.config.json'
```

スクリプトの `__dirname` からの相対パスが正しいか確認してください。現在は `../../../../config/shadow.config.json` を使用しています。

## 関連ファイル

- **スキーマレジストリ**: `packages/api-types/src/schema.ts`
- **モデル定義**: `packages/api-types/src/models/*.ts`
- **生成スクリプト（ソース）**: `packages/api-types/src/scripts/generate-shadow-config.ts`
- **生成スクリプト（実行）**: `packages/api-types/dist/scripts/generate-shadow-config.js`
- **生成ファイル**: `config/shadow.config.json`
- **README**: `packages/api-types/README.md`

## 利点

1. **一貫性**: スキーマ定義が唯一の情報源
2. **型安全性**: TypeScript の型システムを活用
3. **自動化**: ビルド時に自動生成、手動更新不要
4. **同期保証**: モデル定義と設定ファイルの不整合を防止
5. **保守性**: 変更箇所が明確、メンテナンスが容易
