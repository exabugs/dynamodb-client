# Records Lambda ライブラリ移行タスク

## 概要

Records LambdaとTerraformモジュールを`@ainews/core`ライブラリに完全移行し、プロジェクト側はライブラリを使用するだけにする。

**目標**: Records Lambdaをライブラリとして独立させ、他のプロジェクトでも使用可能にする。

**所要時間**: 4-5時間

---

## タスクリスト

- [ ] 1. ライブラリ側の準備
- [x] 1.1 Records Lambda実装をライブラリに移動
- [x] 1.2 Terraformモジュールをライブラリに移動
- [x] 1.3 ビルド設定をライブラリに統合
- [x] 1.4 package.jsonを更新（exportsとscripts）
- [ ] 1.5 テスト設定を移動

- [ ] 2. Terraformの更新
- [x] 2.1 infra/main.tfのmodule sourceを変更
- [x] 2.2 Terraformプランで差分を確認

- [ ] 3. ビルドスクリプトの更新
- [x] 3.1 Makefileを更新（build-functions）
- [ ] 3.2 pnpm-workspace.yamlを更新（オプション）

- [ ] 4. 旧ファイルの削除
- [x] 4.1 functions/records/を削除
- [x] 4.2 infra/modules/api/lambda-records/を削除

- [ ] 5. テストとデプロイ
- [x] 5.1 ビルドテスト（make clean && make build）
- [x] 5.2 Terraformプラン確認（make infra-plan ENV=dev）
- [x] 5.3 dev環境にデプロイ（make deploy-dev）
- [x] 5.4 動作確認（make invoke-fetch ENV=dev）
- [x] 5.5 ログ確認（make logs-records ENV=dev）

- [x] 6. ドキュメント更新
- [x] 6.1 packages/core/README.mdを更新（API型定義のエクスポートを追記）
- [x] 6.2 packages/core/terraform/README.mdを作成
- [x] 6.3 プロジェクトルートのREADME.mdを更新
- [x] 6.4 packages/api-types/README.mdを更新（API型定義の削除を明記）

---

## タスク詳細

### 1. ライブラリ側の準備

#### 1.1 Records Lambda実装をライブラリに移動

**目的**: Records Lambdaのソースコードを`packages/core/src/server/`に移動

**作業内容**:
```bash
# ディレクトリ作成
mkdir -p packages/core/src/server

# ファイル移動
cp -r functions/records/src/* packages/core/src/server/

# 構造確認
packages/core/src/server/
├── handler.ts
├── config.ts
├── operations/
│   ├── find.ts
│   ├── findOne.ts
│   ├── findMany.ts
│   ├── findManyReference.ts
│   ├── insertOne.ts
│   ├── insertMany.ts
│   ├── updateOne.ts
│   ├── updateMany.ts
│   ├── deleteOne.ts
│   └── deleteMany.ts
└── utils/
    ├── auth.ts
    ├── bulkOperations.ts
    ├── chunking.ts
    ├── dynamodb.ts
    └── timestamps.ts
```

**重要**: `handler.ts` で使用されている `import('@ainews/api-types')` の型定義を修正する必要があります。

**型定義の移行**:
1. `handler.ts` で使用されている以下の型を `packages/core/src/server/types.ts` に移動:
   - `FindParams`
   - `FindOneParams`
   - `FindManyParams`
   - `FindManyReferenceParams`
   - `InsertOneParams`
   - `InsertManyParams`
   - `UpdateOneParams`
   - `UpdateManyParams`
   - `DeleteOneParams`
   - `DeleteManyParams`

2. `handler.ts` のインポートを修正:
   ```typescript
   // Before: import('@ainews/api-types').FindParams
   // After: import('./types.js').FindParams
   ```

3. 各操作ハンドラー（`operations/*.ts`）のインポートも同様に修正

**検証**:
- [ ] すべてのファイルが正しく移動されている
- [ ] ディレクトリ構造が正しい
- [ ] `@ainews/api-types` への依存が完全に削除されている
- [ ] TypeScriptのコンパイルが成功する

---

#### 1.2 Terraformモジュールをライブラリに移動

**目的**: Records Lambda用Terraformモジュールを`packages/core/terraform/`に移動

