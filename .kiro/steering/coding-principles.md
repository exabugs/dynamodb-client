# コーディング原則

## 根本的な問題解決を優先する

**最も重要な原則: 症状ではなく、根本原因を解決すること**

### 基本方針

問題に直面したとき、表面的な対処療法ではなく、根本的な原因を特定して解決する。

### 判断基準

1. **型アサーションや型キャストが必要な場合**
   - ❌ 悪い例: `as any`や型アサーションで警告を抑制する
   - ✅ 良い例: 型定義を改善して、型アサーションが不要になるようにする
   - 理由: 型アサーションは型安全性を損ない、将来のバグの原因となる

2. **eslint-disableコメントが必要な場合**
   - ❌ 悪い例: `// eslint-disable-next-line`でルールを無効化する（理由なし）
   - ✅ 良い例: コードを修正してルールに準拠させる
   - ⚠️ 例外: やむを得ず無効化する場合は、**必ず理由を明記すること**
   - 理由: ルールを無効化すると、コード品質が低下し、保守性が悪化する

3. **エラーハンドリングでtry-catchを多用する場合**
   - ❌ 悪い例: エラーを握りつぶして、問題を隠蔽する
   - ✅ 良い例: エラーが発生しないように設計を改善する
   - 理由: エラーハンドリングは最後の手段であり、設計で防ぐべき

4. **ワークアラウンドやハックが必要な場合**
   - ❌ 悪い例: 一時的な回避策で問題を先送りする
   - ✅ 良い例: ライブラリの修正や設計の見直しを行う
   - 理由: ワークアラウンドは技術的負債を増やし、将来の保守コストを増大させる

### 実践例

#### 例1: 型アサーションの削除

```typescript
// ❌ 悪い例: 型アサーションで警告を抑制
const items = await collection.find({ id: params.id } as any).toArray();
return { data: items[0] as any };

// ✅ 良い例: 型定義を改善して型アサーションを不要にする
// 1. Collectionクラスのジェネリック型を改善
export class Collection<TSchema extends DocumentBase = DocumentBase> {
  // ...
}

// 2. 型アサーション不要で使用可能
const items = await collection.find({ id: params.id }).toArray();
return { data: items[0] }; // 型安全
```

#### 例2: eslint-disableの削除

```typescript
// ❌ 悪い例: ルールを無効化
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const error: any = await response.json();

// ✅ 良い例: 適切な型を定義
const error = (await response.json()) as { message?: string };
```

#### 例3: エラーハンドリングの改善

```typescript
// ❌ 悪い例: エラーを握りつぶす
try {
  const value = obj.property.nested.value;
} catch {
  return null; // エラーを隠蔽
}

// ✅ 良い例: Optional Chainingで設計を改善
const value = obj?.property?.nested?.value ?? null;
```

### 根本的な問題解決のステップ

1. **問題の特定**: 症状ではなく、根本原因を特定する
2. **影響範囲の調査**: 問題がどこまで波及しているか確認する
3. **解決策の検討**: 複数の解決策を比較検討する
4. **根本的な修正**: 型定義、設計、アーキテクチャを改善する
5. **検証**: 修正により問題が解決したことを確認する

### 例外ケース

以下の場合のみ、一時的な対処療法を許容する：

1. **外部ライブラリの制約**: 修正不可能な外部ライブラリのバグ
   - ただし、Issue報告やPull Requestを検討すること
2. **緊急の本番障害**: 即座の対応が必要な場合
   - ただし、後日必ず根本的な修正を行うこと
3. **段階的な移行**: 大規模なリファクタリングの途中段階
   - ただし、明確な移行計画とスケジュールを持つこと

これらの場合でも、コメントで理由を明記し、TODO/FIXMEタグで追跡すること。

### テストコードにおける例外

テストコードでは、本番コードよりも実用性と可読性を優先し、以下の条件を緩和する：

1. **型アサーション（`as any`）の使用**
   - ✅ 許容: モックやスタブの作成時
   - ✅ 許容: 外部ライブラリの型定義が不完全な場合
   - ✅ 許容: テストデータの簡潔な記述のため
   - 理由: テストコードは実行時の動作確認が目的であり、型安全性よりも可読性と保守性を優先

