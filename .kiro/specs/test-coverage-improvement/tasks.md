# テストカバレッジ改善タスク

## Overview

dynamodb-clientライブラリのテストカバレッジを33.69%から80%以上に向上させるための実装タスクです。特に$nearオペレータ関連の実装（現在3.67%）を90%以上にすることを最優先とします。

## Tasks

- [x] 1. nearQuery.tsのテスト追加（最優先）✅
  - [x] 1.1 `__tests__/near-query.test.ts`を作成
    - 正常系、DynamoDB統合、エラーハンドリング、エッジケースのテストを追加
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  
  - [x] 1.2 正常系テストを実装
    - 簡易形式の$nearクエリで検索できる
    - GeoJSON形式の$nearクエリで検索できる
    - limitパラメータが正しく適用される
    - 距離情報(__distance)が正しく付与される
    - 結果が距離順にソートされる
    - _Requirements: 1.3_
  
  - [x] 1.3 DynamoDB統合テストを実装
    - シャドウレコードから本体レコードを取得できる
    - 複数のシャドウレコードから複数の本体レコードを取得できる
    - シャドウレコードが存在しない場合は空配列を返す
    - 本体レコードが削除されている場合はスキップする
    - GeoHashフィールド名が正しく生成される
    - _Requirements: 1.5, 1.6_
  
  - [x] 1.4 エラーハンドリングテストを実装
    - DynamoDBエラー時に適切なエラーを投げる
    - 無効な座標の場合にエラーを投げる
    - 無効なlimitの場合にエラーを投げる
    - _Requirements: 1.4, 1.7_
  
  - [x] 1.5 エッジケーステストを実装
    - 座標(0, 0)で検索できる
    - 北極点(90, 0)で検索できる
    - 南極点(-90, 0)で検索できる
    - 日付変更線(0, 180)で検索できる
    - maxDistance=0で完全一致のみ返す
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 1.6 カバレッジ確認
    - nearQuery.tsのカバレッジが100%を達成（目標90%を超過）
    - _Requirements: 1.1, 1.2_

- [x] 2. filter.tsのテスト追加（高優先）✅
  - [x] 2.1 `__tests__/filter-comprehensive.test.ts`を作成
    - 全オペレータのパース、isValidOperator、matchesFilter、convertTypeのテストを追加
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  
  - [x] 2.2 parseFilterFieldの全オペレータテストを実装
    - 13個の全オペレータ($eq, $ne, $lt, $lte, $gt, $gte, $in, $nin, $starts, $ends, $contains, $exists, $near)をテスト
    - 型指定のパース(string, number, date, boolean)をテスト
    - _Requirements: 2.3, 2.4_
  
  - [x] 2.3 isValidOperatorのテストを実装
    - FilterOperator型の全ての値がtrueを返すことをテスト
    - 無効なオペレータはfalseを返すことをテスト
    - _Requirements: 2.5, 2.6_
  
  - [x] 2.4 matchesFilterの全オペレータテストを実装
    - 8個のオペレータ($eq, $ne, $lt, $lte, $gt, $gte, $starts, $ends)の評価をテスト
    - 型変換(string, number, date, boolean)をテスト
    - _Requirements: 2.7, 2.8_
  
  - [x] 2.5 convertTypeのテストを実装
    - 全ての型変換(string, number, date, boolean)をテスト
    - _Requirements: 2.8_
  
  - [x] 2.6 カバレッジ確認
    - filter.tsのカバレッジが98.37%を達成（目標90%を超過）
    - _Requirements: 2.1, 2.2_

- [x] 3. find/utils.tsのテスト追加（高優先）✅
  - [x] 3.1 `__tests__/find-utils-comprehensive.test.ts`を作成
    - detectNearQuery、parseFilters、matchesAllFiltersのテストを追加
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 3.2 detectNearQueryのテストを実装
    - ネストされたオブジェクト形式($near)を検出できる
    - フィールド名に演算子を含める形式("location:$near")を検出できる
    - $nearが存在しない場合nullを返す
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [x] 3.3 parseFiltersのテストを実装
    - ネストされたオブジェクト形式をパースできる
    - フィールド名に演算子を含める形式をパースできる
    - 両方の形式が混在している場合をパースできる
    - エラーハンドリング（無効なオペレータ、型、構文）
    - _Requirements: 3.6_
  
  - [x] 3.4 matchesAllFiltersのテストを実装
    - 全てのフィルターにマッチする場合trueを返す
    - 1つでもマッチしない場合falseを返す
    - 空のフィルター配列の場合trueを返す
    - 複数のオペレータが混在する場合に正しく評価できる
    - _Requirements: 3.7_
  
  - [x] 3.5 カバレッジ確認
    - find/utils.tsのカバレッジが100%を達成（目標90%を超過）
    - _Requirements: 3.1, 3.2_

- [ ] 4. E2Eテストの追加（中優先）
  - [ ] 4.1 `__tests__/e2e-near-search.test.ts`を作成
    - クライアント→Lambda→DynamoDBのE2Eテストを追加
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [ ] 4.2 テストデータのセットアップを実装
    - seedTestVenues()関数を実装
    - cleanupTestVenues()関数を実装
    - _Requirements: 7.3_
  
  - [ ] 4.3 クライアント→Lambda→DynamoDBのテストを実装
    - 簡易形式の$nearクエリで検索できる
    - GeoJSON形式の$nearクエリで検索できる
    - paginationのperPageが適用される
    - maxDistanceでフィルタリングできる
    - minDistanceでフィルタリングできる
    - 結果が距離順にソートされる
    - __distanceフィールドが付与される
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [ ] 4.4 エラーケーステストを実装
    - 無効な座標の場合にエラーを返す
    - 無効なlimitの場合にエラーを返す
    - GeoHashフィールドが存在しない場合にエラーを返す
    - _Requirements: 5.6, 5.7_

- [ ] 5. パフォーマンステストの追加（中優先）
  - [ ] 5.1 `__tests__/performance-near-search.test.ts`を作成
    - 大量データでのパフォーマンステストを追加
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 5.2 パフォーマンステストを実装
    - 1000件の検索が5秒以内に完了する
    - 10000件の検索が30秒以内に完了する
    - precision 6がprecision 4より高速である
    - 最初の反復で結果が見つかった場合、追加反復しない
    - 複数反復が必要な場合、反復回数をログ出力する
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 6. CI/CDでのカバレッジチェック設定
  - [ ] 6.1 `.github/workflows/ci.yml`を更新
    - カバレッジ閾値を設定（lines: 80%, branches: 75%）
    - カバレッジレポートをGitHub Actionsに表示
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ] 6.2 package.jsonにカバレッジ閾値スクリプトを追加
    - `test:coverage:check`スクリプトを追加
    - _Requirements: 6.5_

- [ ] 7. Checkpoint - 全テストが通過することを確認
  - 全テストが通過することを確認
  - カバレッジが目標値（80%/75%）を達成していることを確認
  - ユーザーに質問があれば確認

## Notes

- タスク1-3は最優先で実施（$nearオペレータの品質保証）
- タスク4-5は中優先（E2Eテストとパフォーマンステスト）
- タスク6はCI/CD統合（継続的な品質保証）
- 各タスクは独立して実行可能（並行開発可能）
