# 管理UI ドキュメント

AIニュース自動配信パイプライン 管理UIの技術ドキュメント

## 概要

React + react-admin + MUI 6 で構築された管理Webインターフェース。Records Lambda（GraphQL API）と通信し、記事やタスクなどのリソースを管理します。

## 技術スタック

- **フレームワーク**: React 19
- **UI ライブラリ**: react-admin 5, MUI 6
- **ビルドツール**: Vite
- **認証**: Amplify Auth (Cognito Hosted UI)
- **API通信**: Records Lambda Function URL (HTTP API)

## ドキュメント一覧

### コア機能

- [DataGrid ソート可能フィールドの自動判定](./datagrid-sortable.md)
  - shadow.config.json に基づくソート可能フィールドの自動判定
  - 必須シャドー（id, name, createdAt, updatedAt）の扱い

- [フィルタリングとページネーション](./filtering-and-pagination.md)
  - 複数フィールドのAND検索の仕組み
  - 無限スクロールによるページネーション
  - nextTokenベースのページング実装

### アーキテクチャ

```
┌─────────────────┐
│   React Admin   │
│   (UI Layer)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DataProvider   │
│ (API Client)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Records Lambda  │
│  (HTTP API)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    DynamoDB     │
│ (Single-Table)  │
└─────────────────┘
```

## ディレクトリ構造

```
apps/admin/
├── src/
│   ├── components/       # 共通コンポーネント
│   │   ├── Datagrid.tsx  # カスタムDataGrid（ソート制御）
│   │   └── LoginPage.tsx # ログインページ
│   ├── resources/        # リソース定義
│   │   ├── articles.tsx  # 記事リソース
│   │   └── tasks.tsx     # タスクリソース
│   ├── App.tsx           # アプリケーションルート
│   ├── main.tsx          # エントリーポイント
│   ├── dataProvider.ts   # API通信層
│   └── authProvider.ts   # 認証層
├── docs/                 # ドキュメント（このディレクトリ）
├── public/               # 静的ファイル
├── vite.config.ts        # Vite設定
└── tsconfig.json         # TypeScript設定
```

## 開発

### 環境変数

`.env.local`ファイルを作成し、以下の環境変数を設定：

```bash
# Records Lambda Function URL
VITE_RECORDS_API_URL=https://xxxxx.lambda-url.ap-northeast-1.on.aws/

# Cognito設定
VITE_COGNITO_DOMAIN=ainews-dev.auth.ap-northeast-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=xxxxx
VITE_COGNITO_REDIRECT_URI=http://localhost:3000

# 開発環境で認証を無効化する場合（オプション）
VITE_DISABLE_AUTH=true
```

### 開発サーバー起動

```bash
cd apps/admin
pnpm install
pnpm dev
```

ブラウザで http://localhost:3000 を開きます。

### ビルド

```bash
pnpm build
```

成果物は `dist/` ディレクトリに出力されます。

## 主要コンポーネント

### DataProvider

`src/dataProvider.ts`

react-adminの10操作を実装：

- `getList` - リスト取得（フィルター・ソート・無限スクロール対応）
- `getOne` - 単一レコード取得
- `getMany` - 複数レコード取得（ID指定）
- `getManyReference` - 参照レコード取得
- `create` - レコード作成
- `update` - レコード更新
- `updateMany` - 複数レコード一括更新
- `delete` - レコード削除
- `deleteMany` - 複数レコード一括削除

### AuthProvider

`src/authProvider.ts`

Amplify Authを使用したCognito認証：

- Hosted UIによるログイン/ログアウト
- IDトークンの取得と管理
- 認証状態の確認

### カスタムDatagrid

`src/components/Datagrid.tsx`

shadow.config.jsonに基づいてソート可能フィールドを自動判定：

- 必須シャドー（id, name, createdAt, updatedAt）は常にソート可能
- カスタムシャドーは設定ファイルに基づいて判定
- フィルター入力の動的制御

## リソース定義

### Articles（記事）

`src/resources/articles.tsx`

- **フィルター**: category, status
- **ソート**: updatedAt（デフォルト）, priority, category, status
- **ページネーション**: 無限スクロール（25件/ページ）

### Tasks（タスク）

`src/resources/tasks.tsx`

- **フィルター**: status
- **ソート**: createdAt（デフォルト）, status, dueDate
- **ページネーション**: 無限スクロール（25件/ページ）

## 設定ファイル

### shadow.config.json

`/config/shadow.config.json`

シャドウレコードの定義：

- リソースごとのソート可能フィールド
- フィールドタイプ（string, number, datetime）
- デフォルトソート設定

DataGridコンポーネントは、この設定を`@config`エイリアス経由で読み込みます。

### Vite設定

`vite.config.ts`

- エイリアス設定（`@`, `@config`）
- 開発サーバー設定（ポート3000）
- ビルド設定（ソースマップ有効）

### TypeScript設定

`tsconfig.json`

- ベース設定を`tsconfig.base.json`から継承
- React JSX設定
- パスエイリアス設定
- JSON モジュール解決有効化

## トラブルシューティング

### 認証エラー

1. 環境変数が正しく設定されているか確認
2. Cognito設定（ドメイン、クライアントID、リダイレクトURI）が正しいか確認
3. 開発環境では`VITE_DISABLE_AUTH=true`で認証を無効化できる

### API通信エラー

1. Records Lambda Function URLが正しいか確認
2. Lambda関数が正常に動作しているか確認
3. ブラウザの開発者ツールでネットワークタブを確認

### ソートが効かない

1. `shadow.config.json`に該当フィールドが定義されているか確認
2. [DataGrid ソート可能フィールドの自動判定](./datagrid-sortable.md)を参照

### フィルターが効かない

1. フィルター入力の`source`属性が正しいか確認
2. Records Lambda側でフィルター処理が実装されているか確認
3. [フィルタリングとページネーション](./filtering-and-pagination.md)を参照

## 参考リンク

- [react-admin公式ドキュメント](https://marmelab.com/react-admin/)
- [MUI公式ドキュメント](https://mui.com/)
- [Vite公式ドキュメント](https://vitejs.dev/)
- [AWS Amplify Auth](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
