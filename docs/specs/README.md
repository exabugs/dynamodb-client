# DynamoDB Client API 仕様書

## 概要

DynamoDB ClientのOpenAPI 3.1仕様書です。MongoDB風のAPIインターフェースを提供します。

## 仕様書の閲覧

### HTML版（推奨）

```bash
# HTMLを生成
make docs-build

# ブラウザで開く
open docs/specs/index.html
```

### プレビュー生成

```bash
# プレビュー生成・ブラウザで開く
make docs-preview
```

## 開発

### 検証

```bash
make docs-validate
```

### ファイル構造

```
docs/specs/
├── openapi.yaml              # メインファイル
├── .redocly.yaml            # Redocly設定
├── components/
│   └── schemas/
│       ├── _index.yaml      # スキーマインデックス
│       ├── Document.yaml
│       ├── Error.yaml
│       ├── operations/      # 操作パラメータ
│       └── responses/       # レスポンス
└── index.html               # 生成されたHTML
```

## API概要

### エンドポイント

- `POST /` - MongoDB風操作実行
- `GET /version` - バージョン情報

### サポート操作

1. **find** - フィルター・ソート・ページネーション
2. **findOne** - 単一レコード取得
3. **findMany** - 複数レコード取得（ID指定）
4. **findManyReference** - 参照レコード取得
5. **insertOne** - 単一レコード作成
6. **insertMany** - 複数レコード作成
7. **updateOne** - 単一レコード更新
8. **updateMany** - 複数レコード更新
9. **deleteOne** - 単一レコード削除
10. **deleteMany** - 複数レコード削除

### 認証

- **IAM認証**: AWS Signature Version 4
- **Bearer認証**: JWT（Records Lambda経由）
