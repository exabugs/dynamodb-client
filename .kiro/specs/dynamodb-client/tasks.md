# DynamoDBクライアントライブラリ - 実装タスクリスト

## 概要

このタスクリストは、DynamoDB Single-Table設計向けのクライアントライブラリを実装するためのものです。MongoDB風のシンプルなAPIを提供し、型定義からシャドー設定を自動生成します。

## タスク

- [x] 1. フェーズ1: データ設計の整理

- [x] 1.1 ShadowFieldType enum定義
  - api-types/src/schema.tsにShadowFieldType enumを追加
  - String、Number、Datetimeの3種類
  - _要件: 3.5_

- [x] 1.2 SchemaDefinition型定義
  - resource、type、shadows.sortableFieldsを含む
  - sortableFieldsはRecord<string, ShadowFieldDefinition>
  - _要件: 3.2, 3.3_

- [x] 1.3 リソーススキーマ定義
  - api-types/src/models/配下の各リソースファイルを更新
  - SchemaDefinition<T>を定義
  - sortableFieldsにソートしたいフィールドのみ定義
  - 固定シャドー（name、createdAt、updatedAt）を削除
  - _要件: 3.4, 3.6, 3.7_

- [x] 1.4 SchemaRegistry作成
  - api-types/src/schema.tsにSchemaRegistryを追加
  - 全リソースを登録
  - ResourceName、ResourceTypeMap型を定義
  - _要件: 3.1_

- [x] 2. フェーズ2: シャドー設定の自動生成

- [x] 2.1 生成スクリプト作成
  - api-types/scripts/generate-shadow-config.ts作成
  - SchemaRegistryからshadow.config.jsonを生成
  - $schemaVersion、$generatedAt、$generatedFromを含める
  - _要件: 4.1, 4.2_

- [x] 2.2 ビルドスクリプト統合
  - api-types/package.jsonにgenerate:shadowスクリプト追加
  - prebuildフックで自動生成
  - _要件: 4.3_

- [x] 2.3 インフラ統合
  - config/shadow.config.jsonを環境変数に設定
  - _要件: 4.4_

- [x] 3. フェーズ3: クライアントSDK実装

- [x] 3.1 型定義
  - src/types.tsを作成
  - Filter<T>、FilterOperators、UpdateOperators型を定義
  - $プレフィックスなしの演算子名（eq、gt、lte等）
  - _要件: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

- [x] 3.2 DynamoClient実装
  - src/client/DynamoClient.ts作成
  - Lambda Function URLをエンドポイントとして受け取る
  - Cognito認証とIAM認証をサポート
  - _要件: 5.1, 5.2_

- [x] 3.3 Database実装
  - src/client/Database.ts作成
  - collection<T>(name)メソッドを実装
  - _要件: 5.3_

- [x] 3.4 Collection実装
  - src/client/Collection.ts作成
  - find、findOne、insertOne、insertMany、updateOne、updateMany、deleteOne、deleteManyメソッドを実装
  - _要件: 5.4_

- [x] 3.5 FindCursor実装
  - src/client/FindCursor.ts作成
  - sort、limit、skip、toArrayメソッドを実装
  - _要件: 5.5_

- [x] 3.6 package.json設定
  - "./client"エクスポートを追加
  - "./server"エクスポートを追加
  - "./types"エクスポートを追加
  - _要件: 2.2, 2.3, 2.4, 2.5_

- [x] 4. フェーズ4: Lambda側の実装

- [x] 4.1 クエリ変換
  - src/server/query/converter.ts作成
  - convertFilterToDynamo関数を実装
  - FilterをDynamoDB形式に変換
  - _要件: 8.5_

- [x] 4.2 シャドウレコード生成
  - src/server/shadow/generator.ts更新
  - sortableFieldsに定義されたフィールドのみ処理
  - 値がundefined/nullの場合は空文字として扱いシャドウレコードを生成
  - _要件: 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

- [x] 4.3 設定読み込み
  - src/server/shadow/config.ts作成
  - 環境変数からshadow.config.jsonを読み込む
  - _要件: 8.7_

- [x] 4.4 CRUD操作の更新
  - src/server/operations/を更新
  - 新しいクエリ変換とシャドウ生成ロジックを使用
  - _要件: 8.1, 8.2, 8.3, 8.4_

