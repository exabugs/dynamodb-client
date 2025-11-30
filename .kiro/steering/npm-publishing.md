# npmパブリッシュガイドライン

## 概要

`@exabugs/dynamodb-client` パッケージのnpmへのパブリッシュは、GitHub Actionsを通じて自動化されています。

## パブリッシュ手順

このプロジェクトには2つのパブリッシュ方法があります：

### 方法1: CI Workflow経由（推奨）

mainブランチへのプッシュ時に、コミットメッセージに `[publish]` を含めることで自動的にnpmにパブリッシュされます。

#### 1. バージョンの更新

```bash
# package.jsonのバージョンを更新
vim package.json  # "version": "0.1.x" を更新

# CHANGELOGを更新
vim CHANGELOG.md  # 新バージョンのエントリを追加
```

#### 2. 変更をコミット（[publish]を含める）

**重要**: コミットメッセージに `[publish]` を含めること！

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.1.x [publish]"
git push origin main
```

これで、CI Workflowの`publish`ジョブが自動的に実行され、npmにパブリッシュされます。

### 方法2: Release Workflow経由（Gitタグ使用）

Gitタグをプッシュすることで、Release Workflowが実行されます。

#### 1. バージョンの更新とコミット

```bash
# package.jsonのバージョンを更新
vim package.json  # "version": "0.1.x" を更新

# CHANGELOGを更新
vim CHANGELOG.md  # 新バージョンのエントリを追加

# 変更をコミット
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.1.x"
git push origin main
```

#### 2. Gitタグの作成とプッシュ

**重要**: タグ名は `v` プレフィックス付きのセマンティックバージョニング形式（`v0.1.x`）を使用すること。

```bash
# タグを作成
git tag v0.1.x

# タグをプッシュ（これがGitHub Actionsをトリガーする）
git push origin v0.1.x
```

### GitHub Actionsの確認

#### CI Workflow (方法1)

コミットメッセージに `[publish]` を含めてプッシュすると、以下が実行されます：

- **CI Workflow** (`.github/workflows/ci.yml`)
  - テストを実行（Node.js 18.x, 20.x, 22.x）
  - パッケージをビルド
  - npmにパブリッシュ（Trusted Publishing使用）

実行条件：
```yaml
if: github.event_name == 'push' && 
    github.ref == 'refs/heads/main' && 
    contains(github.event.head_commit.message, '[publish]')
```

#### Release Workflow (方法2)

タグをプッシュすると、以下が実行されます：

- **Release Workflow** (`.github/workflows/release.yml`)
  - テストを実行
  - パッケージをビルド
  - package.jsonのバージョンとタグのバージョンを検証
  - npmにパブリッシュ（Trusted Publishing使用）
  - GitHub Releaseを作成

実行状況を確認：
```bash
# CI Workflowの実行一覧を表示
gh run list --workflow=ci.yml --limit 5

# Release Workflowの実行一覧を表示
gh run list --workflow=release.yml --limit 5

# 特定の実行の詳細を表示
gh run view <run-id> --log

# 失敗したステップのログを表示
gh run view <run-id> --log-failed
```

または、ブラウザで確認：
https://github.com/exabugs/dynamodb-client/actions

### 5. パブリッシュの確認

npmにパブリッシュされたことを確認：
```bash
npm view @exabugs/dynamodb-client version
npm view @exabugs/dynamodb-client versions
```

## 重要な注意事項

### バージョン管理

- **package.jsonのバージョンとGitタグのバージョンは一致させること**
- ワークフローは自動的にバージョンの一致を検証します
- 不一致の場合、ワークフローは失敗します

### タグ命名規則

- ✅ 正しい: `v0.1.2`, `v1.0.0`, `v2.1.3`
- ❌ 間違い: `0.1.2`, `release-0.1.2`, `v0.1.2-beta`

### セマンティックバージョニング

- **パッチバージョン** (0.1.x): バグフィックス、小さな改善
- **マイナーバージョン** (0.x.0): 新機能追加（後方互換性あり）
- **メジャーバージョン** (x.0.0): 破壊的変更

### npm Trusted Publishing

このプロジェクトは npm Trusted Publishing を使用しています：
- `NPM_TOKEN` シークレットは不要
- GitHub ActionsのOIDCトークンで認証
- `--provenance` フラグで署名付きパッケージを生成

## トラブルシューティング

### ワークフローが失敗する場合

1. **バージョン不一致エラー**
   ```
   Error: package.json version (0.1.1) does not match tag version (0.1.2)
   ```
   → package.jsonのバージョンを更新してコミットし、タグを作り直す

2. **テスト失敗**
   ```
   npm test failed
   ```
   → ローカルでテストを実行して修正する：`npm test`

3. **ビルド失敗**
   ```
   npm run build failed
   ```
   → ローカルでビルドを実行して修正する：`npm run build`

4. **npm publish失敗**
   ```
   npm error 403 Forbidden
   ```
   → npm Trusted Publishingの設定を確認
   → npmパッケージの権限を確認

### タグを作り直す場合

```bash
# ローカルのタグを削除
git tag -d v0.1.x

# リモートのタグを削除
git push origin :refs/tags/v0.1.x

# 新しいタグを作成してプッシュ
git tag v0.1.x
git push origin v0.1.x
```

## チェックリスト

### 方法1: CI Workflow経由

- [ ] package.jsonのバージョンを更新した
- [ ] CHANGELOG.mdに新バージョンのエントリを追加した
- [ ] ローカルでテストが通過する（`npm test`）
- [ ] ローカルでビルドが成功する（`npm run build`）
- [ ] コミットメッセージに `[publish]` を含めた
- [ ] 変更をコミットしてプッシュした
- [ ] GitHub Actionsの実行を確認した
- [ ] npmにパブリッシュされたことを確認した

### 方法2: Release Workflow経由

- [ ] package.jsonのバージョンを更新した
- [ ] CHANGELOG.mdに新バージョンのエントリを追加した
- [ ] ローカルでテストが通過する（`npm test`）
- [ ] ローカルでビルドが成功する（`npm run build`）
- [ ] 変更をコミットしてプッシュした
- [ ] Gitタグを作成した（`v` プレフィックス付き）
- [ ] Gitタグをプッシュした
- [ ] GitHub Actionsの実行を確認した
- [ ] npmにパブリッシュされたことを確認した

## 参考リンク

- [npm package](https://www.npmjs.com/package/@exabugs/dynamodb-client)
- [GitHub Releases](https://github.com/exabugs/dynamodb-client/releases)
- [GitHub Actions](https://github.com/exabugs/dynamodb-client/actions)
- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)