**作業内容**:
```bash
# ディレクトリ作成
mkdir -p packages/core/terraform

# ファイル移動
cp -r infra/modules/api/lambda-records/* packages/core/terraform/

# 構造確認
packages/core/terraform/
├── main.tf
├── variables.tf
├── outputs.tf
└── iam.tf
```

**検証**:
- [ ] すべてのTerraformファイルが移動されている
- [ ] main.tfが正しく動作する

---

#### 1.3 ビルド設定をライブラリに統合

**目的**: Records Lambda用のビルド設定を`packages/core/`に統合

**作業内容**:
```bash
# esbuild設定をコピー
cp functions/records/esbuild.config.js packages/core/

# vitest設定をコピー（既存とマージ）
# packages/core/vitest.config.ts を更新してserver/のテストも含める
```

**packages/core/esbuild.config.js**:
```javascript
// Records Lambda用のビルド設定
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/server/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/server/handler.cjs',
  sourcemap: true,
  external: [
    '@aws-sdk/*',
    'aws-jwt-verify',
  ],
});
```

**検証**:
- [ ] esbuild.config.jsが正しく動作する
- [ ] vitest.config.tsがserver/のテストを含む

---

#### 1.4 package.jsonを更新（exportsとscripts）

**目的**: `packages/core/package.json`にserver用のexportsとscriptsを追加

**作業内容**:

**packages/core/package.json**:
```json
{
  "name": "@ainews/core",
  "version": "1.0.0",
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client/index.js",
    "./client/iam": "./dist/client/index.iam.js",
    "./client/cognito": "./dist/client/index.cognito.js",
    "./client/token": "./dist/client/index.token.js",
    "./server": "./dist/server/handler.cjs",
    "./server/handler": "./dist/server/handler.cjs",
    "./types": "./dist/types.js",
    "./integrations/react-admin": "./dist/integrations/react-admin/index.js",
    "./terraform": "./terraform/main.tf"
  },
  "scripts": {
    "build": "tsc && node esbuild.config.js",
    "build:lambda": "node esbuild.config.js",
    "clean": "rm -rf dist",
    "lint": "echo 'Linting skipped for now'",
    "format": "prettier --write src",
    "test": "vitest --run"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "3.929.0",
    "@aws-sdk/lib-dynamodb": "3.929.0",
    "aws-jwt-verify": "^5.1.1",
    "ulid": "^3.0.1"
  }
}
```

**検証**:
- [ ] `pnpm build`が成功する
- [ ] `dist/server/handler.cjs`が生成される
- [ ] exportsが正しく設定されている

---

#### 1.5 テスト設定を移動

**目的**: Records Lambdaのテストを`packages/core/`に統合

**作業内容**:
```bash
# テストファイルを移動
cp -r functions/records/__tests__/* packages/core/src/server/__tests__/

# vitest.config.tsを更新
```

**packages/core/vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/index.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
```

**検証**:
- [ ] `pnpm test`が成功する
- [ ] すべてのテストがパスする

---

### 2. Terraformの更新

#### 2.1 infra/main.tfのmodule sourceを変更

**目的**: Records LambdaモジュールをライブラリのTerraformモジュールに切り替え

**作業内容**:

**infra/main.tf**:
```hcl
# Records Lambda（HTTP API）
module "lambda_records" {
  # Before
  # source = "./modules/api/lambda-records"
  
  # After
  source = "../packages/core/terraform"
  
  project_name = var.project_name
  environment  = var.environment
  region       = var.region
  
  # DynamoDB設定
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  
  # Cognito設定
  cognito_user_pool_id = module.cognito.user_pool_id
  
  # ログ設定
  log_retention_days = var.log_retention_days
  log_level          = var.lambda_records_log_level
}
```

**検証**:
- [ ] Terraformの構文が正しい
- [ ] module.lambda_recordsの出力が変わらない

---

#### 2.2 Terraformプランで差分を確認

**目的**: Terraform変更による影響を確認

**作業内容**:
```bash
cd infra
make plan ENV=dev
```

**期待される結果**:
- Records Lambdaのリソースに変更がない（または最小限）
- 他のリソースに影響がない

**検証**:
- [ ] `terraform plan`が成功する
- [ ] Records Lambdaのリソースが再作成されない
- [ ] 差分が想定通り

---

### 3. ビルドスクリプトの更新

#### 3.1 Makefileを更新（build-functions）

**目的**: Records Lambdaのビルドを`build-packages`に統合

**作業内容**:

**Makefile**:
```makefile
build-packages:
	@echo "Building shared packages..."
	@$(MAKE) -C packages/api-types build
	@$(MAKE) -C packages/shadows build
	@$(MAKE) -C packages/core build        # Records Lambdaも含む

