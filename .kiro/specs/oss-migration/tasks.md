# Implementation Plan

- [ ] 1. 準備フェーズ
  - 新しいブランチを作成（`feature/oss-migration`）
  - バックアップを作成
  - 移行計画を確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. ainews 固有コードの削除
- [ ] 2.1 ディレクトリの削除
  - `apps/` ディレクトリを削除
  - `functions/` ディレクトリを削除
  - `packages/api-types/` ディレクトリを削除
  - `infra/` ディレクトリを削除
  - `config/` ディレクトリを削除
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.2 ルートファイルの削除
  - `.envrc`, `.envrc.example` を削除
  - `Makefile` を削除
  - `CHANGELOG.md` を削除
  - `pnpm-workspace.yaml`, `pnpm-lock.yaml` を削除
  - _Requirements: 2.6, 2.7_

- [ ] 2.3 設定ファイルの削除
  - `prettier.config.cjs` を削除（後で新規作成）
  - `eslint.config.js` を削除（後で新規作成）
  - `tsconfig.base.json` を削除
  - `vitest.setup.ts` を削除（後で新規作成）
  - _Requirements: 2.6, 2.7_

- [ ] 2.4 .kiro/ ディレクトリの整理
  - `.kiro/specs/ainews-pipeline/` を削除
  - `.kiro/steering/` を削除
  - `.kiro/specs/dynamodb-client/` を残す
  - `.kiro/specs/oss-migration/` を残す
  - _Requirements: 2.6, 2.7_

- [ ] 3. ディレクトリ構造の再設計
- [ ] 3.1 ソースコードの移行
  - `packages/core/src/` → `src/` に移動
  - `packages/core/src/client/` → `src/client/` に移動
  - `packages/core/src/server/` → `src/server/` に移動
  - `packages/core/src/shadows/` → `src/shadows/` に移動
  - `packages/core/src/integrations/` → `src/integrations/` に移動
  - `packages/core/src/types.ts` → `src/types.ts` に移動
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3.2 テストコードの移行
  - `packages/core/src/__tests__/` → `__tests__/` に移動
  - ainews 固有のテストケースを削除
  - 汎用的なテストケースのみを残す
  - _Requirements: 3.1, 9.1, 9.2, 9.3_

- [ ] 3.3 packages/ ディレクトリの削除
  - `packages/core/` ディレクトリを削除（移行完了後）
  - `packages/` ディレクトリを削除
  - _Requirements: 3.2_

- [ ] 4. パッケージ設定の更新
- [ ] 4.1 package.json の作成
  - 新しい package.json を作成
  - パッケージ名を `@exabugs/dynamodb-client` に変更
  - npm 公開に必要なフィールドを追加
  - exports フィールドを定義
  - files フィールドを定義
  - scripts を定義
  - dependencies を定義（AWS SDK 固定バージョン）
  - peerDependencies を定義（react-admin）
  - devDependencies を定義
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4_

- [ ] 4.2 .npmignore の作成
  - .npmignore ファイルを作成
  - 不要なファイルを除外
  - _Requirements: 8.5_

- [ ] 4.3 tsconfig.json の作成
  - 新しい tsconfig.json を作成（ESM 用）
  - tsconfig.cjs.json を作成（CJS 用）
  - _Requirements: 3.1_

- [ ] 4.4 vitest.config.ts の作成
  - 新しい vitest.config.ts を作成
  - カバレッジ設定を追加
  - _Requirements: 9.5, 9.6_

- [ ] 4.5 eslint.config.js の作成
  - 新しい eslint.config.js を作成
  - TypeScript ルールを追加
  - _Requirements: 3.1_

- [ ] 4.6 .prettierrc の作成
  - 新しい .prettierrc を作成
  - フォーマットルールを定義
  - _Requirements: 3.1_

- [ ] 5. インポートパスの更新
- [ ] 5.1 クライアントコードのインポート更新
  - `@ainews/core` → `@exabugs/dynamodb-client` に変更
  - `@ainews/api-types` への参照を削除
  - _Requirements: 4.3, 5.1_

- [ ] 5.2 サーバーコードのインポート更新
  - `@ainews/core` → `@exabugs/dynamodb-client` に変更
  - `@ainews/api-types` への参照を削除
  - _Requirements: 4.3, 5.1_

- [ ] 5.3 テストコードのインポート更新
  - `@ainews/core` → `@exabugs/dynamodb-client` に変更
  - `@ainews/api-types` への参照を削除
  - _Requirements: 4.3, 5.1_

- [ ] 6. 国際化対応
- [ ] 6.1 JSDoc コメントの英語化
  - すべての JSDoc コメントを英語に変更
  - _Requirements: 6.3_

- [ ] 6.2 エラーメッセージの英語化
  - すべてのエラーメッセージを英語に変更
  - _Requirements: 6.4_

- [ ] 6.3 コード内コメントの英語化
  - すべてのコード内コメントを英語に変更
  - _Requirements: 6.5_

- [ ] 7. ドキュメントの作成
- [ ] 7.1 README.md の作成
  - プロジェクト概要を記述
  - 主要機能を記述
  - インストール方法を記述
  - クイックスタートを記述
  - 使用例を記述
  - API リファレンスへのリンクを記述
  - ライセンス情報を記述
  - _Requirements: 6.1, 8.6, 8.7, 10.1_

