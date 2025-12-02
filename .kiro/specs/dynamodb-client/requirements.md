# DynamoDBクライアントライブラリ - 要件定義書

## はじめに

DynamoDB Single-Table設計向けのクライアントライブラリです。MongoDB風のシンプルなAPIでDynamoDBを操作でき、型定義からシャドー設定を自動生成することで、開発効率を向上させ、データ整合性を保証します。

v0.3.0以降、自動シャドウ化機能により、設定ファイルのメンテナンスが不要になりました。各レコードは、そのレコードに実際に存在するプリミティブ型フィールドのみを自動的にシャドウ化します。

## 用語集

- **DynamoDB Client（DynamoDBクライアント）**: DynamoDB Single-Table設計向けのHTTPクライアントライブラリ（MongoDB風API）
- **Schema Registry（スキーマレジストリ）**: 全リソースの型定義とシャドー設定を集約したTypeScriptオブジェクト
- **Shadow Field Type（シャドウフィールド型）**: シャドウレコードで使用されるフィールドの型（String、Number、Datetime、Boolean）
- **Lambda Function URL**: Lambda関数を直接HTTPSエンドポイントとして公開するAWS機能（API Gateway不要）
- **Single Source of Truth**: 型定義が唯一の情報源であり、他の設定ファイルは自動生成される
- **Shadow Record（シャドーレコード）**: DynamoDB内で本体レコードと同一テーブルに格納される、ソート・検索用の派生レコード
- **Filter Operator（フィルター演算子）**: 検索条件で使用する比較演算子（eq, ne, gt, gte, lt, lte, in, nin, exists, regex）
- **プリミティブ型**: string, number, boolean, datetime などの基本型
- **オフセット方式**: 負数を含む数値を文字列としてソート可能にする変換方式
- **ゼロパディング**: 数値を固定桁数の文字列に変換する処理（例: `42` → `"00000000000000000042"`）
- **OSS Migration（OSS 化）**: ainews-pipeline から dynamodb-client を独立させ、汎用的な OSS ライブラリとして公開すること

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

### 要件13: 自動シャドウ化（v0.3.0で実装済み）

**ユーザーストーリー:** 開発者として、設定ファイルのメンテナンスなしでシャドウレコードを利用したい

#### 受入基準

1. WHEN レコードを作成する THEN そのレコードに存在する string 型フィールドに対してシャドウレコードを生成する
2. WHEN レコードを作成する THEN そのレコードに存在する number 型フィールドに対してシャドウレコードを生成する
3. WHEN レコードを作成する THEN そのレコードに存在する boolean 型フィールドに対してシャドウレコードを生成する
4. WHEN レコードを作成する THEN そのレコードに存在する datetime 型フィールドに対してシャドウレコードを生成する
5. WHEN レコードを作成する THEN そのレコードに存在する array 型フィールドに対してシャドウレコードを生成する
6. WHEN レコードを作成する THEN そのレコードに存在する object 型フィールドに対してシャドウレコードを生成する
7. WHEN フィールド名が `__` で始まる THEN シャドウレコードを生成しない（内部メタデータ）
8. WHEN フィールド名が `id` である THEN シャドウレコードを生成しない（v0.3.6で実装）
9. WHEN フィールドが null または undefined である THEN シャドウレコードを生成しない
10. WHEN 存在しないフィールドでソートする THEN そのフィールドを持たないレコードは結果に含まれない（仕様）

### 要件14: プリミティブ型の切り詰め処理（v0.3.0で実装済み）

**ユーザーストーリー:** 開発者として、長文フィールドでもストレージ効率を保ちながらソートしたい

#### 受入基準

1. WHEN string 型フィールドをシャドウ化する THEN 先頭100バイト（UTF-8）まで切り詰める
2. WHEN string 型が100バイト未満である THEN そのまま使用する
3. WHEN string 型が100バイトを超える THEN マルチバイト文字の境界を考慮して切り詰める
4. WHEN 切り詰め位置がマルチバイト文字の途中である THEN 前の文字境界まで戻る
5. WHEN 環境変数 `SHADOW_STRING_MAX_BYTES` が設定されている THEN その値を使用する

### 要件15: 複合型の切り詰め処理（v0.3.0で実装済み）

**ユーザーストーリー:** 開発者として、配列やオブジェクトもソート可能にしたい

#### 受入基準

1. WHEN array 型フィールドをシャドウ化する THEN JSON文字列化して先頭200バイト（UTF-8）まで切り詰める
2. WHEN object 型フィールドをシャドウ化する THEN JSON文字列化して先頭200バイト（UTF-8）まで切り詰める
3. WHEN array/object 型が200バイト未満である THEN そのまま使用する
4. WHEN array/object 型が200バイトを超える THEN マルチバイト文字の境界を考慮して切り詰める
5. WHEN 環境変数 `SHADOW_STRING_MAX_BYTES` が設定されている THEN array/object型は2倍の値を使用する

### 要件16: 数値のゼロパディングとオフセット処理（v0.3.0で実装済み）

**ユーザーストーリー:** 開発者として、負数を含む数値フィールドを正しくソートしたい

