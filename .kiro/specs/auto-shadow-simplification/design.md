# 設計書: 自動シャドウ化の簡素化

## 概要

本機能は、現在のJSON設定ファイルベースのシャドウ管理を廃止し、**レコードごとに独立したシャドウ生成**に移行します。各レコードは、そのレコードに実際に存在するプリミティブ型フィールドのみを自動的にシャドウ化します。

### 主要な変更点

1. **JSON設定ファイルの廃止**: `shadow.config.json` を削除
2. **環境変数ベースの設定**: Terraform経由で2つの環境変数を設定（文字列切り詰め、数値パディング）
3. **レコードごとに独立**: 各レコードは自分が持つフィールドのみシャドウ化
4. **自動型推論**: 実行時にフィールド値から型を自動判定
5. **文字列切り詰め**: 先頭100バイト（UTF-8）まで
6. **数値オフセット方式**: 負数対応の20桁ゼロパディング
7. **メンテナンス不要**: レコードが独立しているため、シャドウ再生成メンテナンスは不要

### 重要な仕様

**ソート時に存在しないフィールドでソートした場合、そのフィールドを持たないレコードは結果に含まれません。** これは仕様として受け入れます。

## アーキテクチャ

### 現在のアーキテクチャ

```
┌─────────────────────────────────────────┐
│ packages/api-types/src/schema.ts        │
│ - SchemaRegistryConfig                  │
│ - ArticleSchema, TaskSchema             │
│ - shadows.sortableFields (手動設定)    │
└──────────────┬──────────────────────────┘
               │
               ↓ pnpm build
┌─────────────────────────────────────────┐
│ generate-shadow-config CLI              │
│ - スキーマから shadow.config.json 生成 │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ packages/api-types/shadow.config.json   │
│ - リソースごとのソート可能フィールド   │
│ - デフォルトソート設定                  │
└──────────────┬──────────────────────────┘
               │
               ↓ Terraform (base64エンコード)
┌─────────────────────────────────────────┐
│ Lambda環境変数: SHADOW_CONFIG           │
│ - base64エンコードされたJSON            │
└──────────────┬──────────────────────────┘
               │
               ↓ Lambda起動時
┌─────────────────────────────────────────┐
│ src/server/shadow/config.ts             │
│ - getShadowConfig()                     │
│ - getResourceSchema()                   │
└─────────────────────────────────────────┘
```

### 新しいアーキテクチャ

```
┌─────────────────────────────────────────┐
│ Terraform (infra/main.tf)               │
│ - SHADOW_CREATED_AT_FIELD = "createdAt" │
│ - SHADOW_UPDATED_AT_FIELD = "updatedAt" │
│ - SHADOW_STRING_MAX_BYTES = "100"       │
│ - SHADOW_NUMBER_PADDING   = "20"        │
└──────────────┬──────────────────────────┘
               │
               ↓ Lambda環境変数
┌─────────────────────────────────────────┐
│ Lambda起動時                            │
│ - 環境変数から設定を読み込み           │
│ - グローバル変数にキャッシュ           │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ src/server/shadow/config.ts (新)        │
│ - getShadowConfig()                     │
│   - 環境変数から設定を構築             │
│   - デフォルト値を適用                 │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ src/server/shadow/generator.ts (更新)   │
│ - generateShadowRecords()               │
│   - 全プリミティブ型を自動シャドウ化   │
│   - 文字列切り詰め (100バイト)         │
│   - 数値オフセット方式 (20桁)          │
└─────────────────────────────────────────┘
```

## コンポーネントと インターフェース

### 1. 環境変数設定（Terraform）

**ファイル**: `terraform/main.tf`

```hcl
resource "aws_lambda_function" "records" {
  # source_code_hash から shadow_config を削除
  source_code_hash = data.archive_file.lambda_records.output_base64sha256
  
  environment {
    variables = {
      # 既存の環境変数（変更なし）
      ENV                  = var.environment
      REGION               = var.region
      TABLE_NAME           = var.dynamodb_table_name
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      COGNITO_CLIENT_ID    = var.cognito_client_id
      COGNITO_REGION       = var.region
      LOG_LEVEL            = var.log_level
      
      # 新規のシャドウ設定
      SHADOW_CREATED_AT_FIELD = "createdAt"
      SHADOW_UPDATED_AT_FIELD = "updatedAt"
      SHADOW_STRING_MAX_BYTES = "100"
      SHADOW_NUMBER_PADDING   = "20"
    }
  }
}
```

