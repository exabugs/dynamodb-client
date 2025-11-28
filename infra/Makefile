.PHONY: help check-env switch plan apply status init-workspaces destroy

# デフォルト環境
ENV ?= dev

# デフォルトターゲット
help:
	@echo "Terraform Workspace Management"
	@echo ""
	@echo "Usage:"
	@echo "  make plan [ENV=<dev|stg|prd>]   - 環境のプランを表示 (デフォルト: dev)"
	@echo "  make apply [ENV=<dev|stg|prd>]  - 環境に変更を適用 (デフォルト: dev)"
	@echo "  make switch [ENV=<dev|stg|prd>] - 環境を切り替え (デフォルト: dev)"
	@echo "  make status                      - 現在の状態を表示"
	@echo "  make init-workspaces             - 全ワークスペースを初期化"
	@echo ""
	@echo "Examples:"
	@echo "  make plan           # dev環境でプラン実行"
	@echo "  make plan ENV=stg   # stg環境でプラン実行"
	@echo "  make apply          # dev環境に適用"
	@echo "  make status         # 現在の状態を表示"

# 環境変数の検証
check-env:
	@if [ "$(ENV)" != "dev" ] && [ "$(ENV)" != "stg" ] && [ "$(ENV)" != "prd" ]; then \
		echo "Error: ENV must be dev, stg, or prd (got: $(ENV))"; \
		exit 1; \
	fi

# ワークスペース切り替え
switch: check-env
	@echo "Switching to $(ENV) workspace..."
	@terraform workspace select $(ENV)
	@echo "✓ Switched to $(ENV) workspace"

# Lambda関数のビルド
build-functions:
	@echo "Building Lambda functions..."
	@cd .. && pnpm --filter './functions/*' build
	@echo "✓ Lambda functions built"

# プラン実行
plan: check-env switch build-functions
	@echo "Running plan for $(ENV) environment..."
	@terraform plan -var-file="envs/$(ENV).tfvars"

# 適用
apply: check-env switch build-functions
	@echo "Applying changes for $(ENV) environment..."
	@terraform apply -var-file="envs/$(ENV).tfvars"

# 自動承認で適用
apply-auto: check-env switch build-functions
	@echo "Applying changes for $(ENV) environment (auto-approve)..."
	@terraform apply -auto-approve -var-file="envs/$(ENV).tfvars"

# 破棄（慎重に使用）
destroy: check-env switch
	@echo "⚠️  WARNING: This will destroy all resources in $(ENV) environment!"
	@terraform destroy -var-file="envs/$(ENV).tfvars"

# 現在の状態表示
status:
	@echo "Current workspace: $$(terraform workspace show)"
	@echo ""
	@echo "Available workspaces:"
	@terraform workspace list
	@echo ""
	@echo "Resources in current workspace:"
	@terraform state list 2>/dev/null || echo "  (no resources)"

# ワークスペース初期化
init-workspaces:
	@echo "Initializing workspaces..."
	@terraform workspace new dev 2>/dev/null || echo "  dev workspace already exists"
	@terraform workspace new stg 2>/dev/null || echo "  stg workspace already exists"
	@terraform workspace new prd 2>/dev/null || echo "  prd workspace already exists"
	@echo "✓ Workspaces initialized"
	@echo ""
	@terraform workspace list
