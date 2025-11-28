# テストガイドライン

## 基本原則

**コード修正時は必ず単体テストを追加し、テスト実行を確認すること**

## テスト追加の必須ケース

### 1. 構造変更・リファクタリング

データ構造やインターフェースを変更する場合、必ずテストを追加する。

**例**: シャドウ設定の構造変更（`fields` → `shadows`）
- 設定ファイルの構造検証テスト
- 各パッケージでの構造整合性テスト
- E2Eテスト（実際の設定ファイルとの整合性）

### 2. 新機能の追加

新しい機能を追加する場合、その機能をカバーするテストを追加する。

**例**: 新しいCRUD操作の追加
- 正常系のテスト
- 異常系のテスト（エラーハンドリング）
- エッジケースのテスト

### 3. バグ修正

バグを修正する場合、そのバグを再現するテストを追加する。

**例**: 設定読み込みのバグ修正
- バグが発生する条件を再現するテスト
- 修正後の正常動作を確認するテスト

## テストの種類

### 単体テスト（Unit Test）

個々の関数やクラスの動作を検証する。

**配置場所**:
- `packages/*/src/__tests__/*.test.ts`
- `functions/*/src/__tests__/*.test.ts`
- `packages/*/scripts/__tests__/*.test.ts`

**例**:
```typescript
describe('getShadowConfig', () => {
  it('環境変数から設定を読み込む', () => {
    // テストコード
  });

  it('不正なJSONの場合はエラーをスローする', () => {
    // テストコード
  });
});
```

### 統合テスト（Integration Test）

複数のコンポーネントが連携して動作することを検証する。

**配置場所**:
- `packages/*/src/__tests__/integration*.test.ts`
- `functions/*/src/__tests__/integration*.test.ts`

**例**:
```typescript
describe('Shadow Config Integration', () => {
  it('スキーマレジストリから設定を生成し、読み込める', () => {
    // テストコード
  });
});
```

### E2Eテスト（End-to-End Test）

実際のファイルやリソースを使用して、システム全体の動作を検証する。

**配置場所**:
- `packages/*/scripts/__tests__/config-integrity.test.ts`

**例**:
```typescript
describe('Config Integrity', () => {
  it('実際の設定ファイルがスキーマレジストリと一致する', async () => {
    // 実際のファイルを読み込んで検証
  });
});
```

## テスト実行の確認

### 修正したパッケージのテスト

```bash
pnpm --filter <package-name> test
```

**例**:
```bash
pnpm --filter @ainews/shadows test
pnpm --filter @ainews/core test
pnpm --filter @ainews/api-types test
```

### 全体のテスト

```bash
pnpm test
```

### 特定のテストファイルのみ実行

```bash
pnpm --filter <package-name> test <test-file-pattern>
```

**例**:
```bash
pnpm --filter @ainews/core test server-shadow-config
```

## テストカバレッジの目標

### 最低限のカバレッジ

- **新規コード**: 80%以上
- **修正コード**: 修正箇所を100%カバー
- **クリティカルパス**: 100%

### カバレッジの確認

**重要**: `make test` コマンドは自動的にカバレッジを取得します。

```bash
# プロジェクト全体のカバレッジ
make test

# 特定パッケージのカバレッジ
cd functions/records && make test
cd packages/core && make test
```

カバレッジレポートはターミナルに直接表示されます。HTMLレポートは各パッケージの`coverage/index.html`に生成されます。

### カバレッジ対象

カバレッジは`src`ディレクトリのみを対象とし、以下を除外します：

- `node_modules/**` - 依存パッケージ
- `dist/**` - ビルド成果物
- `**/*.config.ts` - 設定ファイル
- `**/__tests__/**` - テストファイル自体

`include: ['src/**']`が指定されているため、`src`ディレクトリ外のファイル（`examples`、`scripts`など）は自動的に除外されます。この設定により、実際のプロダクションコードのみがカバレッジ対象となります。

## テストの命名規則

### describe ブロック

