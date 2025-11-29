# DynamoDB Client OSS 化 - 要件定義書

## はじめに

ainews-pipeline プロジェクトから dynamodb-client ライブラリを独立させ、npm で公開可能な OSS ライブラリとして再構成します。ainews 固有のコードを全て削除し、汎用的な DynamoDB Single-Table 設計向けクライアントライブラリとして提供します。

## 用語集

- **OSS Migration（OSS 化）**: ainews-pipeline から dynamodb-client を独立させ、汎用的な OSS ライブラリとして公開すること
- **DynamoDB Client（DynamoDB クライアント）**: DynamoDB Single-Table 設計向けの HTTP クライアントライブラリ（MongoDB 風 API）
- **ainews-pipeline**: 元のプロジェクト（AI ニュース自動配信パイプライン）
- **Shadow Record（シャドーレコード）**: DynamoDB 内で本体レコードと同一テーブルに格納される、ソート・検索用の派生レコード
- **Single Source of Truth**: 型定義が唯一の情報源であり、他の設定ファイルは自動生成される

## 要件

### 要件1: リポジトリの目的変更

**ユーザーストーリー:** 開発者として、このリポジトリが dynamodb-client ライブラリ専用であることを明確にしたい

#### 受入基準

1. THE リポジトリ SHALL dynamodb-client ライブラリのみを含む
2. THE リポジトリ SHALL ainews-pipeline 固有のコードを含まない
3. THE README.md SHALL dynamodb-client ライブラリの説明のみを含む
4. THE package.json SHALL `@exabugs/dynamodb-client` をパッケージ名として使用する
5. THE リポジトリ SHALL npm で公開可能な構造を持つ

### 要件2: ainews 固有コードの削除

**ユーザーストーリー:** 開発者として、ainews 固有のコードが完全に削除されることで、汎用的なライブラリとして使用できることを期待する

#### 受入基準

1. THE システム SHALL `apps/` ディレクトリを削除する
2. THE システム SHALL `functions/` ディレクトリを削除する
3. THE システム SHALL `packages/api-types/` ディレクトリを削除する
4. THE システム SHALL `infra/` ディレクトリを削除する
5. THE システム SHALL ainews 固有の設定ファイル（`.envrc`, `config/shadow.config.json` など）を削除する
6. THE システム SHALL ainews 固有のドキュメント（`CHANGELOG.md`, `apps/admin/docs/` など）を削除する
7. THE システム SHALL ainews 固有のスクリプト（`scripts/`, `Makefile` など）を削除する

### 要件3: ディレクトリ構造の再設計

**ユーザーストーリー:** 開発者として、シンプルで分かりやすいディレクトリ構造により、ライブラリの理解と保守が容易になることを期待する

#### 受入基準

1. THE ディレクトリ構造 SHALL 以下の構成を持つ:
   ```
   dynamodb-client/
   ├── src/                    # ソースコード
   │   ├── client/             # クライアント SDK
   │   ├── server/             # サーバー実装
   │   ├── shadows/            # シャドウ管理
   │   ├── integrations/       # 統合（react-admin など）
   │   └── types.ts            # 共通型定義
   ├── examples/               # 使用例
   │   ├── basic/              # 基本的な使用例
   │   ├── lambda/             # Lambda 統合例
   │   ├── webapp/             # Web アプリ統合例
   │   └── react-admin/        # react-admin 統合例
   ├── docs/                   # ドキュメント
   │   ├── README.md           # メインドキュメント
   │   ├── API.md              # API リファレンス
   │   ├── ARCHITECTURE.md     # アーキテクチャ
   │   └── MIGRATION.md        # マイグレーションガイド
   ├── terraform/              # Terraform モジュール（オプション）
   ├── __tests__/              # テストコード
   ├── package.json
   ├── tsconfig.json
   ├── LICENSE
   └── README.md
   ```
2. THE ルート SHALL `packages/` ディレクトリを含まない（monorepo 構造を廃止）
3. THE ルート SHALL シンプルな単一パッケージ構造を持つ
4. THE examples/ SHALL 実際に動作する使用例を含む
5. THE docs/ SHALL 包括的なドキュメントを含む