### 2. 設定管理（更新）

**ファイル**: `src/server/shadow/config.ts`

```typescript
/**
 * シャドウ設定（簡素化版）
 */
export interface ShadowConfig {
  /** タイムスタンプフィールド名 */
  createdAtField: string;
  updatedAtField: string;
  /** 文字列の最大バイト数 */
  stringMaxBytes: number;
  /** 数値のパディング桁数 */
  numberPadding: number;
}

/**
 * グローバル変数にキャッシュ
 */
let cachedShadowConfig: ShadowConfig | null = null;

/**
 * シャドウ設定を取得（環境変数から）
 */
export function getShadowConfig(): ShadowConfig {
  if (!cachedShadowConfig) {
    cachedShadowConfig = {
      createdAtField: process.env.SHADOW_CREATED_AT_FIELD || 'createdAt',
      updatedAtField: process.env.SHADOW_UPDATED_AT_FIELD || 'updatedAt',
      stringMaxBytes: parseInt(process.env.SHADOW_STRING_MAX_BYTES || '100', 10),
      numberPadding: parseInt(process.env.SHADOW_NUMBER_PADDING || '20', 10),
    };
    
    // バリデーション
    if (cachedShadowConfig.stringMaxBytes <= 0) {
      throw new Error('SHADOW_STRING_MAX_BYTES must be positive');
    }
    if (cachedShadowConfig.numberPadding <= 0 || cachedShadowConfig.numberPadding > 38) {
      throw new Error('SHADOW_NUMBER_PADDING must be between 1 and 38');
    }
  }
  
  return cachedShadowConfig;
}
```

### 3. 型推論（新規）

**ファイル**: `src/server/shadow/typeInference.ts`

```typescript
/**
 * フィールド値から型を推論する
 */
export function inferFieldType(value: unknown): ShadowFieldType | null {
  // null/undefined は除外
  if (value === null || value === undefined) {
    return null;
  }
  
  // __ プレフィックスは除外（内部メタデータ）
  // この関数はフィールド名をチェックしないため、呼び出し側で判定
  
  // 型判定
  if (typeof value === 'string') {
    // ISO 8601形式の日時文字列かチェック
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'datetime';
    }
    return 'string';
  }
  
  if (typeof value === 'number') {
    return 'number';
  }
  
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  
  // array型
  if (Array.isArray(value)) {
    return 'array';
  }
  
  // object型
  if (typeof value === 'object') {
    return 'object';
  }
  
  return null;
}

/**
 * レコードから自動的にシャドウ可能なフィールドを抽出する
 */
export function extractShadowableFields(
  record: Record<string, unknown>
): Record<string, ShadowFieldType> {
  const fields: Record<string, ShadowFieldType> = {};
  
  for (const [key, value] of Object.entries(record)) {
    // __ プレフィックスは除外
    if (key.startsWith('__')) {
      continue;
    }
    
    // 型推論
    const type = inferFieldType(value);
    if (type) {
      fields[key] = type;
    }
  }
  
  return fields;
}
```

### 4. シャドウレコード生成（更新）

**ファイル**: `src/server/shadow/generator.ts`

