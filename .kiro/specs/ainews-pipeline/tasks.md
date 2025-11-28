# 実装タスクリスト

## 完了済みフェーズ

### フェーズ1: 基盤構築 ✅

すべてのタスクが完了しました：
- ✅ モノレポセットアップ（pnpm workspace）
- ✅ 共通ライブラリ（@ainews/core, @ainews/shadows, @ainews/api-types）
- ✅ テスト環境（Vitest）
- ✅ Lint/Format設定（ESLint 9 + Prettier）
- ✅ shadow.config.json設定ファイル

### フェーズ2: インフラ基盤（Terraform） ✅

すべてのコアインフラモジュールが完了しました：
- ✅ Terraform基本設定（backend, providers, variables）
- ✅ 環境別設定（dev, stg, prd）
- ✅ DynamoDB Single-Table
- ✅ S3 Assets Bucket
- ✅ CloudFront CDN
- ✅ Cognito User Pool + Hosted UI

### フェーズ3: Records Lambda + Function URL ✅

すべてのタスクが完了しました：
- ✅ Records Lambda実装（10操作完全対応）
- ✅ Records Lambda Terraform実装（Function URL + IAM + 環境変数）
- ✅ Shadow Config環境変数化（SSM不要、コスト削減）
- ✅ @ainews/shadowsパッケージSSM対応
- ✅ Lambda関数のビルドとデプロイ（Terraformによる自動ZIP作成）

**重要な運用ポイント:**
- shadow.config.jsonを変更した場合、Terraformで再度applyすること（環境変数として設定）
- Lambda関数のデプロイ前に必ずビルド（`pnpm build`）を実行すること

### フェーズ4: Admin UI（React + react-admin） ✅

すべてのタスクが完了しました：
- ✅ Viteプロジェクトセットアップ（React 19 + react-admin 5 + MUI 6）
- ✅ Amplify v6認証統合（Cognito Hosted UI + PKCE）
- ✅ グローバルサインアウト + 自動再ログイン防止
- ✅ Records Lambda HTTP API統合（MongoDB 風 API の10操作）
- ✅ nextTokenベースのページネーション対応
- ✅ Articlesリソース実装（List/Create/Edit/Show）
- ✅ Tasksリソース実装（List/Create/Edit/Show）
- ✅ 環境変数設定（.env.example）
- ✅ MongoDB 風 API への統一（find, insertOne, updateOne, deleteOne など）

**実装の特徴:**
- **MongoDB 風 API**: Lambda API を MongoDB 風に統一（react-admin 色を排除）
- **単一ファイルリソース**: List/Create/Edit/Showを1ファイルで管理
- **ログアウト改善**: グローバルサインアウトで完全なセッションクリア
- **開発環境対応**: `VITE_DISABLE_AUTH=true`で認証スキップ可能

**修正済みの問題:**
- ✅ Query 最適化とメモリ内フィルタリングの二重適用問題を解決（2025-11-23）
  - Query 最適化の SK 値を修正（`starts` オペレーターで `#id#` を含めない）
  - メモリ内フィルタリングの除外ロジックを削除（冪等性により二重適用しても問題なし）
  - すべてのフィルター条件をメモリ内で再適用することで正確性を保証

---

## 次の実装フェーズ

**完了済みフェーズ:**
- ✅ フェーズ1: 基盤構築
- ✅ フェーズ2: インフラ基盤（Terraform）
- ✅ フェーズ3: Records Lambda + Function URL
- ✅ フェーズ4: Admin UI（React + react-admin）
- ✅ フェーズ4.5: IAMロール分離とセキュリティ強化
- ✅ フェーズ4.7: バルク操作のスケーラビリティ強化
- ✅ フェーズ4.8: Fetch実行履歴とデータ保持期間管理
- ✅ フェーズ4.9: バルク操作レスポンス形式の統一

**次の推奨フェーズ:**
- ⏳ フェーズ4.6: 高度なフィルター検索機能
- ⏳ フェーズ5: パイプライン層（Fetch Lambda）


### フェーズ4: Admin UI（React + react-admin） ✅

このフェーズは完了しました。React + react-admin + Viteを使用したWeb管理画面が実装されています。

- [x] 9. Admin UI基本セットアップ
  - [x] 9.1 Viteプロジェクト作成
    - apps/admin/ディレクトリ作成
    - package.json作成（react 19, react-admin 5, @mui/material 6, vite, @aws-amplify/auth 6）
    - vite.config.ts設定
    - tsconfig.json設定
    - index.html作成
    - _要件: 2.1_
  - [x] 9.2 認証プロバイダー実装
    - src/authProvider.ts作成（Amplify v6統合）
    - Cognito Hosted UI統合（PKCE + OAuth 2.0 code flow）
    - login/logout/checkAuth/checkError/getPermissions実装
    - グローバルサインアウト実装（`signOut({ global: true })`）
    - 自動再ログイン防止機構（signedOutフラグ + Amplifyキークリア）
    - _要件: 2.3, 2.7, 2.8, 9.1_
  - [x] 9.3 データプロバイダー実装
    - src/dataProvider.ts作成
    - react-admin完全準拠の10操作実装（getList, getOne, getMany, getManyReference, create, update, updateMany, delete, deleteMany, createMany）
    - HTTP POST リクエスト（Records Lambda Function URL）
    - Authorization ヘッダー設定（Cognito JWT）
    - nextTokenベースのページネーション対応
    - エラーハンドリング
    - _要件: 2.2, 2.5, 9.2_
  - [x] 9.4 App.tsx実装
    - <Admin>コンポーネント設定
    - authProvider, dataProvider統合
    - リソース定義（articles, tasks）
    - MUIテーマ設定（コメントアウト済み）
    - _要件: 2.1_
  - [x] 9.5 LoginPage実装
    - src/components/LoginPage.tsx作成
    - MUI Paper + Button UIデザイン
    - Cognito Hosted UIリダイレクトボタン（明示的クリックのみ）
    - ローディング状態管理（Backdrop + CircularProgress）
    - _要件: 2.4, 2.5, 2.6_

- [x] 10. Admin UIリソース実装
  - [x] 10.1 Articlesリソース実装
    - src/resources/articles.tsx作成（単一ファイル構成）
    - List: Datagrid表示（id, name, category, status, createdAt, updatedAt）
    - List: ページネーション（nextToken対応、perPage=25）
    - List: ソート機能（name, category, status, createdAt, updatedAt）
    - List: フィルター機能（category, status）
    - Create: SimpleForm（name, category, status）
    - Edit: SimpleForm（name, category, status編集）
    - Show: SimpleShowLayout（全フィールド表示）
    - _要件: 2.1, 2.5, 2.9_
  - [x] 10.2 Tasksリソース実装
    - src/resources/tasks.tsx作成（単一ファイル構成）
    - List: Datagrid表示（id, name, status, dueDate, createdAt, updatedAt）
    - List: ページネーション（nextToken対応、perPage=25）
    - List: ソート機能（name, status, dueDate, createdAt, updatedAt）
    - List: フィルター機能（status）
    - Create: SimpleForm（name, status, dueDate, assignee, description）
    - Edit: SimpleForm（全フィールド編集）
    - Show: SimpleShowLayout（全フィールド表示）
    - _要件: 2.1, 2.5_

- [x] 11. Admin UI環境変数設定
  - [x] 11.1 .env.example作成
    - VITE_RECORDS_API_URL
    - VITE_COGNITO_USER_POOL_ID
    - VITE_COGNITO_USER_POOL_CLIENT_ID
    - VITE_COGNITO_REGION
    - VITE_DISABLE_AUTH（開発環境用）
    - _要件: 2.3, 9.2_
  - [x] 11.2 main.tsx Amplify設定
    - Amplify.configure()実装
    - Cognito OAuth設定（domain, scopes, redirectSignIn, redirectSignOut）
    - BrowserRouter設定
    - _要件: 2.3_

