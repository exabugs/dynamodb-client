# Private Package Usage Guide

このドキュメントは、プライベートリポジトリとしてGitHub Packagesに公開されたパッケージを使用する方法を説明します。

## GitHub Packagesからのインストール

### 1. Personal Access Token (PAT) の作成

1. GitHubの設定ページに移動: https://github.com/settings/tokens
2. "Generate new token" → "Generate new token (classic)" をクリック
3. 以下のスコープを選択:
   - `read:packages` - パッケージの読み取り
   - `write:packages` - パッケージの書き込み（CI/CD用）
4. トークンを生成してコピー

### 2. ローカル環境での設定

プロジェクトルートまたはホームディレクトリに `.npmrc` ファイルを作成:

```bash
# プロジェクトルートに作成（推奨）
cat > .npmrc << 'EOF'
@exabugs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
EOF
```

**重要**: `.npmrc` を `.gitignore` に追加してトークンが漏洩しないようにしてください。

```bash
echo ".npmrc" >> .gitignore
```

### 3. パッケージのインストール

```bash
npm install @exabugs/dynamodb-client
```

## ainews本体での使用

### pnpm workspaceの場合

ainews本体がpnpm workspaceを使用している場合:

#### 1. ルートの `.npmrc` を更新

```bash
# ainews-pipeline/.npmrc
@exabugs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

#### 2. 環境変数を設定

```bash
# .envrc または .env
export GITHUB_TOKEN=your_github_token_here
```

#### 3. 依存関係を更新

各パッケージの `package.json` で `@ainews/core` を `@exabugs/dynamodb-client` に置き換え:

```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "^1.0.0"
  }
}
```

#### 4. インストール

```bash
pnpm install
```

### インポートパスの更新

```typescript
// Before
import { DynamoClient } from '@ainews/core/client/iam';

// After
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';
```

## CI/CD環境での設定

### GitHub Actions

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22.x'
    registry-url: 'https://npm.pkg.github.com'
    scope: '@exabugs'

- name: Install dependencies
  run: npm ci
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### AWS CodeBuild / その他のCI

環境変数 `GITHUB_TOKEN` を設定:

```bash
export GITHUB_TOKEN=your_github_token
npm ci
```

## トラブルシューティング

### エラー: 401 Unauthorized

**原因**: トークンが無効または権限が不足

**解決方法**:

1. トークンに `read:packages` スコープがあることを確認
2. トークンが有効期限切れでないことを確認
3. `.npmrc` のトークンが正しく設定されていることを確認

### エラー: 404 Not Found

**原因**: パッケージが公開されていない、または名前が間違っている

**解決方法**:

1. パッケージ名が `@exabugs/dynamodb-client` であることを確認
2. GitHub Packagesにパッケージが公開されていることを確認
   - https://github.com/exabugs/dynamodb-client/packages

### pnpmでインストールできない

**原因**: pnpmは `.npmrc` の環境変数展開をサポートしていない場合がある

**解決方法**:

```bash
# 直接トークンを指定（開発環境のみ）
//npm.pkg.github.com/:_authToken=ghp_xxxxxxxxxxxx

# または環境変数を使用
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
pnpm install
```

## バージョン管理

### 最新バージョンの確認

```bash
npm view @exabugs/dynamodb-client versions
```

### 特定バージョンのインストール

```bash
npm install @exabugs/dynamodb-client@1.0.0
```

## ローカル開発

GitHub Packagesを使わずにローカルでテストする場合:

### 方法1: npm link

```bash
# dynamodb-clientディレクトリで
npm run build
npm link

# ainews-pipelineディレクトリで
npm link @exabugs/dynamodb-client
```

### 方法2: file: プロトコル

```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "file:../dynamodb-client"
  }
}
```

## 公開リポジトリへの移行

将来的にパブリックリポジトリに移行する場合:

1. `package.json` から `publishConfig` を削除
2. `.npmrc` から GitHub Packages設定を削除
3. npm公式レジストリに公開

```bash
npm publish --access public
```

## 参考リンク

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Working with the npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
