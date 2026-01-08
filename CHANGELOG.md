# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
