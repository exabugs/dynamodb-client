# 実装計画: OpenAPI駆動MCP開発への移行

## 概要

OpenAPI仕様を真実の情報源（SSOT）として確立し、MCPツール定義を自動生成する仕組みを構築します。実装は2段階で行います：

**第1段階**: 既存コードを分析し、完全なOpenAPI仕様を作成
**第2段階**: OpenAPI仕様からMCPツール定義を自動生成

## タスク

- [ ] 1. OpenAPI仕様の完全化
  - [ ] 1.1 既存コードの分析とパラメータ抽出
    - 既存の`src/mcp/tools/*.ts`を分析
    - 各操作のパラメータ、型、制約を抽出
    - ResourceName enumの値を確認
    - MongoDB演算子の一覧を確認
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 OpenAPI仕様ファイルの作成
    - `openapi-spec.yaml`をプロジェクトルートに作成
    - 基本構造（openapi, info, paths, components）を定義
    - _Requirements: 1.1_

  - [ ] 1.3 ResourceName enumの定義
    - `components/schemas/ResourceName`を定義
    - enum値: users, venues, events, participations, notifications
    - _Requirements: 2.1, 5.1_

  - [ ] 1.4 MongoDB演算子のスキーマ定義
    - `components/schemas/MongoDBOperators`を定義
    - 比較演算子: $eq, $ne, $gt, $gte, $lt, $lte
    - 配列演算子: $in, $nin
    - 文字列演算子: $regex
    - 地理演算子: $near（簡易形式のみ）
    - _Requirements: 2.2, 5.2_

  - [ ] 1.5 $near演算子の詳細定義
    - `components/schemas/NearOperator`を定義
    - 必須フィールド: latitude, longitude
    - オプションフィールド: maxDistance, minDistance
    - 型制約を定義（latitude: -90〜90, longitude: -180〜180）
    - _Requirements: 5.3_

  - [ ] 1.6 全CRUD操作の定義
    - 8つの操作（find, get, create, update, delete, createMany, updateMany, deleteMany）を定義
    - 各操作のoperationId, description, parameters, requestBody, responsesを記述
    - _Requirements: 2.1, 2.2, 2.3, 2.4_


- [ ] 2. MCPツール生成スクリプトの実装
  - [ ] 2.1 プロジェクト構造の準備
    - `scripts/`ディレクトリが存在することを確認
    - 必要な依存関係（yaml, fs, path）を確認
    - _Requirements: 3.1_

  - [ ] 2.2 OpenAPI Loaderの実装
    - `loadOpenAPISpec()`関数を実装
    - YAMLファイルの読み込みと解析
    - 必須フィールド（openapi, info, paths）の検証
    - エラーハンドリング（ファイル不在、YAML構文エラー、必須フィールド欠如）
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

  - [ ]* 2.3 OpenAPI Loaderのプロパティテスト
    - **Property 1: OpenAPI仕様の解析**
    - **Validates: Requirements 1.1**

  - [ ]* 2.4 OpenAPI Loaderのエラーハンドリングテスト
    - **Property 2: 無効なYAMLのエラーハンドリング**
    - **Property 3: 必須フィールドの検証**
    - **Validates: Requirements 1.2, 1.3**

  - [ ] 2.5 Operation Extractorの実装
    - `extractOperations()`関数を実装
    - `paths`オブジェクトからHTTPメソッドを抽出
    - operationId, description, parameters, requestBody, responsesを収集
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.6 Operation Extractorのプロパティテスト
    - **Property 4: ResourceName enumの抽出**
    - **Property 5: filterパラメータのスキーマ抽出**
    - **Property 6: requestBodyのスキーマ抽出**
    - **Property 7: responseスキーマの抽出**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 5.1**

  - [ ] 2.7 Schema Converterの実装
    - `convertParameters()`関数を実装
    - `convertRequestBody()`関数を実装
    - `mergeSchemas()`関数を実装
    - JSON Schema制約の保持（enum, pattern, minimum, maximum等）
    - _Requirements: 3.3, 3.4_

  - [ ]* 2.8 Schema Converterのプロパティテスト
    - **Property 10: パラメータからinputSchemaへの変換**
    - **Property 11: JSON Schema制約の保持**
    - **Validates: Requirements 3.3, 3.4**

  - [ ] 2.9 Tool Definition Generatorの実装
    - `generateTool()`関数を実装
    - `generateAllTools()`関数を実装
    - operationIdからツール名を生成
    - descriptionをツール説明として使用
    - inputSchemaを生成
    - _Requirements: 3.1, 3.2_

  - [ ]* 2.10 Tool Definition Generatorのプロパティテスト
    - **Property 8: operation数とツール数の一致**
    - **Property 9: descriptionの含有**
    - **Validates: Requirements 3.1, 3.2**

  - [ ] 2.11 MongoDB演算子の検証
    - 抽出されたスキーマに全演算子が含まれることを確認
    - $near演算子が簡易形式のみであることを確認
    - _Requirements: 5.2, 5.3_

  - [ ]* 2.12 MongoDB演算子のプロパティテスト
    - **Property 15: MongoDB演算子の網羅性**
    - **Property 16: $near演算子の簡易形式サポート**
    - **Validates: Requirements 5.2, 5.3**


  - [ ] 2.13 Code Generatorの実装
    - `generateCode()`関数を実装
    - `writeToFile()`関数を実装
    - 自動生成の警告コメントを追加
    - Import文を生成
    - tools配列をexport
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 2.14 Code Generatorのプロパティテスト
    - **Property 12: 有効なTypeScriptコードの生成**
    - **Property 13: 必要なimport文の含有**
    - **Property 14: tools配列のexport**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ] 2.15 メイン処理の実装
    - `main()`関数を実装
    - 各コンポーネントを統合
    - エラーハンドリングとログ出力
    - 成功時のメッセージ表示
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.16 エラーハンドリングのプロパティテスト
    - **Property 17: OpenAPIエラーの説明的ログ**
    - **Property 18: ファイルシステムエラーの適切な処理**
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 2.17 スクリプトの実行可能化
    - shebang (`#!/usr/bin/env tsx`) を追加
    - 実行権限を付与
    - _Requirements: 3.1_

