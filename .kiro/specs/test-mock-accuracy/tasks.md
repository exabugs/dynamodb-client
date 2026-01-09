# Implementation Plan: Test Mock Accuracy

## Overview

dynamodb-clientプロジェクトのテストモックを実際のインターフェースと正確に一致させるための実装計画です。型安全なモックファクトリーを作成し、既存のテストを更新します。

## Tasks

- [ ] 1. Mock Factory Moduleの実装
  - Response Builders、Error Simulators、Operation Mock Factoryを実装
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2_

- [x] 1.1 Response Buildersの実装
  - `__tests__/helpers/response-builders.ts`を作成
  - InsertManyResultBuilder、UpdateManyResultBuilder、DeleteManyResultBuilder、FindOneResultBuilder、FindManyResultBuilderを実装
  - 各ビルダーでsuccess、partialFailure、failureメソッドを実装
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ]* 1.2 Response Buildersのユニットテスト
  - `__tests__/helpers/response-builders.test.ts`を作成
  - 各ビルダーの出力が正しい型構造を持つことを検証
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 1.3 Error Simulatorsの実装
  - `__tests__/helpers/error-simulators.ts`を作成
  - ErrorSimulatorインターフェースを実装
  - itemNotFound、validationError、partialFailure、operationErrorメソッドを実装
  - 実際のエラークラス（ItemNotFoundError、AppError、PartialFailureError）を使用
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 1.4 Error Simulatorsのユニットテスト
  - `__tests__/helpers/error-simulators.test.ts`を作成
  - 各エラーシミュレーターが正しいエラー型を生成することを検証
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 1.5 Operation Mock Factoryの実装
  - `__tests__/helpers/mock-factory.ts`を作成
  - OperationMockFactoryインターフェースを実装
  - createInsertManyMock、createUpdateManyMock、createDeleteManyMock、createFindOneMock、createFindManyMockメソッドを実装
  - vi.fn()を使用して型安全なモックを生成
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4_

- [ ]* 1.6 Operation Mock Factoryのユニットテスト
  - `__tests__/helpers/mock-factory.test.ts`を作成
  - 各モックファクトリーが正しい型シグネチャを持つことを検証
  - expectTypeOf()を使用して型チェック
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 2. Test Helper Moduleの実装
  - Mock Setup HelpersとAssertion Helpersを実装
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2.1 Mock Setup Helpersの実装
  - `__tests__/helpers/mock-setup.ts`を作成
  - MockSetupHelpersインターフェースを実装
  - setupInsertManySuccess、setupInsertManyPartialFailure、setupUpdateManySuccess、setupFindOneSuccess、setupFindOneNotFoundメソッドを実装
  - _Requirements: 6.1, 6.2, 6.3_

- [ ]* 2.2 Mock Setup Helpersのユニットテスト
  - `__tests__/helpers/mock-setup.test.ts`を作成
  - 各セットアップヘルパーが正しくモックを設定することを検証
  - _Requirements: 6.1, 6.2_

- [x] 2.3 Assertion Helpersの実装
  - `__tests__/helpers/assertions.ts`を作成
  - AssertionHelpersインターフェースを実装
  - assertInsertManyResult、assertUpdateManyResult、assertDeleteManyResult、assertOperationError、assertItemNotFoundErrorメソッドを実装
  - _Requirements: 6.1, 6.2, 6.3_

- [ ]* 2.4 Assertion Helpersのユニットテスト
  - `__tests__/helpers/assertions.test.ts`を作成
  - 各アサーションヘルパーが正しく検証することを確認
  - _Requirements: 6.1, 6.2_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Existing Test Migrationの実装
  - 既存のテストファイルを新しいモックファクトリーを使用するように更新
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4.1 insertOne-direct.test.tsの更新
  - `__tests__/operations/insertOne-direct.test.ts`を更新
  - モックファクトリーとレスポンスビルダーを使用
  - `as any`や型アサーションを削除
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 4.5, 7.1_

- [ ]* 4.2 insertOne-direct.test.tsのProperty Test追加
  - Property 1（Mock Interface Consistency）のテストを追加
  - Property 2（Response Structure Completeness）のテストを追加
  - _Requirements: 1.1, 1.2, 2.1, 4.1, 4.2_

- [x] 4.3 updateOne-direct.test.tsの更新
  - `__tests__/operations/updateOne-direct.test.ts`を更新
  - モックファクトリーとレスポンスビルダーを使用
  - `as any`や型アサーションを削除
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 4.5, 7.1_

- [ ]* 4.4 updateOne-direct.test.tsのProperty Test追加
  - Property 1（Mock Interface Consistency）のテストを追加
  - Property 2（Response Structure Completeness）のテストを追加
  - _Requirements: 1.1, 1.2, 2.2, 4.1, 4.2_

- [x] 4.5 deleteOne-direct.test.tsの更新
  - `__tests__/operations/deleteOne-direct.test.ts`を更新
  - モックファクトリーとレスポンスビルダーを使用
  - `as any`や型アサーションを削除
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.3, 4.5, 7.1_

- [ ]* 4.6 deleteOne-direct.test.tsのProperty Test追加
  - Property 1（Mock Interface Consistency）のテストを追加
  - Property 2（Response Structure Completeness）のテストを追加
  - _Requirements: 1.1, 1.2, 2.3, 4.1, 4.2_

- [x] 4.7 findOne-direct.test.tsの更新
  - `__tests__/operations/findOne-direct.test.ts`を更新
  - モックファクトリーとエラーシミュレーターを使用
  - `as any`や型アサーションを削除
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.4, 3.1, 4.5, 7.1_

- [ ]* 4.8 findOne-direct.test.tsのProperty Test追加
  - Property 3（Error Type Accuracy）のテストを追加
  - _Requirements: 1.5, 3.1, 3.2, 4.1, 4.2_

- [x] 4.9 その他の操作テストの更新
  - `__tests__/operations/updateOne-filter.test.ts`を確認（統合テスト、更新不要）
  - `__tests__/operations/updateMany-setOnInsert.test.ts`を確認（統合テスト、更新不要）
  - `__tests__/operations/updateOne-setOnInsert.test.ts`を確認（統合テスト、更新不要）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.5, 7.1_

- [ ]* 4.10 その他の操作テストのProperty Test追加
  - 各テストファイルに適切なProperty Testを追加
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Checkpoint - Ensure all tests pass
  - All tests pass: ✅
  - Lint check: ✅ (40 warnings, 0 errors)
  - Build check: ✅

- [ ] 6. Documentationの作成
  - モックファクトリー使用ガイド、ベストプラクティス、アンチパターン集を作成
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6.1 Mock Factory使用ガイドの作成
  - `docs/testing/mock-factory-guide.md`を作成
  - モックファクトリーの使い方を説明
  - 各ビルダーとシミュレーターの使用例を記載
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 6.2 ベストプラクティスドキュメントの作成
  - `docs/testing/best-practices.md`を作成
  - 型安全なモックの作成方法を説明
  - エラーケースのテスト方法を説明
  - 部分失敗のテスト方法を説明
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 6.3 アンチパターン集の作成
  - `docs/testing/anti-patterns.md`を作成
  - 避けるべきモックパターンを列挙
  - `as any`の使用、型アサーションの乱用、モックの重複等
  - _Requirements: 8.5_

- [x] 7. Final checkpoint - Ensure all tests pass
  - All tests pass: ✅
  - Lint check: ✅ (40 warnings, 0 errors)
  - Build check: ✅
  - Documentation complete: ✅

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
