# パッケージ名変更タスク

## 概要

`@ainews/core` パッケージを `@exabugs/dynamodb-client` に改名し、独立したOSSライブラリとして公開可能にする。

**目標**: パッケージ名を変更し、すべての参照を更新する

**所要時間**: 2-3時間

---

## タスクリスト

- [x] 1. パッケージ名の変更
- [x] 1.1 packages/core/package.jsonのnameを変更
- [x] 1.2 packages/core/package.jsonのdescriptionを更新
- [x] 1.3 packages/core/package.jsonのkeywordsを更新
- [x] 1.4 packages/core/package.jsonのrepositoryを追加

- [x] 2. プロジェクト内の参照を更新
- [x] 2.1 apps/admin/package.jsonの依存関係を更新
- [x] 2.2 apps/admin/src/dataProvider.tsのインポートを更新
- [x] 2.3 functions/fetch/package.jsonの依存関係を更新
- [x] 2.4 functions/fetch/src/handler.tsのインポートを更新
- [x] 2.5 functions/maintenance/*/package.jsonの依存関係を更新
- [x] 2.6 packages/api-types/package.jsonの依存関係を更新（devDependencies）

- [x] 3. ドキュメントの更新
- [x] 3.1 packages/core/README.mdのパッケージ名を更新
- [x] 3.2 packages/core/docs/react-admin-integration.mdのパッケージ名を更新
- [x] 3.3 プロジェクトルートのREADME.mdを更新
- [x] 3.4 .kiro/steering/structure.mdを更新

- [x] 4. ビルドとテスト
- [x] 4.1 依存関係を再インストール（pnpm install）
- [x] 4.2 ビルドテスト（make clean && make build）
- [x] 4.3 テスト実行（make test）
- [x] 4.4 Lintチェック（pnpm lint）

- [ ] 5. 動作確認
- [ ] 5.1 Admin UIの起動確認
- [ ] 5.2 Fetch Lambdaのビルド確認
- [ ] 5.3 Records Lambdaのビルド確認

---

## タスク詳細

### 1. パッケージ名の変更

#### 1.1 packages/core/package.jsonのnameを変更

**目的**: パッケージ名を `@exabugs/dynamodb-client` に変更

**作業内容**:

**packages/core/package.json**:
```json
{
  "name": "@exabugs/dynamodb-client",
  "version": "1.0.0",
  "description": "DynamoDB Single-Table Client SDK with MongoDB-like API and Records Lambda implementation",
  ...
}
```

**検証**:
- [ ] package.jsonのnameが `@exabugs/dynamodb-client` である

---

#### 1.2 packages/core/package.jsonのdescriptionを更新

**目的**: パッケージの説明を明確にする

**作業内容**:

**packages/core/package.json**:
```json
{
  "name": "@exabugs/dynamodb-client",
  "version": "1.0.0",
  "description": "DynamoDB Single-Table Client SDK with MongoDB-like API, Shadow Records, and Lambda implementation for serverless applications",
  ...
}
```

**検証**:
- [ ] descriptionが更新されている

---

#### 1.3 packages/core/package.jsonのkeywordsを更新

**目的**: npmでの検索性を向上させる

**作業内容**:

**packages/core/package.json**:
```json
{
  "keywords": [
    "dynamodb",
    "single-table",
    "mongodb",
    "lambda",
    "aws",
    "client",
    "sdk",
    "react-admin",
    "shadow-records",
    "serverless",
    "typescript"
  ],
  ...
}
```

**検証**:
- [ ] keywordsが更新されている

---

#### 1.4 packages/core/package.jsonのrepositoryを追加

**目的**: GitHubリポジトリへのリンクを追加

**作業内容**:

**packages/core/package.json**:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/exabugs/dynamodb-client.git",
    "directory": "packages/core"
  },
  "bugs": {
    "url": "https://github.com/exabugs/dynamodb-client/issues"
  },
  "homepage": "https://github.com/exabugs/dynamodb-client#readme",
  ...
}
```

**検証**:
- [ ] repository、bugs、homepageが追加されている

---

### 2. プロジェクト内の参照を更新

#### 2.1 apps/admin/package.jsonの依存関係を更新

**目的**: Admin UIの依存関係を新しいパッケージ名に更新

**作業内容**:

**apps/admin/package.json**:
```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "workspace:*",
    "@ainews/api-types": "workspace:*",
    ...
  }
}
```

**検証**:
- [ ] `@ainews/core` が `@exabugs/dynamodb-client` に変更されている

---

#### 2.2 apps/admin/src/dataProvider.tsのインポートを更新

**目的**: dataProviderのインポートを新しいパッケージ名に更新

**作業内容**:

**apps/admin/src/dataProvider.ts**:
```typescript
import { createDataProvider } from '@exabugs/dynamodb-client/integrations/react-admin';
```

**検証**:
- [ ] インポートが `@exabugs/dynamodb-client` に変更されている

---

#### 2.3 functions/fetch/package.jsonの依存関係を更新

**目的**: Fetch Lambdaの依存関係を新しいパッケージ名に更新

**作業内容**:

**functions/fetch/package.json**:
```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "workspace:*",
    "@ainews/api-types": "workspace:*",
    ...
  }
}
```

**検証**:
- [ ] `@ainews/core` が `@exabugs/dynamodb-client` に変更されている

---

#### 2.4 functions/fetch/src/handler.tsのインポートを更新

**目的**: Fetch Lambdaのインポートを新しいパッケージ名に更新

**作業内容**:

**functions/fetch/src/handler.ts**:
```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';
```

**検証**:
- [ ] インポートが `@exabugs/dynamodb-client` に変更されている

---

#### 2.5 functions/maintenance/*/package.jsonの依存関係を更新

