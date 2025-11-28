# Makefile運用ガイドライン

## 基本原則

**頻度の高い重要な操作はMakefileで管理し、`make`コマンドで実行すること**

**重要: ビルド操作は必ず `make build` を使用し、`pnpm build` を直接実行しないこと**

### ビルドコマンドの使用ルール

- ✅ **推奨**: `make build` - プロジェクト全体のビルド
- ✅ **推奨**: `make build-packages` - 共有パッケージのみビルド
- ✅ **推奨**: `make build-functions` - Lambda関数のみビルド
- ✅ **推奨**: `make build-apps` - アプリケーションのみビルド
- ❌ **禁止**: `pnpm build` - 直接実行しない
- ❌ **禁止**: `pnpm -r build` - 直接実行しない

### 理由

1. **tsconfig.tsbuildinfoの自動管理**: Makefileは古い `.tsbuildinfo` を自動削除し、インポートエラーを防ぐ
2. **依存関係の自動検知**: ソースファイルや設定ファイルの変更を検知して必要な場合のみ再ビルド
3. **一貫性の確保**: チーム全体で同じビルドプロセスを使用
4. **shadow.config.jsonの自動生成**: `@ainews/api-types` のビルド時に自動生成

## Makefile構成

プロジェクトには3つのMakefileが存在します：

1. **ルートMakefile** (`/Makefile`) - プロジェクト全体の操作
2. **インフラMakefile** (`/infra/Makefile`) - Terraform操作
3. **Lambda個別Makefile** (`/functions/*/Makefile`) - Lambda関数固有の操作

## ルートMakefile

### 目的

プロジェクト全体で頻度の高い操作を統一的に管理する。

### 主要コマンド

#### 開発コマンド

```bash
make install    # 依存関係のインストール
make build      # 全パッケージとLambda関数のビルド
make test       # 全パッケージのテスト実行（カバレッジ付き）
make lint       # 全パッケージのLint実行
make format     # 全パッケージのフォーマット実行
make clean      # ビルド成果物の削除
```

**注意**: `make test` は自動的にカバレッジレポートを生成します。カバレッジレポートはターミナルに直接表示されます。

#### 部分ビルドコマンド

```bash
make build-packages   # 共有パッケージのみビルド
make build-functions  # Lambda関数のみビルド
make build-apps       # アプリケーションのみビルド

make clean-packages   # 共有パッケージのみクリーン
make clean-functions  # Lambda関数のみクリーン
make clean-apps       # アプリケーションのみクリーン
```

#### デプロイコマンド

```bash
make deploy-dev    # dev環境にデプロイ（ビルド + Terraform apply）
make deploy-stg    # stg環境にデプロイ（ビルド + Terraform apply）
make deploy-prd    # prd環境にデプロイ（ビルド + Terraform apply）
```

**重要:** デプロイコマンドは自動的にビルドを実行します。

#### インフラコマンド

```bash
make infra-plan ENV=dev     # Terraformプランを表示
make infra-apply ENV=dev    # Terraformを適用
make infra-status           # Terraform状態を表示
```

#### Lambda操作コマンド

```bash
make invoke-fetch ENV=dev      # Fetch Lambdaを実行
make logs-fetch ENV=dev        # Fetch Lambdaのログを表示
make logs-records ENV=dev      # Records Lambdaのログを表示
```

#### その他

```bash
make shadow-config    # shadow.config.jsonを再生成
```

### 環境変数

- `ENV`: 環境（dev/stg/prd）、デフォルト: `dev`
- `REGION`: AWSリージョン、デフォルト: `us-east-1`

### 使用例

```bash
# dev環境にデプロイ
make deploy-dev

# stg環境のTerraformプランを確認
make infra-plan ENV=stg

# dev環境のFetch Lambdaを実行
make invoke-fetch

# prd環境のRecords Lambdaのログを表示
make logs-records ENV=prd
```

## インフラMakefile

### 目的

Terraform操作を環境ごとに管理する。

### 主要コマンド

