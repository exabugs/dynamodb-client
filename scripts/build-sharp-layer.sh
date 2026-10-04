#!/usr/bin/env bash
set -euo pipefail

# sharp Lambda Layer ビルドスクリプト
#
# Lambda（Amazon Linux、arm64/Graviton）向けのネイティブバイナリを含む
# sharpをLambda Layerとしてパッケージ化する。arm64はx86_64よりコスト・
# 性能面で有利であり、本プロジェクトの他Lambda（records等）とも
# アーキテクチャを揃える。ローカル開発環境（Mac等）のCPUアーキテクチャ・
# OSに依存せず、Dockerの --platform linux/arm64 経由で確実にLambda
# 互換のバイナリをビルドする（詳細: docs/media-design.md）。
#
# process-handler・media-handlerの両方がこのレイヤーを使う。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
OUTPUT_ZIP="$ROOT_DIR/dist/sharp-layer.zip"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker が必要です（linux/arm64向けネイティブバイナリのビルドに使用）" >&2
  exit 1
fi

SHARP_VERSION="$(node -p "require('$ROOT_DIR/package.json').devDependencies.sharp.replace(/^[^0-9]*/, '')")"

echo "Building sharp Lambda Layer (sharp@${SHARP_VERSION}, linux/arm64)..."

# Lambda（Node.js ランタイム）のLayerは nodejs/node_modules/ 配下を参照する規約
mkdir -p "$BUILD_DIR/nodejs"
cat >"$BUILD_DIR/nodejs/package.json" <<EOF
{
  "name": "sharp-lambda-layer",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "sharp": "${SHARP_VERSION}"
  }
}
EOF

docker run --rm \
  --platform linux/arm64 \
  -v "$BUILD_DIR/nodejs:/var/task" \
  -w /var/task \
  node:22-slim \
  npm install --omit=dev --no-audit --no-fund

mkdir -p "$ROOT_DIR/dist"
rm -f "$OUTPUT_ZIP"
(cd "$BUILD_DIR" && zip -r -q "$OUTPUT_ZIP" nodejs)

echo "✅ Built: ${OUTPUT_ZIP} ($(du -h "$OUTPUT_ZIP" | cut -f1))"
