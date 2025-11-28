# DynamoDBクライアントライブラリ - 要件定義書

## はじめに

DynamoDB Single-Table設計向けのクライアントライブラリです。MongoDB風のシンプルなAPIでDynamoDBを操作でき、型定義からシャドー設定を自動生成することで、開発効率を向上させ、データ整合性を保証します。

## 用語集

- **DynamoDB Client（DynamoDBクライアント）**: DynamoDB Single-Table設計向けのHTTPクライアントライブラリ（MongoDB風API）
- **Schema Registry（スキーマレジストリ）**: 全リソースの型定義とシャドー設定を集約したTypeScriptオブジェクト
- **Shadow Field Type（シャドウフィールド型）**: シャドウレコードで使用されるフィールドの型（String、Number、Datetime、Boolean）
- **Lambda Function URL**: Lambda関数を直接HTTPSエンドポイントとして公開するAWS機能（API Gateway不要）
- **Single Source of Truth**: 型定義が唯一の情報源であり、他の設定ファイルは自動生成される
- **Shadow Record（シャドーレコード）**: DynamoDB内で本体レコードと同一テーブルに格納される、ソート・検索用の派生レコード
- **Filter Operator（フィルター演算子）**: 検索条件で使用する比較演算子（eq, ne, gt, gte, lt, lte, in, nin, exists, regex）

## 要件

### 要件1: アーキテクチャ

**ユーザーストーリー:** 開発者として、DynamoDB操作が一箇所に集約されることで、データ整合性を保証し、セキュリティリスクを最小化したい

#### 受入基準

1. THE システム SHALL DynamoDB操作をLambda経由でのみ実行する
2. THE クライアント（Webアプリ、モバイルアプリ、他のLambda）SHALL Lambda Function URLを経由してDynamoDBにアクセスする
3. THE クライアント SHALL DynamoDBへの直接アクセス権限を持たない
4. THE Lambda SHALL DynamoDBへの読み書き権限を持つ唯一のコンポーネントである

### 要件2: パッケージ構成

**ユーザーストーリー:** 開発者として、クライアントSDKとサーバー実装が単一パッケージで管理されることで、バージョン管理とデプロイが容易になることを期待する

#### 受入基準

1. THE パッケージ SHALL クライアントSDKとサーバー実装を含む単一パッケージとして実装する
2. THE パッケージ名 SHALL `@exabugs/dynamodb-client`である
3. THE package.json SHALL "./client"エクスポートでクライアントSDKを公開する
4. THE package.json SHALL "./server"エクスポートでサーバー実装を公開する（内部使用）
5. THE package.json SHALL "./types"エクスポートで型定義を公開する
6. THE クライアント SHALL `@exabugs/dynamodb-client/client`からDynamoClientをインポートする

### 要件3: データ設計（Single Source of Truth）

**ユーザーストーリー:** 開発者として、型定義が唯一の情報源であることで、設定ファイルとの不整合を防ぎ、保守性を向上させたい

#### 受入基準

1. THE プロジェクト SHALL 全リソースの型定義とシャドー設定を含むapi-typesパッケージを持つ
2. THE 各リソース SHALL TypeScriptインターフェース（型定義）とSchemaDefinition（シャドー設定）を持つ
3. THE SchemaDefinition SHALL resource名、型、shadows.sortableFieldsを含む
4. THE shadows.sortableFields SHALL ソートしたいフィールドのみを明示的に定義する
5. THE ShadowFieldType SHALL enum（String、Number、Datetime、Boolean）として定義する
6. THE id フィールド SHALL シャドーレコードを生成せず、PKとして使用する
7. THE createdAt、updatedAt フィールド SHALL 自動的にシャドー化されず、必要な場合のみsortableFieldsに定義する
8. THE SchemaDefinition SHALL TypeScript型と整合性を保証する

### 要件4: シャドー設定の自動生成

**ユーザーストーリー:** 開発者として、シャドー設定が型定義から自動生成されることで、手動での設定ミスを防ぎ、DRY原則を守りたい

#### 受入基準

1. THE 生成スクリプト SHALL SchemaRegistryからshadow.config.jsonを自動生成する
2. THE shadow.config.json SHALL $schemaVersion、$generatedAt、$generatedFrom、resourcesを含む
3. THE ビルドプロセス SHALL 自動的にshadow.config.jsonを生成する（prebuildスクリプト）
4. THE インフラ設定 SHALL config/shadow.config.jsonを環境変数に設定する

### 要件5: クライアントAPI

**ユーザーストーリー:** 開発者として、MongoDB風のシンプルなAPIでDynamoDBを操作することで、学習コストを下げ、開発効率を向上させたい

#### 受入基準

1. THE DynamoClient SHALL Lambda Function URLをエンドポイントとして受け取る
2. THE DynamoClient SHALL Cognito認証（Webアプリ、モバイルアプリ）とIAM認証（Lambda）をサポートする
3. THE Database SHALL collection<T>(name)メソッドでCollection<T>を返す
4. THE Collection<T> SHALL find、findOne、insertOne、insertMany、updateOne、updateMany、deleteOne、deleteManyメソッドを提供する
5. THE FindCursor SHALL sort、limit、skip、toArrayメソッドを提供する
6. THE Collection<T> SHALL 型情報を使用してフィールド名を補完する
7. THE Filter<T> SHALL 存在しないフィールド名でコンパイルエラーを発生させる

### 要件11: 環境別対応（Dual Package Export）

**ユーザーストーリー:** 開発者として、Node.js環境とブラウザ環境で同じAPIを使用しつつ、環境に応じた最適化（バンドルサイズ削減、型安全性）を享受したい

#### 受入基準

