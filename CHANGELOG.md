# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-01-02

### Added

- **GeoHash地理空間検索**: MongoDB互換の`$near`オペレータを実装
  - 自動GeoHash変換: `{latitude, longitude}`オブジェクトを自動検出してシャドウインデックス生成
  - 9ブロック検索: 中心 + 隣接8方向の合計9ブロックを検索して境界をまたぐ検索漏れを防止
  - 段階的精度緩和: precision 6→5→4と段階的に検索範囲を拡大
  - 距離計算・ソート: Haversine公式による正確な距離計算と自動ソート
  - `__distance`フィールド: 検索地点からの距離（メートル）を自動付与
  - `__geohash`フィールド: 検出されたGeoHashを自動付与
  - フィールド名非依存: `location`固定ではなく、任意のフィールド名を自動検出
  - 透過的実装: クライアントはGeoHashを意識せず、通常のオブジェクトとして扱える
  - 設定可能なパラメータ: `GeoHashConfig`で精度や反復回数をカスタマイズ可能

- **新しいユーティリティ関数**:
  - `isGeoCoordinates()`: 地理座標オブジェクトの自動検出
  - `encodeGeoHash()`: 緯度・経度からGeoHashを生成
  - `decodeGeoHash()`: GeoHashから緯度・経度を復元
  - `getNeighborGeoHashes()`: 隣接8方向のGeoHashを取得
  - `calculateDistance()`: Haversine公式による2点間の距離計算
  - `extractCoordinatesFromNearQuery()`: $nearクエリから座標を抽出
  - `extractMaxDistanceFromNearQuery()`: $nearクエリから最大距離を抽出
  - `extractMinDistanceFromNearQuery()`: $nearクエリから最小距離を抽出

- **新しい型定義**:
  - `GeoCoordinates`: 地理座標オブジェクト型
  - `NearQuery`: MongoDB互換の$nearクエリ型（GeoJSON形式と簡易形式をサポート）
  - `DocumentWithDistance`: 距離情報付きドキュメント型
  - `GeoHashConfig`: GeoHash検索の設定型
  - `DEFAULT_GEOHASH_CONFIG`: デフォルト設定定数

### Changed

- **シャドウレコード生成**: `generator.ts`を更新して地理座標の自動検出とGeoHashシャドウレコード生成を追加
  - シャドウインデックスは8文字精度（±19m）で保存
  - 検索は6文字精度（±610m）で開始し、段階的に緩和
  - 既存のシャドウ化機能（文字列フィールド等）と共存

### Dependencies

- **追加**: `ngeohash@^0.6.3` - GeoHashエンコード・デコードライブラリ
- **追加**: `@types/ngeohash@^0.6.8` - ngeohashの型定義

### Notes

- この機能は後方互換性があります。既存のコードは変更なしで動作します。
- GeoHash検索を使用するには、`{latitude, longitude}`オブジェクトを持つフィールドを作成するだけです。
- 詳細な使用方法は [GeoHash Search Guide](./docs/geohash-search.md) を参照してください。

## [1.1.2] - 2025-01-02

### Fixed

- **Parameter Store**: outputs.tfのパラメータ参照を修正
  - 古いパラメータ名（`app_records_api_url`, `lambda_records_function_arn`）から新しい名前（`infra_dynamodb_client_api_url`, `infra_dynamodb_client_api_arn`）に更新
  - v1.1.0で変更したパラメータ名に合わせてoutputsを修正

## [1.1.1] - 2025-01-02

### Fixed

- **Parameter Store**: DynamoDB Table ARNパラメータの作成を修正
  - `dynamodb_table_arn`をParameter Storeモジュールに渡すように修正
  - `/infra/dynamodb-table-arn`パラメータが正しく作成されるようになった

## [1.1.0] - 2025-01-02

### Changed

- **Parameter Store命名規則の統一**: すべてのパラメータを `/infra/` カテゴリに統一
  - `/infra/dynamodb-client-api-url` - DynamoDB Client API URL（旧: `/app/records-api-url`）
  - `/infra/dynamodb-client-api-arn` - Lambda ARN（旧: `/lambda/records-function-arn`）
  - `/infra/dynamodb-table-name` - DynamoDB Table Name
  - `/infra/dynamodb-table-arn` - DynamoDB Table ARN（新規追加）
  - dynamodb-clientは**インフラ基盤**を提供するライブラリとして、すべて「インフラ情報」カテゴリに統一

