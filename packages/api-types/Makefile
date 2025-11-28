.PHONY: build clean test

# ソースファイル（src/scripts を含む）
SRC_FILES := $(shell find src -name '*.ts' -not -name '*.test.ts')
TSCONFIG := tsconfig.json

# 出力ファイル
DIST_INDEX := dist/index.js
DIST_SCHEMA := dist/schema.js
DIST_SCRIPT := dist/scripts/generate-shadow-config.js
SHADOW_CONFIG := ../../config/shadow.config.json

# ビルドターゲット
build: $(DIST_INDEX) $(SHADOW_CONFIG)

# TypeScriptコンパイル（メイン + scripts）
$(DIST_INDEX): $(SRC_FILES) $(TSCONFIG)
	@echo "Building @ainews/api-types..."
	@rm -f tsconfig.tsbuildinfo
	@pnpm exec tsc
	@touch $(DIST_INDEX)

# shadow.config.json生成
$(SHADOW_CONFIG): $(DIST_SCRIPT) $(DIST_SCHEMA)
	@echo "Generating shadow.config.json..."
	@node dist/scripts/generate-shadow-config.js
	@touch $(SHADOW_CONFIG)

test:
	@echo "Running @ainews/api-types tests with coverage..."
	@pnpm test --coverage

clean:
	@echo "Cleaning @ainews/api-types..."
	@rm -rf dist tsconfig.tsbuildinfo