2. **eslint-disableの使用**
   - ✅ 許容: テスト固有のパターン（例: `no-undef`でグローバル変数を使用）
   - ✅ 許容: モックライブラリの制約による警告
   - 理由: テストフレームワークやモックライブラリの制約により、本番コードのルールが適用できない場合がある

3. **簡潔な記述の優先**
   - ✅ 許容: テストデータの作成で型定義を省略
   - ✅ 許容: モックの戻り値で簡略化した型を使用
   - 理由: テストコードは可読性が最優先であり、過度な型定義は逆効果

#### テストコードの例

```typescript
// ✅ テストコードでは許容される
describe('User API', () => {
  it('ユーザーを作成できる', async () => {
    // モックの作成で as any を使用
    const mockUser = {
      id: '123',
      name: 'Test User',
    } as any;

    // テストデータの簡潔な記述
    const result = await createUser(mockUser);
    expect(result.id).toBe('123');
  });

  it('外部APIをモックする', async () => {
    // モックライブラリの制約で型アサーションを使用
    vi.spyOn(api, 'fetchUser').mockResolvedValue({
      data: { id: '123' },
    } as any);

    const user = await getUser('123');
    expect(user.id).toBe('123');
  });
});
```

#### 本番コードとテストコードの違い

| 項目 | 本番コード | テストコード |
|------|-----------|-------------|
| **型安全性** | 最優先 | 可読性を優先 |
| **型アサーション** | 極力避ける | 実用的に使用可 |
| **eslint-disable** | 最小限 | 必要に応じて使用可 |
| **エラーハンドリング** | 厳密 | テスト目的に応じて |
| **コード重複** | DRY原則を厳守 | 可読性のため許容 |

#### テストコードでも避けるべきこと

以下は、テストコードでも避けるべき：

- ❌ 過度な`as any`の使用（型定義が全く無い状態）
- ❌ テストの意図が不明瞭なコード
- ❌ 保守が困難な複雑なモック
- ❌ テスト間の依存関係

テストコードでも、可読性と保守性は重要です。型アサーションを使用する場合でも、テストの意図が明確であることを優先してください。

## ESLint ルール無効化のガイドライン

**重要原則: ESLint ルールを無効化する場合は、必ず理由を明記すること**

### 基本方針

1. **まず根本的な解決を試みる**
   - コードを修正してルールに準拠させる
   - 型定義を改善する
   - 設計を見直す

2. **やむを得ず無効化する場合**
   - 理由を詳細に説明するコメントを追加
   - 根本的な解決策を TODO として記載
   - 影響範囲を最小限にする

### 無効化が許容されるケース

1. **外部ライブラリの制約**
   - react-admin の型定義による `any` の使用
   - AWS SDK のモックでの `any` の使用
   - 理由: ライブラリの設計上の制約

2. **テストコードの実用性**
   - `process.env` の直接操作（`no-undef`）
   - モックの型定義（`@typescript-eslint/no-explicit-any`）
   - 理由: テストコードでは実用性と可読性を優先

3. **一時的な技術的負債**
   - 大規模リファクタリングの途中段階
   - 理由: 段階的な移行のため（明確な計画とスケジュールが必要）

### コメントの書き方

#### ❌ 悪い例: 理由なし

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProvider } from 'react-admin';
```

#### ✅ 良い例: 理由を明記

```typescript
/**
 * NOTE: react-adminの型定義による any の使用
 *
 * react-adminのDataProviderインターフェースは、ジェネリック型パラメータとして
 * `any` を使用することを前提としています。これは、react-adminが様々な型のレコードを
 * 扱うための設計上の制約です。
 *
 * 実行時の型安全性は、以下により確保されています：
 * 1. DynamoDB Client SDK の型チェック
 * 2. TypeScript の型推論（呼び出し側で具体的な型を指定）
 * 3. 実際のレコード型は @ainews/api-types で定義
 *
 * 根本的な解決策（TODO）:
 * 1. react-admin v5 の型定義を調査し、より厳密な型付けが可能か確認
 * 2. カスタム型定義を作成して、プロジェクト固有のリソース型を使用
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProvider } from 'react-admin';
```

#### ✅ 良い例: テストコード

```typescript
/**
 * Maintenance Coordinator Lambda のテスト
 *
 * NOTE: テストコードにおける eslint ルールの無効化
 *
 * 以下のルールを無効化しています：
 *
 * 1. no-undef (process.env の使用)
 *    - テストでは環境変数を直接設定する必要がある
 *    - Node.js のグローバル変数 process は TypeScript で型チェック済み
 *
 * 2. @typescript-eslint/no-explicit-any (モックの型定義)
 *    - AWS SDK のモックでは any を使用せざるを得ない
 *    - テストコードでは実用性と可読性を優先
 *    - 実行時の動作確認が目的であり、型安全性よりも保守性を優先
 */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
