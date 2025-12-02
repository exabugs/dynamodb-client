# npmパブリッシュガイドライン

## 概要

`@exabugs/dynamodb-client` パッケージのnpmへのパブリッシュは、GitHub Actionsを通じて自動化されています。

**重要**: npm Trusted Publishingの設定により、**CI Workflow (`.github/workflows/ci.yml`) のみ**がnpmへのパブリッシュを許可されています。Release Workflowは使用できません。

## パブリッシュ手順

### CI Workflow経由（唯一の方法）

mainブランチへのプッシュ時に、コミットメッセージに `[publish]` を含めることで自動的にnpmにパブリッシュされます。

#### 1. ローカルでテストとビルドを実行

**重要**: コミット前に必ずローカルでテストとビルドを実行すること！

```bash
# テストを実行
npm test

# ビルドを実行
npm run build
```

すべてのテストが通過し、ビルドが成功することを確認してから次のステップに進んでください。

#### 2. バージョンの更新

```bash
# package.jsonのバージョンを更新
vim package.json  # "version": "0.1.x" を更新

# CHANGELOGを更新
vim CHANGELOG.md  # 新バージョンのエントリを追加
```

#### 3. 変更をコミット（[publish]を含める）

**重要**: コミットメッセージに `[publish]` を含めること！

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.1.x [publish]"
git push origin main
```

これで、CI Workflowの`publish`ジョブが自動的に実行され、npmにパブリッシュされます。

### GitHub Actionsの確認

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

実行状況を確認：
```bash
# CI Workflowの実行一覧を表示
gh run list --workflow=ci.yml --limit 5

# 特定の実行の詳細を表示
gh run view <run-id> --log

# 失敗したステップのログを表示
gh run view <run-id> --log-failed
```

または、ブラウザで確認：
https://github.com/exabugs/dynamodb-client/actions

### 3. パブリッシュの確認

npmにパブリッシュされたことを確認：
```bash
npm view @exabugs/dynamodb-client version
npm view @exabugs/dynamodb-client versions
```

## 重要な注意事項

### npm Trusted Publishing

- このプロジェクトは npm Trusted Publishing を使用しています
- **CI Workflow (`.github/workflows/ci.yml`) のみ**がnpmへのパブリッシュを許可されています
- Release Workflowやローカルからの `npm publish` は使用できません
- `NPM_TOKEN` シークレットは不要です（OIDCトークンで認証）

### セマンティックバージョニング

- **パッチバージョン** (0.1.x): バグフィックス、小さな改善
- **マイナーバージョン** (0.x.0): 新機能追加（後方互換性あり）
- **メジャーバージョン** (x.0.0): 破壊的変更

## トラブルシューティング

### ワークフローが失敗する場合

1. **テスト失敗**
   ```
   npm test failed
   ```
   → ローカルでテストを実行して修正する：`npm test`

2. **ビルド失敗**
   ```
   npm run build failed
   ```
   → ローカルでビルドを実行して修正する：`npm run build`

3. **npm publish失敗**
   ```
   npm error 404 Not Found
   ```
   → npm Trusted Publishingの設定を確認
   → CI Workflow (`.github/workflows/ci.yml`) が許可されているか確認
   → npmパッケージの権限を確認

4. **[publish]を含め忘れた場合**
   → 新しいコミットを作成して `[publish]` を含める
   → または、既存のコミットメッセージを修正して force push（非推奨）

## チェックリスト

パブリッシュ前に以下を確認してください：

- [ ] package.jsonのバージョンを更新した
- [ ] CHANGELOG.mdに新バージョンのエントリを追加した
- [ ] ローカルでテストが通過する（`npm test`）
- [ ] ローカルでビルドが成功する（`npm run build`）
- [ ] コミットメッセージに `[publish]` を含めた
- [ ] 変更をコミットしてプッシュした
- [ ] GitHub Actionsの実行を確認した
- [ ] npmにパブリッシュされたことを確認した

## 参考リンク

- [npm package](https://www.npmjs.com/package/@exabugs/dynamodb-client)
- [GitHub Releases](https://github.com/exabugs/dynamodb-client/releases)
- [GitHub Actions](https://github.com/exabugs/dynamodb-client/actions)
- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)