```bash
cd infra

make plan ENV=dev           # プランを表示
make apply ENV=dev          # 変更を適用（対話的）
make apply-auto ENV=dev     # 変更を適用（自動承認）
make status                 # 現在の状態を表示
make switch ENV=stg         # ワークスペースを切り替え
make init-workspaces        # 全ワークスペースを初期化
```

### 重要な注意事項

1. **必ずMakefileを使用すること**: 直接`terraform`コマンドを実行しない
2. **環境変数ファイルの自動適用**: `envs/dev.tfvars`などが自動的に適用される
3. **ワークスペースの自動切り替え**: 環境に応じたワークスペースが自動選択される
4. **Lambda関数の自動ビルド**: `plan`/`apply`実行時に自動的にLambda関数をビルド

### 使用例

```bash
cd infra

# dev環境のプランを確認
make plan

# stg環境に変更を適用
make apply ENV=stg

# 現在の状態を確認
make status
```

## パッケージMakefile

### 目的

共有パッケージのビルドと依存関係を管理する。

### 配置場所

- `packages/api-types/Makefile`
- `packages/shadows/Makefile`
- `packages/core/Makefile`

### 主要コマンド

```bash
cd packages/api-types

make build   # パッケージをビルド（依存関係を自動検知）
make clean   # ビルド成果物を削除
```

### 依存関係管理

Makefileは以下の依存関係を自動的に管理します：

1. **ソースファイルの変更検知**: `src/**/*.ts` が変更されたら再ビルド
2. **tsconfig.jsonの変更検知**: `tsconfig.json` が変更されたら再ビルド
3. **tsconfig.tsbuildinfoの自動削除**: ビルド前に古い `tsconfig.tsbuildinfo` を削除
4. **shadow.config.jsonの生成**: `@ainews/api-types` のビルド時に自動生成

### 使用例

```bash
# ソースファイルを変更
vim packages/api-types/src/index.ts

# 自動的に再ビルドされる
make build-packages

# 変更がない場合はスキップされる
make build-packages
# => "make[1]: Nothing to be done for `build'."
```

## Lambda個別Makefile

### 目的

Lambda関数固有の操作を管理する。

### 配置場所

- `functions/fetch/Makefile`
- `functions/records/Makefile`（将来追加予定）

### 主要コマンド（Fetch Lambda例）

```bash
cd functions/fetch

make build              # Lambda関数をビルド
make deploy ENV=dev     # Lambda関数をデプロイ（Terraform経由）
make invoke ENV=dev     # Lambda関数を実行
make logs ENV=dev       # CloudWatch Logsを表示
make clean              # ビルド成果物を削除
```

### 使用例

```bash
cd functions/fetch

# ビルドのみ実行
make build

# dev環境にデプロイ
make deploy

# Lambda関数を実行
make invoke

# ログをリアルタイムで表示
make logs
```

## Makefile使用のベストプラクティス

### 1. ルートMakefileを優先的に使用

プロジェクト全体の操作は、ルートMakefileから実行することを推奨します。

```bash
# ✅ 推奨: ルートから実行
make deploy-dev

# ⚠️ 非推奨: 個別に実行
pnpm build
cd infra && make apply-auto ENV=dev
```

### 2. ビルドは必ず `make build` を使用

**絶対に `pnpm build` を直接実行しないこと**

Makefileは `tsconfig.tsbuildinfo` を自動的に管理します：

- **ビルド前**: 古い `tsconfig.tsbuildinfo` を削除
- **ビルド後**: 新しい `tsconfig.tsbuildinfo` を生成
- **依存関係**: ソースファイルや `tsconfig.json` の変更を検知して再ビルド

これにより、`tsconfig.tsbuildinfo` が原因のインポートエラーを防ぎます。

```bash
# ✅ 正しい: Makefileを使用（自動的にtsbuildinfoを管理）
make build
make build-packages
make build-functions

# ❌ 間違い: pnpmを直接使用（tsbuildinfoが古いまま残る可能性）
pnpm build
pnpm -r build
cd packages/api-types && pnpm build
```

**例外**: 個別パッケージのMakefile内で `pnpm build` を呼び出すのは問題ありません（Makefileが管理しているため）

### 3. 環境変数を明示的に指定

本番環境への操作は、環境変数を明示的に指定してください。

```bash
# ✅ 推奨: 環境を明示
make deploy-prd

