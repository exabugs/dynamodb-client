# 実装タスク: 自動シャドウ化の簡素化

## 実装方針

レコードごとに独立したシャドウ生成を実装します。各レコードは、そのレコードに実際に存在するプリミティブ型フィールドのみを自動的にシャドウ化します。

## タスク

- [x] 1. 環境変数ベースの設定管理を実装
  - `src/server/shadow/config.ts` を更新
  - `SHADOW_STRING_MAX_BYTES` と `SHADOW_NUMBER_PADDING` のみ読み込み
  - デフォルト値: 100, 20
  - _要件: 2.9-2.11_

- [x] 2. 型推論ロジックを実装
  - `src/server/shadow/typeInference.ts` を新規作成
  - `inferFieldType()`: フィールド値から型を推論
  - string, number, boolean, datetime, array, object を判定
  - null, undefined は除外
  - _要件: 3.1-3.9_

- [x] 3. プリミティブ型の切り詰め処理を実装
  - `src/server/shadow/generator.ts` に `truncateString()` を追加
  - UTF-8バイト単位で切り詰め（100バイト）
  - マルチバイト文字の境界を考慮
  - _要件: 4.1-4.5_

- [x] 3.5. 複合型の切り詰め処理を実装
  - `src/server/shadow/generator.ts` の `formatFieldValue()` を更新
  - array/object 型の処理を追加
  - JSON文字列化して2倍のバイト制限（200バイト）で切り詰め
  - `normalizeJson()` で正規化してから文字列化
  - _要件: 4.5.1-4.5.5_

- [x] 4. 数値オフセット方式を実装
  - `src/server/shadow/generator.ts` に `formatNumberWithOffset()` を追加
  - オフセット: 10^15
  - 範囲: -10^15 ～ +10^15
  - 範囲外の数値はエラー
  - _要件: 5.1-5.6_

- [x] 5. シャドウレコード生成ロジックを更新
  - `src/server/shadow/generator.ts` の `generateShadowRecords()` を更新
  - レコードに存在するフィールドのみ処理
  - すべての型（string, number, boolean, datetime, array, object）をサポート
  - `__` プレフィックスを除外
  - スキーマ定義を使用しない
  - _要件: 3.1-3.9_

- [x] 6. Terraform設定を更新
  - `terraform/main.tf` を更新
  - `SHADOW_CONFIG` 環境変数を削除
  - `SHADOW_CREATED_AT_FIELD`, `SHADOW_UPDATED_AT_FIELD`, `SHADOW_STRING_MAX_BYTES`, `SHADOW_NUMBER_PADDING` を追加
  - `source_code_hash` から `shadow_config` を削除
  - _要件: 2.8-2.11_

- [x] 7. 廃止されたファイルを削除
  - 古いテストファイル `__tests__/server-shadow-config.test.ts` を削除
  - 古いテストファイル `__tests__/server-shadow-generator.test.ts` を削除
  - _要件: 1.1-1.4_

- [x] 8. 単体テストを追加
  - `src/server/shadow/__tests__/typeInference.test.ts` を作成
  - `src/server/shadow/__tests__/generator.test.ts` を作成
  - 型推論のテスト（string, number, boolean, datetime, array, object）
  - プリミティブ型切り詰めのテスト（100バイト）
  - 複合型切り詰めのテスト（200バイト）
  - 数値オフセット方式のテスト

- [x] 9. プロパティベーステストを追加
  - `src/server/shadow/__tests__/properties.test.ts` を作成
  - プリミティブ型切り詰めの正確性（100バイト以下）
  - 複合型切り詰めの正確性（200バイト以下）
  - 数値オフセット方式のソート順
  - マルチバイト文字の境界（プリミティブ型・複合型両方）
  - 自動シャドウ化の完全性（全型をカバー）

- [x] 10. ドキュメントを更新
  - `README.md` を更新
  - 環境変数ベースの設定方法を記載
  - レコードごとに独立したシャドウ生成を説明
  - すべての型（string, number, boolean, datetime, array, object）がサポートされることを明記
  - プリミティブ型は100バイト、複合型は200バイトで切り詰められることを説明
  - 仕様（フィールドがないレコードは結果に含まれない）を明記
  - _要件: 9.1-9.6_

- [x] 11. 統合テストを追加
  - `src/server/shadow/__tests__/integration.test.ts` を作成
  - 環境変数ベースの設定テスト
  - エンドツーエンドのシャドウ生成テスト
  - 異なる型のフィールドのソートテスト
  - 複合型のフィールド処理テスト
  - 長いフィールドの切り詰めテスト

- [x] 12. JSONフィールドの正規化を実装
  - `src/server/shadow/generator.ts` に `normalizeJson()` を実装
  - フィールドを正規化（id先頭、その他アルファベット順、createdAt/updatedAt末尾）
  - 配列内のオブジェクトも再帰的に正規化
  - ネストされたオブジェクトでも同じルールを適用
  - _要件: 8.1-8.6_

- [x] 13. JSON正規化のテストを追加
  - `src/server/shadow/__tests__/generator.test.ts` に正規化テストを追加
  - id が先頭に配置されることをテスト
  - createdAt, updatedAt が末尾に配置されることをテスト
  - その他のフィールドがアルファベット順になることをテスト
  - ネストされたオブジェクトの正規化をテスト
  - 配列内のオブジェクトの正規化をテスト

- [x] 14. 最終チェックポイント
  - ✅ すべてのテスト（275個）が通過
  - ✅ READMEにシャドウ設定のドキュメントを追加
  - ✅ 廃止されたファイルを削除（古いテストファイル、設定生成スクリプト）
