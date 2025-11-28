# シャドウ管理パッケージ統合タスク

## 概要

`@ainews/shadows` パッケージを `@exabugs/dynamodb-client` ライブラリに統合し、OSSライブラリとして提供する。

**目標**: シャドウ管理機能をライブラリに統合し、外部依存なしでDynamoDB Single-Table設計を実装可能にする。

**所要時間**: 2-3時間

---

## タスクリスト

- [x] 1. ライブラリ側の準備
- [x] 1.1 shadowsディレクトリを作成
- [x] 1.2 型定義ファイルを移動
- [x] 1.3 シャドウSK生成関数を移動
- [x] 1.4 シャドウ差分計算関数を移動
- [x] 1.5 設定管理関数を移動
- [x] 1.6 エクスポートファイルを作成

- [x] 2. package.jsonの更新
- [x] 2.1 exportsに"./shadows"を追加
- [x] 2.2 依存関係を確認（@aws-sdk/client-ssm）

- [x] 3. テストの移動
- [x] 3.1 テストファイルを移動
- [x] 3.2 テストが成功することを確認

- [x] 4. ドキュメントの更新
- [x] 4.1 README.mdにシャドウ管理機能を追加
- [x] 4.2 使用例を追加
- [x] 4.3 API仕様を追加

- [x] 5. プロジェクト側の更新
- [x] 5.1 @ainews/shadowsの依存を削除
- [x] 5.2 インポートパスを更新
- [x] 5.3 ビルドとテストを確認

- [x] 6. 最終確認
- [x] 6.1 全体のビルドが成功することを確認
- [x] 6.2 全体のテストが成功することを確認
- [x] 6.3 Records Lambdaが正常に動作することを確認

---

## タスク詳細

### 1. ライブラリ側の準備

#### 1.1 shadowsディレクトリを作成

**目的**: `packages/core/src/shadows/`ディレクトリを作成

**作業内容**:
```bash
mkdir -p packages/core/src/shadows
```

**検証**:
- [ ] ディレクトリが作成されている

---

#### 1.2 型定義ファイルを移動

**目的**: `packages/shadows/src/types.ts`を`packages/core/src/shadows/types.ts`に移動

**作業内容**:
```bash
cp packages/shadows/src/types.ts packages/core/src/shadows/types.ts
```

**packages/core/src/shadows/types.ts**:
```typescript
/**
 * シャドーフィールドの型定義
 */
export type ShadowFieldType = 'string' | 'number' | 'datetime';

/**
 * シャドー設定のフィールド定義
 */
export interface ShadowFieldConfig {
  type: ShadowFieldType;
}

/**
 * リソースごとのシャドー設定
 */
export interface ResourceShadowConfig {
  sortDefaults: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  shadows: {
    [fieldName: string]: ShadowFieldConfig;
  };
  ttl?: {
    days: number;
  };
}

/**
 * shadow.config.jsonの全体構造
 */
export interface ShadowConfig {
  $schemaVersion: string;
  resources: {
    [resourceName: string]: ResourceShadowConfig;
  };
}

/**
 * シャドー差分計算の結果
 */
export interface ShadowDiff {
  /** 削除すべきシャドーSKのリスト */
  toDelete: string[];
  /** 追加すべきシャドーSKのリスト */
  toAdd: string[];
}
```

**検証**:
- [ ] ファイルが移動されている
- [ ] TypeScriptのコンパイルが成功する

---

#### 1.3 シャドウSK生成関数を移動

**目的**: `packages/shadows/src/generator.ts`を`packages/core/src/shadows/generator.ts`に移動

**作業内容**:
```bash
cp packages/shadows/src/generator.ts packages/core/src/shadows/generator.ts
```

**packages/core/src/shadows/generator.ts**:
```typescript
import type { ShadowFieldType } from './types.js';

/**
 * 文字列値をエスケープする
 * ルール: # → ##, スペース → #
 */
export function escapeString(value: string): string {
  return value
    .replace(/#/g, '##')
    .replace(/ /g, '#');
}

/**
 * 数値を20桁のゼロ埋め文字列に変換する
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number value: ${value}`);
  }
  const normalized = Math.max(0, Math.floor(value));
  return normalized.toString().padStart(20, '0');
}

