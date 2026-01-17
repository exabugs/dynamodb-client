# Implementation Plan: DynamoDB Cost Tracking

## Overview

DynamoDB操作のコスト追跡機能を4つのフェーズで実装します。各フェーズは独立して完了可能で、段階的にテストを追加しながら進めます。

## Tasks

- [ ] 1. Phase 1: 型定義とユーティリティの実装
  - ConsumedCapacity型定義とCostTrackerクラスの基盤を構築
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 8.1, 8.2, 8.3, 8.4_

- [x] 1.1 ConsumedCapacity型定義の作成
  - `src/shared/types/consumed-capacity.ts`を作成
  - `ConsumedCapacity`, `AggregatedCost`, `WithConsumedCapacity`インターフェースを定義
  - 型定義を`src/shared/index.ts`からエクスポート
  - _Requirements: 8.1, 8.2, 8.3_

- [ ]* 1.2 ConsumedCapacity型定義のユニットテスト
  - `__tests__/shared/types/consumed-capacity.test.ts`を作成
  - 型の構造を検証
  - _Requirements: 9.1, 9.2, 10.8_

- [x] 1.3 CostTrackerクラスの実装
  - `src/server/utils/cost-tracker.ts`を作成
  - `add()`, `getAggregated()`, `reset()`メソッドを実装
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x]* 1.4 CostTrackerクラスのユニットテスト
  - `__tests__/server/utils/cost-tracker.test.ts`を作成
  - `add()`メソッドのテスト（正常系、undefined、複数回追加）
  - `getAggregated()`メソッドのテスト（初期状態、集計結果）
  - `reset()`メソッドのテスト
  - カバレッジ100%を達成
  - _Requirements: 9.1, 9.2, 10.1, 10.2_

- [ ] 2. Phase 2: Server Layer の修正
  - DynamoDB SDK呼び出しにReturnConsumedCapacityを追加し、コスト情報を収集
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 4.1, 4.2, 4.3, 4.4_

- [x] 2.1 find操作のコスト追跡実装
  - `src/server/operations/find/handler.ts`を修正
  - `ReturnConsumedCapacity: 'TOTAL'`を追加
  - `CostTracker`を使用してコスト情報を収集
  - レスポンスに`consumedCapacity`を含める
  - 複数ページの場合のコスト集計
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.3_

- [x]* 2.2 find操作のコスト追跡テスト
  - `__tests__/server/operations/find-cost.test.ts`を作成
  - 単一ページのコスト追跡
  - 複数ページのコスト集計
  - ConsumedCapacityが存在しない場合
  - _Requirements: 9.1, 9.2, 10.3, 10.5_

- [ ] 2.3 insertOne操作のコスト追跡実装
  - `src/server/operations/insertOne.ts`を修正
  - `ReturnConsumedCapacity: 'TOTAL'`を追加
  - コスト情報を収集してレスポンスに含める
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 2.4 insertOne操作のコスト追跡テスト
  - `__tests__/server/operations/insertOne-cost.test.ts`を作成
  - _Requirements: 9.1, 9.2, 10.3_

- [ ] 2.5 updateOne操作のコスト追跡実装
  - `src/server/operations/updateOne.ts`を修正
  - `ReturnConsumedCapacity: 'TOTAL'`を追加
  - コスト情報を収集してレスポンスに含める
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 2.6 updateOne操作のコスト追跡テスト
  - `__tests__/server/operations/updateOne-cost.test.ts`を作成
  - _Requirements: 9.1, 9.2, 10.3_

- [ ] 2.7 deleteOne操作のコスト追跡実装
  - `src/server/operations/deleteOne.ts`を修正
  - `ReturnConsumedCapacity: 'TOTAL'`を追加
  - コスト情報を収集してレスポンスに含める
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 2.8 deleteOne操作のコスト追跡テスト
  - `__tests__/server/operations/deleteOne-cost.test.ts`を作成
  - _Requirements: 9.1, 9.2, 10.3_

- [x] 2.9 insertMany操作のコスト追跡実装
  - `src/server/operations/insertMany.ts`を修正
  - バッチ操作のコスト集計
  - TransactWriteCommandの配列形式ConsumedCapacityに対応
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4_

- [ ]* 2.10 insertMany操作のコスト追跡テスト
  - `__tests__/server/operations/insertMany-cost.test.ts`を作成
  - バッチ操作のコスト集計を検証
  - _Requirements: 9.1, 9.2, 10.3, 10.5_

- [x] 2.11 updateMany操作のコスト追跡実装
  - `src/server/operations/updateMany.ts`を修正
  - バッチ操作のコスト集計
  - BatchGetCommandとTransactWriteCommandの配列形式ConsumedCapacityに対応
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4_

- [ ]* 2.12 updateMany操作のコスト追跡テスト
  - `__tests__/server/operations/updateMany-cost.test.ts`を作成
  - _Requirements: 9.1, 9.2, 10.3, 10.5_

- [x] 2.13 deleteMany操作のコスト追跡実装
  - `src/server/operations/deleteMany.ts`を修正
  - バッチ操作のコスト集計
  - BatchGetCommandとTransactWriteCommandの配列形式ConsumedCapacityに対応
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4_

