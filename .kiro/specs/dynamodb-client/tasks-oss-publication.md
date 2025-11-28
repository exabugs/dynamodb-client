# DynamoDB Client ライブラリ - OSS公開タスク

## 概要

このドキュメントは、`@ainews/core`パッケージを独立したOSSライブラリとしてnpmに公開する際に実施すべきタスクをまとめたものです。

これらのタスクは、プロジェクト内での使用には影響しないため、実際の公開直前に実施します。

---

## 公開前の必須タスク

### 1. パッケージ名の変更

**目的**: より汎用的なパッケージ名に変更し、プロジェクト固有の名前を排除する

**現状の問題**:
- `@ainews/core`はプロジェクト固有の名前
- 汎用的なライブラリとして認識されにくい

**改善内容**:
1. パッケージ名を決定（例: `@your-org/dynamodb-client`、`dynamodb-mongodb-client`など）
2. `package.json`の`name`フィールドを更新
3. READMEのインストール手順を更新
4. プロジェクト内の参照箇所を更新
   - `apps/admin/package.json`
   - `functions/fetch/package.json`
   - その他の依存パッケージ

**影響範囲**:
- `packages/core/package.json`
- `packages/core/README.md`
- プロジェクト内のすべての依存パッケージ

**検証方法**:
- `pnpm install`が成功すること
- インポートパスが正しく動作すること
- ビルドとテストが成功すること

**優先度**: 🔴 最高（公開前）

**注意事項**:
- npm上でパッケージ名が利用可能か事前に確認する
- スコープ付きパッケージ（`@org/name`）を使用する場合、npm organizationが必要

---

### 2. 国際化対応（英語化）

**目的**: JSDoc、エラーメッセージ、READMEを英語化し、グローバルな利用を可能にする

**現状の問題**:
- JSDocが日本語で記述されている
- エラーメッセージが日本語（一部英語）
- READMEが日本語のみ

**改善内容**:

#### 2.1 JSDocコメントの英語化
1. すべてのJSDocコメントを英語化
2. 型定義の説明を英語化
3. パラメータと戻り値の説明を英語化

**対象ファイル**:
- `packages/core/src/**/*.ts`（全ファイル）

**例**:
```typescript
// Before (日本語)
/**
 * シャドーSKを生成する
 * フォーマット: {fieldName}#{formattedValue}#id#{recordId}
 *
 * @param fieldName - フィールド名
 * @param value - フィールド値
 * @param recordId - レコードID（ULID）
 * @param type - フィールドの型（デフォルト: 'string'）
 * @returns 生成されたシャドーSK
 */

// After (英語)
/**
 * Generate shadow sort key (SK)
 * Format: {fieldName}#{formattedValue}#id#{recordId}
 *
 * @param fieldName - Field name
 * @param value - Field value
 * @param recordId - Record ID (ULID)
 * @param type - Field type (default: 'string')
 * @returns Generated shadow SK
 */
```

#### 2.2 エラーメッセージの英語化
1. すべてのエラーメッセージを英語化
2. エラーコードは英語のまま維持

**対象ファイル**:
- `packages/core/src/errors.ts`
- `packages/core/src/server/**/*.ts`
- `packages/core/src/client/**/*.ts`

**例**:
```typescript
// Before (日本語)
throw new Error('SHADOW_CONFIG環境変数が設定されていません');

// After (英語)
throw new Error('SHADOW_CONFIG environment variable is not set');
```

#### 2.3 READMEの英語化
1. README.mdを英語化
2. README.ja.mdとして日本語版を残す
3. インストール手順、使用例、APIドキュメントを英語化

**対象ファイル**:
- `packages/core/README.md`（英語版）
- `packages/core/README.ja.md`（日本語版、新規作成）
- `packages/core/ARCHITECTURE.md`（英語化）
- `packages/core/CLIENT_USAGE.md`（英語化）

#### 2.4 コード内コメントの英語化
1. ロジックを説明するインラインコメントを英語化
2. TODO/FIXMEコメントを英語化

**影響範囲**:
- `packages/core/src/**/*.ts`（全ファイル）
- `packages/core/README.md`
- `packages/core/ARCHITECTURE.md`
- `packages/core/CLIENT_USAGE.md`

**検証方法**:
- すべてのJSDocが英語であること
- すべてのエラーメッセージが英語であること
- READMEが英語で記述されていること
- ビルドとテストが成功すること

**優先度**: 🔴 最高（公開前）

**推定工数**: 4-6時間

---

### 3. ライセンスの明確化 ✅

**目的**: ライセンスファイルを追加し、著作権を明確にする

**現状**: ✅ 完了（2024-11-28）
- LICENSEファイルを追加済み
- package.jsonに`license`フィールドを追加済み
- READMEにライセンスセクションを追加済み

**改善内容**:
1. MITライセンスファイルを追加
2. `package.json`に`license`フィールドを追加
3. READMEにライセンスセクションを追加
4. 各ソースファイルに著作権表示を追加（オプション）

**LICENSEファイルの内容**:
```
MIT License

Copyright (c) [year] [copyright holder]

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

**package.jsonの更新**:
```json
{
  "license": "MIT"
}
```

**READMEの更新**:
```markdown
## License