/**
 * 日時をUTC ISO 8601形式にフォーマットする
 */
export function formatDatetime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }
  return date.toISOString();
}

/**
 * フィールド値を型に応じてフォーマットする
 */
export function formatFieldValue(
  type: ShadowFieldType,
  value: string | number | Date | null | undefined
): string {
  switch (type) {
    case 'string':
      if (value === null || value === undefined) {
        return '';
      }
      return escapeString(String(value));
    case 'number':
      return formatNumber(value as number | null | undefined);
    case 'datetime':
      return formatDatetime(value as string | Date | null | undefined);
    default:
      throw new Error(`Unknown shadow field type: ${type}`);
  }
}

/**
 * シャドーSKを生成する
 */
export function generateShadowSK(
  fieldName: string,
  value: string | number | Date,
  recordId: string,
  type: ShadowFieldType = 'string'
): string {
  const formattedValue = formatFieldValue(type, value);
  return `${fieldName}#${formattedValue}#id#${recordId}`;
}

/**
 * レコードIDからメインレコードのSKを生成する
 */
export function generateMainRecordSK(recordId: string): string {
  return `id#${recordId}`;
}
```

**検証**:
- [ ] ファイルが移動されている
- [ ] TypeScriptのコンパイルが成功する

---

#### 1.4 シャドウ差分計算関数を移動

**目的**: `packages/shadows/src/differ.ts`を`packages/core/src/shadows/differ.ts`に移動

**作業内容**:
```bash
cp packages/shadows/src/differ.ts packages/core/src/shadows/differ.ts
```

**packages/core/src/shadows/differ.ts**:
```typescript
import type { ShadowDiff } from './types.js';

/**
 * シャドー差分を計算する
 */
export function calculateShadowDiff(
  oldKeys: string[],
  newKeys: string[]
): ShadowDiff {
  const oldSet = new Set(oldKeys);
  const newSet = new Set(newKeys);

  const toDelete = oldKeys.filter((key) => !newSet.has(key));
  const toAdd = newKeys.filter((key) => !oldSet.has(key));

  return { toDelete, toAdd };
}

/**
 * シャドー差分が空かどうかを判定する
 */
export function isDiffEmpty(diff: ShadowDiff): boolean {
  return diff.toDelete.length === 0 && diff.toAdd.length === 0;
}

/**
 * 複数のシャドー差分をマージする
 */
export function mergeShadowDiffs(diffs: ShadowDiff[]): ShadowDiff {
  const toDelete = new Set<string>();
  const toAdd = new Set<string>();

  for (const diff of diffs) {
    for (const key of diff.toDelete) {
      toDelete.add(key);
    }
    for (const key of diff.toAdd) {
      toAdd.add(key);
    }
  }

  return {
    toDelete: Array.from(toDelete),
    toAdd: Array.from(toAdd),
  };
}
```

**検証**:
- [ ] ファイルが移動されている
- [ ] TypeScriptのコンパイルが成功する

---

#### 1.5 設定管理関数を移動

**目的**: `packages/shadows/src/config.ts`を`packages/core/src/shadows/config.ts`に移動

**作業内容**:
```bash
cp packages/shadows/src/config.ts packages/core/src/shadows/config.ts
```

**packages/core/src/shadows/config.ts**:
```typescript
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ResourceShadowConfig, ShadowConfig, ShadowFieldConfig } from './types.js';

/**
 * shadow.config.jsonファイルまたはSSM Parameter Storeから読み込む
 */
