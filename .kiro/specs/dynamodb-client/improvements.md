# DynamoDB Client ライブラリ改善計画

## 概要

このドキュメントは、`@ainews/core`パッケージを独立したOSSライブラリとして公開するための改善計画です。評価レポート（evaluation.md）で特定された改善点を、優先度別に整理し、具体的な実装タスクに落とし込みます。

## 改善の目標

1. **独立性**: プロジェクト固有の依存を削除し、汎用的なライブラリとして機能させる
2. **国際化**: 英語でのドキュメントとエラーメッセージを提供し、グローバルな利用を可能にする
3. **堅牢性**: リトライ機能、エラーハンドリングガイドを追加し、本番環境での信頼性を向上させる
4. **拡張性**: ミドルウェアシステム、デバッグモードを追加し、カスタマイズ性を向上させる

---

## フェーズ1: 必須の改善（公開前）

### 1.0 ドキュメントの更新

**目的**: ARCHITECTURE.mdとCLIENT_USAGE.mdを最新の実装に合わせて更新する

**現状の問題**:
- ARCHITECTURE.mdに記載されているディレクトリ構造が実装と異なる
- `auth/`ディレクトリが存在しない（ドキュメントには記載されている）
- 認証ハンドラーファイル（`handler.ts`, `handler.node.ts`, `handler.browser.ts`）が存在しない
- `index.browser.ts`が存在しない
- 実際の実装では認証ロジックが各エントリーポイント（`index.iam.ts`, `index.cognito.ts`, `index.token.ts`）に直接実装されている

**改善内容**:
1. ARCHITECTURE.mdのディレクトリ構造を実際の実装に合わせて更新
   - `auth/`ディレクトリの記載を削除
   - 実際のファイル構造（`index.iam.ts`, `index.cognito.ts`, `index.token.ts`）を記載
   - 認証ハンドラーの実装方法を正確に記述
2. ARCHITECTURE.mdのコード例を実際の実装に合わせて更新
   - 認証ハンドラーの注入方法を正確に記述
   - ラッパークラスの実装を実際のコードに合わせる
3. CLIENT_USAGE.mdの検証
   - インポートパスが正しいことを確認（既に正しい）
   - 使用例が最新の実装で動作することを確認

**影響範囲**:
- `packages/core/ARCHITECTURE.md`
- `packages/core/CLIENT_USAGE.md`（検証のみ）

**検証方法**:
- ドキュメントに記載されているディレクトリ構造が実際のファイル構造と一致すること
- ドキュメントに記載されているコード例が実際の実装と一致すること
- ドキュメントに記載されている認証ハンドラーの実装方法が正確であること

**優先度**: 🔴 最高

---

### 1.1 依存関係の整理

**目的**: `@ainews/api-types`と`@ainews/shadows`への依存を削除し、プロジェクト固有の依存を排除する

**現状の問題**:
- `@ainews/api-types`パッケージへの強い依存（サーバー側の型定義）
- `@ainews/shadows`パッケージへの依存（シャドー管理関数）
- プロジェクト固有の型定義が混在
- 独立したライブラリとして機能しない

**改善内容**:

#### 1.1.1 @ainews/api-typesの型定義を移動
1. サーバー側で使用されている型定義を`packages/core/src/server/types.ts`に移動
   - `ApiOperation`, `ApiRequest`, `ApiResponse`
   - `FindParams`, `FindOneParams`, `FindManyParams`, `FindManyReferenceParams`
   - `InsertOneParams`, `UpdateOneParams`, `UpdateManyParams`, `DeleteOneParams`, `DeleteManyParams`, `InsertManyParams`
   - `FindResult`, `FindOneResult`, `FindManyResult`, `FindManyReferenceResult`
   - `InsertOneResult`, `UpdateOneResult`, `UpdateManyResult`, `DeleteOneResult`, `DeleteManyResult`, `InsertManyResult`
   - `OperationError`, `BulkOperationResult`
2. プロジェクト固有の型定義（Article, Task, FetchLog）は削除
3. スキーマ定義（SchemaDefinition, SchemaRegistryConfig）は削除（サーバー側で不要）

