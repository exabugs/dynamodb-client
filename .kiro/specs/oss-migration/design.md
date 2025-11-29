# DynamoDB Client OSS 化 - 設計書

## 概要

ainews-pipeline プロジェクトから dynamodb-client ライブラリを独立させ、npm で公開可能な OSS ライブラリとして再構成します。ainews 固有のコードを全て削除し、汎用的な DynamoDB Single-Table 設計向けクライアントライブラリとして提供します。

## アーキテクチャ

### 現在の構造（ainews-pipeline）

```
ainews-pipeline/
├── apps/admin/                    # ❌ 削除対象
├── functions/                     # ❌ 削除対象
│   ├── fetch/
│   └── maintenance/
├── packages/
│   ├── api-types/                 # ❌ 削除対象
│   └── core/                      # ✅ 移行対象
├── infra/                         # ❌ 削除対象（ainews-pipeline で管理）
└── config/                        # ❌ 削除対象
```

### 新しい構造（dynamodb-client）

```
dynamodb-client/
├── src/                           # ソースコード
│   ├── client/                    # クライアント SDK
│   ├── server/                    # サーバー実装
│   ├── shadows/                   # シャドウ管理
│   ├── integrations/              # 統合（react-admin など）
│   └── types.ts                   # 共通型定義
├── examples/                      # 使用例
├── docs/                          # ドキュメント
├── terraform/                     # Terraform モジュール（オプション）
├── __tests__/                     # テストコード
└── package.json
```

## コンポーネント設計

### 1. ディレクトリ構造の再設計

#### 1.1 ソースコードの移行

**移行元:** `packages/core/src/`
**移行先:** `src/`

**移行対象:**
- `client/` - クライアント SDK（全ファイル）
- `server/` - サーバー実装（全ファイル）
- `shadows/` - シャドウ管理（全ファイル）
- `integrations/` - 統合（react-admin など）
- `types.ts` - 共通型定義

**移行時の変更:**
- インポートパスを更新（`@ainews/core` → `@exabugs/dynamodb-client`）
- ainews 固有の参照を削除（`@ainews/api-types` など）


#### 1.2 テストコードの移行

**移行元:** `packages/core/src/__tests__/`
**移行先:** `__tests__/`

**移行対象:**
- `client.test.ts` - DynamoClient のテスト
- `collection.test.ts` - Collection のテスト
- `converter.test.ts` - フィルタ変換のテスト
- `errors.test.ts` - エラークラスのテスト
- `findcursor.test.ts` - FindCursor のテスト
- `logger.test.ts` - ロガーのテスト
- `ulid.test.ts` - ULID のテスト
- `server-shadow-generator.test.ts` - シャドウ生成のテスト
- `integration-lambda.test.ts` - Lambda 統合テスト
- `integration-webapp.test.ts` - Web アプリ統合テスト

**移行時の変更:**
- ainews 固有のテストケースを削除
- 汎用的なテストケースのみを残す
- インポートパスを更新

#### 1.3 ドキュメントの移行

**移行元:** `packages/core/`
**移行先:** `docs/`

**移行対象:**
- `README.md` → `docs/README.md`（汎用化）
- `CLIENT_USAGE.md` → `docs/CLIENT_USAGE.md`（汎用化）
- `ARCHITECTURE.md` → `docs/ARCHITECTURE.md`（汎用化）

**新規作成:**
- `docs/API.md` - API リファレンス
- `docs/MIGRATION.md` - マイグレーションガイド
- `docs/ja/` - 日本語ドキュメント（オプション）

#### 1.4 使用例の作成

**新規作成:** `examples/`

**構成:**
```
examples/
├── basic/                         # 基本的な使用例
│   ├── index.ts                   # CRUD 操作の例
│   ├── package.json
│   └── README.md
├── lambda/                        # Lambda 統合例
│   ├── handler.ts                 # IAM 認証の例
│   ├── package.json
│   └── README.md
├── webapp/                        # Web アプリ統合例
│   ├── index.ts                   # Cognito 認証の例
│   ├── package.json
│   └── README.md
└── react-admin/                   # react-admin 統合例
    ├── dataProvider.ts
    ├── package.json
    └── README.md
```

### 2. パッケージ設定の再設計

#### 2.1 package.json の設計

