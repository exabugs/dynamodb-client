# dynamodb-client OpenAPI仕様書作成タスク

## 概要

dynamodb-clientのAPIエンドポイントをOpenAPI 3.1形式で文書化し、Redoclyを使用して保守可能な仕様書を作成する。

## タスク一覧

### 1. 環境セットアップ

- [ ] 1.1 Redocly CLIのインストール
  - `@redocly/cli`をdevDependenciesに追加
  - バージョン: 最新安定版

- [ ] 1.2 ディレクトリ構造の作成
  ```
  docs/specs/
  ├── .redocly.yaml
  ├── openapi.yaml (メインファイル)
  ├── components/
  │   ├── schemas/
  │   ├── parameters/
  │   ├── responses/
  │   └── examples/
  └── paths/
      ├── collections/
      ├── documents/
      └── queries/
  ```

- [ ] 1.3 Makefile作成（ルートディレクトリに作成）
  - `docs-bundle`: 分割ファイルを結合
  - `docs-validate`: OpenAPI仕様の検証
  - `docs-preview`: ローカルプレビュー
  - `docs-build`: HTML生成
  - `docs-clean`: 生成ファイル削除

### 2. OpenAPI基本構造

- [ ] 2.1 openapi.yamlメインファイル作成
  - OpenAPI 3.1.0
  - 基本情報（title, version, description）
  - サーバー情報
  - 外部ファイル参照設定

- [ ] 2.2 .redocly.yaml設定ファイル作成
  - lint設定
  - bundle設定
  - プレビュー設定

### 3. 共通コンポーネント定義

- [ ] 3.1 スキーマ定義（components/schemas/）
  - Collection.yaml
  - Document.yaml
  - Query.yaml
  - Filter.yaml
  - UpdateOperators.yaml
  - Error.yaml

- [ ] 3.2 共通パラメータ（components/parameters/）
  - CollectionName.yaml
  - DocumentId.yaml
  - QueryParams.yaml

- [ ] 3.3 共通レスポンス（components/responses/）
  - Success.yaml
  - Error.yaml
  - NotFound.yaml
  - ValidationError.yaml

- [ ] 3.4 サンプルデータ（components/examples/）
  - Collection操作の例
  - Document操作の例
  - Query操作の例

### 4. エンドポイント定義

- [ ] 4.1 コレクション操作（paths/collections/）
  - POST /collections - コレクション作成
  - GET /collections/{name} - コレクション取得
  - DELETE /collections/{name} - コレクション削除

- [ ] 4.2 ドキュメント操作（paths/documents/）
  - POST /collections/{name}/documents - ドキュメント作成
  - GET /collections/{name}/documents/{id} - ドキュメント取得
  - PUT /collections/{name}/documents/{id} - ドキュメント更新
  - DELETE /collections/{name}/documents/{id} - ドキュメント削除
  - POST /collections/{name}/documents/bulk - バルク操作

- [ ] 4.3 クエリ操作（paths/queries/）
  - POST /collections/{name}/find - 検索
  - POST /collections/{name}/findOne - 単一検索
  - POST /collections/{name}/count - カウント
  - POST /collections/{name}/aggregate - 集計

### 5. 認証・セキュリティ

- [ ] 5.1 セキュリティスキーマ定義
  - IAM認証
  - JWT認証（Records Lambda経由）

- [ ] 5.2 各エンドポイントへのセキュリティ適用

### 6. 検証とビルド

- [ ] 6.1 OpenAPI仕様の検証
  - `make docs-validate`実行
  - エラー修正

- [ ] 6.2 プレビュー確認
  - `make docs-preview`実行
  - ブラウザで表示確認

- [ ] 6.3 HTML生成
  - `make docs-build`実行
  - 生成されたHTMLの確認

### 7. ドキュメント整備

- [ ] 7.1 README.md作成
  - 仕様書の使い方
  - ビルド方法
  - 開発ガイドライン

- [ ] 7.2 CONTRIBUTING.md作成
  - 仕様書の更新方法
  - ファイル分割のルール
  - レビュープロセス

## 優先順位

1. **高**: タスク1（環境セットアップ）、タスク2（基本構造）
2. **中**: タスク3（共通コンポーネント）、タスク4（エンドポイント定義）
3. **低**: タスク5（認証）、タスク6（検証）、タスク7（ドキュメント）

## 注意事項

- OpenAPI 3.1.0の最新仕様に準拠
- ファイル分割は機能単位で行い、1ファイル200行以内を目安とする
- すべてのエンドポイントにサンプルリクエスト・レスポンスを含める
- エラーレスポンスは統一フォーマットを使用
- 日本語コメントは最小限にし、descriptionフィールドで説明

## 完了条件

- [ ] `make docs-validate`がエラーなく完了
- [ ] `make docs-preview`でブラウザ表示が正常
- [ ] すべてのエンドポイントが文書化されている
- [ ] サンプルリクエスト・レスポンスが含まれている
- [ ] README.mdとCONTRIBUTING.mdが作成されている