**目的**: Maintenance Lambdaの依存関係を新しいパッケージ名に更新

**作業内容**:

**functions/maintenance/coordinator/package.json**:
```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "workspace:*",
    ...
  }
}
```

**functions/maintenance/worker/package.json**:
```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "workspace:*",
    ...
  }
}
```

**検証**:
- [ ] すべてのMaintenance Lambdaで `@ainews/core` が `@exabugs/dynamodb-client` に変更されている

---

#### 2.6 packages/api-types/package.jsonの依存関係を更新（devDependencies）

**目的**: api-typesのdevDependenciesを新しいパッケージ名に更新

**作業内容**:

**packages/api-types/package.json**:
```json
{
  "devDependencies": {
    "@exabugs/dynamodb-client": "workspace:*",
    ...
  }
}
```

**検証**:
- [ ] devDependenciesで `@ainews/core` が `@exabugs/dynamodb-client` に変更されている

---

### 3. ドキュメントの更新

#### 3.1 packages/core/README.mdのパッケージ名を更新

**目的**: READMEのすべての参照を新しいパッケージ名に更新

**作業内容**:

**packages/core/README.md**:
- すべての `@ainews/core` を `@exabugs/dynamodb-client` に置換
- インストール例を更新:
  ```bash
  npm install @exabugs/dynamodb-client
  # または
  pnpm add @exabugs/dynamodb-client
  ```

**検証**:
- [ ] すべての `@ainews/core` が `@exabugs/dynamodb-client` に変更されている

---

#### 3.2 packages/core/docs/react-admin-integration.mdのパッケージ名を更新

**目的**: react-admin統合ドキュメントのパッケージ名を更新

**作業内容**:

**packages/core/docs/react-admin-integration.md**:
- すべての `@ainews/core` を `@exabugs/dynamodb-client` に置換

**検証**:
- [ ] すべての `@ainews/core` が `@exabugs/dynamodb-client` に変更されている

---

#### 3.3 プロジェクトルートのREADME.mdを更新

**目的**: プロジェクトREADMEのパッケージ名を更新

**作業内容**:

**README.md**:
- `@ainews/core` を `@exabugs/dynamodb-client` に置換
- パッケージの説明を更新

**検証**:
- [ ] パッケージ名が更新されている

---

#### 3.4 .kiro/steering/structure.mdを更新

**目的**: ステアリングファイルのパッケージ名を更新

**作業内容**:

**.kiro/steering/structure.md**:
- `@ainews/core` を `@exabugs/dynamodb-client` に置換
- パッケージの説明を更新

**検証**:
- [ ] パッケージ名が更新されている

---

### 4. ビルドとテスト

#### 4.1 依存関係を再インストール（pnpm install）

**目的**: 新しいパッケージ名で依存関係を再インストール

**作業内容**:
```bash
pnpm install
```

**検証**:
- [ ] `pnpm install` が成功する
- [ ] `node_modules` に `@exabugs/dynamodb-client` が存在する

---

#### 4.2 ビルドテスト（make clean && make build）

**目的**: 全体のビルドが成功することを確認

**作業内容**:
```bash
make clean
make build
```

**検証**:
- [ ] すべてのパッケージがビルドされる
- [ ] エラーがない

---

#### 4.3 テスト実行（make test）

**目的**: すべてのテストが成功することを確認

**作業内容**:
```bash
make test
```

**検証**:
- [ ] すべてのテストがパスする
- [ ] エラーがない

---

#### 4.4 Lintチェック（pnpm lint）

**目的**: Lintエラーがないことを確認

**作業内容**:
```bash
pnpm lint
```

**検証**:
- [ ] Lintエラーがない

---

### 5. 動作確認

#### 5.1 Admin UIの起動確認

**目的**: Admin UIが正常に起動することを確認

**作業内容**:
```bash
cd apps/admin
pnpm dev
```

**検証**:
- [ ] Admin UIが起動する
- [ ] ブラウザでアクセスできる
- [ ] エラーがない

---

#### 5.2 Fetch Lambdaのビルド確認

**目的**: Fetch Lambdaが正常にビルドされることを確認

**作業内容**:
```bash
cd functions/fetch
pnpm build
```

**検証**:
- [ ] ビルドが成功する
- [ ] `dist/handler.mjs` が生成される

---

#### 5.3 Records Lambdaのビルド確認

**目的**: Records Lambdaが正常にビルドされることを確認

**作業内容**:
```bash
cd packages/core
pnpm build:lambda
```

**検証**:
- [ ] ビルドが成功する
- [ ] `dist/server/handler.cjs` が生成される

---

## チェックリスト

パッケージ名変更完了時に以下を確認してください：

- [ ] すべてのタスクが完了している
- [ ] package.jsonのnameが `@exabugs/dynamodb-client` である
- [ ] すべての依存関係が更新されている
- [ ] すべてのインポートが更新されている
- [ ] すべてのドキュメントが更新されている
- [ ] ビルドが成功する（`make clean && make build`）
- [ ] テストが成功する（`make test`）
- [ ] Lintエラーがない（`pnpm lint`）
- [ ] Admin UIが起動する
- [ ] Fetch Lambdaがビルドされる
- [ ] Records Lambdaがビルドされる

---

## ロールバック手順

問題が発生した場合のロールバック手順：

```bash
# 1. Gitで変更を戻す
git checkout main
git pull

# 2. 依存関係を再インストール
pnpm install

# 3. ビルド
make clean
make build

# 4. テスト
make test
```

---

## 参考情報

- **要件定義**: `.kiro/specs/dynamodb-client/requirements.md`
- **設計書**: `.kiro/specs/dynamodb-client/design.md`
- **ライブラリ移行タスク**: `.kiro/specs/dynamodb-client/tasks-library-migration.md`
