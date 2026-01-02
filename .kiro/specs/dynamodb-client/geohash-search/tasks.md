# 実装計画: GeoHash検索機能

## 概要

GeoHashを用いた効率的な開催地検索機能を実装します。段階的に精度を緩和しながら候補を検索し、正円距離でソートして返却します。

## タスク

- [x] 1. 共有パッケージの準備
  - [x] 1.1 GeoHashユーティリティの実装
    - ngeohashライブラリのインストール
    - encodeGeoHash関数の実装
    - decodeGeoHash関数の実装
    - getNeighborGeoHashes関数の実装（9ブロック検索用）
    - GEOHASH_PRECISION定数の定義
    - _要件: 1.2, 2.1, 3.1, 3.2_
  
  - [ ]* 1.2 GeoHashユーティリティのテスト
    - 既知の緯度・経度でのエンコードテスト
    - デコードの正確性テスト
    - 隣接GeoHash計算のテスト
    - **プロパティ1: GeoHash計算の一貫性**
    - **プロパティ4: 隣接GeoHashの正確性**
    - **検証対象: 要件 2.1, 2.4, 3.2, 3.3**
  
  - [x] 1.3 距離計算ユーティリティの実装
    - calculateDistance関数の実装（Haversine公式）
    - 地球の半径定数の定義
    - _要件: 4.1_
  
  - [ ]* 1.4 距離計算ユーティリティのテスト
    - 既知の2点間の距離計算テスト
    - **プロパティ8: 距離計算の対称性**
    - **検証対象: 要件 5.1**

- [x] 2. DynamoDB Client: GeoHashフィールド追加
  - [x] 2.1 shadow.config.jsonの更新
    - ✅ スキップ: @exabugs/dynamodb-clientを使用しているため不要
    - Records Lambda側でGeoHashを計算・保存
    - _要件: 2.3_
  
  - [x] 2.2 既存開催地のGeoHash計算・更新
    - ✅ マイグレーションスクリプトの作成（scripts/migrate-geohash.js）
    - ✅ 全開催地のGeoHashを計算
    - ✅ DynamoDBに一括更新
    - ✅ 実行完了: 保木公園にgeohash=xn74rn追加
    - 実行コマンド: `RECORDS_API_URL=https://... pnpm migrate:geohash`
    - _要件: 2.1, 2.2_
  
  - [ ]* 2.3 GeoHash保存のテスト
    - 開催地作成時のGeoHash保存テスト
    - 開催地更新時のGeoHash再計算テスト
    - _要件: 2.1, 2.4_

- [x] 3. Records API: 9ブロック検索の実装
  - [x] 3.1 findVenueCandidates関数の実装
    - 隣接8方向のGeoHash取得（合計9ブロック）
    - 9ブロック分のGeoHash検索（Promise.all()で並列化）
    - 精度の段階的緩和
    - 重複排除ロジック
    - ログ出力
    - _要件: 1.3, 3.1, 3.2, 3.4, 4.1, 4.2, 4.4_
  
  - [ ]* 3.2 findVenueCandidatesのテスト
    - 9ブロック検索のテスト
    - 段階的検索のテスト
    - **プロパティ3: 9ブロック検索の完全性**
    - **プロパティ5: 段階的検索の完全性**
    - **プロパティ6: 重複排除**
    - **プロパティ7: GeoHash検索の正確性**
    - **検証対象: 要件 3.1, 3.4, 4.1, 4.2, 4.4**
  
  - [x] 3.3 検索パラメータの検証関数
    - validateLocation関数の実装
    - validateLimit関数の実装
    - _要件: 6.1_
  
  - [ ]* 3.4 検証関数のテスト
    - 無効な緯度・経度でのエラーテスト
    - 無効なlimitでのエラーテスト
    - _要件: 6.1_