- [x] 11.5 ログアウト機能の修正
  - [x] 11.5.1 authProvider.tsのlogout処理を修正
    - `signOut({ global: true })`でCognitoセッションを完全に破棄
    - `localStorage.setItem('ainews.signedOut', '1')`でログアウトフラグ設定
    - Amplifyローカルストレージキーの明示的クリア（`amplify-signin-with-hostedUI`等）
    - Cognito Hosted UIの/logoutエンドポイントへのリダイレクト
    - _要件: 2.7, 2.8, 9.1_
  - [x] 11.5.2 checkAuth改善
    - ログアウトフラグがある場合は即座に拒否
    - 自動ログインを試みない（明示的なSignInボタンクリックまで待機）
    - _要件: 2.6, 2.8_

- [ ]* 12. Amplify Hosting設定（Terraform）（オプション）
  - infra/modules/hosting/amplify作成
  - Amplify App作成
  - Git連携設定
  - ビルド設定（amplify.yml）
  - _要件: 2.1_

**実装のポイント:**
- **単一ファイルリソース**: List/Create/Edit/Showを1ファイルで管理し、保守性を向上
- **Amplify v6**: 最新の`@aws-amplify/auth`パッケージを使用
- **ログアウト改善**: グローバルサインアウト + 自動再ログイン防止で、ユーザー体験を改善
- **nextTokenページネーション**: DynamoDBのnextTokenベースの無限スクロール対応
- **開発環境対応**: `VITE_DISABLE_AUTH=true`で認証をスキップ可能（テスト用）

### フェーズ4.5: IAMロール分離とセキュリティ強化 ✅

このフェーズは完了しました。Records LambdaとFetch LambdaのIAMロールを分離し、最小権限の原則に従ったセキュリティ強化を実施しました。

- [x] 12.4 idシャドウ冗長性の解消
  - [x] 12.4.1 @ainews/shadowsパッケージ更新
    - packages/shadows/src/config.tsのREQUIRED_SHADOW_FIELDSから`id`フィールドを削除
    - idフィールドは本体レコード（SK = id#{ULID}）として既に存在するため、別途シャドーレコードを生成しない
    - _要件: 5.2, 5.3_
  - [x] 12.4.2 Records Lambda find操作の更新
    - functions/records/src/operations/find.tsを更新
    - sort.field='id'の場合、本体レコード（SK = id#{ULID}）を直接クエリするロジックを追加
    - 既存のシャドーレコードクエリロジックと分岐処理を実装
    - _要件: 5.5, 5.6_
  - [x] 12.4.3 既存データのクリーンアップ（オプション）
    - 既存のidシャドーレコード（SK = id#{ULID}#id#{ULID}）を削除するメンテナンススクリプト作成
    - DynamoDB Scanで冗長なidシャドーを検出
    - BatchWriteItemで削除実行
    - dryRunモードサポート
    - _要件: 5.3_
  - [x] 12.4.4 ユニットテスト更新
    - packages/shadows/__tests__/config.test.tsで既に実装済み
    - REQUIRED_SHADOW_FIELDSに`id`が含まれないことを確認
    - getAllShadowFields()の戻り値に`id`が含まれないことを確認
    - isValidShadowField()で`id`が無効であることを確認
    - _要件: 10.2_
  - [x] 12.4.5 統合テスト更新
    - functions/records/__tests__/operations/find.test.tsを更新
    - sort.field='id'のテストケース追加（ASC/DESC）
    - 本体レコードが直接クエリされることを確認
    - filter.id='xxx'の場合、特定のIDのレコードを取得することを確認
    - BatchGetCommandが呼ばれないことを確認（最適化）
    - すべてのテストがパス（10/10）
    - _要件: 10.2_

- [x] 12.5 Records Lambda IAMロール分離
  - [x] 12.5.1 Records Lambda専用IAMロール作成
    - infra/modules/api/lambda-records/main.tfのIAMロール部分を更新
    - aws_iam_role作成（ainews-{env}-records-lambda-role）
    - assume_role_policy設定（Lambda.amazonaws.com）
    - タグ設定（Environment, ManagedBy, Purpose）
    - _要件: 9.6, 9.23_
  - [x] 12.5.2 AWSマネージドポリシーアタッチ
    - aws_iam_role_policy_attachment作成（AWSLambdaBasicExecutionRole）
    - aws_iam_role_policy_attachment作成（AWSXRayDaemonWriteAccess）
    - _要件: 9.8, 9.11, 9.22_
  - [x] 12.5.3 カスタムインラインポリシー作成（DynamoDB）
    - aws_iam_role_policy作成（dynamodb-access）
    - Action: GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan, BatchGetItem, TransactWriteItems
    - Resource: arn:aws:dynamodb:{region}:{account}:table/ainews-{env}-records
    - _要件: 9.7, 9.9, 9.20, 9.21_
  - [x] 12.5.4 不要な権限の削除確認
    - S3アクセス権限が含まれていないことを確認
    - SSMアクセス権限が含まれていないことを確認（環境変数化により不要）
    - Lambda Invoke権限が含まれていないことを確認
    - _要件: 9.10, 9.17_
  - [x] 12.5.5 Terraform outputs更新
    - infra/modules/api/lambda-records/outputs.tf更新
    - role_arn出力を追加
    - _要件: 9.24_
  - [x] 12.5.6 権限不足エラーハンドリング実装
    - functions/records/src/utils/dynamodb.ts更新
    - AccessDeniedExceptionキャッチ処理追加
    - CloudWatch Logsへの詳細ログ出力
    - _要件: 9.25_

**実装の特徴:**
- **idシャドウ冗長性の解消**: 本体レコードを直接クエリすることで、ストレージコスト削減とパフォーマンス向上
- **最小権限の原則**: Records Lambda専用IAMロールで必要最小限の権限のみを付与
- **セキュリティ強化**: AWSマネージドポリシーを活用し、カスタムポリシーは具体的なリソースARNを指定

### フェーズ4.6: 高度なフィルター検索機能

このフェーズでは、Records Lambda getList操作に高度なフィルター検索機能を追加します。拡張フィールド構文（`フィールド名:オペレータ:型`）をサポートし、7種類の演算子（eq, lt, lte, gt, gte, starts, ends）を実装します。

### フェーズ4.7: バルク操作のスケーラビリティ強化

このフェーズでは、createMany、updateMany、deleteManyの各操作で、TransactWriteItemsの100アイテム制限を超えるリクエストを処理できるよう、チャンク分割機能を実装します。

- [x] 12.6 フィルター処理ユーティリティの拡張
  - [x] 12.6.1 フィルターフィールド構文パーサー実装
    - functions/records/src/utils/filter.ts更新
    - parseFilterField関数実装（`フィールド名:オペレータ:型` をパース）
    - FilterOperator型定義（'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'starts' | 'ends'）
    - FilterType型定義（'string' | 'number' | 'date' | 'boolean'）
    - デフォルト値処理（オペレータ未指定時はeq、型未指定時はstring）
    - 構文エラーハンドリング（INVALID_FILTER）
    - _要件: 12.1, 12.3, 12.4, 12.5, 12.10_
  - [x] 12.6.2 Query最適化ロジック実装
    - findOptimizableFilter関数実装（ソートフィールドと一致するフィルター条件を検出）
    - buildOptimizedKeyCondition関数実装（KeyConditionExpression構築）
    - Query可能な演算子の判定（eq, lt, lte, gt, gte, starts）
    - シャドーSK値のエンコード処理
    - _要件: 12.7_
  - [x] 12.6.3 メモリ内フィルタリング実装
    - matchesFilter関数実装（単一フィルター条件の判定）
    - matchesAllFilters関数実装（AND条件での複数フィルター判定）
    - 型変換ヘルパー実装（convertType関数: string, number, date, boolean）
    - 演算子ごとの比較ロジック実装（eq, lt, lte, gt, gte, starts, ends）
    - ends演算子の後方一致判定実装
    - boolean型の処理（"true"/"false"文字列とboolean値の両方をサポート）
    - _要件: 12.2, 12.6, 12.8, 12.9_
  - [ ]* 12.6.4 フィルターユーティリティのユニットテスト
    - functions/records/src/__tests__/utils/filter.test.ts作成
    - parseFilterField関数のテスト（正常系・異常系）
    - findOptimizableFilter関数のテスト
    - matchesFilter関数のテスト（全演算子）
    - matchesAllFilters関数のテスト（AND条件）
    - 型変換のテスト（string, number, date, boolean）
    - _要件: 10.2_

