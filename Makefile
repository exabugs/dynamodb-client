.PHONY: help install build test lint format clean deploy-dev deploy-stg deploy-prd status logs-fetch logs-records seed clean-data dev-admin

# デフォルト環境
ENV ?= dev
REGION ?= us-east-1

# デフォルトターゲット
help:
	@echo "AINews Pipeline - Root Makefile"
	@echo ""
	@echo "=== 開発コマンド ==="
	@echo "  make install           - 依存関係をインストール (pnpm install)"
	@echo "  make build             - 全パッケージとLambda関数をビルド"
	@echo "  make test              - 全パッケージのテストを実行（カバレッジ付き）"
	@echo "  make lint              - 全パッケージのLintを実行"
	@echo "  make format            - 全パッケージのフォーマットを実行"
	@echo "  make clean             - ビルド成果物を削除"
	@echo ""
	@echo "=== デプロイコマンド ==="
	@echo "  make deploy-dev        - dev環境にデプロイ (ビルド + Terraform apply)"
	@echo "  make deploy-stg        - stg環境にデプロイ (ビルド + Terraform apply)"
	@echo "  make deploy-prd        - prd環境にデプロイ (ビルド + Terraform apply)"
	@echo ""
	@echo "=== インフラコマンド ==="
	@echo "  make infra-plan        - Terraformプランを表示 [ENV=dev]"
	@echo "  make infra-apply       - Terraformを適用 [ENV=dev]"
	@echo "  make infra-status      - Terraform状態を表示"
	@echo ""
	@echo "=== Lambda操作コマンド ==="
	@echo "  make invoke-fetch              - Fetch Lambda（全プロバイダー）を実行 [ENV=dev]"
	@echo "  make invoke-fetch-newsapi      - Fetch Lambda（NewsAPI）を実行 [ENV=dev]"
	@echo "  make invoke-fetch-gnews        - Fetch Lambda（GNews）を実行 [ENV=dev]"
	@echo "  make invoke-fetch-apitube      - Fetch Lambda（APITube）を実行 [ENV=dev]"
	@echo "  make invoke-records            - Records Lambdaを実行 [ENV=dev]"
	@echo "  make logs-fetch                - Fetch Lambdaのログを表示 [ENV=dev]"
	@echo "  make logs-records              - Records Lambdaのログを表示 [ENV=dev]"
	@echo ""
	@echo "=== メンテナンスコマンド ==="
	@echo "  make repair-shadows            - シャドーレコードを修復 (Dry run) [ENV=dev] [RESOURCE=articles]"
	@echo "  make repair-shadows-exec       - シャドーレコードを修復 (実行) [ENV=dev] [RESOURCE=articles]"
	@echo "  make repair-shadow-single      - 単一レコードを修復 [ENV=dev] [RESOURCE=articles] [ID=xxx]"
	@echo ""
	@echo "=== データ管理コマンド ==="
	@echo "  make seed              - テストデータを投入 [ENV=dev]"
	@echo "  make clean-data        - DynamoDBのテストデータを削除（注意！） [ENV=dev]"
	@echo ""
	@echo "=== 開発サーバー ==="
	@echo "  make dev-admin         - Admin UIの開発サーバーを起動"
	@echo ""
	@echo "=== その他 ==="
	@echo "  make shadow-config     - shadow.config.jsonを再生成"
	@echo ""
	@echo "環境変数:"
	@echo "  ENV=$(ENV)       - 環境 (dev/stg/prd)"
	@echo "  REGION=$(REGION) - AWSリージョン"
	@echo "  RESOURCE         - リソース名 (articles/tasks/etc.)"
	@echo "  ID               - レコードID (単一レコード修復時)"

# ========================================
# 開発コマンド
# ========================================

install:
	@echo "Installing dependencies..."
	pnpm install

# パッケージのビルド順序（依存関係順）
build: build-packages build-functions build-apps

build-packages:
	@echo "Building shared packages..."
	@$(MAKE) -C packages/api-types build
	@$(MAKE) -C packages/core build

build-functions:
	@echo "Building Lambda functions..."
	@pnpm --filter "@ainews/fetch-lambda" build
	@pnpm --filter "@ainews/maintenance-coordinator" build
	@pnpm --filter "@ainews/maintenance-worker" build

build-apps:
	@echo "Building applications..."
	@pnpm --filter "@ainews/admin" build

test:
	@echo "Running tests with coverage..."
	pnpm -r test --coverage

lint:
	@echo "Running lint..."
	pnpm lint

format:
	@echo "Running format..."
	pnpm format

clean: clean-apps clean-functions clean-packages
	@echo "All build artifacts cleaned"

clean-packages:
	@echo "Cleaning shared packages..."
	@$(MAKE) -C packages/api-types clean
	@$(MAKE) -C packages/core clean

clean-functions:
	@echo "Cleaning Lambda functions..."
	@pnpm --filter "@ainews/fetch-lambda" clean
	@pnpm --filter "@ainews/maintenance-coordinator" clean
	@pnpm --filter "@ainews/maintenance-worker" clean

