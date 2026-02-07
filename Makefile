.PHONY: help build test lint clean docs-bundle docs-validate docs-preview docs-build docs-clean

help:
	@echo "DynamoDB Client - Makefile"
	@echo ""
	@echo "=== 開発コマンド ==="
	@echo "  make build             - ライブラリをビルド"
	@echo "  make test              - テストを実行"
	@echo "  make lint              - Lintを実行"
	@echo "  make clean             - ビルド成果物を削除"
	@echo ""
	@echo "=== ドキュメント ==="
	@echo "  make docs-bundle       - OpenAPI仕様を結合"
	@echo "  make docs-validate     - OpenAPI仕様を検証"
	@echo "  make docs-preview      - ローカルでプレビュー"
	@echo "  make docs-build        - HTML生成"
	@echo "  make docs-clean        - 生成ファイル削除"

# ========================================
# 開発コマンド
# ========================================

build:
	@echo "Building library..."
	@npm run build

test:
	@echo "Running tests..."
	@npm test

lint:
	@echo "Running lint..."
	@npm run lint

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist coverage

# ========================================
# ドキュメント
# ========================================

docs-bundle:
	@echo "Bundling OpenAPI specification..."
	@npx @redocly/cli bundle docs/specs/openapi.yaml \
		--output docs/specs/openapi.bundled.yaml

docs-validate:
	@echo "Validating OpenAPI specification..."
	@npx @redocly/cli lint docs/specs/openapi.yaml

docs-preview:
	@echo "Starting preview server..."
	@echo "Open http://localhost:8080 in your browser"
	@npx @redocly/cli preview-docs docs/specs/openapi.yaml

docs-build:
	@echo "Building HTML documentation..."
	@npx @redocly/cli build-docs docs/specs/openapi.yaml \
		--output docs/specs/index.html

docs-clean:
	@echo "Cleaning generated documentation..."
	@rm -f docs/specs/openapi.bundled.yaml docs/specs/index.html