```

### コメントに含めるべき情報

1. **なぜ無効化が必要か**
   - 外部ライブラリの制約
   - テストコードの実用性
   - 技術的負債の理由

2. **どのように安全性を確保しているか**
   - 代替手段
   - 実行時のチェック
   - 型推論の活用

3. **根本的な解決策（可能な場合）**
   - TODO として記載
   - 具体的なアクション
   - 参考リンク

### 無効化の範囲

- **ファイル全体**: `/* eslint-disable */`（最小限に）
- **特定のルール**: `/* eslint-disable rule-name */`（推奨）
- **特定の行**: `// eslint-disable-next-line rule-name`（最も限定的）

可能な限り、影響範囲を最小限にすること。

## DRY原則（Don't Repeat Yourself）

コードの重複を避け、再利用可能なコンポーネントを作成すること。

### 適用ガイドライン

1. **定数の共通化**
   - 複数のファイルで使用される定数は、共通のユーティリティファイルに定義する
   - 例: `LAMBDA_TIMEOUT_MS`、`LARGE_BATCH_WARNING_THRESHOLD` などのバルク操作関連定数
   - 配置場所: `functions/*/src/utils/` または `packages/core/src/constants/`

2. **ロジックの共通化**
   - 同じパターンのロジックが3回以上出現する場合、共通関数として抽出する
   - 例: タイムアウトリスク計算、ログ出力パターン、エラーハンドリング
   - 配置場所: `functions/*/src/utils/` または適切な共有パッケージ

3. **型定義の共通化**
   - 複数の操作で使用される型は、共通の型定義ファイルに配置する
   - 例: `PreparedRecord`、`ChunkResult`、`TimeoutRiskInfo`
   - 配置場所: `packages/core/src/types/` または `@ainews/api-types`

### 共通化の判断基準

- **2回の重複**: 注意して観察（まだ共通化しない）
- **3回の重複**: 共通化を検討（パターンが明確な場合は実施）
- **4回以上の重複**: 必ず共通化する

### 共通化の例

```typescript
// ❌ 悪い例: 各ファイルで定数を重複定義
// createMany.ts
const LAMBDA_TIMEOUT_MS = 15 * 60 * 1000;

// updateMany.ts
const LAMBDA_TIMEOUT_MS = 15 * 60 * 1000;

// deleteMany.ts
const LAMBDA_TIMEOUT_MS = 15 * 60 * 1000;

// ✅ 良い例: 共通ユーティリティで定義
// utils/bulkOperations.ts
export const LAMBDA_TIMEOUT_MS = 15 * 60 * 1000;

// createMany.ts, updateMany.ts, deleteMany.ts
import { LAMBDA_TIMEOUT_MS } from '../utils/bulkOperations.js';
```

## メンテナンス性

コードは書かれる回数よりも読まれる回数の方が多い。将来の変更を容易にする設計を心がけること。

### 設計原則

1. **単一責任の原則（Single Responsibility Principle）**
   - 各関数・クラスは1つの責任のみを持つ
   - 関数名は動詞で始まり、何をするかが明確
   - 例: `calculateTimeoutRisk()`, `logLargeBatchWarning()`

2. **関数の粒度**
   - 1つの関数は50行以内を目安とする
   - 複雑なロジックは小さな関数に分割する
   - 各関数にJSDocコメント（日本語）を付ける

3. **依存関係の管理**
   - 循環依存を避ける
   - 依存方向は常に一方向（下位層 → 上位層）
   - 例: operations → utils → core

4. **設定の外部化**
   - ハードコードされた値を避ける
   - 環境変数、設定ファイル、定数ファイルを使用
   - 例: `shadow.config.json`, `LAMBDA_TIMEOUT_MS`

### メンテナンス性向上の例

