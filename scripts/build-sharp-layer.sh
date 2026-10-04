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

# --user でホスト側の実行ユーザーとしてコンテナ内のnpm installを実行する。
# 省略するとコンテナ内はrootとして書き込むため、バインドマウント先
# （$BUILD_DIR、ホスト側のファイルシステム）にroot所有のファイルが残り、
# 非rootユーザーで動くCIランナー（GitHub Actions等）でのtrap内`rm -rf`が
# Permission deniedで失敗する（実際にCIで発生、ローカルのDocker Desktopでは
# UIDマッピングが透過的なため再現しなかった）。
# HOME/npmキャッシュも書き込み可能な場所に向け直す（nodeイメージの既定は
# root想定のため、非rootユーザーのままだと npm install 自体が失敗する）。
docker run --rm \
  --platform linux/arm64 \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm \
  -v "$BUILD_DIR/nodejs:/var/task" \
  -w /var/task \
  node:22-slim \
  npm install --omit=dev --no-audit --no-fund

mkdir -p "$ROOT_DIR/dist"
rm -f "$OUTPUT_ZIP"
(cd "$BUILD_DIR" && zip -r -q "$OUTPUT_ZIP" nodejs)

echo "✅ Built: ${OUTPUT_ZIP} ($(du -h "$OUTPUT_ZIP" | cut -f1))"
