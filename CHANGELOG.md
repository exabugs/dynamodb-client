# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.43] - 2026-01-17

### Changed

- **$near検索の最適化**: maxDistanceによる早期終了条件を追加
  - 候補数による早期終了: maxDistance内の候補がlimit件以上見つかったら終了
  - カバー範囲による早期終了: 現在の精度での9ブロック検索範囲がmaxDistanceを完全にカバーしたら終了
  - GEOHASH_COVERAGE定義を拡張: Precision 2-8のカバー範囲を定義（従来は6-8のみ）
  - 不要な精度緩和を削減し、検索パフォーマンスを向上

## [1.3.42] - 2026-01-15

### Added

- **ドット記法サポート**: `$set`オペレーターでドット記法（例: `"settings.locationEnabled"`）をサポート
  - ネストされたオブジェクトとして正しく保存される（例: `settings: { locationEnabled: true }`）
  - `expandDotNotation`ヘルパー関数を追加
  - `applyJsonMergePatch`関数を更新してドット記法を展開
  - ユニットテスト追加（10テスト）

### Fixed

- **ドット記法の文字列キー問題**: `$set: { "settings.locationEnabled": true }`が文字列キーとして保存されていた問題を修正
  - 以前: `{ "settings.locationEnabled": true }` （文字列キー）
  - 修正後: `{ settings: { locationEnabled: true } }` （ネストされたオブジェクト）

## [1.3.41] - 2026-01-11

### Added

- **updateOne filter版 upsert: true サポート**: filterで検索して存在しない場合に新規作成する機能を実装
  - filter版で`upsert: true`オプションをサポート
  - filterの条件を`$setOnInsert`に自動マージ
  - 新規IDを自動生成（UUID）
  - サーバー側ユニットテスト追加（8テスト）

### Fixed

- **updateOne filter版 upsert: true バグ修正**: filterで検索して存在しない場合に`No records found matching filter`エラーが発生していた問題を修正
  - `updateMany`のfilter版でレコードが見つからない場合の処理を実装
  - 新規レコード作成時にfilterの条件を`$setOnInsert`にマージ
  - FCMトークン登録（`{ token: "..." }`でupsert）が正常に動作するように修正

### Changed

- **テストカバレッジ向上**: サーバー側の`updateOne`ユニットテストを追加（全707テスト成功）

## [1.3.40] - 2026-01-11

### Added

- **updateMany upsert: true サポート**: 存在しないレコードの新規作成機能を実装
  - `upsert: true`オプションで存在しないレコードを自動作成
  - `$set`と`$setOnInsert`オペレーターのサポート
  - `$set`が`$setOnInsert`より優先される仕様
  - サーバー側ユニットテスト追加（8テスト）

### Fixed

- **updateMany upsert: true バグ修正**: 存在しないレコードで`ITEM_NOT_FOUND`エラーが発生していた問題を修正
  - 新規レコード作成処理を実装
  - `createdAt`/`updatedAt`タイムスタンプを自動追加
  - シャドーレコードを自動生成
  - レスポンス形式を修正（新規作成時は`$set`と`$setOnInsert`をマージ）

### Changed

- **テストカバレッジ向上**: サーバー側の`updateMany`ユニットテストを追加
  - 基本的な更新テスト
  - `upsert: false`のテスト
  - `upsert: true`（insert case）のテスト
  - `upsert: true`（update case）のテスト
  - `upsert: true`（混在ケース）のテスト

## [1.3.39] - 2026-01-11

### Fixed

- **package-lock.json同期**: CI失敗を修正
  - `yaml@2.8.2`の依存関係を追加
  - `npm ci`が正常に動作するように修正

## [1.3.38] - 2026-01-11

### Changed

- **テストカバレッジ大幅向上**: 86.37%達成（Phase 2目標80%を超過）
  - dataProviderの完全テスト実装（17テスト、カバレッジ86.37%）
  - react-admin v5 APIに対応（`pageInfo`形式のレスポンス）
  - 全481テスト成功

### Removed

- **useManyToManyTransformフック削除**: 不要なコード削除
  - Many-to-many関係の処理はdataProvider内で統合済み
  - コードの重複を削減し、保守性を向上

## [1.3.37] - 2026-01-09

### Security

- **updateOne情報漏洩の修正**: ADR 001に基づきセキュリティ脆弱性を修正
  - update権限のみでread権限がない場合の情報漏洩を防止
  - `findOne`呼び出しを削除し、`{ id, ...更新したフィールドのみ }` を返却
  - UpdateOperators形式（`$set`）にも対応
  - パフォーマンス向上: 不要な`findOne`クエリを削減

### Added