- [x] 12.7 getList操作の更新
  - [x] 12.7.1 getList処理フローの更新
    - functions/records/src/operations/getList.ts更新
    - フィルター条件のパース処理追加
    - Query最適化ロジックの統合
    - DynamoDB Query実行（最適化されたKeyConditionExpression）
    - BatchGetItemで本体レコード取得
    - メモリ内フィルタリングの適用
    - フィルター適用後のページネーション処理
    - _要件: 12.6, 12.7, 12.11_
  - [x] 12.7.2 既存のFilterExpression処理の削除
    - DynamoDBのFilterExpressionを使用していた旧実装を削除
    - シャドーレコード除外条件は維持（メモリ内で処理）
    - _要件: 12.6_
  - [x] 12.7.3 エラーハンドリングの更新
    - フィルターフィールド構文エラーのハンドリング追加
    - INVALID_FILTERエラーメッセージの改善
    - _要件: 12.10_
  - [ ]* 12.7.4 getList統合テスト
    - functions/records/src/__tests__/operations/getList.test.ts更新
    - 拡張フィールド構文のテスト（全演算子）
    - Query最適化のテスト（ソートフィールド一致時）
    - メモリ内フィルタリングのテスト（複数条件）
    - ページネーション動作のテスト（フィルター適用後）
    - _要件: 10.2_

- [x] 12.8 Admin UIフィルター機能の更新
  - [x] 12.8.1 Articlesリソースのフィルター拡張
    - apps/admin/src/resources/articles.tsx更新
    - 拡張フィールド構文を使用したフィルター実装
    - 範囲検索フィルター追加（priority:gte:number, priority:lte:number）
    - 前方一致フィルター追加（name:starts）
    - 日時範囲フィルター追加（createdAt:gte:date, createdAt:lte:date）
    - boolean型フィルター追加（isPublished:eq:boolean）
    - _要件: 12.12_
  - [x] 12.8.2 Tasksリソースのフィルター拡張
    - apps/admin/src/resources/tasks.tsx更新
    - 拡張フィールド構文を使用したフィルター実装
    - 日時範囲フィルター追加（dueDate:gte:date, dueDate:lte:date）
    - 前方一致フィルター追加（name:starts）
    - _要件: 12.12_
  - [ ]* 12.8.3 フィルターUIコンポーネントの改善（オプション）
    - カスタムフィルターコンポーネント作成
    - 範囲検索用の入力フィールド（From/To）
    - 日時ピッカーの統合
    - _要件: 12.12_

- [ ]* 12.9 ドキュメント更新
  - [ ]* 12.9.1 API仕様ドキュメント更新
    - docs/api.md更新（存在する場合）
    - フィルターフィールド構文の説明追加
    - 演算子一覧と使用例追加
    - Query最適化の説明追加
    - _要件: 12.1, 12.2_
  - [ ]* 12.9.2 README更新
    - README.md更新
    - 高度なフィルター検索機能の説明追加
    - 使用例の追加
    - _要件: 12.1_

**実装のポイント:**
- **後方互換性**: 従来の単純なフィルター形式（`{ status: "published" }`）も引き続きサポート
- **Query最適化**: ソートフィールドと一致するフィルター条件を自動検出して最適化
- **メモリ内フィルタリング**: DynamoDBの制限（ends_withがない等）を回避
- **型安全性**: TypeScriptの型定義で演算子と型の組み合わせを保証

### フェーズ4.7: バルク操作のスケーラビリティ強化

このフェーズでは、createMany、updateMany、deleteManyの各操作で、TransactWriteItemsの100アイテム制限を超えるリクエストを処理できるよう、チャンク分割機能を実装します。

- [x] 12.15 シャドウ設定生成スクリプトの修正（緊急）
  - [x] 12.15.1 shadow.config.json構造の修正
    - packages/api-types/scripts/generate-shadow-config.ts更新
    - `fields`キーを`shadows`キーに変更
    - 生成される構造を`packages/shadows`の型定義に合わせる
    - _要件: 5.1, 5.2_
  - [x] 12.15.2 設定ファイルの再生成
    - `cd packages/api-types && pnpm build`を実行
    - config/shadow.config.jsonが正しい構造で生成されることを確認
    - _要件: 5.1_
  - [x] 12.15.3 Records Lambdaの再ビルドとデプロイ
    - `cd functions/records && pnpm build`を実行
    - Terraformで再デプロイ（`cd infra && make apply-auto`）
    - 環境変数SHADOW_CONFIGが更新されることを確認
    - source_code_hashに設定ファイルのハッシュを含めて自動再デプロイを実現
    - _要件: 6.5_
  - [x] 12.15.4 動作確認
    - Admin UIでTasksリソースのList画面を開く
    - statusフィールドでソートが正常に動作することを確認
    - エラーが発生しないことを確認
    - _要件: 2.5_

- [ ] 12.10 共通チャンク分割ユーティリティの実装
  - [x] 12.10.1 チャンク分割関数の実装
    - functions/records/src/utils/chunking.ts作成
    - calculateChunks関数実装（動的チャンクサイズ計算）
    - ChunkResult型定義（chunk配列、各チャンクのアイテム数）
    - 単一レコードが100アイテムを超える場合のバリデーション
    - _要件: 13.1, 13.2, 13.7, 13.8, 13.9_
  - [x] 12.10.2 チャンク実行ヘルパーの実装
    - executeChunks関数実装（チャンクの順次実行）
    - 各チャンクの成功・失敗を追跡
    - 部分成功のサポート（1つのチャンクが失敗しても継続）
    - 結果の集約（成功レコード、失敗ID、エラー情報）
    - _要件: 13.3, 13.4, 13.5, 13.6_
  - [x] 12.10.3 ログ出力の実装
    - チャンク数、各チャンクのアイテム数をログ出力
    - 各チャンクの処理時間を測定・記録
    - 部分失敗時の詳細ログ出力
    - _要件: 13.10_
  - [x] 12.10.4 チャンク分割ユーティリティのユニットテスト
    - functions/records/src/__tests__/utils/chunking.test.ts作成
    - calculateChunks関数のテスト（正常系・異常系）
    - executeChunks関数のテスト（成功・部分失敗・完全失敗）
    - 100アイテム制限のバリデーションテスト
    - _要件: 10.2_

- [x] 12.11 createMany操作のチャンク分割対応
  - [x] 12.11.1 createMany処理フローの更新
    - functions/records/src/operations/createMany.ts更新
    - 既存の簡易実装（最初の100件のみ処理）を削除
    - アイテム数計算関数の実装（1 + シャドー数）
    - calculateChunks関数を使用してチャンク分割
    - executeChunks関数を使用してチャンク実行
    - _要件: 13.1, 13.2, 13.3, 13.7_
  - [x] 12.11.2 エラーハンドリングの改善
    - チャンクレベルの失敗をハンドリング
    - レコードレベルの成功・失敗を追跡
    - 詳細なエラー情報を返却（failedIds、errors配列）
    - _要件: 13.4, 13.5, 13.6, 13.11_
  - [x] 12.11.3 タイムアウト対策
    - Lambda実行時間制限（15分）を考慮
    - 大量レコード処理時の警告ログ出力
    - _要件: 13.12_
  - [ ]* 12.11.4 createMany統合テスト
    - functions/records/src/__tests__/operations/createMany.test.ts更新
    - 100件超のレコード作成テスト
    - 部分失敗のテスト（一部のチャンクが失敗）
    - シャドー数が多いレコードのテスト
    - _要件: 10.2_