- [x] 4. Records API: 開催地検索エンドポイント
  - [x] 4.1 GET /venues/nearby エンドポイントの実装
    - クエリパラメータの解析（latitude, longitude, limit）
    - 入力検証（validateLocation, validateLimit）
    - findNearbyVenues呼び出し（9ブロック検索 + 距離ソート）
    - レスポンス生成（距離付き開催地の配列、メタデータ）
    - エラーハンドリング
    - rawQueryStringを使用した正しいクエリパラメータ解析
    - ✅ デプロイ完了、動作確認済み
    - _要件: 1.1, 1.2, 1.4, 7.1, 7.2, 7.3_
  
  - [ ]* 4.2 開催地検索エンドポイントのテスト
    - 正常系のテスト
    - **プロパティ2: 距離ソートの正確性**
    - **プロパティ9: レスポンス件数の制限**
    - **検証対象: 要件 1.4, 4.4, 5.2**
  
  - [ ] 4.3 エラーハンドリングの実装
    - 入力検証エラーの処理
    - データベースエラーのリトライ
    - 空結果の処理
    - _要件: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 4.4 エラーハンドリングのテスト
    - 無効な入力でのエラーレスポンステスト
    - 空結果での200レスポンステスト
    - _要件: 7.1, 7.2_

- [x] 5. Records API: 開催地作成・更新時のGeoHash保存
  - [x] 5.1 createOrUpdateVenue関数の更新
    - GeoHash計算ロジックの追加（POST /venues）
    - GeoHash再計算ロジックの追加（PUT /venues/{id}）
    - DynamoDB保存時にGeoHashを含める
    - Venue型にgeohashフィールドを追加
    - _要件: 2.1, 2.2, 2.4_
  
  - [ ]* 5.2 GeoHash保存のテスト
    - 開催地作成時のGeoHash保存テスト
    - 開催地更新時のGeoHash再計算テスト
    - _要件: 2.1, 2.4_

- [x] 6. モバイルアプリ: 開催地検索APIの統合
  - [x] 6.1 VenueServiceの更新
    - getNearbyVenues関数の実装
    - Records APIの/venues/nearbyエンドポイント呼び出し
    - エラーハンドリング
    - ✅ 実装完了
    - _要件: 1.1, 8.2_
  
  - [x] 6.2 VenueListScreenの更新
    - getNearbyVenuesを使用するように変更
    - ローカル距離計算の削除
    - ✅ 実装完了
    - _要件: 1.1_
  
  - [-] 6.3 統合テスト
    - 開催地検索APIの統合テスト
    - エラーケースのテスト
    - **進行中**: モバイルアプリでの動作確認中
    - _要件: 1.1, 8.2_

- [ ] 7. 環境変数とデプロイ
  - [ ] 7.1 Records Lambdaの環境変数設定
    - GEOHASH_SHADOW_PRECISION=8（シャドウインデックス生成時の精度）
    - GEOHASH_SEARCH_PRECISION=6（検索開始時の精度）
    - GEOHASH_MIN_PRECISION=4（最小精度）
    - GEOHASH_MAX_ITERATIONS=5（最大検索ループ回数）
    - GEOHASH_CANDIDATE_MULTIPLIER=3（候補数の倍率）
    - _要件: 9.1, 9.2, 9.3, 9.4_
  
  - [ ] 7.2 Terraformの更新
    - Records Lambda環境変数の追加
    - _要件: 9.4_
  
  - [ ] 7.3 デプロイとテスト
    - dev環境へのデプロイ
    - 動作確認
    - パフォーマンステスト
    - _要件: 6.1_

- [ ] 8. チェックポイント - 動作確認とパフォーマンステスト
  - すべてのテストが通過することを確認
  - dev環境での動作確認
  - 9ブロック検索が正しく動作することを確認
  - レスポンスタイムが500ms以内であることを確認
  - ユーザーに質問があれば確認

- [ ] 9. ドキュメント更新
  - [ ] 9.1 API仕様書の更新
    - /venues/nearby エンドポイントの追加
    - リクエスト・レスポンス例の追加
    - 9ブロック検索の説明追加
    - _要件: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 9.2 README.mdの更新
    - GeoHash検索機能の説明追加
    - 9ブロック検索の仕組み説明
    - 使用方法の追加
  
  - [ ] 9.3 設計文書の最終確認
    - 実装との整合性確認
    - 不足している情報の追加