- **ADR 001**: 最小限のレスポンスデータ（セキュリティ重視）を文書化
  - セキュリティ最優先の設計決定
  - 全操作で最小限の情報のみ返す統一ポリシー

### Changed

- **破壊的変更**: `updateOne`のレスポンス形式が変更
  - 従来: 完全なレコードを返却
  - 新仕様: `{ id, ...更新したフィールドのみ }` を返却
  - 完全なデータが必要な場合は追加の`findOne`呼び出しが必要

## [1.3.36] - 2026-01-09

### Refactored

- **単一操作のリファクタリング**: 単一操作をバルク操作のサブセットとして実装
  - `findOne`: `findMany`を使用するように変更（カバレッジ91.11%）
  - `insertOne`: `insertMany`を使用するように変更（カバレッジ90.00%）
  - `updateOne`: `updateMany`を使用するように変更（カバレッジ84.05%）
  - `deleteOne`: `deleteManyを使用するように変更（カバレッジ83.07%）
  - コードの重複を削減し、保守性を向上
  - 後方互換性100%維持（インターフェース変更なし）

### Added

- **テストカバレッジ向上**: 直接テストを4ファイル追加（計11テスト）
  - 全テスト481件成功（既存470件 + 新規11件）
  - 全体カバレッジ: 36.45% → 40.09%
  - vitest.config.tsの設定改善（`all: true`追加）

## [1.3.35] - 2026-01-08

### Fixed

- **findOneのfilter対応**: `findOne`操作が任意のフィールドでの検索をサポート
  - `findOne({ token: 'xxx' })`が正しく動作するように修正
  - `convertFindOneParams`が`filter.id`以外のフィールドを受け入れるように修正
  - `handleFindOne`が`filter`パラメータをサポート（`find`操作で検索して最初の結果を返す）
  - `filter.id`が存在する場合は従来通りGetItemで取得（後方互換性）
  - `filter`が指定された場合は`find`操作で検索（新しいfilter対応）
  - デバイス登録時の既存デバイスチェック（`findOne({ token })`）が正しく動作

## [1.3.34] - 2026-01-08

### Fixed

- **$setOnInsert対応修正**: `convertUpdateOneParams`が`$setOnInsert`を正しく処理するように修正
  - デバイス登録時に`token`と`userId`が保存されない問題を解決
  - `$set`のみを抽出していたが、`$setOnInsert`も含めるように修正
  - UpdateOperators形式（`{ $set, $setOnInsert }`）の場合、update全体を`handleUpdateOne`に渡す
  - `handleUpsertCreate`で`$set`と`$setOnInsert`を正しくマージできるようになった

## [1.3.33] - 2026-01-08

### Fixed

- **filterによるupdateOne修正**: `convertUpdateOneParams`が`filter.id`以外のフィールドを正しく処理するように修正
  - ゲストユーザーのデバイス登録失敗問題を解決
  - `updateOne({ filter: { token: 'xxx' } }, ...)`が正しく動作するように修正
  - `filter.id`が存在する場合は従来通り`{ id, data, options }`を返す（後方互換性）
  - `filter.id`が存在しない場合は`{ filter, data, options }`を返す（新しいfilter対応）

## [1.3.32] - 2026-01-08

### Added

- **デバッグログ追加**: convertUpdateOneParamsにデバッグログを追加
  - ゲストユーザーのデバイス登録失敗問題の調査のため
  - filter.idが正しく渡されているかを確認

## [1.3.31] - 2026-01-08

### Fixed

- **デプロイ問題の修正**: Lambda関数が古いコードを使用していた問題を修正
  - handler.tsのバージョンコメントを1.3.31に更新
  - デフォルトバージョンを1.3.31に更新
  - v1.3.30のfilter対応コードが正しくデプロイされるようにビルド成果物を更新

## [1.3.30] - 2026-01-08

### Added

- **filterによるレコード特定**: `updateOne`、`updateMany`、`deleteOne`、`deleteMany`操作で`filter`を使用したレコード特定をサポート
  - `updateOne({ filter: { token: 'xxx' } }, ...)`のように任意のフィールドでレコードを特定可能
  - `id`または`filter`のどちらか一方を必須とするUnion型を導入（DRY原則に基づく型定義の改善）
  - デバイストークンの一意性制約など、ID以外のフィールドでのupsert操作に対応
  - 既存の`id`/`ids`による操作は完全に後方互換

### Changed

- **型定義の改善**: `SingleRecordSelector`と`MultipleRecordsSelector`型を導入し、共通部分を抽出
  - `UpdateOneParams`、`DeleteOneParams`: `{ id: string } | { filter: Record<string, unknown> }`
  - `UpdateManyParams`、`DeleteManyParams`: `{ ids: string[] } | { filter: Record<string, unknown> }`
