# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

#### バルク操作レスポンス形式の統一 (2025-11-25)

**背景:**

- Records Lambda のバルク操作（insertMany, updateMany, deleteMany）のレスポンス形式が統一されていなかった
- Collection.ts で MongoDB 互換形式に変換する際に情報が欠落していた

**変更内容:**

1. **統一レスポンス型定義の追加**
   - `BulkOperationResult` 型を定義（count, successIds, failedIds, errors）
   - successIds/failedIds/errors はインデックス付きオブジェクト形式
   - InsertManyResult, UpdateManyResult, DeleteManyResult が BulkOperationResult を継承

2. **Records Lambda の更新**
   - insertMany: 統一形式でレスポンスを返却
   - updateMany: 統一形式でレスポンスを返却
   - deleteMany: 統一形式でレスポンスを返却
   - 成功したレコードのインデックスと ID を successIds に格納
   - 失敗したレコードのインデックスと ID を failedIds に格納
   - エラー情報を errors に格納（インデックスをキーとする）

3. **Collection.ts の MongoDB 互換変換**
   - insertMany: `{ acknowledged, insertedCount, insertedIds }` に変換
   - updateMany: `{ acknowledged, matchedCount, modifiedCount }` に変換
   - deleteMany: `{ acknowledged, deletedCount }` に変換
   - Records Lambda の統一形式から MongoDB 互換形式に変換
   - 情報は欠落せず、すべて保持される

4. **テストの更新**
   - すべてのユニットテストと統合テストを更新
   - モックレスポンスを統一形式に変更
   - 174 テストすべてパス

**利点:**

- Records Lambda は統一形式で全情報を保持
- Collection.ts が MongoDB 互換形式に変換
- 情報は欠落せず、MongoDB 互換性も保たれる
- 将来的に拡張情報（failedIds, errors）を提供するオプションを追加可能

### Fixed

#### Query 最適化とメモリ内フィルタリングの二重適用問題 (2025-11-23)

**問題:**

- Records Lambda の find 操作で、Query 最適化が適用された場合にフィルター条件を除外するロジックがあった
- しかし、Query 最適化は候補の絞り込みのみで、完全なフィルタリングではない
- 特に `starts` オペレーターで、SK の形式が `{field}#{value}#id#{recordId}` のため、前方一致が正しく動作しないケースがあった

**修正内容:**

1. **Query 最適化の SK 値を修正**
   - `starts` オペレーターで `{field}#{value}#id#` を使用していたが、`{field}#{value}` に変更
   - これにより、SK の前方一致が正しく動作するようになった

2. **メモリ内フィルタリングの除外ロジックを削除**
   - Query 最適化が適用された場合でも、すべてのフィルター条件をメモリ内で再適用
   - メモリ内フィルタリングは冪等（何度実行しても結果は同じ）なので、二重適用しても問題ない
   - Query で既に絞り込まれているため、パフォーマンスへの影響は軽微

3. **デバッグログを追加**
   - フィルタリング前後のアイテム数を記録
   - 何件がフィルタリングされたかを確認可能

**影響範囲:**

- `functions/records/src/operations/find.ts`
- `functions/records/src/utils/filter.ts`

**テスト:**

- Admin UI で `name:starts` フィルタを使用して、正しく動作することを確認
- Lambda のログで Query 最適化とメモリ内フィルタリングの動作を確認

**参考:**

- [タスクリスト](.kiro/specs/ainews-pipeline/tasks.md)
- [テストガイド](apps/admin/TEST_GUIDE.md)

---

## [0.1.0] - 2025-11-22

### Added

- Records Lambda 実装（10操作完全対応）
- Admin UI 実装（React + react-admin）
- DynamoDB Single-Table 設計
- Shadow Config 環境変数化
- バルク操作のスケーラビリティ強化
- 高度なフィルター検索機能

### Changed

- IAM ロール分離とセキュリティ強化
- id シャドウ冗長性の解消

### Fixed

- Cognito ログアウト機能の改善
