# dynamodb-client パブリッシュ & asanowa デプロイ手順

## 基本原則

**dynamodb-clientの変更をasanowaに反映する際は、必ずnpmパブリッシュを経由すること**

## 重要な注意事項

### ❌ 絶対に避けるべき実装

```yaml
# pnpm-workspace.yaml で以下は禁止
overrides:
  '@exabugs/dynamodb-client': link:../dynamodb-client
```

**理由**:
- ローカルリンクを使用すると、デプロイ時に古いコードが使用される
- Lambda関数のZIPファイルに古いビルド成果物が含まれる
- npmパッケージの更新が反映されない

### ✅ 正しい実装

```json
// package.json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "^1.3.x"
  }
}
```

## 手順

### Phase 1: dynamodb-client の変更とパブリッシュ

#### 1.1 変更の実装

```bash
cd dynamodb-client

# コードを修正
vim src/server/operations/find/nearQuery.ts

# テストを実行
npm test

# ビルドを実行
npm run build
```

#### 1.2 バージョンの更新

```bash
# package.json のバージョンを更新
vim package.json
# "version": "1.3.2" → "1.3.3"

# CHANGELOG.md を更新
vim CHANGELOG.md
```

**CHANGELOG.md の例**:
```markdown
## [1.3.3] - 2026-01-02

### Fixed
- 修正内容を記載

### Changed
- 変更内容を記載
```

#### 1.3 変更のコミット

```bash
# 変更をステージング
git add package.json CHANGELOG.md src/

# コミット（[publish]タグを含める）
git commit -m "fix: 修正内容の簡潔な説明 [publish]"

# プッシュ
git push origin main
```

**重要**: コミットメッセージに `[publish]` を含めることで、CI Workflowが自動的にnpmにパブリッシュします。

#### 1.4 パブリッシュの確認

```bash
# GitHub Actionsの実行を確認
gh run list --workflow=ci.yml --limit 5

# または、ブラウザで確認
# https://github.com/exabugs/dynamodb-client/actions

# npmにパブリッシュされたことを確認
npm view @exabugs/dynamodb-client version
npm view @exabugs/dynamodb-client versions
```

**期待される出力**:
```
1.3.3
```

### Phase 2: asanowa への反映とデプロイ

#### 2.1 依存関係の更新

```bash
cd asanowa

# package.json のバージョンを更新
vim package.json
# "@exabugs/dynamodb-client": "^1.3.2" → "^1.3.3"

# 依存関係を再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 2.2 インストールの確認

```bash
# インストールされたバージョンを確認
cat node_modules/@exabugs/dynamodb-client/package.json | grep '"version"'

# 期待される出力: "version": "1.3.3",
```

**重要**: ローカルリンクではなく、npmパッケージがインストールされていることを確認してください。

```bash
# シンボリックリンクの確認
ls -la node_modules/@exabugs/dynamodb-client

# 期待される出力:
# lrwxr-xr-x ... node_modules/@exabugs/dynamodb-client -> ../.pnpm/@exabugs+dynamodb-client@1.3.3_...
```

#### 2.3 ビルドとデプロイ

```bash
# ビルド
make build

# デプロイ（dev環境）
make deploy-dev
```

**デプロイ時の確認事項**:
- Terraform が Lambda 関数を更新すること
- 3つの Lambda 関数（records, weather, notification）が更新されること
- デプロイ完了後、`LastModified` が最新の日時になっていること

#### 2.4 デプロイの確認

```bash
# Lambda関数のバージョンを確認
pnpm check:lambda-version

# 期待される出力:
# {
#   "success": true,
#   "data": {
#     "version": "1.3.3",
#     "timestamp": "..."
#   }
# }
```

**確認項目**:
- [ ] Lambda関数が最新バージョン（1.3.3）を返すこと
- [ ] `LastModified` が最新の日時であること
- [ ] エラーが発生していないこと

### Phase 3: 動作確認

#### 3.1 テストデータの投入（必要に応じて）

```bash
# テストデータを投入
pnpm seed:venues:json

# 期待される出力:
# ✅ 40件のvenuesデータを投入しました
```

#### 3.2 シャドーレコードの確認

```bash
# DynamoDBに直接アクセスしてシャドーレコードを確認
pnpm check:dynamodb-direct

# 期待される出力:
# ✅ 40件のlocationシャドーレコードが見つかりました
```

#### 3.3 $near オペレーターのテスト

```bash
# $near オペレーターをテスト
pnpm test:near

# 期待される出力:
# ✅ 新宿御苑から5km以内の開催地: X件
# （距離順にソートされた開催地一覧）
```

## トラブルシューティング

### 問題1: Lambda関数が古いバージョンを返す

**症状**:
```bash
pnpm check:lambda-version
# "version": "1.3.2"  # 古いバージョン
```

**原因**:
- ローカルリンクが残っている
- node_modules が古い状態

**解決策**:
```bash
# 1. pnpm-workspace.yaml を確認
cat pnpm-workspace.yaml
# overrides セクションがないことを確認

# 2. node_modules を削除して再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 3. バージョンを確認
cat node_modules/@exabugs/dynamodb-client/package.json | grep '"version"'

# 4. 再ビルド・再デプロイ
make clean
make build
make deploy-dev
```

### 問題2: Terraform が Lambda 関数を更新しない

**症状**:
```
No changes. Your infrastructure matches the configuration.
```

**原因**:
- Lambda 関数のソースコードハッシュが変わっていない
- Terraform が変更を検知していない

**解決策**:
```bash
# 1. ビルド成果物を削除
make clean

# 2. 再ビルド
make build

# 3. Terraform の状態を確認
cd infra
terraform plan

# 4. 強制的に再デプロイ
terraform taint module.records.aws_lambda_function.records
terraform apply -auto-approve
```

### 問題3: npm パブリッシュが失敗する

**症状**:
```
npm error 404 Not Found
```

**原因**:
- npm Trusted Publishing の設定が正しくない
- CI Workflow の権限が不足している

**解決策**:
```bash
# 1. GitHub Actions の実行ログを確認
gh run view <run-id> --log

# 2. npm Trusted Publishing の設定を確認
# https://www.npmjs.com/settings/exabugs/packages/@exabugs/dynamodb-client/access

# 3. CI Workflow の設定を確認
cat .github/workflows/ci.yml
```

## チェックリスト

### dynamodb-client パブリッシュ前

- [ ] テストが全て通過している（`npm test`）
- [ ] ビルドが成功している（`npm run build`）
- [ ] package.json のバージョンを更新した
- [ ] CHANGELOG.md を更新した
- [ ] コミットメッセージに `[publish]` を含めた

### asanowa デプロイ前

- [ ] pnpm-workspace.yaml に `overrides` セクションがない
- [ ] package.json のバージョンを更新した
- [ ] `rm -rf node_modules pnpm-lock.yaml && pnpm install` を実行した
- [ ] `cat node_modules/@exabugs/dynamodb-client/package.json | grep '"version"'` で最新バージョンを確認した
- [ ] `make build` が成功した

### デプロイ後

- [ ] `pnpm check:lambda-version` で最新バージョンを確認した
- [ ] Lambda 関数の `LastModified` が最新の日時になっている
- [ ] `pnpm test:near` でテストが通過した

## 参考

- [npm パブリッシュガイドライン](./npm-publishing.md)
- [Makefile 運用ガイドライン](../../asanowa/.kiro/steering/makefile-operations.md)
- [標準手順の遵守](./standard-procedures.md)
