# OpenAPI駆動開発ガイドライン

## 基本原則

**OpenAPI仕様をSSOT（Single Source of Truth）として、すべてのコード・テスト・ツールを生成する**

## 開発フロー

```
OpenAPI仕様 (SSOT)
  ↓
  ├─→ TypeScript型定義生成
  ├─→ テストケース生成
  └─→ MCPツール定義生成
       ↓
     実装 → テスト → デプロイ
```

## 1. OpenAPI仕様の管理

### ディレクトリ構造

```
docs/specs/
├── openapi.yaml                    # メインファイル
├── openapi.bundled.yaml           # バンドル済み（生成物）
├── .redocly.yaml                  # Redocly設定
└── components/
    ├── parameters/
    │   └── _index.yaml            # 共通パラメータ（空でも可）
    ├── responses/
    │   └── _index.yaml            # 共通レスポンス（空でも可）
    └── schemas/
        ├── _index.yaml            # スキーマインデックス
        ├── base/                  # 基本型
        │   ├── Document.yaml
        │   ├── Collection.yaml
        │   ├── ResourceName.yaml
        │   ├── Query.yaml
        │   └── Error.yaml
        ├── operators/             # オペレーター
        │   ├── Filter.yaml
        │   ├── FilterOperators.yaml
        │   ├── NearOperator.yaml
        │   └── UpdateOperators.yaml
        ├── options/               # オプション
        │   ├── FindOptions.yaml
        │   ├── UpdateOneOptions.yaml
        │   └── UpdateManyOptions.yaml
        ├── results/               # 結果型
        │   ├── InsertOneResult.yaml
        │   ├── UpdateResult.yaml
        │   └── DeleteResult.yaml
        ├── api/                   # API型
        │   ├── ApiOperation.yaml
        │   ├── ApiRequest.yaml
        │   ├── ApiSuccessResponse.yaml
        │   ├── ApiErrorResponse.yaml
        │   └── OperationError.yaml
        ├── operations/            # 操作パラメータ
        │   ├── FindParams.yaml
        │   ├── FindOneParams.yaml
        │   └── ...
        └── responses/             # レスポンス
            ├── FindResult.yaml
            └── ...
```

### 階層化の原則

- **カテゴリ別に整理**: 目的別にサブディレクトリを作成
- **スケーラビリティ**: 新しいファイルを追加しやすい構造
- **一貫性**: 既存の階層と統一された命名規則

### 命名規則

- **ディレクトリ**: `kebab-case`（例: `base/`, `operators/`）
- **ファイル**: `PascalCase.yaml`（例: `Document.yaml`, `FindParams.yaml`）
- **インデックス**: `_index.yaml`（各ディレクトリに配置）

## 2. 開発ワークフロー

### 2.1 仕様変更時の手順

```bash
# 1. OpenAPI仕様を編集
vim docs/specs/components/schemas/base/Document.yaml

# 2. バリデーション
make docs-validate

# 3. バンドル生成
make docs-bundle

# 4. TypeScript型定義生成
make generate-types

# 5. MCPツール定義生成
make generate-mcp-tools

# 6. ビルド（型生成含む）
make build

# 7. テスト
make test

# 8. Lint
make lint
```

### 2.2 完了条件（必須）

OpenAPI仕様変更時は、以下をすべて実行すること：

- [ ] `make docs-validate` - 仕様バリデーション成功
- [ ] `make docs-bundle` - バンドル生成成功
- [ ] `make generate-types` - 型定義生成成功
- [ ] `make build` - ビルド成功
- [ ] `make test` - テスト成功
- [ ] `make lint` - Lint成功

## 3. 生成物の管理

### 3.1 TypeScript型定義

**生成先**: `src/__generated__/openapi.ts`

**使用方法**:
```typescript
import type { components, paths } from './__generated__/openapi.js';

// スキーマ型
type Document = components['schemas']['Document'];
type FindParams = components['schemas']['FindParams'];

// パス型
type FindOperation = paths['/']['post'];
```

**ルール**:
- 生成ファイルは直接編集しない
- 型定義が必要な場合は、OpenAPI仕様を修正して再生成
- `__generated__/`ディレクトリはGit管理対象

### 3.2 MCPツール定義

**生成先**: `src/mcp/tools.json`

**生成スクリプト**: `scripts/generate-mcp-tools.ts`