- [ ]* 2.14 deleteMany操作のコスト追跡テスト
  - `__tests__/server/operations/deleteMany-cost.test.ts`を作成
  - _Requirements: 9.1, 9.2, 10.3, 10.5_

- [x] 2.15 HTTP APIレスポンス型の拡張
  - `src/server/types.ts`を修正
  - すべてのレスポンス型に`WithConsumedCapacity`を追加
  - `BulkOperationResult`を拡張することで`InsertManyResult`, `UpdateManyResult`, `DeleteManyResult`に自動適用
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 3. Checkpoint - Server Layer の動作確認
  - すべてのServer Layerのテストが通過することを確認
  - カバレッジが90%以上であることを確認
  - ユーザーに進捗を報告し、質問があれば対応

- [ ] 4. Phase 3: Client Layer の修正
  - CollectionクラスとFindCursorクラスにコスト情報を追加
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 4.1 共有型定義の拡張
  - `src/shared/index.ts`を修正
  - `InsertOneResult`, `InsertManyResult`, `UpdateResult`, `DeleteResult`に`WithConsumedCapacity`を追加
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2, 8.3, 8.4_

- [ ] 4.2 Collectionクラスの修正
  - `src/client/Collection.ts`を修正
  - すべてのメソッド（insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany）でレスポンスに`consumedCapacity`を含める
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x]* 4.3 Collectionクラスのコスト追跡テスト
  - `__tests__/client/collection-cost.test.ts`を作成
  - 各操作のコスト情報を検証
  - 後方互換性を検証（consumedCapacityを使用しないコード）
  - _Requirements: 9.1, 9.2, 10.3, 10.8_

- [x] 4.4 FindCursorクラスの修正
  - `src/client/FindCursor.ts`を修正
  - `consumedCapacity`フィールドを追加
  - `getConsumedCapacity()`メソッドを実装
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x]* 4.5 FindCursorクラスのコスト追跡テスト
  - `__tests__/client/find-cursor-cost.test.ts`を作成
  - `getConsumedCapacity()`メソッドを検証
  - 複数ページのコスト集計を検証
  - _Requirements: 9.1, 9.2, 10.3, 10.5_

- [ ] 5. Checkpoint - Client Layer の動作確認
  - すべてのClient Layerのテストが通過することを確認
  - カバレッジが90%以上であることを確認
  - ユーザーに進捗を報告し、質問があれば対応

- [x] 6. Phase 4: テストとドキュメント
  - エッジケーステスト、パフォーマンステスト、ドキュメント更新
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 10.5, 10.6_

- [x]* 6.1 エッジケーステストの作成
  - `__tests__/edge-cases/cost-tracking.test.ts`を作成
  - ConsumedCapacityが存在しない場合
  - RCU/WCUがゼロの場合
  - 非常に大きなRCU/WCU値
  - 複数ページにわたるfind操作
  - バルク操作の部分失敗
  - カバレッジ100%を達成
  - _Requirements: 9.1, 9.2, 10.5_

- [ ]* 6.2 パフォーマンステストの作成
  - `__tests__/performance/cost-tracking.test.ts`を作成
  - コスト追跡のオーバーヘッド測定（目標: < 5ms）
  - 1000回の操作でのパフォーマンス影響
  - メモリ使用量の測定（目標: < 1MB増加）
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 10.6_

- [ ] 6.3 ログ出力機能の実装
  - 各操作ハンドラーにコスト情報のログ出力を追加
  - 高コスト操作の警告ログ（閾値: RCU > 100 または WCU > 50）
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ]* 6.4 ログ出力のテスト
  - ログ出力が正しく行われることを検証
  - 高コスト操作の警告ログを検証
  - _Requirements: 9.1, 9.2, 10.3_

- [x] 6.5 READMEの更新
  - コスト追跡機能の使用方法を追加
  - コード例を追加
  - _Requirements: すべて_

- [x] 6.6 APIドキュメントの更新
  - `ConsumedCapacity`, `AggregatedCost`型のドキュメント
  - `getConsumedCapacity()`メソッドのドキュメント
  - _Requirements: すべて_

- [x] 7. Final Checkpoint - 全体の動作確認
  - すべてのテストが通過することを確認
  - 全体のカバレッジが80%以上、コスト追跡モジュールが90%以上であることを確認
  - パフォーマンステストが目標を達成していることを確認
  - ドキュメントが完全であることを確認
  - ユーザーに最終確認を依頼

## Notes

- タスクに`*`が付いているものはオプショナル（テスト関連）です。MVP（最小限の実装）を優先する場合はスキップ可能ですが、品質保証のため実装を推奨します。
- 各タスクは要件（Requirements）を参照しており、トレーサビリティを確保しています。
- Checkpointタスクでは、ユーザーに進捗を報告し、質問や懸念事項があれば対応します。
- パフォーマンステストは最後に実行し、目標（オーバーヘッド < 5ms、メモリ増加 < 1MB）を達成していることを確認します。