build-functions:
	@echo "Building Lambda functions..."
	# @pnpm --filter "@ainews/records-lambda" build  # 削除
	@pnpm --filter "@ainews/fetch-lambda" build
	@pnpm --filter "@ainews/maintenance-coordinator" build
	@pnpm --filter "@ainews/maintenance-worker" build

clean-packages:
	@echo "Cleaning shared packages..."
	@$(MAKE) -C packages/api-types clean
	@$(MAKE) -C packages/shadows clean
	@$(MAKE) -C packages/core clean        # Records Lambdaも含む

clean-functions:
	@echo "Cleaning Lambda functions..."
	# @pnpm --filter "@ainews/records-lambda" clean  # 削除
	@pnpm --filter "@ainews/fetch-lambda" clean
	@pnpm --filter "@ainews/maintenance-coordinator" clean
	@pnpm --filter "@ainews/maintenance-worker" clean
```

**検証**:
- [ ] `make build`が成功する
- [ ] `make clean`が成功する

---

#### 3.2 pnpm-workspace.yamlを更新（オプション）

**目的**: functions/recordsをワークスペースから削除

**作業内容**:

**pnpm-workspace.yaml**:
```yaml
packages:
  - 'packages/*'
  - 'functions/*'
  # functions/recordsは削除されるため、自動的に除外される
  - 'apps/*'
```

**検証**:
- [ ] `pnpm install`が成功する
- [ ] ワークスペースが正しく認識される

---

### 4. 旧ファイルの削除

#### 4.1 functions/records/を削除

**目的**: 旧Records Lambdaディレクトリを削除

**作業内容**:
```bash
# バックアップ（念のため）
mv functions/records functions/records.backup

# または直接削除
rm -rf functions/records
```

**検証**:
- [ ] functions/records/が存在しない
- [ ] ビルドが成功する

---

#### 4.2 infra/modules/api/lambda-records/を削除

**目的**: 旧Terraformモジュールを削除

**作業内容**:
```bash
# バックアップ（念のため）
mv infra/modules/api/lambda-records infra/modules/api/lambda-records.backup

# または直接削除
rm -rf infra/modules/api/lambda-records
```

**検証**:
- [ ] infra/modules/api/lambda-records/が存在しない
- [ ] Terraformプランが成功する

---

### 5. テストとデプロイ

#### 5.1 ビルドテスト（make clean && make build）

**目的**: 全体のビルドが成功することを確認

**作業内容**:
```bash
make clean
make build
```

**検証**:
- [ ] すべてのパッケージがビルドされる
- [ ] `packages/core/dist/server/handler.cjs`が生成される
- [ ] エラーがない

---

#### 5.2 Terraformプラン確認（make infra-plan ENV=dev）

**目的**: Terraform変更による影響を最終確認

**作業内容**:
```bash
make infra-plan ENV=dev
```

**検証**:
- [ ] プランが成功する
- [ ] Records Lambdaのリソースが再作成されない
- [ ] 差分が想定通り

---

#### 5.3 dev環境にデプロイ（make deploy-dev）

**目的**: dev環境に変更をデプロイ

**作業内容**:
```bash
make deploy-dev
```

**検証**:
- [ ] デプロイが成功する
- [ ] Records Lambdaが正常に動作する

---

#### 5.4 動作確認（make invoke-fetch ENV=dev）

**目的**: Records Lambdaが正常に動作することを確認

**作業内容**:
```bash
# Fetch Lambdaを実行（Records Lambdaを呼び出す）
make invoke-fetch ENV=dev

# Admin UIで動作確認
make dev-admin
# ブラウザでhttp://localhost:5173にアクセス
# 記事一覧が表示されることを確認
```

**検証**:
- [ ] Fetch Lambdaが成功する
- [ ] Records Lambdaが呼び出される
- [ ] Admin UIで記事一覧が表示される

---

#### 5.5 ログ確認（make logs-records ENV=dev）

**目的**: Records Lambdaのログを確認

**作業内容**:
```bash
make logs-records ENV=dev
```

**検証**:
- [ ] ログが正常に出力される
- [ ] エラーがない
- [ ] 設定情報（schemaVersion、configHash）が出力される

---

### 6. ドキュメント更新

#### 6.1 packages/core/README.mdを更新

**目的**: ライブラリのREADMEにRecords Lambda情報を追加

**作業内容**:

**packages/core/README.md**に以下を追加:
```markdown
## Records Lambda（サーバー側実装）