```typescript
// ❌ 悪い例: 複雑なロジックが1つの関数に詰め込まれている
async function processRecords(records: Record[]) {
  // 100行以上のロジック...
  // タイムアウトチェック、チャンク分割、実行、ログ出力が混在
}

// ✅ 良い例: 責任ごとに関数を分割
async function processRecords(records: Record[]) {
  const chunks = calculateChunks(records, getItemCount);
  const riskInfo = calculateTimeoutRisk(startTime);
  logPreparationTimeoutRisk(requestId, resource, records.length, chunks.length, riskInfo);
  const result = await executeChunks(chunks, executeChunk, getRecordId);
  return result;
}
```

## 一貫性の確保

プロジェクト全体で統一されたパターンとスタイルを維持すること。

### コーディングスタイル

1. **命名規則の統一**
   - 変数・関数: camelCase（例: `recordCount`, `calculateTimeoutRisk`）
   - 定数: UPPER_SNAKE_CASE（例: `LAMBDA_TIMEOUT_MS`）
   - 型・インターフェース: PascalCase（例: `PreparedRecord`, `TimeoutRiskInfo`）
   - ファイル名: kebab-case（例: `bulk-operations.ts`）またはcamelCase（例: `bulkOperations.ts`）

2. **エラーハンドリングパターン**
   - すべてのバルク操作で同じエラーハンドリングパターンを使用
   - エラーコードの抽出: `getPreparationErrorCode()`, `getErrorCode()`
   - エラー情報の構造: `{ id, code, message }`

3. **ログ出力パターン**
   - 操作開始: `logger.debug('Executing {operation}', { requestId, resource, count })`
   - 警告: `logLargeBatchWarning()`, `logPreparationTimeoutRisk()`
   - 完了: `logBulkOperationComplete()`
   - 部分失敗: `logPartialFailure()`

4. **レスポンス構造の統一**
   - createMany: `{ items, failedIds, errors }`
   - updateMany: `{ items, failedIds, errors }`
   - deleteMany: `{ deletedIds, failedIds, errors }`

### 一貫性確保の例

```typescript
// ✅ 良い例: すべてのバルク操作で同じパターンを使用

// createMany.ts
export async function handleCreateMany(...): Promise<CreateManyData> {
  const startTime = Date.now();
  logLargeBatchWarning('createMany', recordsData.length, requestId, resource);
  
  // ... 処理 ...
  
  const completionRiskInfo = calculateTimeoutRisk(startTime);
  logBulkOperationComplete('createMany', requestId, resource, ...);
  
  if (allFailedIds.length > 0) {
    logPartialFailure('createMany', requestId, resource, ...);
  }
  
  return { items, failedIds, errors };
}

// updateMany.ts
export async function handleUpdateMany(...): Promise<UpdateManyData> {
  const startTime = Date.now();
  logLargeBatchWarning('updateMany', ids.length, requestId, resource);
  
  // ... 処理 ...
  
  const completionRiskInfo = calculateTimeoutRisk(startTime);
  logBulkOperationComplete('updateMany', requestId, resource, ...);
  
  if (allFailedIds.length > 0) {
    logPartialFailure('updateMany', requestId, resource, ...);
  }
  
  return { items, failedIds, errors };
}
```

## 共通ユーティリティの配置

### ディレクトリ構造

```
functions/records/src/
├── operations/          # ビジネスロジック（CRUD操作）
│   ├── createMany.ts
│   ├── updateMany.ts
│   └── deleteMany.ts
├── utils/              # 共通ユーティリティ
│   ├── bulkOperations.ts   # バルク操作共通（定数、ログ、タイムアウト）
│   ├── chunking.ts         # チャンク分割ロジック
│   ├── dynamodb.ts         # DynamoDB操作
│   └── auth.ts             # 認証・認可
└── config.ts           # 設定管理
```

### 共通化の優先順位

1. **最優先**: 定数（マジックナンバーの排除）
2. **高優先**: ログ出力パターン（一貫性の確保）
3. **中優先**: 計算ロジック（DRY原則）
4. **低優先**: 型定義（必要に応じて）

## メタデータ管理

### 内部メタデータの原則

システム内部で管理するメタデータは `__` プレフィックスを使用する。

1. **命名規則**:
   - 内部メタデータフィールドは `__` で始める
   - 例: `__shadowKeys`, `__configVersion`, `__configHash`

2. **レスポンス除外**:
   - HTTP レスポンスやAPI出力からは除外する
   - クライアントには公開しない

3. **後方互換性**:
   - メタデータがない既存レコードも正常に処理する
   - 更新時に自動的にメタデータを追加する