- [ ] 7.2 docs/API.md の作成
  - 完全な API リファレンスを記述
  - _Requirements: 6.2, 10.2_

- [ ] 7.3 docs/ARCHITECTURE.md の作成
  - アーキテクチャ説明を記述
  - _Requirements: 6.2, 10.3_

- [ ] 7.4 docs/MIGRATION.md の作成
  - マイグレーションガイドを記述
  - _Requirements: 6.2, 10.4_

- [ ] 7.5 docs/CLIENT_USAGE.md の移行
  - `packages/core/CLIENT_USAGE.md` を `docs/CLIENT_USAGE.md` に移動
  - 汎用化（ainews 固有の記述を削除）
  - 英語化
  - _Requirements: 6.2_

- [ ] 8. 使用例の作成
- [ ] 8.1 examples/basic/ の作成
  - 基本的な CRUD 操作の例を作成
  - package.json を作成
  - README.md を作成
  - _Requirements: 10.5_

- [ ] 8.2 examples/lambda/ の作成
  - Lambda 統合例（IAM 認証）を作成
  - package.json を作成
  - README.md を作成
  - _Requirements: 10.5_

- [ ] 8.3 examples/webapp/ の作成
  - Web アプリ統合例（Cognito 認証）を作成
  - package.json を作成
  - README.md を作成
  - _Requirements: 10.5_

- [ ] 8.4 examples/react-admin/ の作成
  - react-admin 統合例を作成
  - package.json を作成
  - README.md を作成
  - _Requirements: 10.5_

- [ ] 9. ライセンスとセキュリティ
- [ ] 9.1 LICENSE ファイルの作成
  - MIT License を作成
  - 著作権表示を追加
  - _Requirements: 7.1, 7.2, 7.5_

- [ ] 9.2 SECURITY.md の作成
  - サポートされるバージョンを記述
  - 脆弱性の報告方法を記述
  - セキュリティアップデートのポリシーを記述
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 9.3 CONTRIBUTING.md の作成
  - 開発環境のセットアップ方法を記述
  - コーディング規約を記述
  - プルリクエストのプロセスを記述
  - コミットメッセージの規約を記述
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 9.4 ソースファイルに著作権表示を追加
  - すべてのソースファイルに著作権表示を追加
  - _Requirements: 7.4_

- [ ] 10. Terraform モジュールの整理
- [ ] 10.1 terraform/ ディレクトリの作成
  - `packages/core/terraform/` → `terraform/` に移動
  - ainews 固有のリソースを削除
  - Lambda 関数デプロイ用のモジュールのみを残す
  - _Requirements: 12.1, 12.2_

- [ ] 10.2 terraform/README.md の作成
  - モジュールの使用方法を記述
  - _Requirements: 12.3_

- [ ] 10.3 terraform/examples/ の作成
  - 基本的な使用例を作成
  - 高度な使用例を作成
  - _Requirements: 12.4_

- [ ] 11. CI/CD の設定
- [ ] 11.1 .github/workflows/ci.yml の作成
  - プルリクエスト時のテスト実行を設定
  - プルリクエスト時のビルド実行を設定
  - プルリクエスト時のリント実行を設定
  - main ブランチへのマージ時の npm 公開を設定（オプション）
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 12. テストの実行
- [ ] 12.1 ビルドの実行
  - `npm run build` を実行
  - ビルドエラーを修正
  - _Requirements: 9.4_

- [ ] 12.2 テストの実行
  - `npm test` を実行
  - テストエラーを修正
  - _Requirements: 9.4, 9.5_

- [ ] 12.3 リントの実行
  - `npm run lint` を実行
  - リントエラーを修正
  - _Requirements: 9.4_

- [ ] 12.4 カバレッジの確認
  - `npm run test:coverage` を実行
  - カバレッジ 80% 以上を確認
  - _Requirements: 9.4_

- [ ] 13. 最終確認
- [ ] 13.1 パッケージ名の確認
  - すべてのファイルで `@exabugs/dynamodb-client` を使用していることを確認
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 13.2 ainews 依存の確認
  - すべてのファイルで `@ainews/*` への参照がないことを確認
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1_

- [ ] 13.3 ディレクトリ構造の確認
  - ディレクトリ構造が設計通りであることを確認
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 13.4 英語ドキュメントの確認
  - すべてのドキュメントが英語で記述されていることを確認
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 13.5 npm 公開可能性の確認
  - package.json が npm 公開に必要なフィールドを含むことを確認
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 14. Checkpoint - すべてのテストが通過することを確認
  - すべてのテストが通過することを確認
  - ユーザーに質問がある場合は確認

- [ ] 15. npm 公開テスト
- [ ] 15.1 npm pack の実行
  - `npm pack` を実行
  - パッケージの内容を確認
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 15.2 npm publish --dry-run の実行
  - `npm publish --dry-run` を実行
  - 公開内容を確認
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 16. ドキュメントの最終レビュー
- [ ] 16.1 README.md のレビュー
  - README.md が完全であることを確認
  - _Requirements: 10.1_

- [ ] 16.2 API ドキュメントのレビュー
  - docs/API.md が完全であることを確認
  - _Requirements: 10.2_

- [ ] 16.3 使用例のレビュー
  - examples/ が実際に動作することを確認
  - _Requirements: 10.5_

- [ ] 17. Final Checkpoint - すべてのタスクが完了したことを確認
  - すべてのタスクが完了したことを確認
  - ユーザーに質問がある場合は確認
