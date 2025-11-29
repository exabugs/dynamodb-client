# GitHub Actions Setup Guide

## Trusted Publishing (Recommended)

npm は Trusted Publishing (OpenID Connect) を推奨しています。これはトークンを使わずに、より安全に GitHub Actions から npm に公開できる方法です。

### 1. npm で Trusted Publishing を設定

1. https://www.npmjs.com/ にログイン
2. パッケージページに移動: https://www.npmjs.com/package/@exabugs/dynamodb-client/access
3. **Publishing Access** タブをクリック
4. **Add Trusted Publisher** をクリック
5. 設定:
   - **Provider**: GitHub Actions
   - **Repository**: `exabugs/dynamodb-client`
   - **Workflow**: `release.yml`（または `ci.yml`）
   - **Environment**: 空欄（または `production`）
6. **Add** をクリック

これで完了です！GitHub Secrets の設定は不要です。

### 2. ワークフローの設定

ワークフローには以下の設定が必要です（既に設定済み）：

```yaml
permissions:
  contents: read
  id-token: write  # Trusted Publishing に必要

steps:
  - name: Publish to npm
    run: npm publish --provenance --access public
```

`--provenance` フラグにより、パッケージの出所が検証可能になります。

---

## Alternative: NPM_TOKEN (非推奨)

Trusted Publishing が利用できない場合のみ、Granular Access Token を使用してください。

### 1. npm Granular Access Token の作成

1. https://www.npmjs.com/ にログイン
2. プロフィール > Access Tokens > Generate New Token
3. **Granular Access Token** を選択
4. 設定:
   - **Token Name**: `github-actions-dynamodb-client`
   - **Expiration**: 1 year
   - **Packages and scopes**: 
     - Select packages: `@exabugs/dynamodb-client`
     - Permissions: `Read and write`
5. **Generate Token** をクリック
6. トークンをコピー

### 2. GitHub Secrets への登録

1. https://github.com/exabugs/dynamodb-client/settings/secrets/actions にアクセス
2. **New repository secret** をクリック
3. 設定:
   - **Name**: `NPM_TOKEN`
   - **Secret**: コピーした npm トークンを貼り付け
4. **Add secret** をクリック

### CODECOV_TOKEN (オプション)

コードカバレッジレポートを Codecov にアップロードする場合に必要です。

1. https://codecov.io/ にログイン
2. リポジトリを追加
3. トークンをコピー
4. GitHub Secrets に `CODECOV_TOKEN` として登録

## Workflows

### ci.yml

- **トリガー**: push to main, pull request
- **実行内容**:
  - Node.js 18, 20, 22 でテスト
  - Lint チェック
  - ビルド検証
  - カバレッジアップロード（オプション）
  - npm 公開（コミットメッセージに `[publish]` が含まれる場合）

### pr.yml

- **トリガー**: pull request
- **実行内容**:
  - フォーマットチェック
  - Lint チェック
  - テスト実行
  - ビルド検証
  - パッケージサイズ確認
  - セキュリティ監査

### release.yml

- **トリガー**: version tag (v*.*.*)
- **実行内容**:
  - テスト実行
  - ビルド
  - npm 公開
  - GitHub Release 作成

### publish-github.yml

- **トリガー**: manual or version tag
- **実行内容**:
  - GitHub Packages への公開

## Release Process

### 手動公開（推奨）

```bash
# 1. バージョンアップ
npm version patch  # or minor, major

# 2. CHANGELOG.md を更新
vim CHANGELOG.md

# 3. コミット & プッシュ
git add .
git commit -m "chore: release v0.1.1"
git push

# 4. タグをプッシュ
git push --tags
```

タグをプッシュすると、`release.yml` ワークフローが自動的に実行され、npm に公開されます。

### コミットメッセージでの公開

```bash
git commit -m "feat: add new feature [publish]"
git push
```

コミットメッセージに `[publish]` を含めると、`ci.yml` ワークフローが npm に公開します。

## Troubleshooting

### npm publish が失敗する

1. **NPM_TOKEN が設定されているか確認**
   - GitHub Settings > Secrets > Actions で確認

2. **トークンの権限を確認**
   - npm の Access Tokens ページで権限を確認
   - `@exabugs/dynamodb-client` への Read and write 権限が必要

3. **トークンの有効期限を確認**
   - 期限切れの場合は新しいトークンを生成

4. **パッケージ名を確認**
   - `package.json` の `name` が `@exabugs/dynamodb-client` であることを確認

### ビルドが失敗する

1. **ローカルでビルドを確認**
   ```bash
   npm run build
   ```

2. **依存関係を確認**
   ```bash
   npm ci
   npm run build
   ```

### テストが失敗する

1. **ローカルでテストを確認**
   ```bash
   npm test
   ```

2. **統合テストをスキップ**
   ```bash
   npm run test:unit
   ```

## Security

- **NPM_TOKEN は絶対に公開しないこと**
- トークンは定期的に更新すること（推奨: 6ヶ月〜1年）
- 不要になったトークンは削除すること
