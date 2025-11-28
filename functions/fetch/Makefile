.PHONY: help build deploy invoke logs clean

# デフォルト環境
ENV ?= dev
REGION ?= us-east-1

# Lambda関数名
FUNCTION_NAME = ainews-$(ENV)-fetch

help:
	@echo "Fetch Lambda Makefile"
	@echo ""
	@echo "使用方法:"
	@echo "  make build                  - Lambda関数をビルド"
	@echo "  make deploy [ENV=dev]       - Lambda関数をデプロイ（Terraform）"
	@echo "  make invoke [ENV=dev]       - Lambda関数を実行（全プロバイダー）"
	@echo "  make invoke-newsapi [ENV=dev] - Lambda関数を実行（NewsAPI）"
	@echo "  make invoke-gnews [ENV=dev]   - Lambda関数を実行（GNews）"
	@echo "  make invoke-apitube [ENV=dev] - Lambda関数を実行（APITube）"
	@echo "  make logs [ENV=dev]         - CloudWatch Logsを表示"
	@echo "  make clean                  - ビルド成果物を削除"
	@echo ""
	@echo "環境変数:"
	@echo "  ENV=$(ENV)"
	@echo "  REGION=$(REGION)"
	@echo "  FUNCTION_NAME=$(FUNCTION_NAME)"

build:
	@echo "Building Fetch Lambda..."
	pnpm build

deploy: build
	@echo "Deploying Fetch Lambda to $(ENV) environment..."
	cd ../../infra && make apply-auto ENV=$(ENV)

invoke:
	@echo "Invoking Fetch Lambda ($(FUNCTION_NAME)) - All providers..."
	@aws lambda invoke \
		--function-name $(FUNCTION_NAME) \
		--region $(REGION) \
		--payload '{}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq .
	@rm -f /tmp/fetch-response.json

invoke-newsapi:
	@echo "Invoking Fetch Lambda ($(FUNCTION_NAME)) - NewsAPI only..."
	@aws lambda invoke \
		--function-name $(FUNCTION_NAME) \
		--region $(REGION) \
		--payload '{"provider":"newsapi"}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq .
	@rm -f /tmp/fetch-response.json

invoke-gnews:
	@echo "Invoking Fetch Lambda ($(FUNCTION_NAME)) - GNews only..."
	@aws lambda invoke \
		--function-name $(FUNCTION_NAME) \
		--region $(REGION) \
		--payload '{"provider":"gnews"}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq .
	@rm -f /tmp/fetch-response.json

invoke-apitube:
	@echo "Invoking Fetch Lambda ($(FUNCTION_NAME)) - APITube only..."
	@aws lambda invoke \
		--function-name $(FUNCTION_NAME) \
		--region $(REGION) \
		--payload '{"provider":"apitube"}' \
		--cli-binary-format raw-in-base64-out \
		/tmp/fetch-response.json
	@echo ""
	@echo "Response:"
	@cat /tmp/fetch-response.json | jq .
	@rm -f /tmp/fetch-response.json

logs:
	@echo "Tailing CloudWatch Logs for $(FUNCTION_NAME)..."
	@aws logs tail /aws/lambda/$(FUNCTION_NAME) \
		--since 5m \
		--format short \
		--region $(REGION) \
		--follow

logs-recent:
	@echo "Recent logs for $(FUNCTION_NAME)..."
	@aws logs tail /aws/lambda/$(FUNCTION_NAME) \
		--since 5m \
		--format short \
		--region $(REGION)

clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