- [x] 12.12 updateMany操作のチャンク分割対応
  - [x] 12.12.1 updateMany処理フローの更新
    - functions/records/src/operations/updateMany.ts更新
    - 既存の簡易実装（最初の100件のみ処理）を削除
    - アイテム数計算関数の実装（1 + 削除シャドー数 + 追加シャドー数）
    - calculateChunks関数を使用してチャンク分割
    - executeChunks関数を使用してチャンク実行
    - _要件: 13.1, 13.2, 13.3, 13.8_
  - [x] 12.12.2 エラーハンドリングの改善
    - チャンクレベルの失敗をハンドリング
    - レコードレベルの成功・失敗を追跡
    - 詳細なエラー情報を返却（failedIds、errors配列）
    - _要件: 13.4, 13.5, 13.6, 13.11_
  - [x] 12.12.3 タイムアウト対策
    - Lambda実行時間制限（15分）を考慮
    - 大量レコード処理時の警告ログ出力
    - _要件: 13.12_
  - [ ]* 12.12.4 updateMany統合テスト
    - functions/records/src/__tests__/operations/updateMany.test.ts更新
    - 100件超のレコード更新テスト
    - 部分失敗のテスト（一部のチャンクが失敗）
    - シャドー差分が大きいレコードのテスト
    - _要件: 10.2_

- [x] 12.13 deleteMany操作のチャンク分割対応
  - [x] 12.13.1 deleteMany処理フローの更新
    - functions/records/src/operations/deleteMany.ts更新
    - 既存の簡易実装（最初の100件のみ処理）を削除
    - アイテム数計算関数の実装（1 + シャドー数）
    - calculateChunks関数を使用してチャンク分割
    - executeChunks関数を使用してチャンク実行
    - _要件: 13.1, 13.2, 13.3, 13.9_
  - [x] 12.13.2 エラーハンドリングの改善
    - チャンクレベルの失敗をハンドリング
    - レコードレベルの成功・失敗を追跡
    - 詳細なエラー情報を返却（failedIds、errors配列）
    - _要件: 13.4, 13.5, 13.6, 13.11_
  - [x] 12.13.3 タイムアウト対策
    - Lambda実行時間制限（15分）を考慮
    - 大量レコード処理時の警告ログ出力
    - _要件: 13.12_
  - [ ]* 12.13.4 deleteMany統合テスト
    - functions/records/src/__tests__/operations/deleteMany.test.ts更新
    - 100件超のレコード削除テスト
    - 部分失敗のテスト（一部のチャンクが失敗）
    - シャドー数が多いレコードのテスト
    - _要件: 10.2_

- [ ]* 12.14 ドキュメント更新
  - [ ]* 12.14.1 API仕様ドキュメント更新
    - docs/api.md更新（存在する場合）
    - バルク操作のチャンク分割の説明追加
    - 制限事項の説明追加（単一レコードが100アイテムを超える場合）
    - _要件: 13.1, 13.2_
  - [ ]* 12.14.2 README更新
    - README.md更新
    - バルク操作のスケーラビリティ機能の説明追加
    - 使用例の追加
    - _要件: 13.1_

**実装のポイント:**
- **動的チャンクサイズ**: 各レコードのアイテム数（メイン + シャドー）を考慮して最適なチャンクサイズを計算
- **部分成功サポート**: 1つのチャンクが失敗しても、他のチャンクは処理を継続
- **詳細なエラー報告**: 成功・失敗したレコードを個別に追跡し、詳細なエラー情報を返却
- **パフォーマンス最適化**: 可能な限り大きなチャンクサイズを使用してDynamoDB呼び出し回数を最小化
- **後方互換性**: 既存のAPIインターフェースを変更せず、内部実装のみを改善

### フェーズ4.8: Fetch実行履歴とデータ保持期間管理 ✅

このフェーズでは、Fetch実行履歴の記録、プロバイダー別実行制御、データ保持期間管理（TTL）を実装します。

- [x] 15.1 FetchLogリソース実装
  - FetchLog型定義（id, name, provider, status, fetchedCount, failedCount, errorMessage, executedAt, ttl, createdAt, updatedAt）
  - FetchLogスキーマ定義（ソート可能フィールド: name, provider, status, executedAt, createdAt, updatedAt）
  - shadow.config.json自動生成
  - _要件: 15.1, 15.2, 15.3_

- [x] 15.2 Admin UI FetchLogリソース追加
  - FetchLogリスト表示（プロバイダー、ステータス、取得件数、実行日時）
  - FetchLog詳細表示（エラーメッセージ、TTL）
  - ステータス・プロバイダー別の色分け表示
  - リソース整合性テスト追加
  - _要件: 15.4_

- [x] 15.3 Fetch Lambda FetchLog記録機能
  - プロバイダー別実行結果の記録
  - 実行開始時にFetchLog作成
  - 実行完了時にFetchLog更新（取得件数、ステータス）
  - エラー時のエラーメッセージ記録
  - 部分成功時のステータス（partial）記録
  - _要件: 15.5, 15.6, 15.7, 15.8_

- [x] 15.4 プロバイダー別実行制御
  - invocation payloadの`provider`フィールドでプロバイダー指定（newsapi, gnews, apitube）
  - 未指定時は全プロバイダー順次実行
  - プロバイダー別の実行結果を個別に記録
  - EventBridge Schedulerで各プロバイダーを別々のスケジュールで実行可能
  - _要件: 15.9, 15.10, 15.11, 15.12_

- [x] 15.5 TTL設定機能実装
  - TTLユーティリティ関数（calculateTTL, addTTL）
  - リソース別デフォルトTTL期間（articles: 90日、fetchLogs: 30日）
  - 環境変数でTTL期間を上書き可能（ARTICLES_TTL_DAYS, FETCHLOGS_TTL_DAYS）
  - insertOne/insertMany操作でTTL自動設定
  - _要件: 16.1, 16.2, 16.3, 16.4, 16.11, 16.12_

- [x] 15.6 DynamoDB TTL設定
  - DynamoDB Terraformモジュールで既にTTL有効化済み（ttlフィールド）
  - _要件: 16.2, 16.5_

**実装の特徴:**
- **FetchLog記録**: 各プロバイダーの実行結果を個別に記録し、監視を容易に
- **プロバイダー別実行**: invocation payloadで実行対象プロバイダーを制御し、無料枠内での運用を実現
- **EventBridge統合**: 各プロバイダーを別々のスケジュールで実行可能（例: newsapi 1時間ごと、gnews 2時間ごと）
- **TTL自動設定**: リソース作成時に自動的にTTL設定し、古いデータを自動削除
- **柔軟な設定**: 環境変数でTTL期間を調整可能

### フェーズ4.9: バルク操作レスポンス形式の統一 ✅

このフェーズでは、Records Lambdaのバルク操作レスポンス形式を統一し、Collection.tsでMongoDB互換形式に変換します。

**完了日:** 2025-11-25

**実装内容:**
- ✅ Records Lambda統一レスポンス形式の定義（BulkOperationResult）
- ✅ insertMany, updateMany, deleteManyの統一レスポンス形式実装
- ✅ Collection.tsでのMongoDB互換形式への変換
- ✅ 型定義の整備（InsertManyResult, UpdateManyResult, DeleteManyResult）

**実装のポイント:**
- **情報の保持**: Records Lambdaは統一形式で全情報を保持（successIds, failedIds, errors）
- **MongoDB互換性**: Collection.tsはMongoDB互換形式に変換（acknowledged, insertedCount, insertedIds等）
- **型安全性**: TypeScriptの型定義で統一形式とMongoDB互換形式を保証
- **後方互換性**: 既存のAPIインターフェースを変更せず、内部実装のみを改善

### フェーズ5: パイプライン層（Fetch Lambda）

このフェーズでは、ニュース記事を自動取得するFetch Lambdaを実装します。

