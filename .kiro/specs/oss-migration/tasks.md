# Implementation Plan

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

- [ ] 13. 最終確認
- [ ] 13.1 英語ドキュメントの確認
  - すべてのドキュメントが英語で記述されていることを確認
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 14. Checkpoint - すべてのテストが通過することを確認
  - すべてのテストが通過することを確認
  - ユーザーに質問がある場合は確認

- [ ] 15. Git 履歴のクリーンアップ
- [ ] 15.1 Git 履歴の削除
  - 新しい orphan ブランチを作成（`git checkout --orphan main-clean`）
  - すべてのファイルを追加（`git add -A`）
  - 初回コミット作成（`git commit -m "Initial commit for public release"`）
  - 古い main ブランチを削除（`git branch -D main`）
  - 新しいブランチを main にリネーム（`git branch -m main`）
  - _Requirements: 8.1, 8.2_

- [ ] 15.2 リモートリポジトリの更新
  - force push で履歴を上書き（`git push -f origin main`）
  - GitHub リポジトリの設定を確認
  - _Requirements: 8.1, 8.2_

- [ ] 15.3 履歴削除の確認
  - `git log` でコミット履歴が1つのみであることを確認
  - リポジトリサイズが削減されたことを確認
  - すべてのファイルが正しく含まれていることを確認
  - _Requirements: 8.1, 8.2_

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




## Shadow Config 生成ツールと Example

- [ ] 18. Shadow Config 生成ツールと Example の実装
  - TypeScript スキーマから shadow.config.json を生成するツールと、完全な動作例を提供する
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_

- [ ] 18.1 Schema 型定義の追加
  - `src/shadows/schema.ts` に型定義を追加
  - `ShadowFieldType`, `ResourceSchema`, `SchemaRegistryConfig` を定義
  - _Requirements: 16.1_

- [ ] 18.2 生成スクリプトの実装
  - `src/scripts/generate-shadow-config.ts` を実装
  - TypeScript スキーマファイルを読み込み、`shadow.config.json` を生成
  - CLI として実行可能にする（shebang, bin 設定）
  - _Requirements: 16.1_

- [x] 18.3 package.json の更新
  - `bin` フィールドに `generate-shadow-config` を追加
  - `exports` に `./shadows` を追加
  - _Requirements: 16.1_

- [x] 18.4 Basic Example の作成
  - `examples/basic/` ディレクトリを作成
  - `schema.ts` - TypeScript スキーマ定義のサンプル
  - `shadow.config.json` - 生成された設定のサンプル
  - `README.md` - Example の説明
  - _Requirements: 16.2, 16.3, 16.4_

- [x] 18.5 Basic Example: Lambda デプロイは不要
  - ライブラリが既に完全な Lambda ハンドラーを提供（`@exabugs/dynamodb-client/server/handler`）
  - ユーザーは Terraform で直接デプロイ可能
  - カスタムハンドラーは不要
  - _Requirements: 16.5_

- [x] 18.6 Basic Example: Client 使用例
  - `examples/basic/client/` ディレクトリを作成
  - `index.ts` - クライアント使用例
  - `package.json` - 依存関係
  - _Requirements: 16.2_

- [x] 18.7 Advanced Example の作成
  - `examples/advanced/` ディレクトリを作成
  - 複数リソース、TTL 設定を含むスキーマ
  - _Requirements: 16.3, 16.9, 16.10_

- [x] 18.7.1 Terraform Examples の確認
  - `terraform/examples/basic/` が存在することを確認
  - `terraform/examples/advanced/` が存在することを確認
  - Examples README から Terraform Examples へのリンクを追加
  - _Requirements: 16.5_

- [x] 18.8 React Admin Example の作成
  - `examples/react-admin/` ディレクトリを作成
  - dataProvider, authProvider, main, App, resources/articles を実装
  - _Requirements: 16.2_

- [x] 18.9 README の更新
  - Quick Start セクションを更新
  - TypeScript スキーマ定義から始める手順に変更
  - Example へのリンクを追加
  - _Requirements: 16.6, 16.7_

- [x] 18.10 ドキュメントの追加
  - `docs/SHADOW_CONFIG.md` を作成
  - フィールドタイプの詳細説明
  - デフォルトソート設定の説明
  - TTL 設定の説明
  - _Requirements: 16.8, 16.9, 16.10_

- [ ] 18.11 テストの追加
  - 生成スクリプトの Unit Test
  - Example の Integration Test（CI で自動実行）
  - _Requirements: 16.1_

- [ ] 18.12 Checkpoint - すべてのテストが通ることを確認
  - すべてのテストが通ることを確認し、ユーザーに質問があれば尋ねる