4. **メタデータの用途**:
   - `__shadowKeys`: 生成済みシャドーレコードのSK配列
   - `__configVersion`: レコード作成時の設定バージョン
   - `__configHash`: レコード作成時の設定ハッシュ（SHA-256）

### 設定変更管理

設定ファイル（例: shadow.config.json）の変更を追跡する。

1. **バージョン管理**:
   - セマンティックバージョニング（major.minor）を使用
   - マイナー更新: 後方互換な変更（フィールド追加・削除）
   - メジャー更新: 破壊的変更（型変更）

2. **ハッシュ生成**:
   - 設定ファイルの内容から SHA-256 ハッシュを生成
   - Lambda 起動時にグローバル変数にキャッシュ
   - レコード作成時にメタデータとして保存

3. **設定ドリフト検出**:
   - レコードのハッシュと現在のハッシュを比較
   - メタデータがないレコードもドリフトとして検出
   - Maintenance Lambda で自動修復

## Lint警告の許容方針

### 基本原則

新規コードは警告ゼロを目指すが、既存コードの技術的負債による警告は段階的に解消する。

### 警告許容レベル

1. **新規パッケージ・Lambda関数**: `--max-warnings 0`
   - 新しく作成するコードは警告を許容しない
   - 例: `functions/maintenance/coordinator`, `functions/maintenance/worker`

2. **既存コードベース**: `--max-warnings 50`
   - 既存の技術的負債による警告を一時的に許容
   - 例: `apps/admin` (現在34個の警告)
   - 新規コードでは警告を増やさないこと

3. **プロジェクト全体**: `pnpm -r lint`
   - 各パッケージの設定に従う
   - CI/CDで全体のlintを実行

### 技術的負債の解消

既存の警告は以下の方針で段階的に解消する：

1. **優先度付け**:
   - 高: セキュリティ・バグに関連する警告
   - 中: 型安全性・保守性に関連する警告
   - 低: スタイル・フォーマットに関連する警告

2. **解消タイミング**:
   - 該当ファイルを修正する際に、関連する警告も同時に解消
   - 定期的なリファクタリングタスクで計画的に解消
   - 警告数が増加傾向にある場合は、即座に対応

3. **警告数の監視**:
   - 月次で警告数をレビュー
   - 警告数が増加している場合は原因を特定し対策
   - 目標: 6ヶ月以内に全パッケージで `--max-warnings 0` を達成

### package.json設定例

```json
{
  "scripts": {
    "lint": "eslint src --ext ts,tsx --max-warnings 50"
  }
}
```

### 新規パッケージ作成時のルール

新しいパッケージやLambda関数を作成する際は、必ず `--max-warnings 0` を設定すること。

```json
{
  "scripts": {
    "lint": "tsc --noEmit && eslint src --ext ts --max-warnings 0"
  }
}
```

## レビューチェックリスト

コードレビュー時に以下を確認すること：

### 根本的な問題解決

- [ ] 型アサーション（`as any`, `as unknown`）を使用していないか
- [ ] `eslint-disable`コメントを使用していないか
- [ ] ワークアラウンドやハックを使用していないか
- [ ] 根本原因を解決せず、症状だけを抑制していないか

### コード品質

- [ ] 同じ定数が複数ファイルに定義されていないか
- [ ] 同じロジックが3回以上繰り返されていないか
- [ ] 関数名・変数名が命名規則に従っているか
- [ ] エラーハンドリングパターンが統一されているか
- [ ] ログ出力パターンが統一されているか
- [ ] JSDocコメントが日本語で記述されているか
- [ ] 1つの関数が50行を超えていないか（複雑な場合は分割を検討）

### メタデータとバージョン管理

- [ ] 内部メタデータは `__` プレフィックスを使用しているか
- [ ] メタデータは HTTP レスポンスから除外されているか
- [ ] 設定変更時にバージョンを更新しているか

### Lint警告

- [ ] 新規コードでlint警告を増やしていないか
- [ ] 既存の警告を解消する機会があれば対応しているか

## 参考実装

プロジェクト内の良い実装例：

- **バルク操作の共通化**: `functions/records/src/utils/bulkOperations.ts`
- **チャンク分割**: `functions/records/src/utils/chunking.ts`
- **シャドウ管理**: `packages/shadows/src/`

これらのファイルを参考に、新しい機能を実装すること。