#### 受入基準

1. WHEN 数値フィールドをシャドウ化する THEN 20桁のゼロパディングを適用する
2. WHEN 数値が正の数である THEN オフセット（10^20）を加算してゼロパディングする
3. WHEN 数値が負の数である THEN オフセット（10^20）を加算してゼロパディングする
4. WHEN 数値がゼロである THEN オフセット（10^20）をそのままゼロパディングする
5. WHEN 数値が範囲外（-10^20 ～ +10^20）である THEN エラーをスローする
6. WHEN 環境変数 `SHADOW_NUMBER_PADDING` が設定されている THEN その値を使用する

### 要件17: JSONフィールドの正規化（v0.3.0で実装済み）

**ユーザーストーリー:** 開発者として、JSONフィールドの順序が一貫していてほしい

#### 受入基準

1. WHEN レコードを保存する THEN `id` フィールドが常に先頭に配置される
2. WHEN レコードを保存する THEN `createdAt` フィールドが常に末尾に配置される
3. WHEN レコードを保存する THEN `updatedAt` フィールドが常に末尾（`createdAt` の後）に配置される
4. WHEN レコードを保存する THEN その他のフィールドがアルファベット順に配置される
5. WHEN ネストされたJSONオブジェクトを保存する THEN 同じルールが再帰的に適用される
6. WHEN 配列内のオブジェクトを保存する THEN 各オブジェクトが正規化される

### 要件18: OSS化 - リポジトリの目的変更（実装済み）

**ユーザーストーリー:** 開発者として、このリポジトリが dynamodb-client ライブラリ専用であることを明確にしたい

#### 受入基準

1. THE リポジトリ SHALL dynamodb-client ライブラリのみを含む
2. THE リポジトリ SHALL ainews-pipeline 固有のコードを含まない
3. THE README.md SHALL dynamodb-client ライブラリの説明のみを含む
4. THE package.json SHALL `@exabugs/dynamodb-client` をパッケージ名として使用する
5. THE リポジトリ SHALL npm で公開可能な構造を持つ

### 要件19: OSS化 - 国際化対応（実装済み）

**ユーザーストーリー:** 開発者として、英語のドキュメントとエラーメッセージにより、国際的なユーザーが使用できることを期待する

#### 受入基準

1. THE README.md SHALL 英語で記述される
2. THE API ドキュメント SHALL 英語で記述される
3. THE JSDoc コメント SHALL 英語で記述される
4. THE エラーメッセージ SHALL 英語で記述される
5. THE コード内コメント SHALL 英語で記述される

### 要件20: OSS化 - ライセンスの明確化（実装済み）

**ユーザーストーリー:** 開発者として、ライセンスが明確であることで、安心してライブラリを使用できることを期待する

#### 受入基準

1. THE リポジトリ SHALL LICENSE ファイルを含む
2. THE LICENSE SHALL MIT ライセンスを使用する
3. THE package.json SHALL `license: "MIT"` を含む
4. THE ソースファイル SHALL 著作権表示を含む
5. THE README.md SHALL ライセンス情報を含む

### 要件21: OSS化 - npm 公開準備（実装済み）

**ユーザーストーリー:** 開発者として、npm で公開可能な構成により、簡単にライブラリを配布できることを期待する

#### 受入基準

1. THE package.json SHALL npm 公開に必要なフィールドを含む（name, version, description, keywords, author, license, repository, bugs, homepage）
2. THE package.json SHALL `files` フィールドで公開ファイルを明示する
3. THE package.json SHALL `exports` フィールドで ESM/CJS エクスポートを定義する
4. THE package.json SHALL `types` フィールドで型定義ファイルを指定する
5. THE .npmignore SHALL 不要なファイルを除外する
6. THE README.md SHALL インストール方法を含む
7. THE README.md SHALL クイックスタートガイドを含む

### 要件22: OSS化 - CI/CD の設定（実装済み）

**ユーザーストーリー:** 開発者として、CI/CD により、自動的にテストとビルドが実行されることを期待する

#### 受入基準

1. THE リポジトリ SHALL GitHub Actions ワークフローを含む
2. THE ワークフロー SHALL プルリクエスト時にテストを実行する
3. THE ワークフロー SHALL プルリクエスト時にビルドを実行する
4. THE ワークフロー SHALL プルリクエスト時にリントを実行する
5. THE ワークフロー SHALL main ブランチへのマージ時に npm 公開を実行する（npm Trusted Publishing使用）

### 要件23: OSS化 - バージョニング戦略（実装済み）

**ユーザーストーリー:** 開発者として、セマンティックバージョニングにより、バージョンアップの影響を理解できることを期待する

#### 受入基準

1. THE バージョニング SHALL セマンティックバージョニング（SemVer）に従う
2. THE MAJOR バージョン SHALL 破壊的変更時にインクリメントする
3. THE MINOR バージョン SHALL 後方互換な機能追加時にインクリメントする
4. THE PATCH バージョン SHALL 後方互換なバグ修正時にインクリメントする
5. THE CHANGELOG.md SHALL バージョンごとの変更履歴を含む