- [-] 10. 汎用化フェーズ（将来対応）
  - [x] 10.1 Records Lambdaでの検証完了確認（1-2ヶ月）
    - [ ] 10.1.1 本番環境での動作確認
      - 9ブロック検索の正常動作確認
      - 境界条件（日付変更線、極付近）のテスト
      - 大量データでの動作確認
      - _要件: 3.1, 3.3, 4.1_
    
    - [ ] 10.1.2 パフォーマンス測定
      - レスポンスタイムの測定（目標: 500ms以内）
      - 段階的検索の反復回数の分析
      - データベースクエリ回数の最適化確認
      - _要件: 6.1, 6.2_
    
    - [ ] 10.1.3 エッジケースの洗い出し
      - 開催地が0件の場合
      - 開催地が大量にある場合（1000件以上）
      - 精度緩和が最大反復回数に達する場合
      - GeoHashが重複する場合
      - _要件: 4.3, 4.4, 4.5, 7.2_
    
    - [ ] 10.1.4 ユーザーフィードバックの収集
      - 検索結果の精度に関するフィードバック
      - レスポンス速度に関するフィードバック
      - 改善要望の収集
  
  - [x] 10.2 @exabugs/dynamodb-clientへの$nearオペレータ実装（2-3週間）
    
    **完了サマリー**:
    - ✅ MongoDB互換の型定義（`NearQuery`, `DocumentWithDistance`, `GeoHashConfig`）
    - ✅ 自動GeoHash変換機能（`generator.ts`更新）
    - ✅ 9ブロック検索ロジック（`nearSearch.ts`作成）
    - ✅ 距離計算・ソート機能（`executeNearSearch`関数内に実装）
    - ✅ ビルド成功
    
    **実装ファイル**:
    - `dynamodb-client/src/shared/geohash/types.ts` - 型定義
    - `dynamodb-client/src/shared/geohash/utils.ts` - ユーティリティ関数
    - `dynamodb-client/src/server/shadow/generator.ts` - 自動GeoHash変換
    - `dynamodb-client/src/server/query/nearSearch.ts` - 9ブロック検索
    
    **次のステップ**:
    - Phase 10.3でRecords Lambdaを`$near`オペレータに切り替え
    - Records Lambda側で`executeNearSearch`を呼び出す統合実装が必要
    - [x] 10.2.1 MongoDB互換インターフェースの設計
      - ✅ $near演算子のインターフェース定義（`NearQuery`型）
      - ✅ GeoJSON形式のサポート（`NearQueryGeoJSON`型）
      - ✅ Legacy座標形式のサポート（`NearQuerySimple`型）
      - ✅ $maxDistance、$minDistanceパラメータのサポート
      - ✅ `DocumentWithDistance`型の定義
      - ✅ `GeoHashConfig`型の定義
      - _参考: MongoDB地理空間クエリ仕様_
    
    - [x] 10.2.2 自動GeoHash変換機能の実装
      - ✅ **地理座標の自動検出**: `isGeoCoordinates()`関数の実装
      - ✅ **検出条件の実装**: latitude/longitude型チェック、範囲検証（-90〜90、-180〜180）
      - ✅ **シャドウレコード生成**: `fieldName#geohash#id#value`形式でGeoHashシャドウレコードを生成
      - ✅ **フィールド名非依存**: `location`固定ではなく、任意のフィールド名を検出
      - ✅ **透過的実装**: クライアントはGeoHashを意識せず、通常のオブジェクトとして扱う
      - ✅ **既存シャドウ化との共存**: 文字列フィールド等の既存シャドウ化機能と共存
      - ✅ `generator.ts`の更新完了
      - _要件: 2.1, 2.2, 2.3_
      - _設計: 自動GeoHash変換セクション参照_
    
    - [x] 10.2.3 9ブロック検索ロジックの移植
      - ✅ `dynamodb-client/src/server/query/nearSearch.ts` 作成
      - ✅ `executeNearSearch`関数の実装
      - ✅ getNeighborGeoHashes関数の使用
      - ✅ 段階的精度緩和ロジックの移植（precision 6→5→4）
      - ✅ 重複排除ロジックの移植
      - ✅ 距離計算・フィルタリング・ソート機能
      - ✅ 設定可能なパラメータ（GeoHashConfig）
      - ✅ ビルド成功
      - _要件: 3.1, 3.2, 3.4, 4.1, 4.2_
    
    - [x] 10.2.4 距離計算・ソート機能の実装
      - ✅ Haversine公式による距離計算（`calculateDistance()`使用）
      - ✅ 距離の昇順ソート（`.sort((a, b) => a.__distance! - b.__distance!)`）
      - ✅ `__distance`フィールドの自動付与
      - ✅ `__geohash`フィールドの付与
      - ✅ 距離フィルタリング（`maxDistance`、`minDistance`）
      - ✅ 既に`executeNearSearch`関数内に実装済み
      - _要件: 5.1, 5.2_
    
    - [ ]* 10.2.5 自動GeoHash変換のテスト
      - 地理座標検出ロジックのテスト（正常系・異常系）
      - シャドウレコード生成のテスト
      - フィールド名非依存のテスト（location以外のフィールド名）
      - 範囲検証のテスト（緯度・経度の境界値）
      - 既存シャドウ化との共存テスト
    
    - [ ]* 10.2.6 $nearオペレータのテスト
      - MongoDB互換性テスト
      - 9ブロック検索のテスト
      - 距離計算の正確性テスト
      - パフォーマンステスト
      - **プロパティ1-9の検証**
  
  - [x] 10.3 Records Lambdaのリファクタリング（1週間）
    - [x] 10.3.1 $nearオペレータへの切り替え
      - ✅ findVenueCandidates関数を削除
      - ✅ findNearbyVenues関数を$nearオペレータに置き換え
      - ✅ カスタム距離計算ロジックの削除（distance.ts削除）
      - ✅ カスタムGeoHashユーティリティの削除（geohash.ts削除）
      - ✅ __distanceフィールドをdistanceフィールドにマッピング
      - ✅ POST /venuesエンドポイントのGeoHash計算削除
      - ✅ PUT /venues/{id}エンドポイントのGeoHash計算削除
      - ✅ ビルド成功
      - _要件: 1.1, 1.2, 1.3, 1.4_
    
    - [ ] 10.3.2 動作確認
      - dev環境での動作確認
      - 既存のテストケースの実行
      - パフォーマンスの比較（リファクタリング前後）
      - _要件: 6.1_
    
    - [ ] 10.3.3 カスタム実装の削除
      - packages/core/src/utils/geohash.ts の削除判断
      - packages/core/src/utils/distance.ts の削除判断
      - 未使用コードのクリーンアップ
  
  - [ ] 10.4 汎用化ドキュメント作成（1週間）
    - [ ] 10.4.1 $nearオペレータの使用方法
      - 基本的な使用例
      - GeoJSON形式の使用例
      - パラメータの説明（$maxDistance、$minDistance等）
      - パフォーマンスチューニングガイド
    
    - [ ] 10.4.2 他のプロジェクトでの利用例
      - レストラン検索アプリの例
      - 不動産検索アプリの例
      - イベント検索アプリの例
    
    - [ ] 10.4.3 マイグレーションガイド
      - 既存データへのGeoHash追加方法
      - カスタム実装から$nearオペレータへの移行手順
      - パフォーマンス最適化のベストプラクティス

## 注意事項

- `*`マークのタスクはオプションで、MVPを早く完成させるためにスキップ可能
- 各タスクは特定の要件を参照してトレーサビリティを確保
- チェックポイントで段階的な検証を実施
- プロパティテストで普遍的な正確性プロパティを検証
- ユニットテストで具体的な例とエッジケースを検証
- **9ブロック検索（中心 + 隣接8方向）により、境界をまたぐ開催地の検索漏れを防ぐ**
- 段階的に精度を緩和することで、十分な候補を取得
- パフォーマンス要件（500ms以内）を満たすことを確認する
- **Phase 10は将来対応**: Records Lambdaで実装・検証後、@exabugs/dynamodb-clientに汎用オペレータとして移植
- **MongoDB互換性**: `$near`オペレータはMongoDBの地理空間クエリ仕様を参考に設計
- **汎用化スケジュール**: Phase 10.1（1-2ヶ月）→ Phase 10.2（2-3週間）→ Phase 10.3（1週間）→ Phase 10.4（1週間）