```typescript
/**
 * 文字列を先頭Nバイトまで切り詰める（UTF-8）
 */
export function truncateString(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  
  if (bytes.length <= maxBytes) {
    return value;
  }
  
  // マルチバイト文字の境界を考慮して切り詰め
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let truncated = decoder.decode(bytes.slice(0, maxBytes));
  
  // 不完全な文字を削除
  truncated = truncated.replace(/[\uFFFD]$/, '');
  
  return truncated;
}

/**
 * 数値をオフセット方式でゼロパディング
 * 
 * 範囲: -10^20 ～ +10^20
 * オフセット: 10^20
 * 
 * 例:
 * -99999 → "09999999999999900001"
 * 0      → "10000000000000000000"
 * 99999  → "10000000000000099999"
 */
export function formatNumberWithOffset(value: number, padding: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number value: ${value}`);
  }
  
  // 範囲チェック
  const maxValue = Math.pow(10, padding);
  if (value < -maxValue || value >= maxValue) {
    throw new Error(`Number ${value} is out of range (-10^${padding} to 10^${padding})`);
  }
  
  // オフセットを加算
  const offset = maxValue;
  const adjusted = Math.floor(value) + offset;
  
  // ゼロパディング（padding + 1桁）
  return adjusted.toString().padStart(padding + 1, '0');
}

/**
 * フィールド値を型に応じてフォーマットする（更新版）
 */
export function formatFieldValue(
  type: ShadowFieldType,
  value: unknown,
  config: ShadowConfig
): string {
  switch (type) {
    case 'string': {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      const truncated = truncateString(str, config.stringMaxBytes);
      return escapeString(truncated);
    }
    case 'number':
      return formatNumberWithOffset(value as number, config.numberPadding);
    case 'datetime':
      return formatDatetime(value as string | Date);
    case 'boolean':
      return formatBoolean(value as boolean);
    case 'array':
    case 'object': {
      // JSON文字列化して2倍のバイト制限で切り詰め
      const normalized = normalizeJson(value);
      const jsonStr = JSON.stringify(normalized);
      const maxBytes = config.stringMaxBytes * 2;
      const truncated = truncateString(jsonStr, maxBytes);
      return escapeString(truncated);
    }
    default:
      throw new Error(`Unknown shadow field type: ${type}`);
  }
}

/**
 * レコードからシャドウレコードを自動生成する（更新版）
 */
export function generateShadowRecords(
  record: Record<string, unknown>,
  resourceName: string
): ShadowRecord[] {
  const config = getShadowConfig();
  const shadows: ShadowRecord[] = [];
  
  // 自動的にシャドウ可能なフィールドを抽出
  const shadowableFields = extractShadowableFields(record);
  
  // 各フィールドに対してシャドウレコードを生成
  for (const [fieldName, fieldType] of Object.entries(shadowableFields)) {
    const value = record[fieldName];
    const formattedValue = formatFieldValue(fieldType, value, config);
    const sk = `${fieldName}#${formattedValue}#id#${record.id}`;
    
    shadows.push({
      PK: resourceName,
      SK: sk,
      data: { id: record.id as string },
    });
  }
  
  return shadows;
}
```

## データモデル

### 環境変数

| 変数名 | 型 | デフォルト値 | 説明 |
|--------|-----|-------------|------|
| `SHADOW_CREATED_AT_FIELD` | string | `"createdAt"` | 作成日時フィールド名 |
| `SHADOW_UPDATED_AT_FIELD` | string | `"updatedAt"` | 更新日時フィールド名 |
| `SHADOW_STRING_MAX_BYTES` | number | `100` | プリミティブ型の最大バイト数（array/objectは2倍） |
| `SHADOW_NUMBER_PADDING` | number | `20` | 数値のパディング桁数 |

### シャドウレコード形式

#### 文字列フィールド

```typescript
// 元のレコード
{
  id: "01HQXYZ...",
  title: "DynamoDB Single-Table Design Best Practices and Performance Tips",
  // ...
}

// シャドウレコード
{
  PK: "articles",
  SK: "title#DynamoDB#Single-Table#Design#Best#Practices#and#Performance#Tips#id#01HQXYZ...",
  //      ↑ 先頭100バイトまで（スペースは # にエスケープ）
  data: { id: "01HQXYZ..." }
}
```

#### 数値フィールド（オフセット方式）

```typescript
// 元のレコード
{
  id: "01HQXYZ...",
  viewCount: 1234,
  score: -42,
  // ...
}

// シャドウレコード（viewCount）
{
  PK: "articles",
  SK: "viewCount#10000000000000001234#id#01HQXYZ...",
  //             ↑ 10^20 + 1234 = 10000000000000001234
  data: { id: "01HQXYZ..." }
}

