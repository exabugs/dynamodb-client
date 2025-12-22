# アーキテクチャドキュメント

## 概要

このドキュメントは、`@exabugs/dynamodb-client` の内部アーキテクチャと依存関係を説明します。

## 層構造

プロジェクトは以下の5つの層で構成されています：

```
integrations/  (最上位層)
    ↓
client/        (クライアント層)
    ↓
server/        (サーバー層)
    ↓
shadows/       (シャドウ管理層)
    ↓
shared/        (共通基盤層)
```

### 1. shared/ (共通基盤層)

**責任**: プロジェクト全体で使用される共通機能を提供

**含まれるもの**:
- 型定義 (`types/`)
- エラークラス (`errors/`)
- ユーティリティ (`utils/`)
- 定数 (`constants/`)

**依存関係**: なし（最下位層）

**エクスポート**:
- 共通型定義（Filter, UpdateOperators, etc.）
- エラークラス（AppError, ValidationError, etc.）
- ユーティリティ（createLogger, ulid, validation）
- 定数（HTTP_STATUS, DYNAMODB_LIMITS, etc.）

### 2. shadows/ (シャドウ管理層)

**責任**: DynamoDB Single-Table設計のシャドウレコード管理

**含まれるもの**:
- シャドウレコード生成 (`generator.ts`)
- シャドウ差分計算 (`differ.ts`)
- 型定義 (`types.ts`)

**依存関係**: 
- `shared/` のみ

**エクスポート**:
- シャドウ生成関数（generateShadowSK, formatFieldValue, etc.）
- 差分計算関数（calculateShadowDiff, isDiffEmpty, etc.）
- 型定義（ShadowFieldType, ShadowFieldConfig, etc.）

### 3. server/ (サーバー層)

**責任**: Lambda関数でのサーバーサイド処理

**含まれるもの**:
- CRUD操作 (`operations/`)
- クエリ処理 (`query/`)
- シャドウ統合 (`shadow/`)
- ユーティリティ (`utils/`)

**依存関係**: 
- `shared/`
- `shadows/`（シャドウレコード生成のため）

**エクスポート**:
- CRUD操作ハンドラー
- クエリ変換関数
- シャドウ設定管理

### 4. client/ (クライアント層)

**責任**: ブラウザ・Node.jsでのクライアントサイド処理

**含まれるもの**:
- Database クラス
- Collection クラス
- FindCursor クラス
- 認証ハンドラー（IAM, Cognito, Token）

**依存関係**: 
- `shared/` のみ

**エクスポート**:
- Database, Collection クラス
- 認証別エントリーポイント

### 5. integrations/ (最上位層)

**責任**: 外部ライブラリとの統合

**含まれるもの**:
- react-admin DataProvider

**依存関係**: 
- `shared/`
- `client/`

**エクスポート**:
- react-admin用DataProvider

## 依存関係の原則

### 1. 一方向依存

すべての依存関係は一方向です：

```
integrations → client → server → shadows → shared
```

### 2. 層の分離

- 各層は明確な責任を持つ
- 上位層は下位層に依存できるが、逆は禁止
- 同一層内での循環依存は禁止

### 3. 共通基盤の活用

- すべての層は `shared/` を使用可能
- 共通機能は `shared/` に集約

## ファイル構成

```
src/
├── shared/           # 共通基盤層
│   ├── types/        # 型定義
│   ├── errors/       # エラークラス
│   ├── utils/        # ユーティリティ
│   ├── constants/    # 定数
│   └── index.ts      # メインエクスポート
├── shadows/          # シャドウ管理層
│   ├── generator.ts  # シャドウ生成
│   ├── differ.ts     # 差分計算
│   ├── types.ts      # 型定義
│   └── index.ts      # エクスポート
├── server/           # サーバー層
│   ├── operations/   # CRUD操作
│   ├── query/        # クエリ処理
│   ├── shadow/       # シャドウ統合
│   ├── utils/        # ユーティリティ
│   ├── handler.ts    # Lambdaハンドラー
│   └── index.ts      # エクスポート
├── client/           # クライアント層
│   ├── Database.ts   # Databaseクラス
│   ├── Collection.ts # Collectionクラス
│   ├── FindCursor.ts # FindCursorクラス
│   ├── index.*.ts    # 認証別エントリー
│   └── index.ts      # 共通エクスポート
├── integrations/     # 最上位層
│   └── react-admin/  # react-admin統合
└── index.ts          # プロジェクトメインエクスポート
```

## 循環依存の検証

現在、循環依存は存在しません。以下の方法で検証できます：

```bash
# 依存関係の可視化（madgeが必要）
npx madge --circular src/

# TypeScriptコンパイラによる検証
npx tsc --noEmit
```

## 今後の拡張指針

### 新しい層の追加

新しい層を追加する場合は、以下の原則に従ってください：

1. **明確な責任**: 層の責任を明確に定義
2. **一方向依存**: 既存の依存関係を壊さない
3. **適切な配置**: 依存関係の順序に従って配置

### 機能の追加

新しい機能を追加する場合は、以下を確認してください：

1. **適切な層**: 機能が属する層を正しく選択
2. **依存関係**: 不要な依存関係を作らない
3. **共通化**: 共通機能は `shared/` に配置

## 参考

- [設計ドキュメント](../specs/dynamodb-client/design.md)
- [要件ドキュメント](../specs/dynamodb-client/requirements.md)