**新しい package.json:**

```json
{
  "name": "@exabugs/dynamodb-client",
  "version": "1.0.0",
  "description": "DynamoDB Single-Table design client library with MongoDB-like API",
  "keywords": [
    "dynamodb",
    "single-table",
    "mongodb",
    "aws",
    "client",
    "shadow-records"
  ],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/dynamodb-client.git"
  },
  "bugs": {
    "url": "https://github.com/your-org/dynamodb-client/issues"
  },
  "homepage": "https://github.com/your-org/dynamodb-client#readme",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./client": {
      "import": "./dist/client/index.js",
      "require": "./dist/client/index.cjs",
      "types": "./dist/client/index.d.ts"
    },
    "./client/iam": {
      "import": "./dist/client/index.iam.js",
      "require": "./dist/client/index.iam.cjs",
      "types": "./dist/client/index.iam.d.ts"
    },
    "./client/cognito": {
      "import": "./dist/client/index.cognito.js",
      "require": "./dist/client/index.cognito.cjs",
      "types": "./dist/client/index.cognito.d.ts"
    },
    "./client/token": {
      "import": "./dist/client/index.token.js",
      "require": "./dist/client/index.token.cjs",
      "types": "./dist/client/index.token.d.ts"
    },
    "./server": {
      "import": "./dist/server/index.js",
      "require": "./dist/server/index.cjs",
      "types": "./dist/server/index.d.ts"
    },
    "./shadows": {
      "import": "./dist/shadows/index.js",
      "require": "./dist/shadows/index.cjs",
      "types": "./dist/shadows/index.d.ts"
    },
    "./types": {
      "import": "./dist/types.js",
      "require": "./dist/types.cjs",
      "types": "./dist/types.d.ts"
    },
    "./integrations/react-admin": {
      "import": "./dist/integrations/react-admin/index.js",
      "require": "./dist/integrations/react-admin/index.cjs",
      "types": "./dist/integrations/react-admin/index.d.ts"
    }
  },
  "files": [
    "dist",
    "terraform",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "build": "tsc && tsc -p tsconfig.cjs.json",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "lint": "eslint src --ext ts --max-warnings 0",
    "format": "prettier --write \"src/**/*.ts\"",
    "prepublishOnly": "npm run build && npm test"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "3.929.0",
    "@aws-sdk/lib-dynamodb": "3.929.0"
  },
  "peerDependencies": {
    "react-admin": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "react-admin": {
      "optional": true
    }
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.3.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```


#### 2.2 .npmignore の設計

```
# Source files
src/
__tests__/
examples/

# Configuration files
tsconfig.json
tsconfig.cjs.json
vitest.config.ts
eslint.config.js
.prettierrc

# Development files
.git/
.github/
.vscode/
.kiro/
node_modules/

# Documentation (except README.md)
docs/

# Build artifacts
*.log
*.tsbuildinfo
coverage/
```

### 3. 国際化対応

#### 3.1 ドキュメントの英語化

**対象ファイル:**
- `README.md` - プロジェクト概要、インストール、クイックスタート
- `docs/API.md` - API リファレンス
- `docs/ARCHITECTURE.md` - アーキテクチャ説明
- `docs/MIGRATION.md` - マイグレーションガイド
- `CONTRIBUTING.md` - コントリビューションガイド
- `SECURITY.md` - セキュリティポリシー

**日本語ドキュメント（オプション）:**
- `docs/ja/README.md`
- `docs/ja/API.md`
- `docs/ja/ARCHITECTURE.md`
- `docs/ja/MIGRATION.md`

#### 3.2 コードの英語化

**対象:**
- JSDoc コメント
- エラーメッセージ
- ログメッセージ
- コード内コメント

**例:**

```typescript
// Before (日本語)
/**
 * クライアントに接続します
 */
async connect(): Promise<void> {
  throw new Error('クライアントが接続されていません');
}

// After (英語)
/**
 * Connect to the DynamoDB client
 */
async connect(): Promise<void> {
  throw new Error('Client is not connected. Call connect() first.');
}
```

### 4. ライセンスとセキュリティ

#### 4.1 LICENSE ファイル

**MIT License:**

