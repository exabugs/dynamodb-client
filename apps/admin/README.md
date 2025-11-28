# AI News Pipeline - Admin UI

React + react-admin + Vite による管理画面

## 技術スタック

- **React**: 19.x
- **react-admin**: 5.x
- **Material-UI**: 6.x
- **Vite**: 5.x
- **TypeScript**: 5.3.x

## セットアップ

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm dev

# ビルド
pnpm build

# プレビュー
pnpm preview
```

## 環境変数

`.env.example` をコピーして `.env.local` を作成し、必要な値を設定してください。

```bash
cp .env.example .env.local
```

## ディレクトリ構造

```
src/
├── main.tsx              # エントリーポイント
├── App.tsx               # react-admin <Admin>コンポーネント
├── auth/                 # 認証プロバイダー
├── dataProvider/         # データプロバイダー
├── api/                  # HTTP クライアント
├── resources/            # リソース定義（articles, tasks）
└── components/           # 共通コンポーネント
```

## 開発

- ポート: 3000（固定、`strictPort: true`）
- 自動リロード: 有効
- TypeScript型チェック: `pnpm type-check`

### 重要な設定

#### ポート固定

開発サーバーはポート3000で固定されています（`vite.config.ts`で`strictPort: true`を設定）。

理由：
- Cognito Hosted UIのコールバック/ログアウトURLがポート3000で設定されている
- ポートが自動的に変更されると、認証が失敗する

ポート3000が使用中の場合は、以下のコマンドで使用中のプロセスを確認してください：

```bash
lsof -ti:3000
```

#### CORS設定

Lambda Function URLのCORS設定を使用するため、Lambda関数のハンドラーではCORSヘッダーを設定していません。

CORSエラーが発生する場合は、以下を確認してください：
1. Lambda関数が最新版にデプロイされているか
2. ブラウザのキャッシュをクリアしたか
3. Lambda Function URLのCORS設定が正しいか（`infra/modules/api/lambda-records/main.tf`）