#### 1.1.2 @ainews/shadowsの関数を移動
1. シャドー管理関数を`packages/core/src/server/shadow/`に移動
   - `generator.ts`: `generateShadowSK`, `generateMainRecordSK`, `formatFieldValue`など
   - `differ.ts`: `calculateShadowDiff`, `isDiffEmpty`, `mergeShadowDiffs`
   - `config.ts`: `loadShadowConfig`, `getResourceConfig`, `isValidShadowField`, `getDefaultSort`など
   - `types.ts`: `ShadowFieldType`, `ShadowFieldConfig`, `ResourceShadowConfig`, `ShadowConfig`, `ShadowDiff`
2. 既存の`packages/core/src/server/shadow/config.ts`と統合

#### 1.1.3 package.jsonの更新
1. `@ainews/api-types`への依存を削除
2. `@ainews/shadows`への依存を削除
3. AWS SDKのバージョンを固定（`^3.0.0` → `3.929.0`）

#### 1.1.4 インポートパスの更新
1. すべての`@ainews/api-types`インポートを`../../server/types.js`に変更
2. すべての`@ainews/shadows`インポートを`../../server/shadow/`に変更

**影響範囲**:
- `packages/core/src/server/types.ts`（新規作成）
- `packages/core/src/server/shadow/`（既存ファイルと統合）
- `packages/core/src/server/operations/*.ts`（インポートパス変更）
- `packages/core/src/server/handler.ts`（インポートパス変更）
- `packages/core/src/server/utils/validation.ts`（インポートパス変更）
- `packages/core/package.json`

**検証方法**:
- ビルドが成功すること
- テストが全て通過すること
- `@ainews/api-types`への参照がないこと
- `@ainews/shadows`への参照がないこと
- Records Lambdaが正常に動作すること

**優先度**: 🔴 最高

**注意事項**:
- この変更は大規模なため、段階的に進める
- 各ステップでビルドとテストを実行して、問題がないことを確認する
- `@ainews/api-types`と`@ainews/shadows`は他のパッケージ（apps/admin、functions/fetch）でも使用されているため、それらには影響しない

---

**注意**: パッケージ名の変更、国際化対応、ライセンスの明確化など、OSS公開時に実施すべきタスクは、別ファイル（[tasks-oss-publication.md](./tasks-oss-publication.md)）で管理しています。

---

## フェーズ2: 推奨の改善（公開後、優先度: 中）

### 2.1 リトライ機能の追加

**目的**: ネットワークエラー時の自動リトライ機能を追加し、堅牢性を向上させる

**現状の問題**:
- ネットワークエラー時にリトライしない
- 一時的な障害で操作が失敗する

**改善内容**:
1. リトライ機能を実装（exponential backoff）
2. リトライ回数、初期遅延、最大遅延を設定可能にする
3. リトライ対象のエラーを定義（ネットワークエラー、5xx、429など）
4. リトライログを出力

**実装例**:
```typescript
interface RetryOptions {
  maxRetries?: number;        // デフォルト: 3
  initialDelay?: number;      // デフォルト: 1000ms
  maxDelay?: number;          // デフォルト: 10000ms
  retryableErrors?: string[]; // デフォルト: ['ECONNRESET', 'ETIMEDOUT', ...]
}

const client = new DynamoClient(FUNCTION_URL, {
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
  },
  auth: { ... }
});
```

**影響範囲**:
- `packages/core/src/client/Collection.ts`
- `packages/core/src/client/DynamoClient.ts`
- `packages/core/src/types.ts`

**検証方法**:
- ネットワークエラー時にリトライすること
- リトライ回数が設定値を超えないこと
- exponential backoffが正しく動作すること

**優先度**: 🟡 中

---

### 2.2 ミドルウェアシステム

**目的**: ロギング、メトリクス、リトライなどを追加可能にし、拡張性を向上させる

**現状の問題**:
- 機能の追加が困難
- カスタマイズ性が低い

**改善内容**:
1. ミドルウェアインターフェースを定義
2. ミドルウェアチェーンを実装
3. 組み込みミドルウェアを提供（ロギング、メトリクス、リトライ）
4. カスタムミドルウェアの作成方法をドキュメント化