```
MIT License

Copyright (c) 2025 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### 4.2 SECURITY.md

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please send an email to security@example.com.

Please do not report security vulnerabilities through public GitHub issues.

We will respond to your report within 48 hours and provide a timeline for a fix.

## Security Update Policy

- Security patches will be released as soon as possible
- Users will be notified via GitHub Security Advisories
- Critical vulnerabilities will be prioritized
```

#### 4.3 CONTRIBUTING.md

```markdown
# Contributing to DynamoDB Client

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run tests: `npm test`

## Coding Standards

- Use TypeScript strict mode
- Follow ESLint rules
- Write tests for new features
- Update documentation

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Commit Message Convention

Follow Conventional Commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
```

### 5. CI/CD 設定

#### 5.1 GitHub Actions ワークフロー

**`.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm test
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v5
        with:
          files: ./coverage/coverage-final.json

  publish:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 6. Terraform モジュールの整理

#### 6.1 ディレクトリ構造

```
terraform/
├── main.tf                        # Lambda 関数デプロイ用モジュール
├── variables.tf                   # 変数定義
├── outputs.tf                     # 出力定義
├── README.md                      # 使用方法
└── examples/
    ├── basic/                     # 基本的な使用例
    │   ├── main.tf
    │   └── README.md
    └── advanced/                  # 高度な使用例
        ├── main.tf
        └── README.md
```

#### 6.2 terraform/README.md

```markdown
# Terraform Module for DynamoDB Client

This module deploys a Lambda function that uses the DynamoDB Client library.

## Usage

```hcl
module "dynamodb_client" {
  source = "github.com/your-org/dynamodb-client//terraform"

  function_name = "my-dynamodb-function"
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  
  environment_variables = {
    DYNAMODB_TABLE = "my-table"
  }
}
```

## Examples