このライブラリには、Records Lambda（サーバー側実装）も含まれています。

### デプロイ方法

Terraformモジュールを使用してデプロイします。

```hcl
module "lambda_records" {
  source = "github.com/your-org/dynamodb-client//packages/core/terraform"
  # または
  # source = "../packages/core/terraform"  # ローカル開発時
  
  project_name = "my-project"
  environment  = "dev"
  region       = "us-east-1"
  
  # DynamoDB設定
  dynamodb_table_name = "my-table"
  dynamodb_table_arn  = "arn:aws:dynamodb:..."
  
  # Cognito設定
  cognito_user_pool_id = "us-east-1_xxxxx"
  
  # シャドウ設定
  shadow_config = base64encode(file("shadow.config.json"))
}
```

### ビルド

```bash
cd packages/core
pnpm build        # クライアントとサーバーの両方をビルド
pnpm build:lambda # サーバーのみをビルド
```
```

**検証**:
- [ ] READMEが更新されている
- [ ] 使用例が正しい

---

#### 6.2 packages/core/terraform/README.mdを作成

**目的**: Terraformモジュールの使用方法を説明

**作業内容**:

**packages/core/terraform/README.md**:
```markdown
# Records Lambda Terraformモジュール

DynamoDB Single-Table設計向けのRecords Lambda関数をデプロイするTerraformモジュールです。

## 使用方法

```hcl
module "lambda_records" {
  source = "github.com/your-org/dynamodb-client//packages/core/terraform"
  
  project_name = "my-project"
  environment  = "dev"
  region       = "us-east-1"
  
  # DynamoDB設定
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  
  # Cognito設定
  cognito_user_pool_id = module.cognito.user_pool_id
  
  # シャドウ設定（base64エンコード）
  shadow_config = base64encode(file("${path.root}/../config/shadow.config.json"))
  
  # ログ設定
  log_retention_days = 7
  log_level          = "info"
}
```

## 出力

- `function_name`: Lambda関数名
- `function_arn`: Lambda関数ARN
- `function_url`: Lambda Function URL
- `shadow_config`: シャドウ設定（base64エンコード）

## 要件

- Terraform >= 1.5.0
- AWS Provider >= 5.0.0
- DynamoDBテーブル（Single-Table設計）
- Cognito User Pool（認証用）
```

**検証**:
- [ ] READMEが作成されている
- [ ] 使用例が正しい

---

#### 6.3 プロジェクトルートのREADME.mdを更新

**目的**: プロジェクトのREADMEにライブラリ移行情報を追加

**作業内容**:

**README.md**に以下を追加:
```markdown
## Records Lambda

Records Lambdaは`@ainews/core`ライブラリに統合されています。

詳細は[packages/core/README.md](packages/core/README.md)を参照してください。
```

**検証**:
- [ ] READMEが更新されている

---

## チェックリスト

リファクタ完了時に以下を確認してください：

- [ ] すべてのタスクが完了している
- [ ] ビルドが成功する（`make clean && make build`）
- [ ] テストが成功する（`make test`）
- [ ] Terraformプランが成功する（`make infra-plan ENV=dev`）
- [ ] dev環境にデプロイ成功（`make deploy-dev`）
- [ ] Records Lambdaが正常に動作する
- [ ] Admin UIで記事一覧が表示される
- [ ] ログにエラーがない
- [ ] ドキュメントが更新されている
- [ ] 旧ファイルが削除されている

---

## ロールバック手順

問題が発生した場合のロールバック手順：

```bash
# 1. Gitで変更を戻す
git checkout main
git pull

# 2. ビルド
make clean
make build

# 3. デプロイ
make deploy-dev

# 4. 動作確認
make invoke-fetch ENV=dev
```

---

## 参考情報

- **評価レポート**: `.kiro/specs/dynamodb-client/evaluation.md`
- **設計書**: `.kiro/specs/dynamodb-client/design.md`
- **改善計画**: `.kiro/specs/dynamodb-client/improvements.md`
