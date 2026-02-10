# OpenAPI駆動開発ルール

## 基本原則

**OpenAPI仕様をSSOT（Single Source of Truth）として、すべてのコード・テスト・ツールを生成する**

## 必須ルール

### 1. 仕様変更時の完了条件

OpenAPI仕様を変更した場合、以下をすべて実行すること：

```bash
make docs-validate      # 仕様バリデーション
make docs-bundle        # 仕様バンドル
make generate-types     # 型定義生成
make build              # 完全ビルド（型生成含む）
make lint               # Lint
make test               # テスト
```

**理由**: 型不整合によるランタイムエラーを防ぐ

### 2. 生成ファイルの直接編集禁止

以下のファイルは直接編集しない：

- `src/__generated__/openapi.ts` - TypeScript型定義
- `src/mcp/tools.json` - MCPツール定義
- `docs/specs/openapi.bundled.yaml` - バンドル済み仕様

**理由**: 再生成で上書きされる

### 3. 仕様ファーストの開発

```
仕様定義 → 型生成 → 実装 → テスト
```

実装前に必ずOpenAPI仕様を定義すること。

## ディレクトリ構造

```
docs/specs/
├── openapi.yaml                    # メインファイル
├── openapi.bundled.yaml           # バンドル済み（生成物）
└── components/
    └── schemas/
        ├── _index.yaml            # スキーマインデックス
        ├── base/                  # 基本型
        ├── operators/             # オペレーター
        ├── options/               # オプション
        ├── results/               # 結果型
        ├── api/                   # API型
        ├── operations/            # 操作パラメータ
        └── responses/             # レスポンス
```

## 階層化の原則

- **カテゴリ別に整理**: 目的別にサブディレクトリを作成
- **スケーラビリティ**: 新しいファイルを追加しやすい構造
- **一貫性**: 統一された命名規則

## 命名規則

- **ディレクトリ**: `kebab-case`（例: `base/`, `operators/`）
- **ファイル**: `PascalCase.yaml`（例: `Document.yaml`）
- **インデックス**: `_index.yaml`

## 型定義の使用

```typescript
import type { components, paths } from './__generated__/openapi.js';

// スキーマ型
type Document = components['schemas']['Document'];

// パス型
type FindOperation = paths['/']['post'];
```

## チェックリスト

OpenAPI仕様変更時：

- [ ] `make docs-validate` 成功
- [ ] `make docs-bundle` 成功
- [ ] `make generate-types` 成功
- [ ] `make build` 成功
- [ ] `make test` 成功
- [ ] `make lint` 成功
- [ ] 生成ファイルをGitに追加

## 詳細

詳細は [OPENAPI_DRIVEN_DEVELOPMENT.md](../../docs/specs/OPENAPI_DRIVEN_DEVELOPMENT.md) を参照