See `examples/` directory for more examples.
```

### 7. 削除対象の詳細

#### 7.1 ディレクトリの削除

**完全削除:**
- `apps/` - admin アプリケーション
- `functions/` - Lambda 関数（fetch, maintenance など）
- `packages/api-types/` - ainews 固有の型定義
- `infra/` - Terraform リソース（ainews-pipeline で管理）
- `config/` - ainews 固有の設定ファイル

#### 7.2 ファイルの削除

**ルートディレクトリ:**
- `.envrc` - ainews 固有の環境変数
- `.envrc.example` - ainews 固有の環境変数例
- `Makefile` - ainews 固有のビルドスクリプト
- `CHANGELOG.md` - ainews 固有の変更履歴
- `pnpm-workspace.yaml` - monorepo 設定
- `pnpm-lock.yaml` - pnpm ロックファイル

**設定ファイル:**
- `prettier.config.cjs` - プロジェクト固有の設定（新しい設定を作成）
- `eslint.config.js` - プロジェクト固有の設定（新しい設定を作成）
- `tsconfig.base.json` - monorepo 用の設定（不要）
- `vitest.setup.ts` - プロジェクト固有の設定（新しい設定を作成）

#### 7.3 .kiro/ ディレクトリの整理

**削除:**
- `.kiro/specs/ainews-pipeline/` - ainews 固有のスペック
- `.kiro/steering/` - ainews 固有のステアリングファイル

**残す:**
- `.kiro/specs/dynamodb-client/` - dynamodb-client のスペック
- `.kiro/specs/oss-migration/` - OSS 化のスペック

### 8. 移行手順

#### 8.1 フェーズ1: 準備

1. 新しいブランチを作成（`feature/oss-migration`）
2. バックアップを作成
3. 移行計画を確認

#### 8.2 フェーズ2: 削除

1. ainews 固有のディレクトリを削除
2. ainews 固有のファイルを削除
3. 不要な設定ファイルを削除

#### 8.3 フェーズ3: 移行

1. `packages/core/src/` → `src/` に移動
2. `packages/core/src/__tests__/` → `__tests__/` に移動
3. インポートパスを更新

#### 8.4 フェーズ4: 新規作成

1. `examples/` ディレクトリを作成
2. `docs/` ディレクトリを作成
3. LICENSE, CONTRIBUTING.md, SECURITY.md を作成

#### 8.5 フェーズ5: 国際化

1. ドキュメントを英語化
2. JSDoc コメントを英語化
3. エラーメッセージを英語化

#### 8.6 フェーズ6: テスト

1. ビルドを実行
2. テストを実行
3. リントを実行
4. カバレッジを確認

#### 8.7 フェーズ7: 公開準備

1. package.json を更新
2. README.md を更新
3. CI/CD を設定
4. npm 公開テスト

## 正確性プロパティ

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. 
Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: パッケージ名の一貫性

*For any* ファイル（package.json, ドキュメント, コード）、パッケージ名は `@exabugs/dynamodb-client` である
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 2: ainews 依存の完全削除

*For any* ファイル、`@ainews/*` パッケージへのインポートまたは参照は存在しない
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1**

### Property 3: ディレクトリ構造の正確性

*For any* ソースファイル、`src/` ディレクトリ配下に配置される
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: 英語ドキュメントの完全性

*For any* ドキュメントファイル（README.md, docs/*.md）、英語で記述される
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 5: npm 公開可能性

*For any* package.json、npm 公開に必要なフィールド（name, version, description, keywords, author, license, repository, bugs, homepage, files, exports）を含む
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

## エラーハンドリング

### 移行エラー

- **ファイルが見つからない**: 移行元のファイルが存在しない場合、警告を表示して続行
- **インポートパスの更新失敗**: 手動で修正が必要な箇所をリストアップ
- **テスト失敗**: 失敗したテストを特定し、修正方法を提示

### ビルドエラー

- **型エラー**: TypeScript の型エラーを修正
- **リントエラー**: ESLint のエラーを修正
- **テストエラー**: テストの失敗を修正

## テスト戦略

### ユニットテスト

- 既存のテストを維持
- ainews 固有のテストケースを削除
- 汎用的なテストケースのみを残す

### 統合テスト

- Lambda 統合テスト（IAM 認証）
- Web アプリ統合テスト（Cognito 認証）

### カバレッジ目標

- 80% 以上のカバレッジを維持
- 主要な機能を網羅

## メリット

1. **独立性**: ainews プロジェクトに依存しない
2. **再利用性**: 他のプロジェクトで使用可能
3. **保守性**: シンプルな構造で保守が容易
4. **国際化**: 英語のドキュメントで国際的なユーザーに対応
5. **品質**: CI/CD により品質を保証
6. **コミュニティ**: OSS として公開し、コミュニティからのフィードバックを得る


## Shadow Config 生成ツールと Example

### 概要

Shadow Config は DynamoDB Client の最も重要な設定です。ユーザーが簡単に設定を作成できるよう、TypeScript スキーマから自動生成するツールと、完全な動作例を提供します。

### コンポーネント

#### 1. Schema 型定義

```typescript
// src/shadows/schema.ts

export enum ShadowFieldType {
  String = 'string',
  Number = 'number',
  Datetime = 'datetime',
}

export interface ShadowFieldDefinition {
  type: ShadowFieldType;
}

export interface ResourceSchema<T = any> {
  resource: string;
  type: T;
  shadows: {
    sortableFields: Record<string, ShadowFieldDefinition>;
  };
  sortDefaults?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  ttl?: {
    days: number;
  };
}

export interface SchemaRegistryConfig {
  database: {
    name: string;
    timestamps: {
      createdAt: string;
      updatedAt: string;
    };
  };
  resources: Record<string, ResourceSchema>;
}
```

#### 2. 生成スクリプト

```typescript
// src/scripts/generate-shadow-config.ts

/**
 * SchemaRegistryConfig から shadow.config.json を生成
 *
 * 使用方法:
 * 1. スキーマ定義ファイルを作成（例: my-schema.ts）
 * 2. npx generate-shadow-config my-schema.ts -o shadow.config.json
 */
```

**機能:**
- TypeScript スキーマファイルを読み込み
- `SchemaRegistryConfig` を抽出
- `shadow.config.json` を生成
- デフォルトソート設定を自動決定（updatedAt DESC または最初のフィールド ASC）

#### 3. Example ディレクトリ構造

```
examples/
├── README.md                    # Example の説明
├── basic/                       # 基本的な使用例
│   ├── schema.ts               # TypeScript スキーマ定義
│   ├── shadow.config.json      # 生成された設定
│   ├── lambda/                 # Lambda デプロイ例
│   │   ├── handler.ts
│   │   └── package.json
│   └── client/                 # クライアント使用例
│       ├── index.ts
│       └── package.json
├── advanced/                    # 高度な使用例
│   ├── schema.ts               # 複数リソース、TTL 設定
│   ├── shadow.config.json
│   └── ...
└── react-admin/                 # React Admin 統合例
    ├── schema.ts
    ├── shadow.config.json
    └── ...