### 要件4: パッケージ名の変更

**ユーザーストーリー:** 開発者として、パッケージ名が汎用的であることで、ainews プロジェクトに依存しないことを明確にしたい

#### 受入基準

1. THE パッケージ名 SHALL `@exabugs/dynamodb-client` である
2. THE package.json SHALL 正しいパッケージ名を含む
3. THE すべてのインポート文 SHALL 新しいパッケージ名を使用する
4. THE ドキュメント SHALL 新しいパッケージ名を使用する
5. THE 例 SHALL 新しいパッケージ名を使用する

### 要件5: 依存関係の整理

**ユーザーストーリー:** 開発者として、ainews 固有の依存関係が削除されることで、ライブラリが独立して動作することを期待する

#### 受入基準

1. THE package.json SHALL `@ainews/*` パッケージへの依存を含まない
2. THE package.json SHALL 必要最小限の依存関係のみを含む
3. THE AWS SDK SHALL 固定バージョンを使用する（`@aws-sdk/client-dynamodb: 3.929.0`）
4. THE peerDependencies SHALL 適切に定義される
5. THE devDependencies SHALL 開発に必要な依存関係のみを含む

### 要件6: 国際化対応

**ユーザーストーリー:** 開発者として、英語のドキュメントとエラーメッセージにより、国際的なユーザーが使用できることを期待する

#### 受入基準

1. THE README.md SHALL 英語で記述される
2. THE API ドキュメント SHALL 英語で記述される
3. THE JSDoc コメント SHALL 英語で記述される
4. THE エラーメッセージ SHALL 英語で記述される
5. THE コード内コメント SHALL 英語で記述される
6. THE 日本語ドキュメント SHALL `docs/ja/` ディレクトリに配置される（オプション）

### 要件7: ライセンスの明確化

**ユーザーストーリー:** 開発者として、ライセンスが明確であることで、安心してライブラリを使用できることを期待する

#### 受入基準

1. THE リポジトリ SHALL LICENSE ファイルを含む
2. THE LICENSE SHALL MIT ライセンスを使用する
3. THE package.json SHALL `license: "MIT"` を含む
4. THE ソースファイル SHALL 著作権表示を含む
5. THE README.md SHALL ライセンス情報を含む

### 要件8: npm 公開準備

**ユーザーストーリー:** 開発者として、npm で公開可能な構成により、簡単にライブラリを配布できることを期待する

#### 受入基準

1. THE package.json SHALL npm 公開に必要なフィールドを含む（name, version, description, keywords, author, license, repository, bugs, homepage）
2. THE package.json SHALL `files` フィールドで公開ファイルを明示する
3. THE package.json SHALL `exports` フィールドで ESM/CJS エクスポートを定義する
4. THE package.json SHALL `types` フィールドで型定義ファイルを指定する
5. THE .npmignore SHALL 不要なファイルを除外する
6. THE README.md SHALL インストール方法を含む
7. THE README.md SHALL クイックスタートガイドを含む

### 要件9: テストコードの整理

**ユーザーストーリー:** 開発者として、テストコードが整理されることで、ライブラリの品質を保証できることを期待する

#### 受入基準

1. THE テストコード SHALL `__tests__/` ディレクトリに配置される
2. THE テストコード SHALL ainews 固有のテストを含まない
3. THE テストコード SHALL 汎用的なテストのみを含む
4. THE テストコード SHALL カバレッジ 80% 以上を達成する
5. THE package.json SHALL `test` スクリプトを含む
6. THE package.json SHALL `test:coverage` スクリプトを含む

### 要件10: ドキュメントの整理

**ユーザーストーリー:** 開発者として、包括的なドキュメントにより、ライブラリの使用方法を素早く理解できることを期待する

#### 受入基準

1. THE README.md SHALL 以下のセクションを含む:
   - プロジェクト概要
   - 主要機能
   - インストール方法
   - クイックスタート
   - 使用例
   - API リファレンス（リンク）
   - ライセンス
2. THE docs/API.md SHALL 完全な API リファレンスを含む
3. THE docs/ARCHITECTURE.md SHALL アーキテクチャ説明を含む
4. THE docs/MIGRATION.md SHALL マイグレーションガイドを含む
5. THE examples/ SHALL 実際に動作する使用例を含む

