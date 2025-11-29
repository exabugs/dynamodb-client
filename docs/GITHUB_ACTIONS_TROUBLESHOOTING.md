# GitHub Actions Troubleshooting

## ワークフローが止まらない場合

### 方法1: GitHub Web UIから停止

1. GitHubリポジトリページに移動
2. "Actions" タブをクリック
3. 実行中のワークフローをクリック
4. 右上の "Cancel workflow" ボタンをクリック

### 方法2: GitHub CLIから停止

```bash
# 実行中のワークフローを一覧表示
gh run list --status in_progress

# 特定のワークフローをキャンセル
gh run cancel <run-id>

# すべての実行中ワークフローをキャンセル
gh run list --status in_progress --json databaseId --jq '.[].databaseId' | xargs -I {} gh run cancel {}
```

### 方法3: すべてのワークフローを無効化

緊急時にすべてのワークフローを停止する場合：

1. GitHubリポジトリページに移動
2. "Settings" > "Actions" > "General"
3. "Actions permissions" で "Disable actions" を選択
4. 問題を修正後、再度有効化

## よくある問題と解決方法

### 問題1: ワークフローが無限ループする

**原因**: ワークフロー内でgit pushを実行し、それが新しいワークフローをトリガーしている

**解決方法**:
```yaml
# ワークフローからのpushを除外
on:
  push:
    branches: [main]
    # ワークフローからのpushを無視
    paths-ignore:
      - '.github/workflows/**'
```

または、特定の条件でのみ実行：
```yaml
on:
  push:
    branches: [main]
    # コミットメッセージに[skip ci]が含まれる場合はスキップ
jobs:
  build:
    if: "!contains(github.event.head_commit.message, '[skip ci]')"
```

### 問題2: npm ciが失敗する

**原因**: .npmrcファイルがない、またはトークンが設定されていない

**解決方法**:
```yaml
- name: Setup .npmrc for GitHub Packages
  run: |
    echo "@exabugs:registry=https://npm.pkg.github.com" > .npmrc
    echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> .npmrc

- name: Install dependencies
  run: npm ci
```

### 問題3: テストが失敗する

**原因**: 環境変数が設定されていない、またはテストが環境依存

**解決方法**:
```yaml
- name: Run tests
  run: npm test
  env:
    NODE_ENV: test
    # 必要な環境変数を設定
```

### 問題4: ビルドが失敗する

**原因**: Node.jsバージョンの不一致、依存関係の問題

**解決方法**:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22.x'  # package.jsonのenginesと一致させる
    cache: 'npm'
```

### 問題5: パッケージ公開が失敗する

**原因**: 権限不足、パッケージ名の重複

**解決方法**:
```yaml
jobs:
  publish:
    permissions:
      contents: read
      packages: write  # 必須
```

## デバッグ方法

### ステップごとのログ確認

```bash
# 特定のワークフローのログを表示
gh run view <run-id> --log

# 失敗したステップのみ表示
gh run view <run-id> --log-failed
```

### ローカルでワークフローをテスト

[act](https://github.com/nektos/act)を使用してローカルでワークフローを実行：

```bash
# actをインストール
brew install act

# ワークフローを実行
act push

# 特定のジョブを実行
act -j test

# デバッグモードで実行
act -v
```

### シークレットのテスト

```bash
# シークレットを指定して実行
act -s GITHUB_TOKEN=your_token
```

## ワークフローの最適化

### キャッシュの活用

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22.x'
    cache: 'npm'  # node_modulesをキャッシュ
```

### 並列実行

```yaml
jobs:
  test:
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    # 各バージョンで並列実行
```

### 条件付き実行

```yaml
jobs:
  publish:
    # mainブランチかつコミットメッセージに[publish]が含まれる場合のみ
    if: github.ref == 'refs/heads/main' && contains(github.event.head_commit.message, '[publish]')
```

## 現在のワークフロー設定

### ci.yml
- **トリガー**: mainブランチへのpush、PRの作成/更新
- **実行内容**: テスト、ビルド
- **注意**: 毎回実行されるため、テストは高速に保つ

### pr.yml
- **トリガー**: PRの作成/更新
- **実行内容**: フォーマットチェック、リント、テスト、ビルド、セキュリティ監査

### coverage.yml
- **トリガー**: mainブランチへのpush、PRの作成/更新
- **実行内容**: カバレッジ計測

### publish-github.yml
- **トリガー**: バージョンタグ（v*.*.*）のpush、手動実行
- **実行内容**: GitHub Packagesへの公開
- **注意**: mainブランチへのpushでは実行されない

### release.yml
- **トリガー**: バージョンタグ（v*.*.*）のpush
- **実行内容**: npm公開、GitHubリリース作成

## 推奨事項

1. **ワークフローは最小限に保つ**: 必要なチェックのみ実行
2. **キャッシュを活用**: ビルド時間を短縮
3. **並列実行**: 複数のジョブを並列で実行
4. **条件付き実行**: 不要な実行を避ける
5. **タイムアウト設定**: 無限ループを防ぐ

```yaml
jobs:
  test:
    timeout-minutes: 10  # 10分でタイムアウト
```

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [act - Run GitHub Actions locally](https://github.com/nektos/act)