```

### Example: Basic

#### schema.ts

```typescript
import { SchemaRegistryConfig, ShadowFieldType } from '@exabugs/dynamodb-client/shadows';

// Article 型定義
export interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  author: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// スキーマレジストリ
export const MySchemaRegistry: SchemaRegistryConfig = {
  database: {
    name: 'myapp',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  resources: {
    articles: {
      resource: 'articles',
      type: {} as Article,
      shadows: {
        sortableFields: {
          title: { type: ShadowFieldType.String },
          status: { type: ShadowFieldType.String },
          author: { type: ShadowFieldType.String },
          createdAt: { type: ShadowFieldType.Datetime },
          updatedAt: { type: ShadowFieldType.Datetime },
        },
      },
    },
  },
};
```

#### 生成コマンド

```bash
npx @exabugs/dynamodb-client generate-shadow-config schema.ts -o shadow.config.json
```

#### 生成される shadow.config.json

```json
{
  "$schemaVersion": "2.0",
  "$generatedFrom": "schema.ts (MySchemaRegistry)",
  "database": {
    "name": "myapp",
    "timestamps": {
      "createdAt": "createdAt",
      "updatedAt": "updatedAt"
    }
  },
  "resources": {
    "articles": {
      "shadows": {
        "title": { "type": "string" },
        "status": { "type": "string" },
        "author": { "type": "string" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      },
      "sortDefaults": {
        "field": "updatedAt",
        "order": "DESC"
      }
    }
  }
}
```

### README 更新

Quick Start セクションを以下のように更新：

```markdown
## 🚀 Quick Start

### 1. Define Your Schema (TypeScript)

Create a `schema.ts` file:

\`\`\`typescript
import { SchemaRegistryConfig, ShadowFieldType } from '@exabugs/dynamodb-client/shadows';

export interface Article {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const MySchema: SchemaRegistryConfig = {
  database: {
    name: 'myapp',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  resources: {
    articles: {
      resource: 'articles',
      type: {} as Article,
      shadows: {
        sortableFields: {
          title: { type: ShadowFieldType.String },
          status: { type: ShadowFieldType.String },
          createdAt: { type: ShadowFieldType.Datetime },
          updatedAt: { type: ShadowFieldType.Datetime },
        },
      },
    },
  },
};
\`\`\`

### 2. Generate Shadow Config

\`\`\`bash
npx @exabugs/dynamodb-client generate-shadow-config schema.ts -o shadow.config.json
\`\`\`

**Or see complete examples:**
- [Basic Example](examples/basic/) - Simple setup
- [Advanced Example](examples/advanced/) - Multiple resources, TTL
- [React Admin Example](examples/react-admin/) - Admin UI integration

### 3. Deploy Lambda with Config

See [Deployment Guide](docs/DEPLOYMENT.md) for details.

### 4. Use Client

\`\`\`typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';

const client = new DynamoClient(FUNCTION_URL, { region: 'ap-northeast-1' });
const articles = client.db().collection('articles');

await articles.insertOne({ title: 'Hello', status: 'published' });
\`\`\`
```

### package.json 更新

```json
{
  "bin": {
    "generate-shadow-config": "./dist/scripts/generate-shadow-config.js"
  },
  "exports": {
    "./shadows": {
      "import": "./dist/shadows/index.js",
      "types": "./dist/shadows/index.d.ts"
    }
  }
}
```

### テスト戦略

#### Unit Tests
- スキーマ型定義のテスト
- 生成スクリプトのテスト（入力 → 出力の検証）

#### Integration Tests
- Example の動作確認（CI で自動実行）
- 生成された設定ファイルの妥当性検証

### 実装の優先順位

1. **高**: Schema 型定義の追加
2. **高**: 生成スクリプトの実装
3. **高**: Basic Example の作成
4. **中**: Advanced Example の作成
5. **中**: React Admin Example の作成
6. **低**: CLI オプションの拡張（watch mode, validation など）