// シャドウレコード（score）
{
  PK: "articles",
  SK: "score#09999999999999999958#id#01HQXYZ...",
  //         ↑ 10^20 - 42 = 09999999999999999958
  data: { id: "01HQXYZ..." }
}
```

#### 日時フィールド

```typescript
// 元のレコード
{
  id: "01HQXYZ...",
  createdAt: "2024-01-15T10:30:00.000Z",
  // ...
}

// シャドウレコード
{
  PK: "articles",
  SK: "createdAt#2024-01-15T10:30:00.000Z#id#01HQXYZ...",
  data: { id: "01HQXYZ..." }
}
```

#### 真偽値フィールド

```typescript
// 元のレコード
{
  id: "01HQXYZ...",
  published: true,
  // ...
}

// シャドウレコード
{
  PK: "articles",
  SK: "published#1#id#01HQXYZ...",
  //            ↑ true = "1", false = "0"
  data: { id: "01HQXYZ..." }
}
```

#### 配列フィールド

```typescript
// 元のレコード
{
  id: "01HQXYZ...",
  tags: ["dynamodb", "aws", "nosql"],
  // ...
}

// シャドウレコード
{
  PK: "articles",
  SK: "tags#[\"aws\",\"dynamodb\",\"nosql\"]#id#01HQXYZ...",
  //       ↑ JSON文字列化（正規化済み）、先頭200バイトまで
  data: { id: "01HQXYZ..." }
}
```

#### オブジェクトフィールド

```typescript
// 元のレコード
{
  id: "01HQXYZ...",
  metadata: {
    category: "tech",
    priority: 5,
    updatedAt: "2024-01-15T10:30:00Z"
  },
  // ...
}

// シャドウレコード
{
  PK: "articles",
  SK: "metadata#{\"category\":\"tech\",\"priority\":5,\"updatedAt\":\"2024-01-15T10:30:00Z\"}#id#01HQXYZ...",
  //           ↑ JSON文字列化（正規化済み）、先頭200バイトまで
  data: { id: "01HQXYZ..." }
}
```

## 正確性プロパティ

*プロパティは、システムが満たすべき特性や動作を形式的に記述したものです。これらは、すべての有効な実行において真であるべき条件を定義します。*

### プロパティ1: 環境変数の読み込み

*すべての* Lambda起動時において、環境変数が正しく読み込まれ、デフォルト値が適用される

**検証**: 要件2.9-2.13

### プロパティ2: プリミティブ型の自動シャドウ化

*すべての* プリミティブ型フィールド（string, number, boolean, datetime）において、シャドウレコードが自動的に生成される

**検証**: 要件3.1-3.4

### プロパティ3: 内部メタデータの除外

*すべての* `__` プレフィックスで始まるフィールドにおいて、シャドウレコードが生成されない

**検証**: 要件3.7

### プロパティ3.5: 配列・オブジェクト型のシャドウ化

*すべての* array型およびobject型フィールドにおいて、JSON文字列化され、2倍のバイト制限（200バイト）で切り詰められたシャドウレコードが生成される

**検証**: 要件3.5, 3.6, 4.5.1-4.5.5

### プロパティ4: プリミティブ型切り詰めの正確性

*すべての* string型フィールドにおいて、先頭100バイト（UTF-8）まで切り詰められ、マルチバイト文字の境界が考慮される

**検証**: 要件4.1-4.5

### プロパティ4.5: 複合型切り詰めの正確性

*すべての* array型およびobject型フィールドにおいて、JSON文字列化後に先頭200バイト（UTF-8）まで切り詰められ、マルチバイト文字の境界が考慮される

**検証**: 要件4.5.1-4.5.5

### プロパティ5: 数値オフセット方式の正確性

*すべての* 数値フィールドにおいて、オフセット（10^20）が加算され、N桁のゼロパディングが適用され、ソート順が保たれる

**検証**: 要件5.1-5.4

### プロパティ6: 範囲外の数値のエラー

*すべての* 範囲外の数値（-10^20 ～ +10^20の外）において、エラーがスローされる

**検証**: 要件5.5

### プロパティ7: 後方互換性

*すべての* 既存のレコードにおいて、新しい方式でシャドウレコードが再生成され、クエリが正常に動作する

**検証**: 要件6.1-6.4

## エラーハンドリング

### 1. 環境変数エラー

```typescript
// 不正な値
SHADOW_STRING_MAX_BYTES = "abc"  // ❌ 数値ではない
SHADOW_NUMBER_PADDING = "0"      // ❌ 0以下
SHADOW_NUMBER_PADDING = "50"     // ❌ 38を超える