- [ ] 13. Fetch Lambda実装
  - [x] 13.1 Fetch Lambda プロジェクトセットアップ
    - functions/pipeline/fetch/package.json作成（依存関係: @ainews/core, @aws-sdk/client-ssm, @aws-sdk/client-lambda）
    - functions/pipeline/fetch/tsconfig.json作成
    - functions/pipeline/fetch/esbuild.config.js作成
    - ディレクトリ構造作成（src/providers/）
    - _要件: 10.1_
  - [x] 13.2 Fetch Lambda handler実装
    - handler.ts作成（lambdaHandler関数）
    - 環境変数検証（ENV, REGION, PARAM_PATH, RECORDS_FUNCTION_NAME）
    - SSM Parameter Store読み取り（GetParametersByPath）
    - Records Lambda呼び出し（InvokeCommand + createMany操作）
    - エラーハンドリング（CONFIG_ERROR, INVOKE_ERROR）
    - 権限不足エラーハンドリング（AccessDeniedException）
    - CloudWatch Logsログ出力
    - _要件: 1.1, 1.2, 1.3, 1.4, 9.26_
  - [x] 13.3 NewsAPI Provider実装
    - [x] 13.3.1 NewsAPIプロバイダー実装
      - providers/newsapi.ts作成
      - NewsProviderインターフェース実装
      - fetchArticles()メソッド実装（top-headlines APIエンドポイント使用）
      - エラーハンドリング（API制限、ネットワークエラー）
      - レート制限対応（429エラー時のリトライロジック）
      - ページネーション対応（pageSize, page パラメータ）
      - カテゴリ、言語、検索キーワードフィルター対応
      - _要件: 1.1, 1.2_
    - [x] 13.3.2 handler.tsの更新
      - DummyNewsProviderからNewsAPIProviderに切り替え
      - SSMからAPI Keyを取得（/ainews/{env}/key/NEWSAPI）
      - プロバイダーインスタンス生成とfetchArticles()呼び出し
      - エラーハンドリング（API_KEY_MISSING, PROVIDER_ERROR）
      - _要件: 1.1, 1.3, 1.4_
    - [x] 13.3.3 環境変数とSSM設定
      - SSM Parameter Store設定手順をREADMEに追加
      - パラメータ名: /ainews/dev/key/NEWSAPI
      - パラメータタイプ: SecureString
      - 値: NewsAPI APIキー（https://newsapi.org/から取得）
      - _要件: 1.4_
    - [ ]* 13.3.4 NewsAPIプロバイダーユニットテスト
      - __tests__/providers/newsapi.test.ts作成
      - fetchArticles()正常系テスト（モックHTTPレスポンス）
      - エラーハンドリングテスト（401, 429, 500エラー）
      - ページネーションテスト
      - フィルターテスト（category, language, query）
      - _要件: 10.2_
  - [ ]* 13.4 Fetch Lambdaユニットテスト
    - __tests__/handler.test.ts作成
    - SSM読み取りテスト（aws-sdk-client-mock）
    - Records Lambda呼び出しテスト（aws-sdk-client-mock）
    - エラーハンドリングテスト（CONFIG_ERROR, INVOKE_ERROR）
    - _要件: 10.2_