- 対象の関数名、クラス名、または機能名を記述
- 日本語で記述

**例**:
```typescript
describe('getShadowConfig', () => { ... });
describe('設定ファイル構造の検証', () => { ... });
```

### it ブロック

- テストの内容を簡潔に記述
- 日本語で記述
- 「〜する」「〜の場合は〜」の形式

**例**:
```typescript
it('環境変数から設定を読み込む', () => { ... });
it('不正なJSONの場合はエラーをスローする', () => { ... });
it('shadowsキーを使用している（fieldsキーではない）', () => { ... });
```

## テストデータの管理

### モックデータ

- テストファイル内で定義
- 実際のデータ構造に近い形式
- 必要最小限のフィールドのみ含める

**例**:
```typescript
const mockConfig: ShadowConfig = {
  $schemaVersion: '2.0',
  resources: {
    articles: {
      sortDefaults: {
        field: 'updatedAt',
        order: 'DESC',
      },
      shadows: {
        name: { type: 'string' },
        createdAt: { type: 'datetime' },
        updatedAt: { type: 'datetime' },
      },
    },
  },
};
```

### テストフィクスチャ

- 複数のテストで共有するデータは `__fixtures__` ディレクトリに配置
- JSON、YAML、テキストファイルなど

**配置場所**:
- `packages/*/src/__tests__/__fixtures__/`
- `functions/*/src/__tests__/__fixtures__/`

## テスト実行のタイミング

### 必須タイミング

1. **コード修正後**: 修正したパッケージのテストを実行
2. **コミット前**: 全体のテストを実行
3. **プルリクエスト作成前**: 全体のテストを実行

### 推奨タイミング

1. **開発中**: ファイル保存時に自動実行（watch mode）
2. **リファクタリング中**: 各ステップでテストを実行

## テスト失敗時の対応

### 1. エラーメッセージを確認

```bash
pnpm test 2>&1 | grep -A 10 "FAIL"
```

### 2. 失敗したテストのみ再実行

```bash
pnpm --filter <package-name> test <test-file-name>
```

### 3. デバッグモードで実行

```typescript
// テストファイルに追加
import { describe, it, expect } from 'vitest';

describe.only('デバッグ対象', () => {
  it.only('特定のテスト', () => {
    // デバッグコード
  });
});
```

### 4. 修正後、全体のテストを再実行

```bash
pnpm test
```

## テストの保守

### テストコードの品質

- テストコードも本番コードと同じ品質基準を適用
- DRY原則に従う（共通ロジックは関数化）
- 読みやすく、理解しやすいコードを書く

### テストの更新

- 仕様変更時は対応するテストも更新
- 不要になったテストは削除
- テストが失敗する場合は、テストを修正するのではなく、コードを修正

## CI/CDとの連携

### GitHub Actions

- プルリクエスト作成時に自動実行
- mainブランチへのマージ前に全テストが通過することを確認

### ローカル実行

- コミット前に必ず全テストを実行
- テストが失敗している状態でコミットしない

## 例外ケース

### テストが書けない場合

以下の場合のみ、テストを省略できる：

1. **外部サービスへの依存**: モックが困難な外部API呼び出し
   - ただし、可能な限りモックを使用すること
2. **UI/UXの視覚的な確認**: スタイルやレイアウトの確認
   - ただし、ロジック部分はテストすること
3. **一時的なデバッグコード**: 本番環境に含まれないコード

これらの場合でも、コメントで理由を明記すること。

## チェックリスト

コード修正時に以下を確認すること：

- [ ] 修正箇所をカバーするテストを追加した
- [ ] 修正したパッケージのテストが通過した
- [ ] 全体のテストが通過した
- [ ] テストコードがコーディング規約に従っている
- [ ] テストの命名が適切（日本語、わかりやすい）
- [ ] モックデータが適切に定義されている
- [ ] エッジケースをカバーしている
- [ ] エラーハンドリングをテストしている

## TypeScript ASTを使った静的解析テスト

### 概要

