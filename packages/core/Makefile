.PHONY: build clean test

# ソースファイル
SRC_FILES := $(shell find src -name '*.ts' -not -name '*.test.ts')
TSCONFIG := tsconfig.json

# 出力ファイル
DIST_INDEX := dist/index.js

# ビルドターゲット
build: $(DIST_INDEX)

# TypeScriptコンパイル + Lambda バンドル
$(DIST_INDEX): $(SRC_FILES) $(TSCONFIG)
	@echo "Building @ainews/core..."
	@rm -f tsconfig.tsbuildinfo
	@pnpm exec tsc
	@node esbuild.config.js
	@touch $(DIST_INDEX)

test:
	@echo "Running @ainews/core tests with coverage..."
	@pnpm test --coverage

clean:
	@echo "Cleaning @ainews/core..."
	@rm -rf dist tsconfig.tsbuildinfo