**実装例**:
```typescript
interface Middleware {
  name: string;
  before?: (context: RequestContext) => Promise<void>;
  after?: (context: ResponseContext) => Promise<void>;
  error?: (context: ErrorContext) => Promise<void>;
}

const client = new DynamoClient(FUNCTION_URL, {
  auth: { ... }
});

client.use(loggingMiddleware);
client.use(metricsMiddleware);
client.use(retryMiddleware);
```

**影響範囲**:
- `packages/core/src/client/middleware/`（新規作成）
- `packages/core/src/client/DynamoClient.ts`
- `packages/core/src/client/Collection.ts`

**検証方法**:
- ミドルウェアが順番に実行されること
- エラー時にエラーハンドラーが呼ばれること
- カスタムミドルウェアが動作すること

**優先度**: 🟡 中

---

### 2.3 デバッグモード

**目的**: リクエスト/レスポンスのトレース、ログ出力を可能にし、デバッグを容易にする

**現状の問題**:
- リクエスト/レスポンスの内容が見えない
- デバッグが困難

**改善内容**:
1. `debug: true`オプションを追加
2. リクエスト/レスポンスをコンソールに出力
3. タイミング情報を出力
4. エラー詳細を出力

**実装例**:
```typescript
const client = new DynamoClient(FUNCTION_URL, {
  debug: true,
  auth: { ... }
});

// コンソール出力例:
// [DynamoClient] Request: POST /records
// [DynamoClient] Body: {"operation":"find","database":"ainews",...}
// [DynamoClient] Response: 200 OK (123ms)
// [DynamoClient] Body: {"data":[...]}
```

**影響範囲**:
- `packages/core/src/client/Collection.ts`
- `packages/core/src/client/DynamoClient.ts`
- `packages/core/src/types.ts`

**検証方法**:
- `debug: true`時にログが出力されること
- `debug: false`時にログが出力されないこと

**優先度**: 🟡 中

---

### 2.4 エラーハンドリングガイド

**目的**: エラーハンドリングのベストプラクティスをドキュメント化する

**現状の問題**:
- どのエラーをキャッチすべきか不明確
- リトライ戦略のベストプラクティスがない

**改善内容**:
1. エラーハンドリングガイドを作成（ERROR_HANDLING.md）
2. エラーの種類と対処方法を記載
3. リトライ戦略のベストプラクティスを記載
4. コード例を豊富に提供

**ドキュメント構成**:
- エラーの種類（ネットワークエラー、認証エラー、バリデーションエラー、タイムアウト）
- エラーハンドリングのパターン
- リトライ戦略
- ロギングとモニタリング

**影響範囲**:
- `packages/core/ERROR_HANDLING.md`（新規作成）
- `packages/core/README.md`（リンク追加）

**検証方法**:
- ドキュメントが存在すること
- コード例が動作すること

**優先度**: 🟡 中

---

### 2.5 カバレッジ目標の設定

**目的**: テストカバレッジの目標を設定し、品質を維持する

**現状の問題**:
- カバレッジ目標が未定義
- カバレッジの定期的な確認がない

**改善内容**:
1. カバレッジ目標を80%以上に設定
2. `vitest.config.ts`に`thresholds`を追加
3. CI/CDでカバレッジをチェック
4. カバレッジバッジをREADMEに追加