**使用方法**:
```typescript
import tools from './mcp/tools.json' assert { type: 'json' };

// MCPサーバーで使用
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.tools,
}));
```

**ルール**:
- OpenAPI仕様から自動生成
- 手動編集は禁止（再生成で上書きされる）
- 操作ごとにMCPツールを生成

### 3.3 テストケース

**方針**: OpenAPI仕様から自動生成（将来実装予定）

**現状**: 手動でテストケースを作成

**将来の実装**:
```bash
# テストケース生成（未実装）
make generate-tests
```

## 4. OpenAPI仕様の記述ルール

### 4.1 基本構造

```yaml
# メインファイル（openapi.yaml）
openapi: 3.1.0
info:
  title: DynamoDB Client API
  version: 1.3.52
  description: MongoDB風のAPIインターフェース

paths:
  /:
    post:
      summary: MongoDB風操作実行
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiRequest'
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiSuccessResponse'

components:
  schemas:
    # _index.yamlで管理
    $ref: './components/schemas/_index.yaml'
```

### 4.2 スキーマ定義

```yaml
# components/schemas/base/Document.yaml
type: object
description: DynamoDBドキュメント
additionalProperties: true
properties:
  id:
    type: string
    description: レコードID（ULID）
  createdAt:
    type: string
    format: date-time
    description: 作成日時
  updatedAt:
    type: string
    format: date-time
    description: 更新日時
```

### 4.3 参照の記述

```yaml
# 同一ディレクトリ内
$ref: './Document.yaml'

# 親ディレクトリ
$ref: '../base/Document.yaml'

# コンポーネント参照
$ref: '#/components/schemas/Document'
```

## 5. Makefileコマンド

### ドキュメント関連

```bash
# バリデーション
make docs-validate

# バンドル生成
make docs-bundle

# プレビュー生成・表示
make docs-preview

# HTML生成
make docs-build

# 生成ファイル削除
make docs-clean
```

### 型生成関連

```bash
# TypeScript型定義生成
make generate-types

# MCPツール定義生成
make generate-mcp-tools
```

### ビルド・テスト

```bash
# ビルド（型生成含む）
make build

# テスト
make test

# Lint
make lint
```

## 6. CI/CD統合

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      # OpenAPI仕様バリデーション
      - name: Validate OpenAPI
        run: make docs-validate
      
      # 型生成
      - name: Generate Types
        run: make generate-types
      
      # ビルド
      - name: Build
        run: make build
      
      # テスト
      - name: Test
        run: make test
      
      # Lint
      - name: Lint
        run: make lint
```

## 7. ベストプラクティス

### 7.1 仕様ファーストの開発

1. **仕様を先に書く**: 実装前にOpenAPI仕様を定義
2. **型定義を生成**: `make generate-types`で型を生成
3. **型に従って実装**: 生成された型を使用して実装
4. **テストを書く**: 仕様に基づいてテストケースを作成

### 7.2 仕様の保守

- **定期的なバリデーション**: CI/CDで自動チェック
- **バージョン管理**: 仕様変更時はバージョンを更新
- **ドキュメント生成**: HTML版を定期的に更新

### 7.3 チーム開発

- **仕様レビュー**: 実装前に仕様をレビュー
- **変更通知**: 仕様変更時はチームに通知
- **ドキュメント共有**: HTML版を共有して仕様を確認

## 8. トラブルシューティング

### 問題1: バリデーションエラー

```bash
# エラー詳細を確認
make docs-validate 2>&1 | less

# 参照エラーの場合
# - ファイルパスを確認
# - _index.yamlの参照を確認
```

### 問題2: 型生成エラー

```bash
# バンドルファイルを確認
cat docs/specs/openapi.bundled.yaml

# 再生成
make docs-bundle
make generate-types
```

### 問題3: 循環参照

```yaml
# ❌ 悪い例: 循環参照
# A.yaml
$ref: './B.yaml'

# B.yaml
$ref: './A.yaml'

# ✅ 良い例: 共通型を抽出
# Base.yaml
type: object

# A.yaml
allOf:
  - $ref: './Base.yaml'

# B.yaml
allOf:
  - $ref: './Base.yaml'
```

## 9. 参考リンク

- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [Redocly CLI](https://redocly.com/docs/cli/)
- [openapi-typescript](https://github.com/drwpow/openapi-typescript)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## 10. 更新履歴

- 2026-02-10: 初版作成（OpenAPI駆動開発の標準化）
