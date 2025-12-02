# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
