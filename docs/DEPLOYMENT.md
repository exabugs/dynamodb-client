# Deployment Guide

このドキュメントは、`@exabugs/dynamodb-client` パッケージをGitHub Packagesに公開する手順を説明します。

## 前提条件

- GitHubリポジトリへのpushアクセス権限
- GitHub Actionsが有効になっていること

## 自動デプロイ（推奨）

### 方法1: mainブランチへのpush

mainブランチにpushすると、自動的にGitHub Packagesに公開されます。

```bash
git push origin main
```

GitHub Actionsが自動的に以下を実行します：

1. テストの実行
2. ビルド
3. GitHub Packagesへの公開

### 方法2: 手動トリガー

GitHub Actionsの画面から手動でワークフローを実行できます。

1. GitHubリポジトリページに移動
2. "Actions" タブをクリック
3. "Publish to GitHub Packages" ワークフローを選択
4. "Run workflow" ボタンをクリック

## 手動デプロイ

ローカルから手動で公開する場合：

### 1. Personal Access Tokenの作成

1. https://github.com/settings/tokens にアクセス
2. "Generate new token (classic)" をクリック
3. 以下のスコープを選択:
   - `write:packages`
   - `read:packages`
4. トークンを生成してコピー

### 2. .npmrcの設定

```bash
cat > .npmrc << 'EOF'
@exabugs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
EOF
```

### 3. ビルドとテスト

```bash
npm run build
npm test
```

### 4. 公開

```bash
npm publish
```

## バージョン管理

### セマンティックバージョニング

このプロジェクトは[セマンティックバージョニング](https://semver.org/)に従います。

- **MAJOR**: 破壊的変更
- **MINOR**: 後方互換性のある機能追加
- **PATCH**: 後方互換性のあるバグ修正

### バージョンの更新

```bash
# パッチバージョンを上げる (1.0.0 -> 1.0.1)
npm version patch

# マイナーバージョンを上げる (1.0.0 -> 1.1.0)
npm version minor

# メジャーバージョンを上げる (1.0.0 -> 2.0.0)
npm version major
```

### タグを使ったリリース

バージョンタグをpushすると、自動的にリリースが作成されます。

```bash
# バージョンを更新（自動的にgit tagが作成される）
npm version patch

# タグをpush
git push origin main --tags
```

これにより、`release.yml` ワークフローが実行され、以下が自動的に行われます：

1. テストとビルド
2. GitHub Packagesへの公開
3. GitHubリリースの作成

## デプロイ後の確認

### 1. GitHub Packagesでの確認

1. GitHubリポジトリページに移動
2. 右サイドバーの "Packages" セクションを確認
3. `@exabugs/dynamodb-client` パッケージが表示されることを確認

### 2. インストールテスト

別のプロジェクトでインストールをテストします：

```bash
# .npmrcを設定
cat > .npmrc << 'EOF'
@exabugs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
EOF

# インストール
npm install @exabugs/dynamodb-client

# インポートテスト
node -e "const { DynamoClient } = require('@exabugs/dynamodb-client/client/iam'); console.log('OK');"
```

## トラブルシューティング

### エラー: npm ERR! 403 Forbidden

**原因**: トークンに `write:packages` スコープがない

**解決方法**: トークンを再作成し、`write:packages` スコープを追加

### エラー: npm ERR! 404 Not Found

**原因**: パッケージ名またはレジストリURLが間違っている

**解決方法**:

1. `package.json` の `name` が `@exabugs/dynamodb-client` であることを確認
2. `publishConfig.registry` が `https://npm.pkg.github.com` であることを確認

### GitHub Actionsが失敗する

**原因**: テストまたはビルドが失敗している

**解決方法**:

1. GitHub Actionsのログを確認
2. ローカルで `npm test` と `npm run build` を実行して問題を特定
3. 修正してpush

### パッケージが見つからない

**原因**: パッケージがプライベートで、認証が必要

**解決方法**:

1. `.npmrc` が正しく設定されていることを確認
2. トークンに `read:packages` スコープがあることを確認
3. パッケージの可視性設定を確認（Settings > Packages）

## ainews本体での使用

### 1. 依存関係の更新

各パッケージの `package.json` を更新：

```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "^1.0.0"
  }
}
```

### 2. インポートパスの更新

```typescript
// Before
import { DynamoClient } from '@ainews/core/client/iam';
import { createHandler } from '@ainews/core/server/handler';

// After
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';
import { createHandler } from '@exabugs/dynamodb-client/server/handler';
```

### 3. 一括置換

```bash
# ainews-pipelineディレクトリで実行
find . -type f -name "*.ts" -not -path "*/node_modules/*" -exec sed -i '' 's/@ainews\/core/@exabugs\/dynamodb-client/g' {} +
```

### 4. インストールと確認

```bash
pnpm install
pnpm build
pnpm test
```

## 公開リポジトリへの移行

将来的にパブリックリポジトリに移行する場合：

### 1. リポジトリを公開

GitHub Settings > General > Danger Zone > Change visibility

### 2. npm公式レジストリに公開

```bash
# package.jsonからpublishConfigを削除
npm pkg delete publishConfig

# .npmrcを更新（GitHub Packages設定を削除）
rm .npmrc

# npm公式レジストリに公開
npm publish --access public
```

### 3. ドキュメントの更新

- README.mdのインストール方法を更新
- PRIVATE_PACKAGE_USAGE.mdを削除または更新
- Codecovを有効化

## 参考リンク

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Publishing Node.js packages](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [Semantic Versioning](https://semver.org/)