### Breaking Changes

- Parameter Storeのパラメータ名が変更されました
  - 既存プロジェクトは新しいパラメータ名に移行する必要があります
  - 詳細は [Parameter Store Migration Guide](./docs/parameter-store-migration.md) を参照

## [1.0.3] - 2025-12-31

### Fixed

- **型安全性の向上**: `ParsedFilterField`の型定義を修正
  - `find/types.ts`の重複した型定義を削除し、`filter.ts`からインポート
  - `operator`フィールドを`string`型から`FilterOperator`型に変更
  - TypeScriptコンパイラが`$`プレフィックスなしの演算子を検出できるように修正

- **ID最適化クエリ**: `$eq`演算子の比較を修正
  - `idQuery.ts`で演算子比較が`'eq'`（`$`なし）になっていた問題を修正
  - `getOne`操作で単一レコードが正しく取得できるように修正
  - react-admin詳細画面が正常に動作するように修正

- **シャドウクエリ**: `$`プレフィックス付き演算子に統一
  - `shadowQuery.ts`のswitch文で`'eq'`, `'gt'`, `'gte'`, `'lt'`, `'lte'`を`'$eq'`, `'$gt'`, `'$gte'`, `'$lt'`, `'$lte'`に修正
  - すべてのクエリ最適化で一貫して`$`プレフィックス付き演算子を使用

## [1.0.2] - 2025-12-31

### Changed

- **BREAKING**: フィルター演算子を `$` プレフィックス必須に統一
  - `FilterOperator` 型を `$eq`, `$ne`, `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$starts`, `$ends`, `$contains`, `$exists` に変更
  - すべてのサーバー側フィルター処理で `$` プレフィックスを標準とする
  - `$` なしの演算子はエラーとして扱う（明確なエラーメッセージ）
  - MongoDB互換性を完全に保証

### Fixed

- **サーバーサイドフィルター処理**: `$` プレフィックス付き演算子を正しく処理
  - `find` 操作で `{ id: { $in: [...] } }` 形式のフィルターが正常に動作
  - react-admin統合からのフィルターが正常に動作
  - 一貫性のある演算子処理（モンキーパッチなし）

## [1.0.1] - 2025-12-31

### Fixed

- **react-admin統合**: `convertFilter`関数が演算子に`$`プレフィックスを追加するように修正
  - react-adminから送信される`{id: {in: [...]}}`を`{id: {$in: [...]}}`に自動変換
  - `update`、`delete`、`getList`、`getManyReference`操作で正しくフィルタが適用されるように修正
  - dynamodb-client 1.0.0のMongoDB互換性向上に対応

## [1.0.0] - 2025-01-01

### BREAKING CHANGES

- **MongoDB互換性向上**: すべての操作オペレータに `$` プレフィックスを追加
  - **フィルタ演算子**: `eq` → `$eq`, `gt` → `$gt`, `gte` → `$gte`, `lt` → `$lt`, `lte` → `$lte`, `in` → `$in`, `nin` → `$nin`, `exists` → `$exists`, `regex` → `$regex`, `ne` → `$ne`
  - **更新演算子**: `set` → `$set`, `unset` → `$unset`, `inc` → `$inc`
  - **論理演算子**: `and` → `$and`, `or` → `$or`
  - MongoDBの公式ドキュメントと完全に一致する構文を採用
  - TypeScriptコンパイラが自動的にエラーを検出するため、移行は比較的容易

### Migration Guide

v0.xからv1.0.0へのアップグレードには、既存コードの更新が必要です。詳細なマイグレーションガイドは [docs/MIGRATION_v1.md](./docs/MIGRATION_v1.md) を参照してください。

**主な変更点**:

```typescript
// v0.x（旧）
collection.find({ age: { gte: 18 } });
collection.updateOne({ id: '123' }, { set: { name: 'John' } });

// v1.0.0（新）
collection.find({ age: { $gte: 18 } });
collection.updateOne({ id: '123' }, { $set: { name: 'John' } });
```