- [x] 5. フェーズ5: クライアント統合

- [x] 5.1 Webアプリ統合
  - dataProvider.tsを更新
  - パッケージ名/clientからDynamoClientをインポート
  - collection.find().sort().limit().toArray()を使用
  - _要件: 10.1, 10.2_

- [x] 5.2 Lambda統合
  - Lambda関数のhandler.tsを更新
  - IAM認証でDynamoClientを使用
  - collection.insertMany()でレコードを一括挿入
  - _要件: 10.3, 10.4_

- [x] 6. フェーズ6: テストとドキュメント

- [x] 6.1 ユニットテスト
  - クエリ変換のテスト
  - シャドウレコード生成のテスト
  - クライアントSDKのテスト
  - _要件: 5.6, 5.7_

- [x] 6.2 統合テスト
  - Webアプリからのエンドツーエンドテスト
  - Lambdaからのテスト

- [x] 6.3 ドキュメント更新
  - README.mdにクライアントSDKの使用例を追加
  - データ設計のドキュメント更新

- [x] 7. フェーズ7: 環境別対応（Dual Package Export）

- [x] 7.1 認証ハンドラーの分離
  - src/client/auth/types.ts作成（認証型定義）
  - src/client/auth/handler.ts作成（共通認証ロジック）
  - src/client/auth/handler.node.ts作成（Node.js用、IAM追加）
  - src/client/auth/handler.browser.ts作成（ブラウザ用、IAM除外）
  - _要件: 11.2, 11.3, 11.6_

- [x] 7.2 依存性注入パターンの導入
  - Collection.ts、Database.ts、DynamoClient.tsを共通実装に変更
  - 認証ハンドラーをコンストラクタで注入
  - AuthHeadersGetter型を定義
  - _要件: 11.4, 11.5_

- [x] 7.3 環境別ラッパーの作成
  - src/client/index.ts作成（Node.js用ラッパー）
  - src/client/index.browser.ts作成（ブラウザ用ラッパー）
  - 環境別の認証ハンドラーを注入
  - _要件: 11.1, 11.6_

- [x] 7.4 Dual Package Export設定
  - package.jsonにexports設定を追加
  - "./client"でnode/browser/defaultを定義
  - "./client/node"と"./client/browser"を明示的に定義
  - _要件: 11.7, 11.8_

- [x] 7.5 型安全性の確保
  - ブラウザ環境でBrowserAuthOptions型を使用
  - Node.js環境でAuthOptions型を使用
  - ブラウザ環境でIAM認証を使用するとコンパイルエラー
  - _要件: 11.9, 11.10_

- [x] 7.6 ドキュメント作成
  - ARCHITECTURE.md作成（設計パターンの詳細）
  - CLIENT_USAGE.md作成（環境別の使用方法）
  - MIGRATION_GUIDE.md作成（移行ガイド）
  - README.md更新（パッケージ概要）

- [x] 7.7 ビルドとテスト
  - TypeScriptビルドの確認
  - admin アプリのビルド確認
  - 既存コードの後方互換性確認

## 完了条件

- [x] 型定義からshadow.config.jsonが自動生成される
- [x] クライアントSDKでMongoDB風のAPIが使える
- [x] WebアプリとLambdaが新しいクライアントSDKを使用
- [x] 固定シャドー（name、createdAt、updatedAt）が削除される
- [x] idフィールドのシャドーレコードが生成されない
- [x] 全てのテストがパスする
- [x] ビジネスロジックが100%共通化される
- [x] 環境別コードが認証ハンドラーとラッパーのみに局所化される
- [x] ブラウザ環境でAWS SDKパッケージが除外される
- [x] 既存コードの後方互換性が保たれる

## 推定工数

- フェーズ1: 2時間（データ設計の整理）
- フェーズ2: 2時間（シャドー設定の自動生成）
- フェーズ3: 4時間（クライアントSDK実装）
- フェーズ4: 3時間（Lambda側の実装）
- フェーズ5: 2時間（クライアント統合）
- フェーズ6: 2時間（テストとドキュメント）
- フェーズ7: 4時間（環境別対応）

**合計: 19時間**

## 実績

- フェーズ7完了日: 2025-11-24
- コミットID: 61110fb
- コード削減: 770行（重複コード削除）
- 共通化率: 100%（ビジネスロジック507行）
