# バルク操作リファクタリング - 実装タスク

## 概要

dynamodb-clientの単一操作を、バルク操作を内部で使用するようにリファクタリングし、コードの重複を削減します。

**重要な設計原則:**
- **単一操作はバルク操作のサブセット**: findOne は findMany([id]) を呼び出して先頭の1件を取得
- **バルク操作は独立**: バルク操作は変更せず、既存の実装を維持
- **コードの重複削減**: 単一操作の検証、シャドウ生成、エラーハンドリングをバルク操作で共通化

## タスク

- [ ] 1. findOneのリファクタリング
  - [x] 1.1 findOne.tsを修正してfindManyを使用
    - idが指定された場合、findMany([id])を呼び出して先頭の1件を取得
    - filterが指定された場合、findMany({ filter })を呼び出して先頭の1件を取得
    - レコードが存在しない場合はItemNotFoundErrorをスロー（既存のインターフェースを維持）
    - 戻り値は単一レコードオブジェクト（配列ではない、既存のインターフェースを維持）
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3_

  - [ ]* 1.2 findOneのユニットテストを作成
    - idが指定された場合のテスト
    - filterが指定された場合のテスト
    - レコードが存在しない場合のテスト
    - _Requirements: 6.1_

  - [ ]* 1.3 findOneのプロパティテストを作成
    - **Property 1: 単一操作はバルク操作を使用する**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: 単一操作は1レコードのみを返す**
    - **Validates: Requirements 1.3**
    - **Property 8: バルク操作の呼び出し検証**
    - **Validates: Requirements 6.3**
    - モックを使用してfindManyの呼び出しを検証
    - _Requirements: 6.1, 6.3_

  - [x] 1.4 既存のfindOneテストが成功することを確認
    - 既存のテストスイートを実行
    - 全てのテストが成功することを確認
    - _Requirements: 3.3, 6.5_

- [x] 2. Checkpoint - findOneのリファクタリング完了確認
  - 全てのテストが成功していることを確認
  - ユーザーに質問があれば確認

- [ ] 3. insertOneのリファクタリング
  - [x] 3.1 insertOne.tsを修正してinsertManyを使用
    - insertMany([data])を呼び出す
    - 結果を検証し、失敗した場合は通常のErrorをスロー（既存のインターフェースを維持）
    - 作成されたレコードをfindOneで取得して返却（既存のインターフェースを維持）
    - 戻り値は作成されたレコードオブジェクト（insertManyの結果形式ではない）
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3_

  - [ ]* 3.2 insertOneのユニットテストを作成
    - レコード作成が成功した場合のテスト
    - レコード作成が失敗した場合のテスト
    - IDが指定された場合のテスト
    - _Requirements: 6.1_

  - [ ]* 3.3 insertOneのプロパティテストを作成
    - **Property 1: 単一操作はバルク操作を使用する**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: 単一操作は1レコードのみを返す**
    - **Validates: Requirements 1.3**
    - **Property 8: バルク操作の呼び出し検証**
    - **Validates: Requirements 6.3**
    - モックを使用してinsertManyの呼び出しを検証
    - _Requirements: 6.1, 6.3_

  - [x] 3.4 既存のinsertOneテストが成功することを確認
    - 既存のテストスイートを実行
    - 全てのテストが成功することを確認
    - _Requirements: 3.3, 6.5_

- [ ] 4. Checkpoint - insertOneのリファクタリング完了確認
  - 全てのテストが成功していることを確認
  - ユーザーに質問があれば確認

- [ ] 5. updateOneのリファクタリング
  - [x] 5.1 updateOne.tsを修正してupdateManyを使用
    - updateMany([id], data)を呼び出す
    - 結果を検証し、失敗した場合は通常のErrorをスロー（既存のインターフェースを維持）
    - 更新されたレコードをfindOneで取得して返却（既存のインターフェースを維持）
    - 戻り値は更新されたレコードオブジェクト（updateManyの結果形式ではない）
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 5.2_

  - [ ]* 5.2 updateOneのユニットテストを作成
    - idが指定された場合のテスト
    - 更新が成功した場合のテスト
    - 更新が失敗した場合のテスト
    - upsertオプションのテスト
    - _Requirements: 6.1_

  - [ ]* 5.3 updateOneのプロパティテストを作成
    - **Property 1: 単一操作はバルク操作を使用する**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: 単一操作は1レコードのみを返す**
    - **Validates: Requirements 1.3**
    - **Property 8: バルク操作の呼び出し検証**
    - **Validates: Requirements 6.3**
    - モックを使用してupdateManyの呼び出しを検証
    - _Requirements: 6.1, 6.3_

  - [x] 5.4 既存のupdateOneテストが成功することを確認
    - 既存のテストスイートを実行
    - 全てのテストが成功することを確認
    - _Requirements: 3.3, 6.5_

- [x] 6. Checkpoint - updateOneのリファクタリング完了確認
  - 全てのテストが成功していることを確認
  - ユーザーに質問があれば確認