**自動マイグレーション**:

```bash
# 一括置換（推奨）
find src -name "*.ts" -type f -exec sed -i '' \
  -e 's/{ eq:/{ $eq:/g' \
  -e 's/{ gt:/{ $gt:/g' \
  -e 's/{ gte:/{ $gte:/g' \
  -e 's/{ lt:/{ $lt:/g' \
  -e 's/{ lte:/{ $lte:/g' \
  -e 's/{ in:/{ $in:/g' \
  -e 's/{ nin:/{ $nin:/g' \
  -e 's/{ exists:/{ $exists:/g' \
  -e 's/{ regex:/{ $regex:/g' \
  -e 's/{ ne:/{ $ne:/g' \
  -e 's/{ set:/{ $set:/g' \
  -e 's/{ unset:/{ $unset:/g' \
  -e 's/{ inc:/{ $inc:/g' \
  -e 's/{ and:/{ $and:/g' \
  -e 's/{ or:/{ $or:/g' \
  {} +
```

### Benefits

- **MongoDB互換性**: MongoDBの公式ドキュメントと完全に一致
- **学習コスト削減**: MongoDB経験者が即座に使用可能
- **エコシステム統合**: MongoDB関連ツールとの統合が容易
- **明確な意図**: `$` プレフィックスにより演算子であることが明確
- **将来の拡張性**: MongoDB互換の新しい演算子を追加しやすい

### Changed

- **型定義**: `FilterOperators`, `UpdateOperators`, `Filter` 型を更新
- **サーバー側**: クエリ変換と更新演算子処理を更新
- **クライアント側**: `Collection` と `FindCursor` の実装を更新
- **react-admin統合**: データプロバイダーを更新
- **テスト**: すべてのテストケース（314件）を更新し、全テストが通過

### Documentation

- **マイグレーションガイド**: 詳細な移行手順を `docs/MIGRATION_v1.md` に追加
- **APIリファレンス**: `docs/API.md` のオペレータ一覧を更新
- **使用例**: すべてのコード例を新しい構文に更新

## [0.9.3] - 2024-12-31

### Fixed

- **Lambda Handler**: Improved CORS and error handling
  - Simplified CORS preflight handling with dedicated `createCorsResponse` function
  - Improved error response structure with consistent CORS headers
  - Enhanced error logging with request context
  - Better separation of concerns between response builders and error handlers

## [0.9.2] - 2024-12-31

### Fixed

- **Parameter Converter**: Improved code formatting and maintainability
  - Refactored multi-line ternary operators to single-line format for better readability
  - Enhanced `convertUpdateOneParams` and `convertUpdateManyParams` to properly pass through `options` parameter
  - Ensures upsert options are correctly propagated from MongoDB-style API to internal operations
  - No functional changes - purely code quality improvements

## [0.9.1] - 2024-12-30

### Fixed

- **Filter Operator Support**: Added support for `in`, `nin`, `contains`, and `exists` operators
  - Updated `FilterOperator` type to include all supported operators
  - Enhanced `parseFilters` function to support nested object filter syntax: `{ id: { in: [...] } }`
  - Added `contains` and `exists` operator handling in `matchesAllFilters` function
  - Fixed react-admin integration: `getMany` operation now works correctly with `in` operator
  - Backward compatible: Both filter syntaxes are supported (`"id:in"` and `{ id: { in: [...] } }`)

## [0.9.0] - 2024-12-29

### Added

- **Upsert Option for updateOne/updateMany**: MongoDB-compatible upsert functionality
  - Added `UpdateOneOptions` and `UpdateManyOptions` types with `upsert` boolean option
  - Added `upsertedId` field to `UpdateResult` type (set when a new document is created via upsert)
  - Server-side implementation: `handleUpsertCreate` and `handleUpsertUpdate` functions
  - Client-side implementation: Third parameter (options) for `updateOne` and `updateMany` methods
  - Automatic timestamp management: `createdAt` and `updatedAt` are automatically set on upsert
  - Automatic shadow record generation: Shadow records are created/updated during upsert operations
  - Comprehensive test coverage: Unit tests and integration tests for upsert functionality
  - Complete documentation: API reference, usage examples, and migration guide in `docs/API.md`