1. THE パッケージ SHALL Node.js用とブラウザ用のエントリーポイントを提供する
2. THE ブラウザ用エントリーポイント SHALL IAM認証を除外し、AWS SDKパッケージを含まない
3. THE Node.js用エントリーポイント SHALL すべての認証方式（Token、Cognito、IAM）をサポートする
4. THE ビジネスロジック（Collection、Database、DynamoClient）SHALL 100%共通化される
5. THE 認証ハンドラー SHALL 依存性注入パターンで外部から注入される
6. THE 環境別コード SHALL 認証ハンドラーとラッパークラスのみに局所化される
7. THE package.json SHALL Dual Package Exportで環境別エントリーポイントを定義する
8. THE ブラウザ環境 SHALL デフォルトでブラウザ用エントリーポイントを使用する
9. THE 型システム SHALL 環境に応じた認証オプションの型チェックを提供する
10. THE ブラウザ環境 SHALL IAM認証を使用しようとするとコンパイルエラーを発生させる

### 要件6: フィルタAPI

**ユーザーストーリー:** 開発者として、型安全なフィルタAPIで複雑な検索条件を記述することで、実行時エラーを防ぎたい

#### 受入基準

1. THE Filter<T> SHALL TypeScript型安全なフィルタ定義を提供する
2. THE FilterOperators SHALL eq、ne、gt、gte、lt、lte、in、nin、exists、regexをサポートする
3. THE Filter SHALL $プレフィックスなしの演算子名を使用する（例: { priority: { gte: 5 } }）
4. THE Filter SHALL andとor論理演算子をサポートする

### 要件7: 更新API

**ユーザーストーリー:** 開発者として、シンプルな更新APIでレコードを更新することで、コードの可読性を向上させたい

#### 受入基準

1. THE UpdateOperators SHALL set、unset、incをサポートする
2. THE UpdateOperators SHALL $プレフィックスなしの演算子名を使用する（例: { set: { status: 'published' } }）

### 要件8: Lambda実装

**ユーザーストーリー:** 開発者として、Lambda側の実装が明確に構造化されることで、保守性を向上させたい

#### 受入基準

1. THE Lambda実装 SHALL handler.ts（エントリーポイント）を含む
2. THE Lambda実装 SHALL operations/（CRUD操作）を含む
3. THE Lambda実装 SHALL query/（クエリ変換）を含む
4. THE Lambda実装 SHALL shadow/（シャドウ管理）を含む
5. THE query/converter SHALL FilterをDynamoDB形式に変換する
6. THE shadow/generator SHALL SchemaDefinitionからシャドーレコードを生成する
7. THE shadow/config SHALL 環境変数からshadow.config.jsonを読み込む

### 要件9: シャドーレコード生成

**ユーザーストーリー:** 開発者として、シャドーレコードが自動生成されることで、手動でのレコード管理を不要にしたい

#### 受入基準

1. THE シャドーレコード生成 SHALL sortableFieldsに定義されたフィールドのみ処理する
2. THE シャドーレコード生成 SHALL 値がundefinedまたはnullの場合、空文字として扱いシャドーレコードを生成する
3. THE シャドーキー SHALL "フィールド名#値#id#レコードID"形式を使用する
4. THE 数値型 SHALL 20桁ゼロ埋め文字列に変換する
5. THE 日時型 SHALL UTC ISO 8601形式を使用する
6. THE 真偽値型 SHALL "0"（false）または"1"（true）に変換する
7. THE undefined/null値 SHALL 空文字として正規化され、"フィールド名##id#レコードID"形式のシャドーキーを生成する

### 要件10: 使用例

**ユーザーストーリー:** 開発者として、実際の使用例を参照することで、APIの使い方を素早く理解したい

#### 受入基準

1. THE Webアプリ SHALL DynamoClientでLambda Function URLに接続する
2. THE Webアプリ SHALL collection.find().sort().limit().toArray()でレコードを取得する
3. THE Lambda SHALL IAM認証でDynamoClientを使用する
4. THE Lambda SHALL collection.insertMany()でレコードを一括挿入する

### 要件12: シャドウ管理パッケージの統合

**ユーザーストーリー:** 開発者として、シャドウ管理機能がライブラリに統合されることで、外部依存なしでDynamoDB Single-Table設計を実装したい

#### 受入基準

1. THE パッケージ SHALL シャドウSK生成関数（generateShadowSK、escapeString、formatNumber、formatDatetime、formatFieldValue、generateMainRecordSK）を提供する
2. THE パッケージ SHALL シャドウ差分計算関数（calculateShadowDiff、isDiffEmpty、mergeShadowDiffs）を提供する
3. THE パッケージ SHALL 設定管理関数（loadShadowConfig、getResourceConfig、getAllShadowFields、isValidShadowField、getDefaultSort、getConfigPathFromEnv）を提供する
4. THE パッケージ SHALL シャドウ型定義（ShadowFieldType、ShadowFieldConfig、ResourceShadowConfig、ShadowConfig、ShadowDiff）を提供する
5. THE package.json SHALL "./shadows"エクスポートでシャドウ管理機能を公開する
6. THE シャドウ管理機能 SHALL `@exabugs/dynamodb-client/shadows`からインポート可能である
7. THE シャドウ管理機能 SHALL 既存の`@ainews/shadows`パッケージと100%互換性を持つ
8. THE 設定読み込み SHALL ファイルシステムとSSM Parameter Storeの両方をサポートする
9. THE エスケープルール SHALL `#` → `##`、スペース → `#` を適用する
10. THE 数値フォーマット SHALL 20桁のゼロ埋め文字列に変換する
11. THE 日時フォーマット SHALL UTC ISO 8601形式を使用する