export async function loadShadowConfig(
  configPath: string = './shadow.config.json'
): Promise<ShadowConfig> {
  try {
    let content: string;

    const isSSMParameter = configPath.startsWith('/') && !configPath.includes('.');

    if (isSSMParameter) {
      const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
      const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
      const command = new GetParameterCommand({
        Name: configPath,
        WithDecryption: false,
      });
      const response = await client.send(command);

      if (!response.Parameter?.Value) {
        throw new Error(`SSM parameter '${configPath}' not found or has no value`);
      }

      content = response.Parameter.Value;
    } else {
      const absolutePath = resolve(configPath);
      content = await readFile(absolutePath, 'utf-8');
    }

    const config = JSON.parse(content) as ShadowConfig;

    if (!config.$schemaVersion) {
      throw new Error('Missing $schemaVersion in shadow.config.json');
    }

    if (!config.resources || typeof config.resources !== 'object') {
      throw new Error('Missing or invalid resources in shadow.config.json');
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load shadow config: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 特定のリソースのシャドー設定を取得する
 */
export function getResourceConfig(
  config: ShadowConfig,
  resourceName: string
): ResourceShadowConfig {
  const resourceConfig = config.resources[resourceName];

  if (!resourceConfig) {
    throw new Error(`Resource '${resourceName}' not found in shadow config`);
  }

  return resourceConfig;
}

/**
 * リソースの全シャドーフィールドを取得する
 */
export function getAllShadowFields(
  config: ShadowConfig,
  resourceName: string
): Record<string, ShadowFieldConfig> {
  const resourceConfig = getResourceConfig(config, resourceName);
  return resourceConfig.shadows;
}

/**
 * 指定されたフィールドが有効なシャドーフィールドかどうかを検証する
 */
export function isValidShadowField(
  config: ShadowConfig,
  resourceName: string,
  fieldName: string
): boolean {
  try {
    const allFields = getAllShadowFields(config, resourceName);
    return fieldName in allFields;
  } catch {
    return false;
  }
}

/**
 * リソースのデフォルトソート設定を取得する
 */
export function getDefaultSort(
  config: ShadowConfig,
  resourceName: string
): { field: string; order: 'ASC' | 'DESC' } {
  const resourceConfig = getResourceConfig(config, resourceName);
  return resourceConfig.sortDefaults;
}

/**
 * 設定ファイルから環境変数経由でパスを取得する
 */
export function getConfigPathFromEnv(envVar: string = 'SHADOW_CONFIG_PATH'): string {
  return process.env[envVar] || './shadow.config.json';
}
```

**検証**:
- [ ] ファイルが移動されている
- [ ] TypeScriptのコンパイルが成功する

---

#### 1.6 エクスポートファイルを作成

**目的**: `packages/core/src/shadows/index.ts`を作成

**作業内容**:

**packages/core/src/shadows/index.ts**:
```typescript
/**
 * @exabugs/dynamodb-client/shadows - シャドー管理ライブラリ
 *
 * DynamoDB Single-Table設計における動的シャドーレコード管理を提供します。
 *
 * 主な機能:
 * - シャドーSK生成（string/number/datetime対応）
 * - シャドー差分計算（旧影と新影の比較）
 * - shadow.config.json読み込みと検証
 */

// 型定義のエクスポート
export type {
  ShadowFieldType,
  ShadowFieldConfig,
  ResourceShadowConfig,
  ShadowConfig,
  ShadowDiff,
} from './types.js';

// ジェネレーター関数のエクスポート
export {
  escapeString,
  formatNumber,
  formatDatetime,
  formatFieldValue,
  generateShadowSK,
  generateMainRecordSK,
} from './generator.js';

// 差分計算関数のエクスポート
export { calculateShadowDiff, isDiffEmpty, mergeShadowDiffs } from './differ.js';

// 設定管理関数のエクスポート
export {
  loadShadowConfig,
  getResourceConfig,
  getAllShadowFields,
  isValidShadowField,
  getDefaultSort,
  getConfigPathFromEnv,
} from './config.js';
```

**検証**:
- [ ] ファイルが作成されている
- [ ] TypeScriptのコンパイルが成功する

---

### 2. package.jsonの更新

#### 2.1 exportsに"./shadows"を追加

**目的**: `packages/core/package.json`に`./shadows`エクスポートを追加

**作業内容**:

**packages/core/package.json**:
```json
{
  "name": "@exabugs/dynamodb-client",
  "version": "1.0.0",
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client/index.js",
    "./client/iam": "./dist/client/index.iam.js",
    "./client/cognito": "./dist/client/index.cognito.js",
    "./client/token": "./dist/client/index.token.js",
    "./server": "./dist/server/handler.cjs",
    "./shadows": "./dist/shadows/index.js",
    "./types": "./dist/types.js",
    "./integrations/react-admin": "./dist/integrations/react-admin/index.js",
    "./terraform": "./terraform/main.tf"
  }
}
```

**検証**:
- [ ] exportsが正しく設定されている
- [ ] `pnpm build`が成功する

---

#### 2.2 依存関係を確認（@aws-sdk/client-ssm）

**目的**: `@aws-sdk/client-ssm`が依存関係に含まれていることを確認

**作業内容**:

**packages/core/package.json**:
```json
{
  "dependencies": {
    "@aws-sdk/client-dynamodb": "3.929.0",
    "@aws-sdk/lib-dynamodb": "3.929.0",
    "@aws-sdk/client-ssm": "^3.0.0",
    "aws-jwt-verify": "^5.1.1",
    "ulid": "^3.0.1"
  }
}
```

**検証**:
- [ ] `@aws-sdk/client-ssm`が依存関係に含まれている
- [ ] `pnpm install`が成功する

---

### 3. テストの移動

#### 3.1 テストファイルを移動

**目的**: `packages/shadows/src/__tests__/`を`packages/core/src/shadows/__tests__/`に移動

**作業内容**:
```bash
cp -r packages/shadows/src/__tests__ packages/core/src/shadows/__tests__
```

**検証**:
- [ ] テストファイルが移動されている

---

#### 3.2 テストが成功することを確認

**目的**: シャドウ管理機能のテストが成功することを確認

**作業内容**:
```bash
cd packages/core
pnpm test
```

**検証**:
- [ ] すべてのテストがパスする
- [ ] エラーがない

---

### 4. ドキュメントの更新

#### 4.1 README.mdにシャドウ管理機能を追加

**目的**: `packages/core/README.md`にシャドウ管理機能の説明を追加

**作業内容**:

**packages/core/README.md**に以下を追加:
```markdown
## シャドウ管理機能

このライブラリには、DynamoDB Single-Table設計におけるシャドウレコード管理機能が含まれています。

### インストール

```bash
pnpm add @exabugs/dynamodb-client
```

### 使用方法

#### シャドウSK生成

```typescript
import { generateShadowSK } from '@exabugs/dynamodb-client/shadows';

// 文字列フィールド
const nameSK = generateShadowSK('name', 'Tech News', '01HZXY123', 'string');
// => 'name#Tech#News#id#01HZXY123'

// 数値フィールド
const prioritySK = generateShadowSK('priority', 123, '01HZXY123', 'number');
// => 'priority#00000000000000000123#id#01HZXY123'

// 日時フィールド
const createdAtSK = generateShadowSK(
  'createdAt',
  '2025-11-12T10:00:00.000Z',
  '01HZXY123',
  'datetime'
);
// => 'createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123'
```

#### シャドウ差分計算

```typescript
import { calculateShadowDiff } from '@exabugs/dynamodb-client/shadows';

const oldKeys = [
  'name#Old#Name#id#01HZXY123',
  'priority#00000000000000000010#id#01HZXY123',
];

const newKeys = [
  'name#New#Name#id#01HZXY123',
  'priority#00000000000000000010#id#01HZXY123',
];

const diff = calculateShadowDiff(oldKeys, newKeys);
// => {
//   toDelete: ['name#Old#Name#id#01HZXY123'],
//   toAdd: ['name#New#Name#id#01HZXY123']
// }
```

#### 設定ファイル読み込み

```typescript
import { loadShadowConfig, getAllShadowFields } from '@exabugs/dynamodb-client/shadows';

// shadow.config.jsonを読み込む
const config = await loadShadowConfig('./shadow.config.json');

// リソースの全シャドーフィールドを取得
const fields = getAllShadowFields(config, 'articles');
// => {
//   id: { type: 'string' },
//   name: { type: 'string' },
//   createdAt: { type: 'datetime' },
//   updatedAt: { type: 'datetime' }
// }
```

### エスケープルール

文字列値は以下のルールでエスケープされます：

- `#` → `##`
- スペース → `#`

例：
- `"Tech News"` → `"Tech#News"`
- `"AI#ML"` → `"AI##ML"`
```

**検証**:
- [ ] READMEが更新されている
- [ ] 使用例が正しい

---

#### 4.2 使用例を追加

**目的**: 実際の使用例を追加

**作業内容**: 上記の4.1で追加済み

**検証**:
- [ ] 使用例が追加されている

---

#### 4.3 API仕様を追加

**目的**: API仕様を追加

**作業内容**: 上記の4.1で追加済み

**検証**:
- [ ] API仕様が追加されている

---

### 5. プロジェクト側の更新

#### 5.1 @ainews/shadowsの依存を削除

**目的**: プロジェクト側の`@ainews/shadows`依存を削除

**作業内容**:

**packages/core/package.json**から`@ainews/shadows`を削除:
```json
{
  "dependencies": {
    // "@ainews/shadows": "workspace:*",  // 削除
    "@aws-sdk/client-dynamodb": "3.929.0",
    "@aws-sdk/lib-dynamodb": "3.929.0",
    "@aws-sdk/client-ssm": "^3.0.0",
    "aws-jwt-verify": "^5.1.1",
    "ulid": "^3.0.1"
  }
}
```

**検証**:
- [ ] `@ainews/shadows`が削除されている
- [ ] `pnpm install`が成功する

---

#### 5.2 インポートパスを更新

**目的**: プロジェクト側のインポートパスを`@exabugs/dynamodb-client/shadows`に更新

**作業内容**:

**packages/core/src/server/shadow/generator.ts**:
```typescript
// Before
// import { generateShadowSK } from '@ainews/shadows';

// After
import { generateShadowSK } from '../../shadows/index.js';
```

**検証**:
- [ ] インポートパスが更新されている
- [ ] TypeScriptのコンパイルが成功する

---

#### 5.3 ビルドとテストを確認

**目的**: プロジェクト全体のビルドとテストが成功することを確認

**作業内容**:
```bash
make clean
make build
make test
```

**検証**:
- [ ] ビルドが成功する
- [ ] テストが成功する

---

### 6. 最終確認

#### 6.1 全体のビルドが成功することを確認

**目的**: プロジェクト全体のビルドが成功することを確認

**作業内容**:
```bash
make clean
make build
```

**検証**:
- [ ] すべてのパッケージがビルドされる
- [ ] `packages/core/dist/shadows/index.js`が生成される
- [ ] エラーがない

---

#### 6.2 全体のテストが成功することを確認

**目的**: プロジェクト全体のテストが成功することを確認

**作業内容**:
```bash
make test
```

**検証**:
- [ ] すべてのテストがパスする
- [ ] エラーがない

---

#### 6.3 Records Lambdaが正常に動作することを確認

**目的**: Records Lambdaが正常に動作することを確認

**作業内容**:
```bash
# dev環境にデプロイ
make deploy-dev

# Fetch Lambdaを実行（Records Lambdaを呼び出す）
make invoke-fetch ENV=dev

# ログ確認
make logs-records ENV=dev
```

**検証**:
- [ ] デプロイが成功する
- [ ] Fetch Lambdaが成功する
- [ ] Records Lambdaが正常に動作する
- [ ] ログにエラーがない

---

## チェックリスト

統合完了時に以下を確認してください：

- [ ] すべてのタスクが完了している
- [ ] ビルドが成功する（`make clean && make build`）
- [ ] テストが成功する（`make test`）
- [ ] `packages/core/dist/shadows/index.js`が生成される
- [ ] `@exabugs/dynamodb-client/shadows`からインポート可能
- [ ] Records Lambdaが正常に動作する
- [ ] ドキュメントが更新されている
- [ ] `@ainews/shadows`パッケージへの依存が削除されている

---

## ロールバック手順

問題が発生した場合のロールバック手順：

```bash
# 1. Gitで変更を戻す
git checkout main
git pull

# 2. ビルド
make clean
make build

# 3. デプロイ
make deploy-dev

# 4. 動作確認
make invoke-fetch ENV=dev
```

---

## 参考情報

- **要件定義**: `.kiro/specs/dynamodb-client/requirements.md`
- **設計書**: `.kiro/specs/dynamodb-client/design.md`
- **既存パッケージ**: `packages/shadows/`