### Changed

- **API Enhancement**: `updateOne` and `updateMany` methods now accept an optional third parameter for options
  - Backward compatible: Existing code continues to work without changes
  - Default behavior unchanged: `upsert` defaults to `false`

### Documentation

- **API Reference**: Updated `docs/API.md` with detailed upsert option documentation
  - Added UpdateOneOptions and UpdateManyOptions type definitions
  - Added UpdateResult.upsertedId field explanation
  - Added practical usage examples for upsert operations
  - Added migration guide from v0.3.x to v0.4.x
  - Added FAQ section for common upsert questions

## [0.8.1] - 2025-12-28

### Fixed

- **Terraform Outputs**: Removed deleted Cognito parameters from parameter-store module outputs
  - Removed `cognito_user_pool_id`, `cognito_client_id`, `cognito_domain` from outputs.tf
  - These parameters were removed in v0.8.0 but outputs.tf was not updated
  - Fixes Terraform validation errors in consuming projects

## [0.8.0] - 2025-12-28

### BREAKING CHANGES

- **Removed asanowa-specific parameters for library generalization**
  - Removed `cognito_client_id` parameter (aud verification not needed for generic library)
  - Removed `cognito_admin_ui_client_id` parameter (asanowa-specific, moved to project-specific configuration)
  - Removed `cognito_user_pool_domain` parameter (OAuth flow specific, not needed for JWT verification)
  - Removed `COGNITO_CLIENT_ID` environment variable from Records Lambda
  - Removed `COGNITO_REGION` environment variable (redundant, extracted from user pool ID)
  - Removed Admin UI Cognito parameters from Parameter Store module (asanowa-specific)

### Migration Guide

If your project was using the removed parameters:

1. **cognito_client_id**: Remove from module call. JWT verification now works without aud validation for better generalization.
2. **cognito_admin_ui_client_id** and **cognito_user_pool_domain**: Move these to your project-specific Parameter Store configuration.
3. **COGNITO_REGION**: No longer needed. Region is automatically extracted from `cognito_user_pool_id`.

### What remains

- `cognito_user_pool_id`: Still required for JWT signature verification (JWKS endpoint construction)

## [0.7.5] - 2025-12-28

### Removed

- **All KMS Settings Verification**: Removed all KMS-related settings to verify if they were actually necessary
  - Removed `aws_iam_role_policy.records_kms_default` IAM policy resource (Lambda execution environment)
  - Removed `aws_iam_role_policy.records_kms` IAM policy resource (Parameter Store access)
  - Removed `kms_key_arn = ""` setting from Lambda function
  - Current Lambda function uses only environment variables, not Parameter Store SecureString
  - This is part of ADR-005 verification to determine the true cause of Lambda Function URL issues

## [0.7.4] - 2025-12-28

### Fixed

- **Lambda KMS Encryption**: Disabled KMS encryption for Lambda function to resolve persistent KMSAccessDeniedException (ADR-004)
- **Lambda Startup**: Fixed Lambda function startup failure by explicitly setting `kms_key_arn = ""`
- **502 Bad Gateway**: Resolved Function URL errors caused by Lambda execution environment KMS issues

### Changed

- **Security Model**: Moved from KMS-encrypted Lambda environment to unencrypted for compatibility
- **ADR-003 Deprecated**: Replaced complex KMS permission approach with simpler encryption disable approach

### Technical

- **Terraform**: Added `kms_key_arn = ""` to Lambda function configuration
- **Architecture Decision**: Created ADR-004 to document KMS encryption disable decision

## [0.7.3] - 2025-12-28

### Fixed

- **Lambda KMS Access**: Added AWS default KMS key access permissions for Lambda execution environment (ADR-003)
- **KMSAccessDeniedException**: Resolved Lambda startup failure due to missing KMS permissions
- **Lambda Runtime**: Added conditional access to default KMS key used by Lambda service for function protection

### Security

- **KMS Permissions**: Limited KMS access to Lambda service only with conditional access control
- **Least Privilege**: Maintained security with service-specific KMS access restrictions

## [0.7.2] - 2024-12-28

### Fixed

- **Parameter Store**: Added overwrite=true to all SSM parameters to handle existing parameters
  - Prevents ParameterAlreadyExists errors during Terraform apply
  - Allows updating existing Parameter Store values without manual deletion