clean-apps:
	@echo "Cleaning applications..."
	@pnpm --filter "@ainews/admin" clean || true

# ========================================
# デプロイコマンド
# ========================================

deploy-dev: build
	@echo "Deploying to dev environment..."
	@cd infra && make apply-auto ENV=dev

deploy-stg: build
	@echo "Deploying to stg environment..."
	@cd infra && make apply ENV=stg

deploy-prd: build
	@echo "⚠️  Deploying to PRODUCTION environment..."
	@cd infra && make apply ENV=prd

# ========================================
# インフラコマンド
# ========================================

infra-plan:
	@cd infra && make plan ENV=$(ENV)

infra-apply:
	@cd infra && make apply ENV=$(ENV)

infra-status:
	@cd infra && make status

# ========================================
# Lambda操作コマンド
# ========================================

invoke-fetch:
	@echo "Invoking Fetch Lambda (ainews-$(ENV)-fetch) - All providers..."
	@aws lambda invoke \
		--function-name ainews-$(ENV)-fetch \
		--region $(REGION) \
		--payload '{}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq . || cat /tmp/fetch-response.json
	@rm -f /tmp/fetch-response.json

invoke-fetch-newsapi:
	@echo "Invoking Fetch Lambda (ainews-$(ENV)-fetch) - NewsAPI only..."
	@aws lambda invoke \
		--function-name ainews-$(ENV)-fetch \
		--region $(REGION) \
		--payload '{"provider":"newsapi"}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq . || cat /tmp/fetch-response.json
	@rm -f /tmp/fetch-response.json

invoke-fetch-gnews:
	@echo "Invoking Fetch Lambda (ainews-$(ENV)-fetch) - GNews only..."
	@aws lambda invoke \
		--function-name ainews-$(ENV)-fetch \
		--region $(REGION) \
		--payload '{"provider":"gnews"}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq . || cat /tmp/fetch-response.json
	@rm -f /tmp/fetch-response.json

invoke-fetch-apitube:
	@echo "Invoking Fetch Lambda (ainews-$(ENV)-fetch) - APITube only..."
	@aws lambda invoke \
		--function-name ainews-$(ENV)-fetch \
		--region $(REGION) \
		--payload '{"provider":"apitube"}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq . || cat /tmp/fetch-response.json
	@rm -f /tmp/fetch-response.json

invoke-records:
	@echo "Invoking Records Lambda (ainews-$(ENV)-records)..."
	@echo "Note: Records Lambda requires HTTP POST request. Use curl or Admin UI instead."
	@echo "Example: curl -X POST https://YOUR_FUNCTION_URL/find -H 'Content-Type: application/json' -d '{\"resource\":\"articles\"}'"

logs-fetch:
	@echo "Tailing CloudWatch Logs for ainews-$(ENV)-fetch..."
	@aws logs tail /aws/lambda/ainews-$(ENV)-fetch \
		--since 5m \
		--format short \
		--region $(REGION) \
		--follow

logs-records:
	@echo "Tailing CloudWatch Logs for ainews-$(ENV)-records..."
	@aws logs tail /aws/lambda/ainews-$(ENV)-records \
		--since 5m \
		--format short \
		--region $(REGION) \
		--follow

# ========================================
# メンテナンスコマンド
# ========================================

RESOURCE ?= articles

repair-shadows:
	@echo "Repairing shadow records for $(RESOURCE) in $(ENV) environment (DRY RUN)..."
	@cd packages/core && ENV=$(ENV) AWS_REGION=$(REGION) pnpm repair-shadows -- --resource $(RESOURCE) --dry-run

repair-shadows-exec:
	@echo "Repairing shadow records for $(RESOURCE) in $(ENV) environment (EXECUTING)..."
	@cd packages/core && ENV=$(ENV) AWS_REGION=$(REGION) pnpm repair-shadows -- --resource $(RESOURCE) --repair

repair-shadow-single:
ifndef ID
	@echo "Error: ID is required. Usage: make repair-shadow-single RESOURCE=articles ID=xxx [ENV=dev]"
	@exit 1
endif
	@echo "Repairing single record $(ID) in $(RESOURCE) ($(ENV) environment)..."
	@cd packages/core && ENV=$(ENV) AWS_REGION=$(REGION) pnpm repair-shadows -- --resource $(RESOURCE) --id $(ID) --repair

# ========================================
# データ管理コマンド
# ========================================

seed:
	@echo "Seeding test data to $(ENV) environment..."
	@pnpm --filter "@ainews/admin" seed

clean-data:
	@echo "⚠️  WARNING: This will delete ALL test data in $(ENV) environment!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@pnpm --filter "@ainews/admin" clean-data

# ========================================
# 開発サーバー
# ========================================

dev-admin:
	@echo "Starting Admin UI development server..."
	@pnpm --filter "@ainews/admin" dev

# ========================================
# その他
# ========================================

shadow-config:
	@echo "Regenerating shadow.config.json..."
	@echo "Note: Script is now in src/scripts/generate-shadow-config.ts"
	@$(MAKE) -C packages/api-types build
	@echo "✓ shadow.config.json regenerated"