// エラーメッセージ
throw new Error('SHADOW_STRING_MAX_BYTES must be a positive number');
throw new Error('SHADOW_NUMBER_PADDING must be between 1 and 38');
```

### 2. 数値範囲エラー

```typescript
// 範囲外の数値
const value = 10 ** 21;  // 10^21 > 10^20

// エラーメッセージ
throw new Error(`Number ${value} is out of range (-10^20 to 10^20)`);
```

### 3. 型エラー

```typescript
// 不正な型
const value = { nested: "object" };  // object型

// 動作: シャドウレコードを生成しない（エラーではない）
```

## テスト戦略

### 単体テスト

1. **環境変数の読み込み**
   - デフォルト値の適用
   - 不正な値のバリデーション

2. **型推論**
   - 各型の正確な判定
   - `__` プレフィックスの除外
   - object/array の除外

3. **プリミティブ型の切り詰め**
   - ASCII文字列（100バイト）
   - マルチバイト文字（日本語、絵文字）
   - 境界条件（ちょうど100バイト）

4. **複合型の切り詰め**
   - 配列のJSON文字列化（200バイト）
   - オブジェクトのJSON文字列化（200バイト）
   - ネストされた構造
   - 境界条件（ちょうど200バイト）

5. **数値オフセット方式**
   - 正の数
   - 負の数
   - ゼロ
   - 範囲外の数値

### プロパティベーステスト

1. **プリミティブ型切り詰めの正確性**
   - ランダムな文字列を生成
   - 切り詰め後のバイト数が100以下であることを検証
   - マルチバイト文字が壊れていないことを検証

2. **複合型切り詰めの正確性**
   - ランダムな配列・オブジェクトを生成
   - JSON文字列化して切り詰め
   - 切り詰め後のバイト数が200以下であることを検証
   - マルチバイト文字が壊れていないことを検証

3. **数値オフセット方式のソート順**
   - ランダムな数値配列を生成
   - オフセット方式で変換
   - 文字列としてソート
   - 元の数値順と一致することを検証

4. **自動シャドウ化の完全性**
   - ランダムなレコードを生成
   - すべての型（string, number, boolean, datetime, array, object）のフィールドにシャドウレコードが生成されることを検証
   - `__` プレフィックスのフィールドが除外されることを検証

### 統合テスト

1. **Lambda環境での動作確認**
   - 環境変数の読み込み
   - シャドウレコードの生成
   - DynamoDBへの書き込み

2. **クエリの動作確認**
   - ソート順の正確性
   - フィルタリングの正確性

## 移行戦略

### フェーズ1: 新機能の実装

1. 型推論ロジックの実装
2. 文字列切り詰めの実装
3. 数値オフセット方式の実装
4. 環境変数ベースの設定管理

### フェーズ2: テストの追加

1. 単体テストの追加
2. プロパティベーステストの追加
3. 統合テストの追加

### フェーズ3: Terraform設定の更新

1. `source_code_hash` から `shadow_config` を削除
2. 新しい環境変数を追加
3. `var.shadow_config` 変数を削除

### フェーズ4: 既存データの移行

1. メンテナンスワーカーを実行
2. すべてのレコードのシャドウレコードを再生成
3. 古いシャドウレコードを削除

### フェーズ5: クリーンアップ

1. `shadow.config.json` を削除
2. `generate-shadow-config` CLIを削除
3. `src/shadows/config.ts` を削除（クライアント側）
4. ドキュメントの更新

## パフォーマンス考慮事項

### メモリ使用量

- **現在**: JSON設定ファイル（約10KB）をメモリにキャッシュ
- **新方式**: 環境変数（約200バイト）をメモリにキャッシュ
- **削減**: 約98%のメモリ削減

### 起動時間

- **現在**: JSON設定ファイルのパース（約1ms）
- **新方式**: 環境変数の読み込み（約0.1ms）
- **改善**: 約10倍高速化

### シャドウレコード生成

- **現在**: 設定ファイルで指定されたフィールドのみ
- **新方式**: すべての型のフィールド（string, number, boolean, datetime, array, object）
- **影響**: フィールド数に応じて増加（通常5-10個 → 15-30個）

### ストレージ使用量

- **プリミティブ型切り詰め**: 長文フィールドでもストレージ増加は限定的（100バイト）
- **複合型切り詰め**: 配列・オブジェクトは2倍の情報を保持（200バイト）
- **数値オフセット方式**: 固定21バイト（20桁 + 符号）
- **推定**: レコードあたり約2-4KB増加（フィールド数と複合型の数に依存）

## セキュリティ考慮事項

### 環境変数の保護

- Terraform経由で設定されるため、コードリポジトリには含まれない
- Lambda実行環境でのみアクセス可能
- IAMロールによるアクセス制御

### データの切り詰め

- 文字列切り詰めにより、機密情報の一部のみがシャドウレコードに含まれる
- ただし、元のレコードには完全なデータが保存される

## 依存関係

### 既存の依存関係（変更なし）

- `@aws-sdk/client-dynamodb`: DynamoDB操作
- `ulid`: レコードID生成

### 新規の依存関係

なし（標準ライブラリのみ使用）

## 廃止される機能

1. **`shadow.config.json`**: JSON設定ファイル
2. **`generate-shadow-config` CLI**: 設定ファイル生成ツール
3. **`src/shadows/config.ts`**: クライアント側の設定管理
4. **`SHADOW_CONFIG` 環境変数**: base64エンコードされたJSON
5. **`var.shadow_config` Terraform変数**: 設定ファイルの内容

## JSONフィールドの正規化

### 目的

JSONオブジェクトのフィールド順序を正規化することで、同じ内容のJSONが常に同じ文字列表現になります。

### 正規化ルール

1. **先頭**: `id` フィールド
2. **中間**: その他のフィールド（アルファベット順）
3. **末尾**: `createdAt`, `updatedAt` フィールド

### 実装

```typescript
/**
 * JSONオブジェクトのフィールドを正規化
 */
function normalizeJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(item => normalizeJson(item));
  
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    
    // 1. id を先頭に
    if ('id' in obj) sorted.id = normalizeJson(obj.id);
    
    // 2. その他をアルファベット順に
    const otherKeys = Object.keys(obj)
      .filter(key => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt')
      .sort();
    for (const key of otherKeys) {
      sorted[key] = normalizeJson(obj[key]);
    }
    
    // 3. タイムスタンプを末尾に
    if ('createdAt' in obj) sorted.createdAt = normalizeJson(obj.createdAt);
    if ('updatedAt' in obj) sorted.updatedAt = normalizeJson(obj.updatedAt);
    
    return sorted;
  }
  
  return value;
}
```

### 例

```typescript
// 元のレコード
{
  updatedAt: "2024-01-15T10:30:00Z",
  title: "Article",
  id: "01HQXYZ...",
  author: "John"
}

// 正規化後
{
  id: "01HQXYZ...",              // 先頭
  author: "John",                // アルファベット順
  title: "Article",
  updatedAt: "2024-01-15T10:30:00Z"  // 末尾
}
```

## 今後の拡張性

### オプション1: フィールドごとの設定

将来的に、特定のフィールドのみ除外したい場合：

```hcl
SHADOW_EXCLUDE_FIELDS = "content,metadata"
```

### オプション2: リソースごとの設定

将来的に、リソースごとに異なる設定を適用したい場合：

```hcl
SHADOW_ARTICLES_STRING_MAX_BYTES = "200"
SHADOW_TASKS_STRING_MAX_BYTES = "50"
```

### オプション3: カスタム型推論

将来的に、カスタム型を追加したい場合：

```typescript
// 例: UUID型
if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
  return 'uuid';
}
```