## [0.7.1] - 2024-12-28

### Fixed

- **CORS**: Removed OPTIONS method from allowMethods to comply with AWS Lambda Function URL constraints
  - AWS Lambda Function URL has a 6-character limit per method name
  - OPTIONS (7 characters) exceeded this limit causing ValidationException
  - Preflight OPTIONS requests are handled automatically by Lambda Function URL

## [0.7.0] - 2024-12-28

### Added

- **Terraform**: KMS access policy for Parameter Store integration
  - Lambda functions can now decrypt SecureString environment variables
  - Added `kms:Decrypt` permission with SSM service condition
  - Enables secure configuration management through Parameter Store

### Changed

- **CORS**: Expanded CORS configuration for comprehensive API support
  - Added support for GET, PUT, DELETE, and OPTIONS methods
  - Previously only supported POST method
  - Enables full REST API functionality for react-admin integration

### Improved

- **Infrastructure**: Enhanced Lambda function permissions and dependencies
  - Added proper dependency management for KMS policy
  - Improved security with least-privilege access patterns

## [0.5.0] - 2024-12-23

### Added

- 包括的なAPIリファレンスドキュメント (`docs/API.md`)
  - 3つの認証方式（IAM、Cognito、Token）の詳細な説明
  - すべてのクライアントAPIメソッドの完全な仕様
  - 型定義（Filter、UpdateOperators、結果型）の詳細
  - react-admin統合の使用方法
  - エラーハンドリングとベストプラクティス
- コントリビューションガイド (`CONTRIBUTING.md`)
  - 開発環境のセットアップから本番リリースまでの完全なワークフロー
  - TypeScript、命名規則、JSDocコメントのコーディング規約
  - AAA パターンに基づくテストガイドライン
  - Conventional Commitsに基づくコミットメッセージ規約
- セキュリティポリシー (`SECURITY.md`)
  - GitHub Security Advisoriesを使用した脆弱性報告手順
  - 責任ある開示プロセスと協調的開示タイムライン
  - 開発者・利用者向けのセキュリティベストプラクティス

### Changed

- アーキテクチャリファクタリングによるコード構造の改善
  - 共通モジュールの抽出 (`src/shared/` ディレクトリ構造)
  - 大きな関数の分割（handler.ts ~520行 → 複数モジュール）
  - コードの重複排除と共通定数の統一
  - エラーハンドリングとログ記録の標準化
- 依存関係管理と循環依存の解決

### Improved

- コードの可読性と保守性の向上
- 単一責任原則に基づく関数分割（50行制限）
- 3回以上繰り返されるコードの共通関数化
- エラーコード列挙型の拡張

## [0.4.1] - 2024-12-23

### Fixed

- **Package**: Removed obsolete `bin` field for `generate-shadow-config`
  - CLI tool was removed in v0.3.2 but bin field was not removed from package.json
  - Eliminates pnpm warning about missing generate-shadow-config.js file
  - No functional changes - purely cleanup

## [0.4.0] - 2024-12-23

### Changed

- **Architecture**: Major architecture refactoring for improved maintainability
  - Extracted shared modules to `src/shared/` directory structure
  - Organized dependencies and eliminated circular dependencies
  - Split large functions into modular components following single responsibility principle
  - Improved code organization with clear 5-layer architecture: integrations → client → server → shadows → shared

### Improved

- **Code Quality**: Enhanced maintainability and readability
  - Split `handleFind` function (429 lines) into focused, testable modules
  - Created unified error hierarchy and common utilities
  - Standardized import paths and reduced code duplication
  - Added architecture documentation and dependency validation tests

### Technical

- **Dependencies**: Established clear dependency direction without circular references
- **Testing**: All 266 tests continue to pass with improved architecture
- **Documentation**: Added comprehensive architecture documentation
- **Package**: Removed obsolete `bin` field for `generate-shadow-config` CLI tool

## [0.3.7] - 2024-12-19

### Removed

- **BREAKING CHANGE**: Complete removal of legacy shadow configuration support
  - Removed `LegacyShadowConfig` and `ResourceShadowConfig` types from shadows module
  - Removed duplicate shadow configuration types from server module
  - Removed all shadow.config.json file support
  - Only v0.3.x environment variable-based configuration is now supported