### 要件11: CI/CD の設定

**ユーザーストーリー:** 開発者として、CI/CD により、自動的にテストとビルドが実行されることを期待する

#### 受入基準

1. THE リポジトリ SHALL GitHub Actions ワークフローを含む
2. THE ワークフロー SHALL プルリクエスト時にテストを実行する
3. THE ワークフロー SHALL プルリクエスト時にビルドを実行する
4. THE ワークフロー SHALL プルリクエスト時にリントを実行する
5. THE ワークフロー SHALL main ブランチへのマージ時に npm 公開を実行する（オプション）

### 要件12: Terraform モジュールの整理

**ユーザーストーリー:** 開発者として、Terraform モジュールが独立して使用できることで、簡単にインフラをデプロイできることを期待する

#### 受入基準

1. THE terraform/ ディレクトリ SHALL Lambda 関数デプロイ用のモジュールのみを含む
2. THE terraform/ ディレクトリ SHALL ainews 固有のリソースを含まない
3. THE terraform/README.md SHALL モジュールの使用方法を含む
4. THE terraform/examples/ SHALL 使用例を含む
5. THE terraform/ ディレクトリ SHALL オプションとして提供される（ライブラリ本体とは独立）

### 要件13: バージョニング戦略

**ユーザーストーリー:** 開発者として、セマンティックバージョニングにより、バージョンアップの影響を理解できることを期待する

#### 受入基準

1. THE バージョニング SHALL セマンティックバージョニング（SemVer）に従う
2. THE MAJOR バージョン SHALL 破壊的変更時にインクリメントする
3. THE MINOR バージョン SHALL 後方互換な機能追加時にインクリメントする
4. THE PATCH バージョン SHALL 後方互換なバグ修正時にインクリメントする
5. THE CHANGELOG.md SHALL バージョンごとの変更履歴を含む

### 要件14: コントリビューションガイド

**ユーザーストーリー:** 開発者として、コントリビューションガイドにより、プロジェクトへの貢献方法を理解できることを期待する

#### 受入基準

1. THE リポジトリ SHALL CONTRIBUTING.md ファイルを含む
2. THE CONTRIBUTING.md SHALL 開発環境のセットアップ方法を含む
3. THE CONTRIBUTING.md SHALL コーディング規約を含む
4. THE CONTRIBUTING.md SHALL プルリクエストのプロセスを含む
5. THE CONTRIBUTING.md SHALL コミットメッセージの規約を含む

### 要件15: セキュリティポリシー

**ユーザーストーリー:** 開発者として、セキュリティポリシーにより、脆弱性の報告方法を理解できることを期待する

#### 受入基準

1. THE リポジトリ SHALL SECURITY.md ファイルを含む
2. THE SECURITY.md SHALL サポートされるバージョンを含む
3. THE SECURITY.md SHALL 脆弱性の報告方法を含む
4. THE SECURITY.md SHALL セキュリティアップデートのポリシーを含む
5. THE package.json SHALL セキュリティ監査スクリプトを含む（`npm audit`）


### 要件16: Shadow Config の生成ツールと Example

**ユーザーストーリー:** 開発者として、Shadow Config の設定方法が明確で、簡単に始められることを期待する

#### 受入基準

1. THE システム SHALL TypeScript スキーマから `shadow.config.json` を生成するツールを提供する
2. THE システム SHALL `examples/` ディレクトリに完全な動作例を含む
3. THE Example SHALL TypeScript スキーマ定義のサンプルを含む
4. THE Example SHALL 生成された `shadow.config.json` のサンプルを含む
5. THE Example SHALL Lambda デプロイ用の設定例を含む
6. THE README.md SHALL Shadow Config の作成手順を詳細に説明する
7. THE README.md SHALL Example へのリンクを含む
8. THE ドキュメント SHALL フィールドタイプ（string, number, datetime）の説明を含む
9. THE ドキュメント SHALL デフォルトソート設定の説明を含む
10. THE ドキュメント SHALL TTL 設定の説明を含む
