# @ainews/api-types

プロジェクト固有のリソースモデルとスキーマ定義パッケージ。シャドウ設定の自動生成を提供します。

## 概要

このパッケージは以下を提供します：

- **リソースモデル**: Article、Task、FetchLog などのプロジェクト固有のリソース型定義
- **スキーマレジストリ**: リソーススキーマの一元管理（Single Source of Truth）
- **シャドウ設定の自動生成**: `shadow.config.json` の自動生成

> **注意**: API 型定義（`FindParams`, `ApiOperation` 等）は `@ainews/core/types` に移動しました。
> API 型定義が必要な場合は、`@ainews/core/types` から直接インポートしてください。

## 特徴

### Single Source of Truth

TypeScript のスキーマ定義（`SchemaRegistryConfig`）が唯一の情報源となり、以下が自動生成されます：

- `config/shadow.config.json` - DynamoDB シャドウレコード設定
- タイムスタンプフィールドの自動設定
- デフォルトソート設定

### 型安全性

- TypeScript の型システムを活用した型安全な API 定義
- リソース型とスキーマ定義の一貫性を保証
- コンパイル時の型チェック

## 使用方法

### ビルド

```bash
pnpm build
```

ビルド時に以下が実行されます：

1. TypeScript のコンパイル（`tsc`）
2. `shadow.config.json` の自動生成

### 新しいリソースの追加

1. **モデル定義を作成**（`src/models/YourResource.ts`）:

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

2. **スキーマレジストリに登録**（`src/schema.ts`）:

```typescript
import { YourResourceSchema } from './models/YourResource.js';

export const SchemaRegistryConfig: SchemaRegistryConfig = {
  database: {
    /* ... */
  },
  resources: {
    articles: ArticleSchema,
    tasks: TaskSchema,
    yourResources: YourResourceSchema, // 追加
  },
};
```

3. **エクスポート**（`src/index.ts`）:

```typescript
export * from './models/YourResource.js';
```

4. **ビルド**:

```bash
pnpm build
```

これで `shadow.config.json` が自動的に更新されます。

## ディレクトリ構造

```
packages/api-types/
├── src/
│   ├── models/          # リソースモデル定義
│   │   ├── Article.ts
│   │   └── Task.ts
│   ├── scripts/         # ビルドスクリプト
│   │   ├── generate-shadow-config.ts  # 生成スクリプト（TypeScript）
│   │   └── __tests__/   # スクリプトのテスト
│   ├── schema.ts        # スキーマレジストリ（Single Source of Truth）
│   └── index.ts         # エクスポート
├── dist/                # コンパイル済みファイル
│   ├── models/
│   ├── scripts/         # コンパイル済みスクリプト
│   ├── schema.js
│   └── index.js
├── package.json
├── tsconfig.json
└── README.md
```

## スクリプト

- `pnpm build` - TypeScript のコンパイルと shadow.config.json の生成
- `pnpm clean` - ビルド成果物の削除
- `pnpm format` - コードフォーマット

## 依存関係

- TypeScript 5.3.0+
- Node.js 22.0.0+

## 注意事項

### 循環依存の回避

スキーマ定義では、`ShadowFieldType` enum の代わりに文字列リテラルを使用してください：

```typescript
// ✅ 正しい
sortableFields: {
  name: { type: 'string' as ShadowFieldType.String },
}

// ❌ 間違い（循環依存エラー）
sortableFields: {
  name: { type: ShadowFieldType.String },
}
```

### ビルド順序

`shadow.config.json` の生成は、TypeScript のコンパイル後に実行されます。そのため、スキーマ定義を変更した場合は、必ず `pnpm build` を実行してください。

## ライセンス

MIT
