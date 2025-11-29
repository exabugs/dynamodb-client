# パッケージ公開完了

## 公開情報

- **パッケージ名**: `@exabugs/dynamodb-client`
- **バージョン**: `1.0.0`
- **公開先**: GitHub Packages
- **公開日時**: 2025-11-29

## 確認方法

### 1. GitHubでパッケージを確認

https://github.com/exabugs/dynamodb-client/packages

### 2. GitHub Actionsで公開ログを確認

https://github.com/exabugs/dynamodb-client/actions

"Publish to GitHub Packages" ワークフローが成功していることを確認してください。

## ainews本体での使用方法

### ステップ1: Personal Access Tokenの作成

1. https://github.com/settings/tokens にアクセス
2. "Generate new token (classic)" をクリック
3. 以下のスコープを選択:
   - `read:packages` - パッケージの読み取り
4. トークンを生成してコピー

### ステップ2: .npmrcの設定

ainews-pipelineプロジェクトのルートに`.npmrc`ファイルを作成:

```bash
cd /path/to/ainews-pipeline

cat > .npmrc << 'EOF'
@exabugs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
EOF
```

**重要**: `YOUR_GITHUB_TOKEN`を実際のトークンに置き換えてください。

### ステップ3: .gitignoreに追加

```bash
echo ".npmrc" >> .gitignore
```

### ステップ4: 依存関係の更新

各パッケージの`package.json`を更新:

```json
{
  "dependencies": {
    "@exabugs/dynamodb-client": "^1.0.0"
  }
}
```

以下のパッケージで`@ainews/core`を`@exabugs/dynamodb-client`に置き換え:

- `packages/core/package.json` → 削除（このパッケージ自体が不要）
- `functions/records/package.json`
- `functions/fetch/package.json`
- `apps/admin/package.json`

### ステップ5: インポートパスの一括更新

```bash
cd /path/to/ainews-pipeline

# すべてのTypeScriptファイルでインポートパスを更新
find . -type f -name "*.ts" -o -name "*.tsx" | \
  grep -v node_modules | \
  xargs sed -i '' 's/@ainews\/core/@exabugs\/dynamodb-client/g'
```

### ステップ6: インストールとビルド

```bash
# 依存関係をインストール
pnpm install

# ビルド
pnpm build

# テスト
pnpm test
```

## トラブルシューティング

### エラー: 401 Unauthorized

**原因**: トークンが無効または権限が不足

**解決方法**:
1. トークンに`read:packages`スコープがあることを確認
2. `.npmrc`のトークンが正しく設定されていることを確認

### エラー: 404 Not Found

**原因**: パッケージが見つからない

**解決方法**:
1. パッケージ名が`@exabugs/dynamodb-client`であることを確認
2. GitHubでパッケージが公開されていることを確認

### pnpmでインストールできない

**解決方法**:
```bash
# 環境変数を使用
export GITHUB_TOKEN=your_github_token
pnpm install
```

## 更新履歴

### v1.0.0 (2025-11-29)

初回リリース

**主要機能**:
- MongoDB-like API for DynamoDB
- Single-Table Design with Shadow Records
- Multiple authentication methods (IAM, Cognito, Token)
- Lambda function implementation
- react-admin integration
- TypeScript support
- Terraform modules for deployment

**含まれるモジュール**:
- Client SDK (IAM, Cognito, Token authentication)
- Server implementation (Lambda handler)
- Shadow records management
- react-admin data provider
- Terraform deployment modules

## 次のバージョン

次のバージョンをリリースする場合:

```bash
# パッチバージョン (1.0.0 -> 1.0.1)
npm version patch
git push origin main --tags

# マイナーバージョン (1.0.0 -> 1.1.0)
npm version minor
git push origin main --tags

# メジャーバージョン (1.0.0 -> 2.0.0)
npm version major
git push origin main --tags
```

## 参考リンク

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Private Package Usage Guide](./PRIVATE_PACKAGE_USAGE.md)
- [Deployment Guide](./DEPLOYMENT.md)
