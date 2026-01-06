# React-Admin 多対多関係コンポーネント - 実装タスク

## 概要

dynamodb-clientライブラリに、React-Adminで多対多関係を扱うための専用コンポーネントを追加する実装タスク。

## タスク

- [x] 1. 型定義の追加
  - `src/integrations/react-admin/types.ts`に以下を追加
  - `ReferenceManyToManyFieldProps`型定義
  - `ReferenceManyToManyInputProps`型定義
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1_

- [ ] 2. ReferenceManyToManyFieldコンポーネントの実装
  - [x] 2.1 基本実装
    - `src/integrations/react-admin/components/ReferenceManyToManyField.tsx`を作成
    - useRecordContext, useDataProviderフックを使用
    - usingプロパティのパース処理
    - 中間テーブルからの関連ID取得
    - ターゲットレコードの取得
    - 子コンポーネントへのデータ渡し
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2_

  - [x] 2.2 エラーハンドリング
    - usingプロパティの形式検証
    - 起点フィールドの存在確認
    - DataProviderエラーのハンドリング
    - ユーザーフレンドリーなエラー表示
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.3 パフォーマンス最適化
    - リクエストのバッチ処理
    - getManyでの一括取得
    - リクエストキャンセル処理
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 2.4 ユニットテストの作成
    - usingプロパティのパーステスト
    - 中間レコード取得のテスト
    - ターゲットレコード取得のテスト
    - エラーハンドリングのテスト
    - **Property 1: usingプロパティのパース**
    - **Property 2: 中間レコード取得の一貫性**
    - **Property 3: ターゲットレコード取得の完全性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 4.3, 5.1, 5.2, 5.3**

- [ ] 3. ReferenceManyToManyInputコンポーネントの実装
  - [x] 3.1 基本実装
    - `src/integrations/react-admin/components/ReferenceManyToManyInput.tsx`を作成
    - useRecordContext, useDataProvider, useNotify, useRefreshフックを使用
    - 現在の関連の取得
    - 関連追加時のcreateMany呼び出し
    - 関連削除時のdeleteMany呼び出し
    - 子コンポーネントへのデータ渡し
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4_

  - [x] 3.2 エラーハンドリング
    - usingプロパティの形式検証
    - 起点フィールドの存在確認
    - DataProviderエラーのハンドリング
    - ユーザーフレンドリーなエラー通知
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 3.3 ユニットテストの作成
    - 現在の関連取得のテスト
    - 関連追加のテスト
    - 関連削除のテスト
    - エラーハンドリングのテスト
    - **Property 4: 関連追加の冪等性**
    - **Property 5: 関連削除の完全性**
    - **Property 6: バッチ操作の原子性**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3**

- [ ] 4. DataProviderの拡張
  - [x] 4.1 createManyメソッドの追加
    - `src/integrations/react-admin/dataProvider.ts`にcreateMany実装を追加
    - collection.insertManyを使用
    - 挿入されたレコードを返却
    - _Requirements: 3.2_

  - [ ] 4.2 createManyのテスト
    - 複数レコード作成のテスト
    - エラーハンドリングのテスト
    - **Validates: Requirements 3.2, 3.5**

- [x] 5. コンポーネントのエクスポート
  - `src/integrations/react-admin/components/index.ts`を作成
  - ReferenceManyToManyFieldをエクスポート
  - ReferenceManyToManyInputをエクスポート
  - `src/integrations/react-admin/index.ts`を更新
  - 新しいコンポーネントと型をエクスポート
  - _Requirements: 7.5, 10.4_

- [x] 6. チェックポイント - テストとビルドの確認
  - すべてのユニットテストが成功することを確認
  - `npm run build`が成功することを確認
  - `npm run lint`がエラーなしで完了することを確認
  - 型定義が正しくエクスポートされていることを確認

- [ ]* 7. 統合テストの作成
  - [ ]* 7.1 表示フローのテスト
    - VenueShow画面での管理者一覧表示
    - UserShow画面での管理venue一覧表示
    - **Property 7: エラーメッセージの明確性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [ ]* 7.2 編集フローのテスト
    - VenueEdit画面での管理者追加
    - VenueEdit画面での管理者削除
    - **Property 8: データ整合性の保持**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 8. ドキュメントの更新
  - `README.md`に多対多関係のセクションを追加
  - ReferenceManyToManyFieldの使用例を追加
  - ReferenceManyToManyInputの使用例を追加
  - プロパティの説明を追加
  - TypeScript型の例を追加
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. 最終チェックポイント
  - すべてのテストが成功することを確認
  - `npm run build`が成功することを確認
  - `npm run lint`がエラーなしで完了することを確認
  - ドキュメントが正しく更新されていることを確認
  - 既存のDataProviderメソッドが壊れていないことを確認
  - React-Admin v4.xとの互換性を確認

## 注意事項

- タスクに`*`が付いているものはオプションタスクです（テスト関連）
- 各タスクは順番に実行してください
- チェックポイントでは必ずすべてのテストを実行してください
- 既存のコードを壊さないように注意してください