# ⚠️ 非推奨: デフォルト環境に依存
make deploy-dev  # デフォルトはdev
```

### 4. デプロイ前にテストを実行

デプロイ前に必ずテストを実行してください。

```bash
# テスト実行
make test

# テストが通ったらデプロイ
make deploy-dev
```

### 5. ログ確認の習慣化

デプロイ後は必ずログを確認してください。

```bash
# デプロイ
make deploy-dev

# ログ確認
make logs-fetch ENV=dev
```

### 6. shadow.config.json更新時の手順

shadow.config.jsonを更新した場合の手順：

```bash
# 1. スキーマ定義を更新
vim packages/api-types/src/models/YourResource.ts

# 2. shadow.config.jsonを再生成
make shadow-config

# 3. Records Lambdaを再デプロイ
make deploy-dev
```

## トラブルシューティング

### ビルドエラーが発生する

```bash
# クリーンビルド
make clean
make build
```

### Terraformの状態が不整合

```bash
cd infra
make status
make switch ENV=dev
```

### Lambda関数が更新されない

```bash
# 強制的に再ビルド＆デプロイ
make clean
make deploy-dev
```

### ログが表示されない

```bash
# AWS CLIの認証情報を確認
aws sts get-caller-identity

# リージョンを確認
make logs-fetch ENV=dev REGION=us-east-1
```

## 新しいLambda関数を追加する場合

新しいLambda関数を追加する際は、以下の手順でMakefileを作成してください：

1. **個別Makefileの作成**: `functions/your-function/Makefile`を作成
2. **ルートMakefileの更新**: 必要に応じてルートMakefileにコマンドを追加
3. **ドキュメント更新**: このステアリングファイルを更新

### テンプレート

```makefile
.PHONY: help build deploy invoke logs clean

ENV ?= dev
REGION ?= us-east-1
FUNCTION_NAME = ainews-$(ENV)-your-function

help:
	@echo "Your Function Lambda Makefile"
	@echo ""
	@echo "使用方法:"
	@echo "  make build              - Lambda関数をビルド"
	@echo "  make deploy [ENV=dev]   - Lambda関数をデプロイ"
	@echo "  make invoke [ENV=dev]   - Lambda関数を実行"
	@echo "  make logs [ENV=dev]     - CloudWatch Logsを表示"
	@echo "  make clean              - ビルド成果物を削除"

build:
	@echo "Building Your Function Lambda..."
	pnpm build

deploy: build
	@echo "Deploying Your Function Lambda to $(ENV) environment..."
	cd ../../infra && make apply-auto ENV=$(ENV)

invoke:
	@echo "Invoking Your Function Lambda ($(FUNCTION_NAME))..."
	@aws lambda invoke \
		--function-name $(FUNCTION_NAME) \
		--region $(REGION) \
		--payload '{}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/your-function-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/your-function-response.json | jq .
	@rm -f /tmp/your-function-response.json

logs:
	@echo "Tailing CloudWatch Logs for $(FUNCTION_NAME)..."
	@aws logs tail /aws/lambda/$(FUNCTION_NAME) \
		--since 5m \
		--format short \
		--region $(REGION) \
		--follow

clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
```

## チェックリスト

開発・デプロイ時に以下を確認してください：

- [ ] **ビルドは `make build` を使用している（`pnpm build` を直接実行していない）**
- [ ] ルートMakefileから操作を実行している
- [ ] 環境変数（ENV）を正しく指定している
- [ ] デプロイ前にテストを実行している
- [ ] デプロイ後にログを確認している
- [ ] shadow.config.json更新時は再デプロイしている
- [ ] 本番環境への操作は慎重に実行している

## 参考

- Terraform操作の詳細: [terraform.md](.kiro/steering/terraform.md)
- テスト実行の詳細: [testing.md](.kiro/steering/testing.md)
- シャドウ設定の詳細: [shadow-config-generation.md](.kiro/steering/shadow-config-generation.md)