TypeScript Compiler APIを使用して、ソースコードを静的に解析し、型定義との整合性を検証する。

### 適用例: react-adminリソース整合性テスト

react-adminのリソース定義（`source`属性）が、TypeScript型定義と一致することを検証する。

**配置場所**:
- `apps/admin/src/resources/__tests__/*.test.tsx`
- `apps/admin/src/resources/__tests__/helpers/resourceIntegrity.ts`

**利点**:
- コンポーネントをレンダリングせず、依存関係の問題を回避
- 正規表現より堅牢で保守性が高い
- 型定義ファイルが唯一の情報源（Single Source of Truth）

**実装例**:
```typescript
import { extractFieldsFromInterface, testSourceIntegrity } from './helpers/resourceIntegrity';

describe('Articles Resource', () => {
  const resourceFilePath = path.join(__dirname, '../articles.tsx');
  const typeFilePath = path.join(__dirname, '../../../../../packages/api-types/src/models/Article.ts');
  const articleFields = extractFieldsFromInterface(typeFilePath, 'Article');

  testSourceIntegrity(resourceFilePath, articleFields, 'articles');
});
```

**ヘルパー関数**:
- `extractFieldsFromInterface()`: 型定義ファイルからインターフェースのフィールドを抽出
- `testSourceIntegrity()`: リソースファイルの`source`属性が型定義に存在することを検証
- `testRecordRepresentation()`: `recordRepresentation`フィールドが型定義に存在することを検証
- `testResourceName()`: リソース名が正しく設定されていることを検証

### 命名規則

リソースを追加する際は、以下の命名規則に従ってください：

| 要素 | 命名規則 | 例 |
|------|---------|-----|
| **インターフェース名** | 大文字単数形（PascalCase） | `Article`, `Task`, `Video` |
| **型定義ファイル名** | インターフェース名 + `.ts` | `Article.ts`, `Task.ts`, `Video.ts` |
| **スキーマ名** | インターフェース名 + `Schema` | `ArticleSchema`, `TaskSchema`, `VideoSchema` |
| **リソース名（resource）** | 小文字複数形 | `articles`, `tasks`, `videos` |
| **リソースファイル名（react-admin）** | リソース名 + `.tsx` | `articles.tsx`, `tasks.tsx`, `videos.tsx` |

### 新しいリソースの追加

新しいリソース（例: `videos`）を追加する場合：

1. 型定義を作成: `packages/api-types/src/models/Video.ts`
2. リソース定義を作成: `apps/admin/src/resources/videos.tsx`
3. テスト定義に追加: `apps/admin/src/resources/__tests__/resources.test.tsx`

```typescript
const resources: ResourceDefinition[] = [
  { resourceFile: 'articles.tsx', typeFile: 'Article.ts' },
  { resourceFile: 'tasks.tsx', typeFile: 'Task.ts' },
  { resourceFile: 'videos.tsx', typeFile: 'Video.ts' }, // 追加
];
```

テストは自動的に以下を検証します：
- 型定義ファイルからインターフェース名を導出（`Video.ts` → `Video`）
- スキーマ名を自動生成（`Video` → `VideoSchema`）
- スキーマの`resource`フィールドとリソースファイルの`name`が一致
- `source`属性が型定義に存在
- `recordRepresentation`が型定義に存在

## 参考実装

プロジェクト内の良いテスト実装例：

- **構造検証**: `packages/shadows/src/__tests__/config.test.ts`
- **設定読み込み**: `packages/core/src/__tests__/server-shadow-config.test.ts`
- **E2Eテスト**: `packages/api-types/scripts/__tests__/config-integrity.test.ts`
- **生成スクリプト**: `packages/api-types/scripts/__tests__/generate-shadow-config.test.ts`
- **AST静的解析**: `apps/admin/src/resources/__tests__/articles.test.tsx`
- **ASTヘルパー**: `apps/admin/src/resources/__tests__/helpers/resourceIntegrity.ts`

これらのファイルを参考に、新しいテストを実装すること。