**実装例**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**'],
      exclude: ['node_modules/**', 'dist/**', '**/*.config.ts', '**/__tests__/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

**影響範囲**:
- `packages/core/vitest.config.ts`
- `packages/core/README.md`

**検証方法**:
- カバレッジが80%以上であること
- カバレッジが80%未満の場合、テストが失敗すること

**優先度**: 🟡 中

---

## フェーズ3: オプションの改善（優先度: 低）

### 3.1 パフォーマンス最適化

**目的**: 接続プール、キャッシュ機能を追加し、パフォーマンスを向上させる

**改善内容**:
1. 接続プール機能を実装（オプション）
2. キャッシュ機能を実装（オプション）
3. カーソルベースのページネーションを実装

**優先度**: 🟢 低

---

### 3.2 プラグインシステム

**目的**: サードパーティ拡張をサポートし、エコシステムを構築する

**改善内容**:
1. プラグインインターフェースを定義
2. プラグインの登録・管理機能を実装
3. プラグイン開発ガイドを作成

**優先度**: 🟢 低

---

### 3.3 イベントフック

**目的**: beforeInsert、afterInsertなどのイベントフックを追加し、カスタマイズ性を向上させる

**改善内容**:
1. イベントフックインターフェースを定義
2. イベントハンドラーの登録・管理機能を実装
3. 組み込みイベントを定義（beforeInsert、afterInsert、beforeUpdate、afterUpdate、beforeDelete、afterDelete）

**優先度**: 🟢 低

---

### 3.4 カスタムシリアライザー

**目的**: 日付型などのカスタマイズを可能にし、柔軟性を向上させる

**改善内容**:
1. シリアライザーインターフェースを定義
2. カスタムシリアライザーの登録機能を実装
3. 組み込みシリアライザーを提供（日付型、BigInt型）

**優先度**: 🟢 低

---

## 実装スケジュール

### フェーズ1: 必須の改善（独立性の確保）
- **期間**: 1週間
- **タスク**: 1.0 ✅ → 1.1 ✅
- **目標**: 独立したライブラリとして機能する状態にする
- **注意**: OSS公開時のタスク（パッケージ名変更、国際化、ライセンス）は別ファイル（tasks-oss-publication.md）で管理

### フェーズ2: 推奨の改善（公開後）
- **期間**: 4週間
- **タスク**: 2.1 → 2.2 → 2.3 → 2.4 → 2.5
- **目標**: 堅牢性と拡張性を向上させる

### フェーズ3: オプションの改善（長期）
- **期間**: 継続的
- **タスク**: 3.1 → 3.2 → 3.3 → 3.4
- **目標**: エコシステムを構築し、コミュニティを育成する

---

## 成功指標

### フェーズ1完了時
- [x] ドキュメントが最新の実装を反映している
- [x] `@ainews/api-types`への依存がない
- [x] `@ainews/shadows`への依存がない
- [x] ビルドとテストが成功する
- [ ] リトライ機能が動作する（フェーズ2）
- [ ] ミドルウェアシステムが動作する（フェーズ2）

### フェーズ2完了時
- [ ] リトライ機能が動作する
- [ ] ミドルウェアシステムが動作する
- [ ] デバッグモードが動作する
- [ ] エラーハンドリングガイドが存在する
- [ ] テストカバレッジが80%以上である

### フェーズ3完了時
- [ ] パフォーマンス最適化が実装されている
- [ ] プラグインシステムが動作する
- [ ] イベントフックが動作する
- [ ] カスタムシリアライザーが動作する

---

## リスクと対策

### リスク1: 依存関係の整理が困難
- **対策**: 段階的に移行し、各ステップでテストを実行する

### リスク2: 国際化対応の工数が大きい
- **対策**: 自動翻訳ツールを活用し、ネイティブスピーカーにレビューを依頼する

### リスク3: リトライ機能の実装が複雑
- **対策**: 既存のライブラリ（例: `retry`、`p-retry`）を参考にする

### リスク4: ミドルウェアシステムの設計が困難
- **対策**: Express.js、Koa.jsなどの既存のミドルウェアシステムを参考にする

---

## 次のステップ

1. ✅ **ドキュメント更新**: ARCHITECTURE.mdとCLIENT_USAGE.mdを最新の実装に合わせて更新する（タスク1.0）
2. ✅ **依存関係の整理**: `@ainews/api-types`と`@ainews/shadows`への依存を削除（タスク1.1）
3. **フェーズ2の開始**: 推奨の改善（2.1 → 2.2 → 2.3 → 2.4 → 2.5）を実装する
4. **OSS公開準備**: 公開時タスク（tasks-oss-publication.md）を実施
   - パッケージ名の変更
   - 国際化対応（英語化）
   - ライセンスの明確化
   - package.jsonのメタデータ更新
   - npmパッケージの公開準備
5. **コミュニティ構築**: GitHub、Discord、ドキュメントサイトを整備する