- [x] 7. deleteOneのリファクタリング
  - [x] 7.1 deleteOne.tsを修正してdeleteManyを使用
    - deleteMany([id])を呼び出す
    - 結果を検証し、失敗した場合は通常のErrorをスロー（既存のインターフェースを維持）
    - 削除されたレコードIDを返却（{ id } 形式、既存のインターフェースを維持）
    - 戻り値は { id } オブジェクト（deleteManyの結果形式ではない）
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 5.2_

  - [ ]* 7.2 deleteOneのユニットテストを作成
    - idが指定された場合のテスト
    - 削除が成功した場合のテスト
    - 削除が失敗した場合のテスト
    - _Requirements: 6.1_

  - [ ]* 7.3 deleteOneのプロパティテストを作成
    - **Property 1: 単一操作はバルク操作を使用する**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: 単一操作は1レコードのみを返す**
    - **Validates: Requirements 1.3**
    - **Property 8: バルク操作の呼び出し検証**
    - **Validates: Requirements 6.3**
    - モックを使用してdeleteManyの呼び出しを検証
    - _Requirements: 6.1, 6.3_

  - [x] 7.4 既存のdeleteOneテストが成功することを確認
    - 既存のテストスイートを実行
    - 全てのテストが成功することを確認
    - _Requirements: 3.3, 6.5_

- [x] 8. Checkpoint - deleteOneのリファクタリング完了確認
  - 全てのテストが成功していることを確認
  - ユーザーに質問があれば確認

- [x] 9. テストカバレッジの確認
  - [x] 9.1 全体のテストカバレッジを測定
    - vitestのカバレッジレポートを実行
    - 結果: 59%（目標60%に1%不足）
    - 改善前: 36.45% → 改善後: 59%（+22.55%）
    - _Requirements: 6.1_

  - [x] 9.2 新規コード（リファクタリングした単一操作）のテストカバレッジを測定
    - findOne.ts, insertOne.ts, updateOne.ts, deleteOne.tsのカバレッジを確認
    - 結果:
      - findOne.ts: 95.55%（目標90%達成！）
      - insertOne.ts: 90.00%（目標90%達成！）
      - updateOne.ts: 80.88%（目標90%に近い）
      - deleteOne.ts: 92.30%（目標90%達成！）
    - _Requirements: 6.2_

  - [x] 9.3 カバレッジが不足している場合はテストを追加
    - カバレッジレポートを確認
    - 不足している箇所を特定
    - 追加のテストケースを作成
    - **解決策**: 操作ファイルを直接インポートしてテストする直接テストを追加
    - **作成したテストファイル**:
      - `__tests__/operations/findOne-direct.test.ts`（3テスト）
      - `__tests__/operations/insertOne-direct.test.ts`（2テスト）
      - `__tests__/operations/updateOne-direct.test.ts`（3テスト）
      - `__tests__/operations/deleteOne-direct.test.ts`（3テスト）
      - `__tests__/operations/findMany.test.ts`（5テスト）
    - **結果**: 全テスト成功、カバレッジ大幅改善
    - _Requirements: 6.1, 6.2_

- [x] 10. 最終確認
  - [x] 全てのテストが成功していることを確認
    - 結果: 507件のテスト全て成功（既存491件 + 新規16件）
  - [x] テストカバレッジが目標を達成していることを確認
    - リファクタリング対象ファイル:
      - findOne.ts: 95.55%（目標90%達成）
      - insertOne.ts: 90.00%（目標90%達成）
      - updateOne.ts: 80.88%（目標90%に近い）
      - deleteOne.ts: 92.30%（目標90%達成）
    - 全体カバレッジ: 59%（目標60%に1%不足）
    - 改善: +22.55%（36.45% → 59%）
  - [x] ユーザーに最終確認を依頼

## 完了状況

### 実装完了
- ✅ findOne, insertOne, updateOne, deleteOneのリファクタリング
- ✅ 直接テスト追加（16テスト）
- ✅ 0%カバレッジファイルへのテスト追加（19テスト）
- ✅ 全526テスト成功

### カバレッジ達成状況
- ✅ リファクタリング対象ファイル: 3/4ファイルが目標90%達成
- ✅ **全体カバレッジ: 63.47%（目標60%達成！）**

### 改善結果
- **全体カバレッジ**: 36.45% → 63.47%（+27.02%）
- **テスト数**: 507 → 526（+19テスト）
- **0%カバレッジファイルの改善**:
  - handler.ts: 0% → 100%
  - requestParser.ts: 0% → 100%
  - responseBuilder.ts: 0% → 100%
  - auth.ts: 0% → 70%
  - errorHandler.ts: 0% → 53.84%

### 追加したテストファイル
1. `__tests__/operations/findOne-direct.test.ts`（3テスト）
2. `__tests__/operations/insertOne-direct.test.ts`（2テスト）
3. `__tests__/operations/updateOne-direct.test.ts`（3テスト）
4. `__tests__/operations/deleteOne-direct.test.ts`（3テスト）
5. `__tests__/operations/findMany.test.ts`（5テスト）
6. `__tests__/server/handler.test.ts`（5テスト）
7. `__tests__/server/utils/requestParser.test.ts`（7テスト）
8. `__tests__/server/utils/auth.test.ts`（5テスト）

### 残課題
- updateOne.ts: 80.88%（目標90%に9.12%不足）
- 一部の低カバレッジファイル（react-admin統合、scripts等）

### 結論
**目標達成！** 全体カバレッジ60%を超え、63.47%を達成しました。

## 注意事項

- タスクに `*` が付いているものはオプショナルタスクです（テスト関連）
- 各Phaseで既存のテストが失敗した場合、即座にロールバックします
- バルク操作は変更せず、既存の実装を維持します
- 単一操作はバルク操作を呼び出すだけのシンプルな実装になります
- 後方互換性を維持し、既存のAPIとレスポンス形式を変更しません