MIT License - see the [LICENSE](LICENSE) file for details
```

**影響範囲**:
- `packages/core/LICENSE`（新規作成）
- `packages/core/package.json`
- `packages/core/README.md`

**検証方法**:
- LICENSEファイルが存在すること
- `package.json`に`license: "MIT"`が記載されていること
- READMEにライセンスセクションが存在すること

**優先度**: 🔴 最高（公開前）

**推定工数**: 30分

---

### 4. package.jsonのメタデータ更新

**目的**: npm公開に必要なメタデータを追加・更新する

**改善内容**:
1. `description`を英語化
2. `keywords`を追加・更新
3. `author`を追加
4. `repository`を追加
5. `bugs`を追加
6. `homepage`を追加

**package.jsonの更新例**:
```json
{
  "name": "@your-org/dynamodb-client",
  "version": "1.0.0",
  "description": "DynamoDB Single-Table Client SDK with MongoDB-like API",
  "keywords": [
    "dynamodb",
    "single-table",
    "mongodb",
    "aws",
    "client",
    "sdk",
    "nosql",
    "database"
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
  "homepage": "https://github.com/your-org/dynamodb-client#readme"
}
```

**影響範囲**:
- `packages/core/package.json`

**検証方法**:
- すべてのメタデータが英語であること
- リポジトリURLが正しいこと

**優先度**: 🔴 最高（公開前）

**推定工数**: 30分

---

### 5. npmパッケージの公開準備

**目的**: npmに公開するための最終準備を行う

**改善内容**:
1. `.npmignore`ファイルを作成（または`package.json`の`files`フィールドを確認）
2. `prepublishOnly`スクリプトを追加（ビルドとテストを自動実行）
3. バージョン番号を確認（セマンティックバージョニング）
4. CHANGELOGを作成

**.npmignoreの内容**:
```
# Source files
src/
*.ts
!*.d.ts

# Tests
**/__tests__/
**/*.test.ts
**/*.spec.ts
vitest.config.ts
vitest.setup.ts

# Build tools
tsconfig.json
esbuild.config.js

# Development files
.git/
.github/
.vscode/
node_modules/
coverage/

# Documentation (keep README)
ARCHITECTURE.md
CLIENT_USAGE.md
```

**package.jsonの更新**:
```json
{
  "scripts": {
    "prepublishOnly": "pnpm build && pnpm test"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

**影響範囲**:
- `packages/core/.npmignore`（新規作成）
- `packages/core/package.json`
- `packages/core/CHANGELOG.md`（新規作成）

**検証方法**:
- `npm pack`を実行して、パッケージ内容を確認
- 不要なファイルが含まれていないこと
- 必要なファイル（dist、README、LICENSE）が含まれていること

**優先度**: 🔴 最高（公開前）

**推定工数**: 1時間

---

## 公開手順

### 1. 最終確認

- [ ] すべての公開前タスクが完了している
- [ ] ビルドが成功する
- [ ] すべてのテストが通過する
- [ ] ドキュメントが最新である
- [ ] LICENSEファイルが存在する
- [ ] package.jsonのメタデータが正しい

### 2. npmアカウントの準備

- [ ] npmアカウントを作成（未作成の場合）
- [ ] npm organizationを作成（スコープ付きパッケージの場合）
- [ ] 2FAを有効化（推奨）

### 3. パッケージ名の確認

```bash
npm search @your-org/dynamodb-client
```

パッケージ名が利用可能であることを確認。

### 4. ドライラン

```bash
cd packages/core
npm pack
```

生成された`.tgz`ファイルの内容を確認。

### 5. 公開

```bash
cd packages/core
npm login
npm publish --access public
```

スコープ付きパッケージの場合、`--access public`が必要。

### 6. 公開後の確認

- [ ] npmで検索できる
- [ ] インストールできる
- [ ] ドキュメントが表示される
- [ ] バッジが正しく表示される

---

## 公開後のタスク

### 1. プロジェクト内の参照を更新

公開後、プロジェクト内のパッケージ参照を更新します。

**対象ファイル**:
- `apps/admin/package.json`
- `functions/fetch/package.json`
- その他の依存パッケージ

**変更内容**:
```json
// Before
{
  "dependencies": {
    "@ainews/core": "workspace:*"
  }
}

// After
{
  "dependencies": {
    "@your-org/dynamodb-client": "^1.0.0"
  }
}
```

### 2. READMEにバッジを追加

```markdown
# DynamoDB Client

[![npm version](https://badge.fury.io/js/%40your-org%2Fdynamodb-client.svg)](https://www.npmjs.com/package/@your-org/dynamodb-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

### 3. GitHubリポジトリの作成

- [ ] GitHubリポジトリを作成
- [ ] コードをプッシュ
- [ ] GitHub Actionsを設定（CI/CD）
- [ ] Issueテンプレートを作成
- [ ] Pull Requestテンプレートを作成

---

## 推定工数

| タスク | 推定工数 |
|--------|----------|
| 1. パッケージ名の変更 | 1時間 |
| 2. 国際化対応（英語化） | 4-6時間 |
| 3. ライセンスの明確化 | 30分 |
| 4. package.jsonのメタデータ更新 | 30分 |
| 5. npmパッケージの公開準備 | 1時間 |
| **合計** | **7-9時間** |

---

## 注意事項

1. **公開は慎重に**: 一度公開したパッケージは削除できない（24時間以内のみ可能）
2. **バージョン管理**: セマンティックバージョニングに従う
3. **破壊的変更**: メジャーバージョンを上げる際は、CHANGELOGに明記
4. **セキュリティ**: 機密情報（APIキー、パスワードなど）を含めない
5. **テスト**: 公開前に必ずテストを実行

---

## 参考リンク

- [npm公式ドキュメント](https://docs.npmjs.com/)
- [セマンティックバージョニング](https://semver.org/)
- [MITライセンス](https://opensource.org/licenses/MIT)
- [npm organizationの作成](https://docs.npmjs.com/creating-an-organization)