### Changed

- Simplified type exports to only include v0.3.x specification types
- Updated documentation to reflect complete v0.3.x migration
- Consolidated shadow configuration to single source (environment variables)

### Migration Guide

- Replace any usage of `ResourceShadowConfig` or `LegacyShadowConfig` with environment variables
- Use `SHADOW_CREATED_AT_FIELD`, `SHADOW_UPDATED_AT_FIELD`, `SHADOW_STRING_MAX_BYTES`, `SHADOW_NUMBER_PADDING`
- Remove any shadow.config.json files from your project

## [0.3.6] - 2024-12-02

### Changed

- **Shadow Records**: Exclude `id` field from shadow record generation
  - `id` field no longer generates a shadow record
  - Main record (`SK = id#{ULID}`) is used for id-based sorting
  - Reduces redundant shadow records and improves performance
  - `find()` operation already optimized to use main records for id sorting

## [0.3.5] - 2024-12-02

### Changed

- **Shadow Records**: Removed `data` field from shadow records
  - Shadow records now only contain `PK` and `SK` fields
  - Record ID is extracted from `SK` (format: `{field}#{value}#id#{recordId}`)
  - Reduces storage cost and simplifies data structure
  - No functional changes - ID extraction logic remains the same

## [0.3.4] - 2024-12-02

### Removed

- **Metadata**: Removed internal metadata fields from records
  - Removed `__shadowKeys` field (no longer needed with auto-shadow)
  - Removed `__configVersion` field (no config file to track)
  - Removed `__configHash` field (no config file to track)
  - Records are now cleaner and contain only user data
- **Terraform**: Removed `shadow_config` output from Terraform module
  - No longer needed with environment variable-based configuration

## [0.3.3] - 2024-12-02

### Fixed

- **Types**: Made `shadows` property optional in `ResourceSchema` interface
  - Allows schemas without `shadows.sortableFields` definition
  - Maintains backward compatibility with v0.2.x schemas
  - All fields are automatically shadowed in v0.3.x

## [0.3.2] - 2024-12-02

### Changed

- **Shadow Configuration**: Simplified shadow configuration (auto-shadow simplification)
  - Removed `shadow.config.json` file requirement
  - Removed `generate-shadow-config` CLI tool
  - All fields are now automatically shadowed without configuration
  - Simplified package structure and build process

## [0.3.1] - 2024-12-02

### Fixed

- **Build**: Fixed TypeScript compilation errors
  - Fixed syntax errors in timestamps.ts and validation.ts
  - Updated ShadowConfig type imports
  - Removed unused getResourceSchema calls
- **ESLint**: Fixed ESLint parsing errors for test files
  - Added separate ESLint configuration for test files
  - Configured `project: false` for test files excluded from tsconfig.json

## [0.3.0] - 2024-12-01

### Added

- **Shadow Configuration**: Automatic field detection for all record types
  - Support for 6 field types: string, number, boolean, datetime, array, object
  - Automatic shadow generation for all fields in each record
  - Environment variable-based configuration (4 variables)
  - Comprehensive test suite (275 tests)
  - Updated documentation with new configuration guide

### Changed

- **Shadow Configuration**: Simplified configuration management
  - Replaced JSON configuration files with environment variables
  - `SHADOW_CREATED_AT_FIELD` (default: `createdAt`)
  - `SHADOW_UPDATED_AT_FIELD` (default: `updatedAt`)
  - `SHADOW_STRING_MAX_BYTES` (default: `100`)
  - `SHADOW_NUMBER_PADDING` (default: `15`)
  - Primitive types truncated at 100 bytes
  - Complex types (array/object) truncated at 200 bytes
  - Number range: -10^15 to +10^15

### Removed

- **Shadow Configuration**: Removed schema-based configuration
  - No longer requires `shadow.config.json` files
  - No longer requires schema definitions for shadow fields
  - Removed `generate-shadow-config` script
  - Records are now independent and self-contained

### Breaking Changes