- [ ] 3. Checkpoint - 基本機能の動作確認
  - すべてのテストが通過することを確認
  - 生成スクリプトが正常に動作することを確認
  - ユーザーに質問があれば確認

- [x] 4. 統合とテスト
  - [x] 4.1 生成されたMCPツール定義の検証
    - `src/mcp/tools/generated.ts`が正しく生成されることを確認
    - 既存のMCPツール定義と形式が一致することを確認
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 TypeScriptコンパイルの確認
    - 生成されたコードがコンパイルエラーなしでビルドできることを確認
    - _Requirements: 4.1_

  - [ ]* 4.3 統合テスト
    - OpenAPI仕様の更新 → 再生成 → 検証のフローをテスト
    - _Requirements: 7.1_

  - [ ]* 4.4 更新対応のプロパティテスト
    - **Property 19: 仕様更新時の再生成の一貫性**
    - **Property 20: operation追加時の新ツール生成**
    - **Property 21: operation削除時のツール非生成**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 5. ドキュメントとビルド設定
  - [x] 5.1 package.jsonスクリプトの追加
    - `generate-mcp-tools`スクリプトを追加
    - `tsx scripts/generate-mcp-tools.ts`を実行
    - _Requirements: 3.1_

  - [x] 5.2 READMEの更新
    - OpenAPI駆動開発のワークフローを説明
    - `npm run generate-mcp-tools`の使用方法を記載
    - OpenAPI仕様の更新方法を記載
    - _Requirements: 3.1_

  - [x] 5.3 生成ファイルの.gitignore設定
    - `src/mcp/tools/generated.ts`を.gitignoreに追加（オプション）
    - または、生成ファイルをコミットする方針を決定
    - _Requirements: 4.3_

- [x] 6. Final Checkpoint - 全体の動作確認
  - すべてのテストが通過することを確認
  - OpenAPI仕様の更新 → 生成 → ビルド → 実行のフローが正常に動作することを確認
  - ユーザーに最終確認


## 注意事項

### タスクの実行順序

- タスクは上から順に実行してください
- 各タスクは前のタスクの完了を前提としています
- `*`マークのタスクはオプション（プロパティテスト）ですが、実装を推奨します

### テストについて

- ユニットテストとプロパティテストの両方を実装します
- プロパティテストは`fast-check`ライブラリを使用します
- 各プロパティテストは最低100回実行します
- テストファイルは`tests/unit/`と`tests/property/`に配置します

### コード品質

- スクリプトは150行以内に収めます
- 関数は単一責任の原則に従います
- エラーハンドリングは説明的なメッセージを含めます
- TypeScriptの型安全性を最大限活用します

### 既存コードの保護

- 既存の`src/mcp/adapter.ts`や個別ツールファイルは変更しません
- 既存の実装は動作しているため、変更を加えません
- OpenAPI仕様のみを整備し、生成スクリプトを新規作成します

## 実装の優先順位

### Phase 1: 基本機能（必須）

タスク1〜3が該当します。これらは必ず実装してください。

### Phase 2: テストとドキュメント（推奨）

タスク4〜6が該当します。品質保証のため実装を推奨します。

### Phase 3: 最適化（オプション）

パフォーマンス最適化や詳細なログ出力は、基本機能が完成してから検討します。

## 成功基準

以下の条件を満たせば、このスペックは完了です：

1. ✅ OpenAPI仕様が完全に定義されている
2. ✅ MCPツール生成スクリプトが動作する
3. ✅ 生成されたMCPツール定義が既存と同じ形式である
4. ✅ すべてのテストが通過する
5. ✅ `npm run generate-mcp-tools`でツール定義を生成できる
6. ✅ ドキュメントが更新されている

## 参考情報

- 設計ドキュメント: `.kiro/specs/openapi-to-mcp-generator/design.md`
- 要件ドキュメント: `.kiro/specs/openapi-to-mcp-generator/requirements.md`
- 既存のMCPツール: `src/mcp/tools/*.ts`
- 既存のアダプター: `src/mcp/adapter.ts`