- [ ] 14. Fetch Lambda Terraform実装（IAMロール分離）
  - [x] 14.1 Lambda関数リソース作成
    - modules/pipeline/lambda-fetch/main.tf作成
    - runtime=nodejs22.x, architectures=[arm64]
    - handler=handler.lambdaHandler
    - timeout=60, memory_size=512
    - _要件: 6.5_
  - [x] 14.2 Fetch Lambda専用IAMロール作成
    - aws_iam_role作成（ainews-{env}-fetch-lambda-role）
    - assume_role_policy設定（Lambda.amazonaws.com）
    - タグ設定（Environment, ManagedBy, Purpose）
    - _要件: 9.6, 9.12, 9.23_
  - [x] 14.3 AWSマネージドポリシーアタッチ
    - aws_iam_role_policy_attachment作成（AWSLambdaBasicExecutionRole）
    - aws_iam_role_policy_attachment作成（AWSXRayDaemonWriteAccess）
    - _要件: 9.15, 9.19, 9.22_
  - [x] 14.4 カスタムインラインポリシー作成（SSM）
    - aws_iam_role_policy作成（ssm-access）
    - Action: ssm:GetParameter, ssm:GetParametersByPath
    - Resource: arn:aws:ssm:{region}:{account}:parameter/ainews/{env}/*
    - _要件: 9.13, 9.20, 9.21_
  - [x] 14.5 カスタムインラインポリシー作成（Lambda Invoke）
    - aws_iam_role_policy作成（lambda-invoke）
    - Action: lambda:InvokeFunction
    - Resource: arn:aws:lambda:{region}:{account}:function:ainews-{env}-records
    - _要件: 9.14, 9.16, 9.20, 9.21_
  - [x] 14.6 環境変数設定
    - Lambda環境変数設定（ENV, REGION, PARAM_PATH, RECORDS_FUNCTION_NAME, LOG_LEVEL）
    - _要件: 1.4_
  - [x] 14.7 Fetch Lambda Terraformモジュール統合
    - infra/main.tfにmodule "lambda_fetch"追加
    - 必要な変数をvariables.tfに追加
    - 出力をoutputs.tfに追加（function_arn, role_arn）
    - _要件: 6.1, 9.24_

- [x] 14.8 記事重複防止とID管理（id = canonical_id方式）
  - [x] 14.8.1 canonical_id生成ユーティリティ実装
    - functions/fetch/src/utils/canonicalId.ts作成
    - URLベースのSHA-256ハッシュ生成（26文字、ULID互換）
    - タイトルベースのフォールバック
    - _要件: 1.1, 1.2_
  - [x] 14.8.2 NewsAPIプロバイダーでcanonical_id使用
    - providers/newsapi.ts更新
    - normalizeArticle()でcanonical_id生成
    - idフィールドにcanonical_idを設定（id = canonical_id）
    - URL優先、タイトルフォールバック
    - _要件: 1.1, 1.2_
  - [x] 14.8.3 Records Lambda upsert動作確認
    - 同じIDで複数回insertOneを実行して上書き動作確認
    - insertManyでの重複処理確認（同じIDは上書き）
    - _要件: 1.2_

- [x] 14.9 insertManyレスポンス修正（フェーズ4.9で完了）
  - [x] 14.9.1 Records Lambda insertManyレスポンス調査
    - functions/records/src/operations/insertMany.ts確認
    - 統一レスポンス形式（successIds, failedIds, errors）を実装済み
    - レスポンス形式の確認完了
    - _要件: 1.2_
  - [x] 14.9.2 insertManyレスポンスにsuccessIds追加
    - 成功したレコードのIDリスト（インデックス付きオブジェクト）を返却
    - failedIdsと区別
    - _要件: 1.2_
  - [x] 14.9.3 Collection.tsでMongoDB互換形式に変換
    - insertManyResult形式（acknowledged, insertedCount, insertedIds）に変換
    - Fetch Lambdaは統一形式のsuccessIdsを使用可能
    - _要件: 1.1, 1.2_

- [ ] 15. EventBridge Scheduler実装
  - [ ] 15.1 Schedulerリソース作成
    - modules/pipeline/eventbridge/main.tf作成
    - aws_scheduler_schedule リソース作成
    - schedule_expression設定（環境変数、例: cron(30 21 * * ? *)）
    - schedule_expression_timezone設定（Asia/Tokyo）
    - target設定（Fetch Lambda ARN）
    - _要件: 1.1_
  - [ ] 15.2 Scheduler IAMロール作成
    - aws_iam_role + aws_iam_role_policy作成
    - lambda:InvokeFunction権限
    - _要件: 9.5_
  - [ ] 15.3 EventBridge Scheduler Terraformモジュール統合
    - infra/main.tfにmodule "eventbridge_scheduler"追加
    - 必要な変数をvariables.tfに追加（schedule_expression）
    - _要件: 6.1_


---

## 将来の実装フェーズ

### フェーズ6: パイプライン層（Translate〜Publish Lambda）（将来実装）

このフェーズは将来の拡張として計画されています。現時点では実装不要です。

各ステージの概要：
- **Translate**: AWS Translateを使用した多言語翻訳
- **Normalize**: テキスト正規化（句読点、改行、フォーマット）
- **Script**: SSML形式の音声スクリプト生成
- **TTS**: Amazon Pollyを使用した音声合成
- **Render**: AWS Elemental MediaConvertを使用した動画レンダリング
- **Publish**: CloudFront署名付きURL生成と配信

実装時には以下の構成を採用：
- 各ステージを独立したLambda関数として実装
- Step Functionsでオーケストレーション
- DynamoDBでステージ進行状態を管理（pipelineStatus）
- S3で中間成果物（音声、動画）を保存

### フェーズ7: メンテナンス層（シャドー整合性修復）

このフェーズでは、shadow.config更新後の既存レコードのシャドー整合性を修復するメンテナンスシステムを実装します。

- [ ] 16. Maintenance Coordinator Lambda実装
  - [ ] 16.1 Coordinator Lambda プロジェクトセットアップ
    - functions/maintenance/coordinator/package.json作成（依存関係: @aws-sdk/client-sfn）
    - functions/maintenance/coordinator/tsconfig.json作成
    - functions/maintenance/coordinator/esbuild.config.js作成
    - _要件: 10.1_
  - [ ] 16.2 Coordinator Lambda handler実装
    - handler.ts作成（lambdaHandler関数）
    - 入力検証（resource, segments, dryRun, pageLimit）
    - resource名検証（ALLOW_RESOURCES環境変数）
    - Step Functions StartExecution呼び出し
    - 実行ARN返却
    - _要件: 11.1, 11.8_
  - [ ] 16.3 Coordinator Lambda Terraformモジュール
    - infra/modules/maintenance/lambda-coordinator/main.tf作成
    - Lambda関数リソース作成
    - IAMロール作成（Step Functions StartExecution権限）
    - 環境変数設定（ENV, REGION, STATE_MACHINE_ARN, ALLOW_RESOURCES）
    - _要件: 11.1, 9.5_

- [ ] 17. Maintenance Worker Lambda実装
  - [ ] 17.1 Worker Lambda プロジェクトセットアップ
    - functions/maintenance/worker/package.json作成（依存関係: @ainews/core, @ainews/shadows）
    - functions/maintenance/worker/tsconfig.json作成
    - functions/maintenance/worker/esbuild.config.js作成
    - _要件: 10.1_
  - [ ] 17.2 Worker Lambda handler実装
    - handler.ts作成（lambdaHandler関数）
    - 入力パース（resource, segment, totalSegments, dryRun, pageLimit, runId）
    - DynamoDB Scan（Segment指定、ページネーション）
    - shadow.config読み込み
    - 期待シャドー生成（@ainews/shadows使用）
    - __shadowKeysと比較
    - dryRun=falseの場合、TransactWriteItemsで修復（旧影削除 + 新影作成）
    - 結果返却（scanned, repaired, noop）
    - _要件: 11.3, 11.4, 11.5, 11.6_
  - [ ] 17.3 Worker Lambda Terraformモジュール
    - infra/modules/maintenance/lambda-worker/main.tf作成
    - Lambda関数リソース作成
    - Maintenance Lambda専用IAMロール作成（ainews-{env}-maintenance-lambda-role）
    - AWSマネージドポリシーアタッチ（AWSLambdaBasicExecutionRole, AWSXRayDaemonWriteAccess）
    - カスタムインラインポリシー作成（DynamoDB: Scan, Query, GetItem, TransactWriteItems）
    - カスタムインラインポリシー作成（Step Functions: StartExecution - Coordinatorのみ）
    - タグ設定（Environment, ManagedBy, Purpose）
    - 環境変数設定（ENV, REGION, TABLE_NAME, SHADOW_CONFIG_PATH）
    - _要件: 11.2, 9.5, 9.22, 9.23_

- [ ] 18. Maintenance State Machine実装
  - [ ] 18.1 State Machine定義作成
    - modules/maintenance/step-functions/state-machine.json作成
    - MapステートでWorker Lambda並列実行
    - MaxConcurrency=8設定
    - 入力変換（segments配列生成）
    - _要件: 11.2_
  - [ ] 18.2 State Machine Terraformリソース作成
    - modules/maintenance/step-functions/main.tf作成
    - aws_sfn_state_machine リソース作成
    - IAMロール作成（Lambda InvokeFunction権限）
    - CloudWatch Logs設定
    - _要件: 11.2, 9.5_
  - [ ] 18.3 Maintenance Terraformモジュール統合
    - infra/main.tfにmodule "maintenance_coordinator", "maintenance_worker", "maintenance_sfn"追加
    - 必要な変数をvariables.tfに追加
    - 出力をoutputs.tfに追加（coordinator_function_arn, worker_function_arn, sfn_arn）
    - _要件: 6.1_


### フェーズ8: モニタリング・ロギング

このフェーズでは、CloudWatch Logs、Metrics、Alarms、X-Rayを設定して、システムの可観測性を向上させます。

- [ ] 19. CloudWatch Logs設定
  - [ ] 19.1 ロググループリソース作成
    - modules/monitoring/cloudwatch/main.tf作成
    - aws_cloudwatch_log_group リソース作成
    - 対象: records, fetch, maint-coordinator, maint-worker
    - retention_in_days設定（環境変数: log_retention_days）
    - _要件: 10.1_

- [ ] 20. CloudWatch Dashboards作成（オプション）
  - [ ] 20.1 Dashboardリソース作成
    - modules/monitoring/cloudwatch/dashboard.tf作成
    - aws_cloudwatch_dashboard リソース作成
    - Widget定義（Metric, Log Insights）
    - Lambda Metrics（Invocations, Errors, Duration）
    - DynamoDB Metrics（ConsumedCapacity, UserErrors）
    - Step Functions Metrics（ExecutionsFailed, ExecutionsSucceeded, ExecutionTime）
    - _要件: 10.1_

- [ ] 21. CloudWatch Alarms作成（オプション）
  - [ ] 21.1 Alarmリソース作成
    - modules/monitoring/cloudwatch/alarms.tf作成
    - aws_cloudwatch_metric_alarm リソース作成
    - SNS Topic作成（aws_sns_topic）
    - Email Subscription作成（aws_sns_topic_subscription）
    - Lambda Errorsアラーム（threshold=10/5分）
    - DynamoDB Throttlesアラーム（threshold=5/分）
    - Step Functions Failuresアラーム（threshold=1/5分）
    - _要件: 10.1_

- [ ] 22. X-Ray設定（オプション）
  - [ ] 22.1 X-Ray Terraformリソース更新
    - 各Lambda関数のtracing_config設定（mode = "Active"）
    - Step Functions tracing_configuration設定
    - _要件: 10.1_
  - [ ] 22.2 Monitoring Terraformモジュール統合
    - infra/main.tfにmodule "monitoring"追加
    - 必要な変数をvariables.tfに追加（alert_email）
    - _要件: 6.1_

### フェーズ9: Mobile App（Expo/React Native）（将来実装）

このフェーズは将来の拡張として計画されています。現時点では実装不要です。

実装時には以下の構成を採用：
- **フレームワーク**: Expo 54 / React Native
- **認証**: react-oidc-context (OIDC + PKCE)
- **HTTP クライアント**: fetch API / axios
- **ナビゲーション**: React Navigation 6

主要画面：
- LoginScreen（Cognito OIDC サインイン）
- ArticleListScreen（記事一覧、FlatList）
- ArticleDetailScreen（記事詳細）
- ログアウト機能

### フェーズ10: CI/CD + ドキュメント

このフェーズでは、GitHub Actions CI/CDパイプラインとプロジェクトドキュメントを整備します。

- [ ] 23. GitHub Actions CI/CD設定
  - [ ] 23.1 CI workflow作成
    - .github/workflows/ci.yml作成
    - pnpm install
    - pnpm lint（全ワークスペース）
    - pnpm test（全ワークスペース）
    - トリガー: push, pull_request
    - _要件: 10.1, 10.4_
  - [ ] 23.2 CD workflow作成
    - .github/workflows/cd-dev.yml作成
    - pnpm install
    - pnpm build（全Lambda関数）
    - Terraform init/plan/apply（dev環境）
    - トリガー: push to develop branch
    - _要件: 6.1_
  - [ ] 23.3 GitHub OIDC設定（Terraform）
    - infra/modules/iam/github-actions/main.tf作成
    - IAM Role作成（GitHubActionsRole）
    - Trust Policy設定（GitHub OIDC Provider）
    - 必要な権限付与（Lambda, DynamoDB, S3, CloudFront, Cognito, Step Functions, EventBridge）
    - _要件: 9.5_

- [ ] 24. ドキュメント作成
  - [ ] 24.1 README.md更新
    - プロジェクト概要
    - 主要機能
    - Quick Start（ローカル開発環境セットアップ）
    - ディレクトリ構造
    - 技術スタック
    - _要件: 10.1_
  - [ ] 24.2 architecture.md作成
    - docs/architecture.md作成
    - システム構成図（Mermaid）
    - AWSサービスマッピング
    - データフロー
    - 設計上の決定事項と根拠
    - _要件: 10.1_
  - [ ] 24.3 api.md作成
    - docs/api.md作成
    - HTTP API仕様（Lambda Function URL）
    - リクエスト/レスポンス形式（10操作）
    - 認証方法（Cognito JWT）
    - エラーコード一覧
    - _要件: 10.1_
  - [ ] 24.4 deployment.md作成
    - docs/deployment.md作成
    - デプロイ手順（Terraform）
    - 環境変数設定
    - SSM Parameter Store設定
    - Cognito User Pool設定
    - トラブルシューティング
    - _要件: 10.1_

### フェーズ11: 統合テスト + 本番準備（オプション）

このフェーズは本番環境へのデプロイ前に実施する統合テストとセキュリティレビューです。

- [ ]* 25. 統合テスト実装（オプション）
  - [ ]* 25.1 HTTP API統合テスト
    - tests/integration/api.test.ts作成
    - 実際のLambda Function URLを使用
    - 10操作すべてのテスト（getList, getOne, getMany, getManyReference, create, update, updateMany, delete, deleteMany, createMany）
    - シャドーレコード生成確認
    - _要件: 10.2_
  - [ ]* 25.2 DynamoDB統合テスト
    - tests/integration/dynamodb.test.ts作成
    - シャドーレコード生成確認
    - TransactWriteItems動作確認
    - ConsistentRead動作確認
    - _要件: 10.2_
  - [ ]* 25.3 メンテナンスシステムE2Eテスト
    - tests/integration/maintenance.test.ts作成
    - Coordinator Lambda呼び出しテスト
    - Step Functions実行テスト
    - Worker Lambda並列実行確認
    - dryRun動作確認
    - _要件: 10.2_

- [ ]* 26. Admin UI E2Eテスト（Playwright）（オプション）
  - [ ]* 26.1 Playwrightセットアップ
    - apps/admin/playwright.config.ts作成
    - apps/admin/e2e/ディレクトリ作成
    - _要件: 10.2_
  - [ ]* 26.2 E2Eテストシナリオ実装
    - apps/admin/e2e/articles.spec.ts作成
    - ログイン → 記事作成 → 編集 → 削除フロー
    - _要件: 10.2_

- [ ] 27. 本番環境準備
  - [ ] 27.1 prd.tfvars設定
    - enable_pitr=true
    - log_retention_days=30
    - MFA有効化
    - _要件: 6.1, 6.3, 9.1_
  - [ ] 27.2 本番用ドメイン設定（オプション）
    - Route 53設定
    - ACM証明書設定
    - CloudFront Custom Domain設定
    - _要件: 6.1_

- [ ] 28. セキュリティレビュー
  - [ ] 28.1 IAMロールレビュー
    - 各Lambda関数のIAMロール確認
    - ワイルドカード（*）使用箇所確認
    - 不要な権限削除
    - _要件: 9.5_
  - [ ] 28.2 暗号化設定確認
    - DynamoDB暗号化確認（AWS管理キー）
    - S3暗号化確認（SSE-S3）
    - SSM SecureString確認
    - _要件: 9.5_
  - [ ] 28.3 ネットワークセキュリティ確認
    - S3 Public Access Block確認
    - Lambda Function URL CORS設定確認
    - Cognito User Pool設定確認
    - _要件: 9.5_

- [ ]* 29. パフォーマンステスト（オプション）
  - [ ]* 29.1 負荷テスト実施
    - Artillery / k6でHTTP API負荷テスト
    - 同時実行数: 10, 50, 100
    - レスポンスタイム測定
    - エラー率測定
    - _要件: 10.2_
  - [ ]* 29.2 パフォーマンスチューニング
    - Lambda メモリサイズ最適化（512MB → 1024MB）
    - DynamoDB Auto Scaling設定（本番環境のみ）
    - CloudFront キャッシュ設定最適化
    - _要件: 10.1_

---

## 実装優先順位

### 最優先（MVP）
1. **フェーズ3**: Records Lambda + Function URL（HTTP API実装）
2. **フェーズ4**: Admin UI（React + react-admin）
3. **フェーズ5**: Fetch Lambda（ニュース取得）

### 高優先度
4. **フェーズ7**: メンテナンス層（シャドー整合性修復）
5. **フェーズ8**: モニタリング・ロギング（CloudWatch Logs）
6. **フェーズ10**: CI/CD + ドキュメント

### 中優先度（将来拡張）
7. **フェーズ6**: パイプライン層（Translate〜Publish Lambda）
8. **フェーズ9**: Mobile App（Expo/React Native）
9. **フェーズ11**: 統合テスト + 本番準備

---

## 次のステップ

現在の実装状況：
- ✅ フェーズ1: 基盤構築（完了）
- ✅ フェーズ2: インフラ基盤（完了）
- ✅ フェーズ3: Records Lambda + Function URL（完了）
- ✅ フェーズ4: Admin UI（完了）
- ⏳ フェーズ4.5: IAMロール分離とセキュリティ強化（進行中）
- ⏳ フェーズ4.6: 高度なフィルター検索機能
- ✅ フェーズ4.7: バルク操作のスケーラビリティ強化（完了）

**推奨される次のタスク**: 

**緊急: シャドウ設定の構造不整合を修正**
タスク12.15（シャドウ設定生成スクリプトの修正）から開始してください。

現在、`shadow.config.json`の構造と`packages/shadows`の型定義が一致していないため、Records Lambdaでソートフィールドの検証が正しく動作していません。この問題を修正する必要があります。

**オプション1: フェーズ5を開始（パイプライン層 - Fetch Lambda）**
タスク13.1（Fetch Lambda プロジェクトセットアップ）から開始してください。

このフェーズでは以下を実装します：
- ニュース記事を自動取得するFetch Lambda
- SSM Parameter Storeからの設定読み込み
- Records LambdaをDynamoClient経由で呼び出し
- IAM認証による安全な通信
- EventBridge Schedulerによる定期実行

**実装の目的:**
- ニュース記事の自動取得と保存
- パイプラインの起点となるLambda関数
- 将来的な翻訳・音声合成・動画生成への拡張基盤

**オプション2: フェーズ4.5を継続**
タスク12.4（idシャドウ冗長性の解消）から開始してください。

このタスクでは以下を実装します：
- @ainews/shadowsパッケージのREQUIRED_SHADOW_FIELDSから`id`フィールドを削除
- Records Lambda getList操作で`sort.field='id'`の場合、本体レコードを直接クエリするロジックを追加
- 既存の冗長なidシャドーレコードを削除するメンテナンススクリプト作成（オプション）
- ユニットテストと統合テストの更新

**最適化の目的:**
- 冗長なシャドーレコードの削減（DynamoDBストレージコスト削減）
- 書き込み操作のパフォーマンス向上（TransactWriteItemsのアイテム数削減）
- データ整合性の向上（本体レコードとシャドーレコードの重複排除）

**オプション3: フェーズ4.6を開始**
タスク12.6（フィルター処理ユーティリティの拡張）から開始してください。

このフェーズでは以下を実装します：
- 拡張フィールド構文（`フィールド名:オペレータ:型`）のパーサー実装
- 7種類のフィルター演算子（eq, lt, lte, gt, gte, starts, ends）のサポート
- Query最適化ロジック（ソートフィールドと一致する条件をKeyConditionExpressionに含める）
- メモリ内フィルタリング（DynamoDBの制限を回避）
- Admin UIでの高度なフィルター機能の実装

**機能の目的:**
- 範囲検索のサポート（priority >= 5 AND priority <= 10）
- 前方一致・後方一致検索のサポート（name が "AI" で始まる）
- 日時範囲検索のサポート（createdAt >= "2025-01-01" AND createdAt < "2025-02-01"）
- パフォーマンス最適化（Query最適化により取得レコード数を削減）



---

## フェーズ12: DynamoDBクライアントライブラリとデータ設計 ✅

**参照:** 詳細なタスクリストは [.kiro/specs/dynamodb-client/tasks.md](../dynamodb-client/tasks.md) を参照してください。

### 概要

DynamoDB Single-Table設計向けのクライアントライブラリを実装します。MongoDB風のシンプルなAPIでDynamoDBを操作でき、型定義からシャドー設定を自動生成します。

### 完了状況

✅ **全フェーズ完了**（2025-11-22）

- ✅ フェーズ1: データ設計の整理
- ✅ フェーズ2: シャドー設定の自動生成
- ✅ フェーズ3: クライアントSDK実装
- ✅ フェーズ4: Lambda側の実装
- ✅ フェーズ5: クライアント統合
- ✅ フェーズ6: テストとドキュメント

### 改善内容（2025-11-22）

ainewsプロジェクトで使用するための重要な改善を実施：

1. **認証オプションの型安全性向上**: Discriminated Unionで型レベルの安全性を確保
2. **タイムアウト設定の追加**: デフォルト30秒、カスタマイズ可能
3. **自動接続オプションの追加**: `autoConnect: true`で接続忘れを防止
4. **入力バリデーションの強化**: 空文字列や空白のみの入力をエラーとして検出
5. **エラーメッセージの改善**: より具体的で解決方法を含むメッセージ
6. **テストの追加・更新**: 154テストすべてパス

**評価:** A-（優秀、一部改善の余地あり）

詳細は以下を参照：
- [評価レポート](.kiro/specs/dynamodb-client/evaluation.md)
- [改善サマリー](.kiro/specs/dynamodb-client/improvements-summary.md)

### プロジェクト固有の適用

- パッケージ名: `@ainews/core`
- 型定義パッケージ: `@ainews/api-types`
- Lambda実装: `functions/records`
- クライアント: `apps/admin`、`apps/mobile`、`functions/fetch`

### 使用例

```typescript
// Webアプリ（Cognito認証）
const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    type: 'cognito',
    getToken: async () => {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    },
  },
  timeout: 30000,
});

// Lambda（IAM認証）
const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    type: 'iam',
    region: process.env.AWS_REGION!,
  },
  timeout: 60000,
});
```


---

## フェーズ13: TypeScript プロジェクト構造の最適化

### 概要

`packages/` 配下の scripts ディレクトリを `src/scripts` に移動し、TypeScript の設定を簡素化します。

### タスク

- [x] 30. TypeScript プロジェクト構造の最適化
  - [x] 30.1 @ainews/api-types の scripts 移動
    - `packages/api-types/scripts/` を `packages/api-types/src/scripts/` に移動
    - `packages/api-types/scripts/__tests__/` を `packages/api-types/src/scripts/__tests__/` に移動
    - _要件: 17.1, 17.13_
  - [x] 30.2 @ainews/api-types のインポートパス更新
    - `src/scripts/generate-shadow-config.ts` のインポートパスを更新（`../dist/schema.js` → `../schema.js`）
    - `src/scripts/__tests__/generate-shadow-config.test.ts` のインポートパスを確認
    - `src/scripts/__tests__/config-integrity.test.ts` のインポートパスを確認
    - _要件: 17.10, 17.11, 17.12_
  - [x] 30.3 @ainews/api-types の tsconfig.json 更新
    - `tsconfig.json` の `include` を `["src/**/*"]` に更新（scripts を含む）
    - `rootDir` が `"./src"` であることを確認
    - `outDir` が `"./dist"` であることを確認
    - _要件: 17.3, 17.6, 17.7_
  - [x] 30.4 @ainews/api-types の tsconfig.scripts.json 削除
    - `packages/api-types/tsconfig.scripts.json` を削除
    - _要件: 17.4_
  - [x] 30.5 @ainews/api-types の package.json 更新
    - `build` スクリプトから `tsc -p tsconfig.scripts.json` を削除
    - `build` スクリプトを `"tsc && node dist/scripts/generate-shadow-config.js"` に更新
    - _要件: 17.5_
  - [x] 30.6 @ainews/api-types の Makefile 更新
    - 依存関係の検知パスに `src/scripts/**/*.ts` を追加
    - ビルドターゲットの依存関係を更新
    - _要件: 17.16, 17.17_
  - [x] 30.7 @ainews/api-types のビルドテスト
    - `make clean` でビルド成果物を削除
    - `make build` でビルドを実行
    - `dist/scripts/generate-shadow-config.js` が生成されることを確認
    - `dist/scripts/__tests__/` が生成されることを確認
    - _要件: 17.8, 17.9_
  - [x] 30.8 @ainews/api-types のテスト実行
    - `pnpm --filter @ainews/api-types test` でテストを実行
    - すべてのテストが正常に実行されることを確認
    - _要件: 17.14, 17.15_
  - [x] 30.9 @ainews/core の scripts 移動
    - `packages/core/scripts/` を `packages/core/src/scripts/` に移動
    - _要件: 17.2_
  - [x] 30.10 @ainews/core のインポートパス更新
    - `src/scripts/repair-shadows.ts` のインポートパスを確認・更新
    - 相対インポートパスを適切に調整
    - _要件: 17.10, 17.11, 17.12_
  - [x] 30.11 @ainews/core の tsconfig.json 更新
    - `tsconfig.json` の `include` を `["src/**/*"]` に更新（scripts を含む）
    - `rootDir` が `"./src"` であることを確認
    - `outDir` が `"./dist"` であることを確認
    - _要件: 17.3, 17.6, 17.7_
  - [x] 30.12 @ainews/core の tsconfig.scripts.json 削除
    - `packages/core/tsconfig.scripts.json` を削除
    - _要件: 17.4_
  - [x] 30.13 @ainews/core の package.json 更新
    - `build` スクリプトから `tsc -p tsconfig.scripts.json` を削除（存在する場合）
    - _要件: 17.5_
  - [x] 30.14 @ainews/core の Makefile 更新
    - 依存関係の検知パスに `src/scripts/**/*.ts` を追加（存在する場合）
    - ビルドターゲットの依存関係を更新
    - _要件: 17.16, 17.17_
  - [x] 30.15 @ainews/core のビルドテスト
    - `make clean` でビルド成果物を削除
    - `make build` でビルドを実行
    - `dist/scripts/repair-shadows.js` が生成されることを確認
    - _要件: 17.8, 17.9_
  - [x] 30.16 @ainews/core のテスト実行
    - `pnpm --filter @ainews/core test` でテストを実行
    - すべてのテストが正常に実行されることを確認
    - _要件: 17.14, 17.15_
  - [x] 30.17 ルート Makefile の更新
    - `shadow-config` ターゲットのパスを確認（変更不要のはず）
    - コメントを更新（scripts → src/scripts）
    - _要件: 17.18_
  - [x] 30.18 全体のビルドテスト
    - `make clean` でプロジェクト全体のビルド成果物を削除
    - `make build` でプロジェクト全体をビルド
    - `make shadow-config` で shadow.config.json を生成
    - `config/shadow.config.json` が正しく生成されることを確認
    - _要件: 17.8, 17.9_
  - [x] 30.19 全体のテスト実行
    - `pnpm test` でプロジェクト全体のテストを実行
    - すべてのテストが正常に実行されることを確認
    - _要件: 17.15_
  - [x] 30.20 ドキュメント更新
    - `packages/api-types/README.md` のパス参照を更新
    - `packages/core/README.md` のパス参照を更新（存在する場合）
    - `.kiro/steering/shadow-config-generation.md` のパス参照を更新
    - _要件: 17.10, 17.11_