- **Shadow Configuration**: Configuration method has changed
  - Old: JSON configuration files with schema definitions
  - New: Environment variables with automatic field detection
  - Migration: Set environment variables and remove JSON config files
  - All fields are now automatically shadowed (no schema required)

## [0.2.2] - 2024-12-01

### Added

- **Types**: Export `ResultBase` and `InputBase` from `@exabugs/dynamodb-client/client`
  - `ResultBase`: Base interface for document results (with required `id` field)
  - `InputBase`: Base interface for document inputs (with optional `id` field)
  - Allows users to extend `ResultBase` for type-safe collection definitions
  - Improves type safety when defining custom document interfaces

### Changed

- **Client**: Updated `client/index.ts` to export base types
  - `export { Collection, type InputBase, type ResultBase } from './Collection.js'`

## [0.2.1] - 2025-01-19

### Fixed

- **Server**: Removed `database` field validation from Lambda handler
  - Fixed runtime error: "Missing required field: database"
  - `MongoDBStyleRequest` interface no longer includes `database` field
  - `parseRequestBody()` function no longer validates `database` field
  - Completes the v0.2.0 breaking change implementation

### Added

- **Tests**: Added comprehensive unit tests for Lambda handler
  - Request body parsing tests (7 tests)
  - MongoDB-style API operation tests (8 tests)
  - v0.2.0 breaking change verification tests (2 tests)
  - CORS and method validation tests (2 tests)
  - Authentication header validation tests (2 tests)
  - Total: 21 new tests to prevent regression

## [0.2.0] - 2024-12-01

### Changed

- **BREAKING**: Removed `databaseName` parameter from all APIs
  - `DynamoClient.db()` no longer requires a database name argument
  - `createDataProvider()` no longer requires `databaseName` option
  - `Database` class no longer stores or uses database name
  - `Collection` and `FindCursor` no longer include database name in requests
  - Simplified architecture: DynamoDB table is 1:1 with Lambda function
  - For multi-tenant use cases, use separate DynamoDB tables instead

### Migration Guide

**Before (v0.1.x):**

```typescript
const client = new DynamoClient(apiUrl);
await client.connect();
const db = client.db('myapp');
const collection = db.collection('users');

const dataProvider = createDataProvider({
  apiUrl: 'https://...',
  databaseName: 'myapp',
  tokenProvider,
});
```

**After (v0.2.0):**

```typescript
const client = new DynamoClient(apiUrl);
await client.connect();
const db = client.db();
const collection = db.collection('users');

const dataProvider = createDataProvider({
  apiUrl: 'https://...',
  tokenProvider,
});
```

## [0.1.2] - 2024-11-30

### Added

- Boolean type support for shadow fields
  - Added `'boolean'` to `ShadowFieldType`
  - Added `formatBoolean()` function for boolean value formatting
  - Boolean values are formatted as `'true'` or `'false'` strings
  - Full test coverage for boolean shadow records

### Changed

- Updated `formatFieldValue()` to handle boolean type
- Updated `generateShadowSK()` to support boolean values
- Exported `formatBoolean` from shadows module

## [0.1.0] - 2024-11-29

### Added

- Initial release of @exabugs/dynamodb-client
- MongoDB-like API for DynamoDB Single-Table Design
- Shadow Records for efficient sorting and querying
- Multiple authentication methods:
  - IAM authentication for server-side
  - Cognito authentication for web applications
  - Token authentication for custom scenarios
- Lambda function implementation with Function URL support
- react-admin integration for admin UIs
- Terraform modules for infrastructure deployment
- Comprehensive TypeScript support
- Full test coverage with Vitest

### Features

- **Client SDK**: DynamoDB operations with MongoDB-like API
  - `insertOne`, `insertMany`
  - `findOne`, `find` with cursor support
  - `updateOne`, `updateMany`
  - `deleteOne`, `deleteMany`
- **Server Implementation**: Lambda handler for serverless deployments
- **Shadow Records**: Automatic generation and management for sorting
- **Advanced Filtering**: 7 operators (eq, lt, lte, gt, gte, starts, ends)
- **Bulk Operations**: Automatic chunking for large datasets
- **TTL Support**: Automatic data expiration

[Unreleased]: https://github.com/exabugs/dynamodb-client/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/exabugs/dynamodb-client/releases/tag/v0.1.0
