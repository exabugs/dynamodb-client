# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
