# プロジェクト構造

## Monorepo構成

```
.
├── apps/           # クライアントアプリケーション
├── functions/      # AWS Lambda関数
├── packages/       # 共有ライブラリ
├── infra/          # Terraformインフラ（ワークスペース外）
└── .kiro/          # Kiro設定とスペック
```

## ワークスペース設定

`pnpm-workspace.yaml`で定義:
- `packages/*` - 共有ライブラリ（core, shadows, graphql-types）
- `functions/*` - Lambda関数（records, fetch, パイプラインステージ, メンテナンス）
- `apps/*` - アプリケーション（管理UI, モバイルアプリ）

## 主要ディレクトリ

### `/apps`
クライアント向けアプリケーション:
- **admin/**: React + react-admin Webインターフェース（コンテンツ管理用）
- **mobile/**: Expo/React Nativeモバイルアプリ

### `/functions`
AWS Lambda関数:
- **records/**: GraphQL CRUD操作とシャドウ管理用TypeScript Lambda
- **fetch/**: ニュース記事取得用TypeScript Lambda（records Lambdaを呼び出す）
- **maintenance-coordinator/**: Step Functions経由でシャドウ整合性修復を調整
- **maintenance-worker/**: 並列DynamoDBスキャンとシャドウ修復ワーカー
- 今後: translate, normalize, script, tts, render, publish

### `/packages`
コード再利用のための共有ライブラリ:
- **core/**: 共通ユーティリティ、型、定数
- **shadows/**: シャドウ生成と管理ロジック
- **graphql-types/**: スキーマから生成されたGraphQL型

### `/infra`
Terraformインフラストラクチャコード（pnpmワークスペース外）:
- マルチ環境サポート（dev, stg, prd）
- モジュール: DynamoDB, Lambda, AppSync, Cognito, S3, Step Functions

### `/.kiro`
Kiro AI アシスタント設定:
- **specs/**: プロジェクト仕様（要件、設計、タスク）
- **steering/**: AI ガイダンスルール（このファイル）
- **settings/**: ツール設定

## ファイル命名規則

- TypeScriptソース: `*.ts`, `*.tsx`
- テストファイル: `*.test.ts`, `*.spec.ts`
- 設定ファイル: `*.config.ts`, `*.config.js`
- Lambdaハンドラー: `handler.ts`（エントリーポイント）
- Lambda出力: `dist/handler.cjs` または `dist/handler.mjs`

## 設定ファイル

- `tsconfig.base.json`: ベースTypeScript設定（ワークスペースで拡張）
- `vitest.config.ts`: カバレッジ設定を含むテスト設定
- `eslint.config.js`: TypeScriptルール付きESLint flat config
- `.prettierrc`: インポートソート付きコードフォーマットルール
- `pnpm-workspace.yaml`: ワークスペースパッケージ定義

## DynamoDBスキーマ

`ainews-{env}-records`のSingle-Table設計:
- **PK**: リソース名（例: "articles", "tasks"）
- **SK**: レコードID（ULID）またはシャドウキー（例: "name#value#id#ULID"）
- **data**: `__shadowKeys`メタデータを含むレコードペイロード
- シャドウレコードにより、GSIなしで効率的なソートが可能

## シャドウ設定

`config/shadow.config.json`に配置:
- リソースごとのソート可能フィールドを定義
- フィールドタイプを指定（string, number, datetime）
- シャドウレコード生成を制御
- `$schemaVersion` フィールドでバージョン管理（セマンティックバージョニング形式: major.minor）

### バージョン管理原則

- **マイナーバージョン更新**: シャドーフィールドの追加・削除（後方互換）
- **メジャーバージョン更新**: シャドーフィールドの型変更（破壊的変更）
- Records Lambda は起動時に設定ハッシュ（SHA-256）を生成し、レコードに `__configVersion` と `__configHash` を埋め込む
- Maintenance Lambda は設定ドリフトを検出し、必要に応じてシャドーレコードを修復する

## 環境変数

Lambda関数で使用:
- `ENV`: 環境識別子（dev/stg/prd）
- `REGION`: AWSリージョン
- `RECORDS_TABLE`: DynamoDBテーブル名
- `ASSETS_BUCKET`: メディアファイル用S3バケット
- `PARAM_PATH`: シークレット用SSM Parameter Storeパス

## スペック管理

### スペックディレクトリ構造

このプロジェクトでは、**単一のスペックディレクトリ**を使用します:

```
.kiro/specs/
├── ainews-pipeline/          # プロジェクト全体の統合スペック
│   ├── requirements.md       # 全要件を統合
│   ├── design.md            # 全設計を統合
│   └── tasks.md             # 全タスクを統合
└── dynamodb-client/          # Incubator: 独立ライブラリ候補
    ├── requirements.md       # ライブラリ固有の要件
    ├── design.md            # ライブラリ固有の設計
    ├── evaluation.md        # 品質評価レポート
    ├── improvements.md      # 改善タスク
    └── improvements-summary.md  # 改善完了サマリー
```

### Incubatorプロジェクト

将来的に独立したOSSライブラリとして切り出す可能性があるプロジェクトは、別スペックで管理します：

- **dynamodb-client**: DynamoDB Single-Table設計向けクライアントライブラリ
  - 独立したOSSライブラリ化を検討中
  - ainews-pipelineからは`@exabugs/dynamodb-client`パッケージとして参照
  - 評価・改善タスクを独立して管理

### スペック管理ルール

1. **単一スペック原則**:
   - 新機能や改善は、既存の `ainews-pipeline` スペックに統合する
   - 機能ごとに別々のスペックディレクトリを作成しない
   - すべての要件、設計、タスクは一つのスペックファイルセットで管理する
   - **例外**: Incubatorプロジェクト（独立ライブラリ候補）は別スペックで管理

2. **要件の追加**:
   - 新しい要件は `requirements.md` に新しいセクション（要件14、要件15...）として追加
   - 既存の要件を拡張する場合は、該当する要件セクションを更新
   - 用語集に新しい用語を追加する場合は、アルファベット順または関連性順に挿入

3. **設計の追加**:
   - 新しい設計は `design.md` の適切なセクションに統合
   - 既存のコンポーネントに関連する場合は、該当セクションを更新
   - 新しいコンポーネントの場合は、新しいサブセクションを追加

4. **タスクの追加**:
   - 新しいタスクは `tasks.md` に追加
   - 既存のタスクに関連する場合は、サブタスクとして追加
   - タスク番号は連番で管理

5. **ステアリングファイルの活用**:
   - 機能固有の詳細なルールや実装ガイドは `.kiro/steering/` に配置
   - 例: `shadow-config-versioning.md`、`security.md`、`terraform.md`
   - ステアリングファイルは常に読み込まれ、実装時のガイドとして機能

### スペックファイルの内容

`.kiro/specs/ainews-pipeline/`の詳細仕様:
- `requirements.md`: 全ユーザーストーリーと受け入れ基準（日本語、EARS形式）
- `design.md`: 全アーキテクチャとコンポーネント設計（日本語）
- `tasks.md`: 全実装タスクの内訳

### 新機能追加時のワークフロー

1. **要件の追加・更新**:
   ```bash
   # requirements.md を編集
   # - 新しい要件セクションを追加、または
   # - 既存の要件セクションを更新
   ```

2. **設計の追加・更新**:
   ```bash
   # design.md を編集
   # - 新しい設計セクションを追加、または
   # - 既存の設計セクションを更新
   ```

3. **タスクの追加**:
   ```bash
   # tasks.md を編集
   # - 新しいタスクを追加
   ```

4. **ステアリングファイルの作成（必要に応じて）**:
   ```bash
   # .kiro/steering/ に新しいルールファイルを作成
   # 例: .kiro/steering/new-feature-rules.md
   ```

### 利点

- **一貫性**: すべての要件・設計・タスクが一箇所に集約
- **追跡性**: 機能間の依存関係が明確
- **保守性**: ドキュメントの重複を避け、更新が容易
- **検索性**: 全体を通して検索・参照が簡単
