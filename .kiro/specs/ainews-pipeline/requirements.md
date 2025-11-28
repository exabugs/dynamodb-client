# 要件定義書

## はじめに

AIニュース自動配信パイプラインは、ニュース記事の取得から音声合成、動画レンダリング、配信までを自動化するシステムです。DynamoDB Single-Table設計による動的シャドー管理、Lambda Function URL (HTTP API)、React管理画面、Expo/React Nativeモバイルアプリを統合し、エンドツーエンドのニュース配信ワークフローを提供します。コスト最適化のため、未使用時の費用を完全にゼロにする設計を採用しています。

## 用語集

- **Pipeline（パイプライン）**: fetch → translate → normalize → script → TTS → render → publish の一連の処理フロー
- **Shadow Record（シャドーレコード）**: DynamoDB内で本体レコードと同一テーブルに格納される、ソート・検索用の派生レコード
- **Admin UI（管理画面）**: React + react-admin + Amplify Hosted UIによる管理画面
- **LoginPage（ログインページ）**: Admin UIのログイン画面コンポーネント（SignInボタンを含む）
- **Mobile App（モバイルアプリ）**: Expo/React Native + OIDC認証によるモバイルクライアント
- **Records Lambda**: TypeScript製のHTTP API Lambda（CRUD操作、Lambda Function URL経由で公開）
- **Fetch Lambda**: TypeScript製のニュース取得Lambda
- **Single-Table Design（シングルテーブル設計）**: 複数リソースを1つのDynamoDBテーブルで管理する設計パターン
- **Lambda Function URL**: Lambda関数を直接HTTPSエンドポイントとして公開するAWS機能
- **Cognito User Pool**: AWS Cognitoによるユーザー認証基盤
- **Cognito Hosted UI**: AWS Cognitoが提供する認証UI（ユーザー名・パスワード入力画面）
- **Maintenance Coordinator Lambda**: シャドー整合性メンテナンスを開始するオーケストレーター
- **Maintenance Worker Lambda**: DynamoDBレコードを走査してシャドーを修復するワーカー
- **Step Functions**: Maintenance Workerを並列実行するオーケストレーションサービス
- **IAM Role（IAMロール）**: AWS Lambda関数が他のAWSサービスにアクセスするための権限セット
- **Least Privilege（最小権限の原則）**: 必要最小限の権限のみを付与するセキュリティ原則
- **IAM Policy（IAMポリシー）**: 具体的な権限を定義するJSON文書
- **Lambda Execution Role**: Lambda関数の実行時に使用されるIAMロール
- **Filter Operator（フィルター演算子）**: 検索条件で使用する比較演算子（eq, lt, le, gt, ge, starts, ends）
- **Filter Field Syntax（フィルターフィールド構文）**: `フィールド名:オペレータ:型` 形式の拡張フィールド名指定
- **In-Memory Filtering（メモリ内フィルタリング）**: DynamoDBから取得したレコードをLambda内のメモリで条件判定してフィルタリングする処理
- **Query Optimization（クエリ最適化）**: ソートフィールドと一致するフィルター条件をDynamoDB QueryのKeyConditionExpressionに含めることで取得レコード数を削減する最適化手法
- **Chunk（チャンク）**: バルク操作で処理される一連のレコードのグループ（TransactWriteItemsの100アイテム制限内）
- **Chunk Splitting（チャンク分割）**: 大量のレコードを複数のチャンクに分割して順次処理する手法
- **Partial Success（部分成功）**: バルク操作で一部のレコードが成功し、一部が失敗する状態
- **Item Count（アイテム数）**: DynamoDBのTransactWriteItemsで処理されるアイテムの総数（メインレコード + シャドーレコード）
- **Shadow Config（シャドー設定）**: DynamoDBのシャドーレコード生成ルールを定義するJSON設定ファイル（config/shadow.config.json）
- **Schema Version（スキーマバージョン）**: shadow.config.json の `$schemaVersion` フィールドで管理されるバージョン番号（セマンティックバージョニング形式）
- **Config Hash（設定ハッシュ）**: shadow.config.json の内容から生成されるSHA-256ハッシュ値
- **Config Metadata（設定メタデータ）**: 本体レコードの `data.__configVersion` と `data.__configHash` に格納される、レコード作成時の設定情報
- **Config Drift（設定ドリフト）**: レコード作成時の設定と現在の設定が異なる状態
- **Dry Run Mode（ドライランモード）**: 実際の修復を行わず、修復が必要なレコードを検出するだけのモード
- **Repair Mode（修復モード）**: 実際にシャドーレコードを削除・作成してデータを修復するモード
- **DynamoDB Client（DynamoDBクライアント）**: DynamoDB Single-Table設計向けのHTTPクライアントライブラリ（MongoDB風API）
- **Schema Registry（スキーマレジストリ）**: 全リソースの型定義とシャドー設定を集約したTypeScriptオブジェクト
- **Shadow Field Type（シャドウフィールド型）**: シャドウレコードで使用されるフィールドの型（String、Number、Datetime）
- **Lambda Function URL**: Lambda関数を直接HTTPSエンドポイントとして公開するAWS機能（API Gateway不要）

## 要件

### 要件1: 自動ニュース取得

**ユーザーストーリー:** システム管理者として、パイプラインが定期的にニュース記事を自動取得することで、手動介入なしに常に新鮮なコンテンツを利用可能にしたい

#### 受入基準

1. WHEN EventBridge Schedulerが設定されたcron式でトリガーされる時、THE Fetch Lambda SHALL 設定されたソースからニュース記事を取得する
2. WHEN Fetch Lambdaが正常に完了する時、THE Fetch Lambda SHALL リソース名に一致するPK形式でDynamoDB recordsテーブルに生データを保存する
3. IF Fetch Lambdaが取得中にエラーに遭遇する場合、THEN THE Fetch Lambda SHALL エラーをCloudWatchにログ出力し、失敗ステータスを返す
4. THE Fetch Lambda SHALL 環境変数（ENV、REGION、RECORDS_TABLE、ASSETS_BUCKET）を通じて環境固有の設定をサポートする
5. THE Fetch Lambda SHALL SSM Parameter Store（`/ainews/{env}/key/NEWSAPI`）からNewsAPI APIキーを取得する
6. WHEN NewsAPI APIキーが存在しない場合、THE Fetch Lambda SHALL API_KEY_MISSINGエラーをログ出力し、失敗ステータスを返す
7. THE Fetch Lambda SHALL NewsAPI top-headlines APIエンドポイント（`https://newsapi.org/v2/top-headlines`）を使用してニュース記事を取得する
8. WHEN NewsAPIがレート制限エラー（429）を返す時、THE Fetch Lambda SHALL エラーをログ出力し、次回実行まで待機する
9. THE Fetch Lambda SHALL カテゴリ、言語、検索キーワードによるフィルタリングをサポートする
10. THE Fetch Lambda SHALL ページネーション（pageSize、page パラメータ）をサポートし、大量の記事を段階的に取得できる

### 要件2: Web管理画面

**ユーザーストーリー:** コンテンツ管理者として、Webインターフェースを通じてニュース記事を管理することで、公開コンテンツのレビュー、編集、制御を行いたい

#### 受入基準

1. WHEN 認証済みユーザーがAdmin UIにアクセスする時、THE Admin UI SHALL ページネーション対応（1ページあたり≤50件）で記事リストを表示する
2. WHEN ユーザーが記事に対してCRUD操作を実行する時、THE Admin UI SHALL HTTP POSTリクエストを使用してRecords Lambda Function URLと通信する
3. THE Admin UI SHALL 認可コードフローを使用してCognito Hosted UIを通じてユーザーを認証する
4. WHEN ユーザーが未認証の時、THE Admin UI SHALL LoginPageを表示する
5. WHEN ユーザーがLoginPageのSignInボタンをクリックする時、THE Admin UI SHALL Cognito Hosted UIにリダイレクトする
6. THE Cognito Hosted UI SHALL 自動ログインを実行せず、ユーザーに認証情報の入力を求める
7. WHEN ユーザーがログアウトする時、THE Admin UI SHALL ローカル認証状態をクリアし、LoginPageにリダイレクトする
8. WHEN ログアウト後にLoginPageが表示される時、THE Admin UI SHALL ユーザーが明示的にSignInボタンをクリックするまで待機する
9. THE Admin UI SHALL 有効なシャドーフィールド（id、name、createdAt、updatedAt、またはカスタムシャドー）による記事のソートをサポートする

### 要件3: モバイルアプリ

**ユーザーストーリー:** モバイルユーザーとして、モバイルデバイスでニュース記事を閲覧することで、外出先でもコンテンツにアクセスしたい

#### 受入基準

1. WHEN ユーザーがMobile Appを開く時、THE Mobile App SHALL react-oidc-contextを使用してCognito OIDC経由で認証する
2. WHEN 認証が成功する時、THE Mobile App SHALL ユーザーのJWTトークンを使用してRecords Lambda Function URLから記事を取得する
3. THE Mobile App SHALL 基本メタデータ（タイトル、日付、ステータス）を含むスクロール可能なリストで記事を表示する
4. WHEN ユーザーがログアウトする時、THE Mobile App SHALL ローカル認証状態をクリアし、ログインページにリダイレクトする

### 要件4: データ整合性

**ユーザーストーリー:** 開発者として、HTTP API操作がデータ整合性を維持することで、同時更新がデータベースを破損しないようにしたい

#### 受入基準

1. WHEN Records Lambdaが書き込み操作（create/update/delete）を実行する時、THE Records Lambda SHALL アトミック実行のためにTransactWriteItemsを使用する
2. WHEN レコードを更新する時、THE Records Lambda SHALL RFC 7396 JSON Merge Patchセマンティクス（nullはフィールド削除、配列は完全置換）を適用する
3. THE Records Lambda SHALL ConsistentRead=trueを設定することで、すべての読み取り操作に強整合性を強制する
4. WHEN シャドーレコードが更新される時、THE Records Lambda SHALL 同一トランザクション内で古いシャドーを削除し、新しいシャドーを作成する
5. THE Records Lambda SHALL __shadowKeysメタデータ属性を内部的に維持し、HTTPレスポンスでは公開しない

### 要件5: 動的シャドー管理

**ユーザーストーリー:** 開発者として、DynamoDBスキーマが複数フィールドによる効率的なクエリをサポートすることで、Admin UIがパフォーマンス低下なしに記事をソート・フィルタできるようにしたい

#### 受入基準

1. THE Records Lambda SHALL PK（リソース名）とSK（レコードIDまたはシャドーキー）を持つ単一のDynamoDBテーブルにすべてのレコードを保存する
2. THE Records Lambda SHALL 本体レコード（SK = id#{ULID}）と必須シャドーフィールド（name、createdAt、updatedAt）および外部JSON設定で定義されたオプションフィールドのシャドーレコードを生成する
3. THE Records Lambda SHALL idフィールドのシャドーレコードを生成せず、本体レコードのSK（id#{ULID}）をidソート用として使用する
4. WHEN シャドーSK値を生成する時、THE Records Lambda SHALL 文字列を可逆エスケープ（# → ##、スペース → #）、数値を20桁ゼロ埋め文字列、日時をUTC ISO 8601でフォーマットする
5. WHEN getListクエリを実行する時、THE Records Lambda SHALL SKプレフィックスでシャドーレコードをクエリし、BatchGetItemで本体レコードを取得する
6. WHEN sort.field='id'の時、THE Records Lambda SHALL 本体レコード（SK = id#{ULID}）を直接クエリし、別途シャドーレコードを参照しない
7. THE Records Lambda SHALL sort.fieldが有効なシャドー名と一致することを検証し、一致しない場合はINVALID_FILTERエラーを返す
8. THE Records Lambda SHALL SHADOW_CONFIG環境変数からシャドー設定をJSON文字列として読み込む
9. THE Terraform設定 SHALL config/shadow.config.jsonファイルの内容をSHADOW_CONFIG環境変数に設定する
10. THE Records Lambda SHALL Lambda実行環境のグローバル変数にシャドー設定をキャッシュし、初回呼び出し時のみパースする
11. WHEN shadow.config.jsonを変更する時、THE システムオペレーター SHALL Terraformで再度applyし、Lambda関数を再デプロイする

### 要件6: Infrastructure as Code

**ユーザーストーリー:** システムオペレーターとして、インフラストラクチャが環境間で一貫してプロビジョニングされることで、dev、staging、production環境が設定以外は同一になるようにしたい

#### 受入基準

1. THE Terraform設定 SHALL 環境固有のtfvarsファイルを持つ複数のワークスペース（dev、stg、prd）をサポートする
2. THE Terraform設定 SHALL バージョニング、暗号化、パブリックアクセスブロックを有効にしたS3バケットをプロビジョニングする
3. THE Terraform設定 SHALL enable_pitrがtrueの時、TTLとPITRを有効にしたDynamoDBテーブルを作成する
4. THE Terraform設定 SHALL Hosted UI、パスワードポリシー（≥8文字、大小英字+数字）、ローカル開発とExpo両方のコールバックURLを持つCognito User Poolを設定する
5. THE Terraform設定 SHALL Records LambdaとFetch Lambdaに対して、それぞれ独立したIAMロールを作成し、各Lambda関数に最小限の必要な権限のみを付与する
6. THE Terraform設定 SHALL CORS設定とCognito JWT検証を含むRecords Lambda Function URLを作成する
7. THE Terraform設定 SHALL archive_fileデータソースを使用してLambda関数のビルド成果物（.cjsファイル）を自動的にZIPアーカイブに変換する
8. THE Terraform設定 SHALL source_code_hashを使用してLambda関数のコード変更を検知し、自動的に再デプロイする
9. THE Terraform設定 SHALL defaultワークスペースでのリソース作成を防止し、dev/stg/prdワークスペースの使用を強制する
10. WHEN Terraformを初期化する時、THE システム SHALL dev、stg、prdの3つのワークスペースを作成し、各ワークスペースの状態ファイルがS3の正しいパス（env:/dev/、env:/stg/、env:/prd/）に配置されることを確認する
11. WHEN defaultワークスペースでterraform planまたはapplyを実行する時、THE Terraform設定 SHALL エラーメッセージを表示し、実行を中断する
12. THE Terraform設定 SHALL ワークスペース切り替えと環境固有のtfvarsファイル適用を簡素化するヘルパースクリプトまたはMakefileを提供する
13. IF defaultワークスペースに既存リソースが存在する場合、THEN THE システム SHALL 状態ファイルの移行手順を提供し、既存のAWSリソースに影響を与えずに適切な環境ワークスペースに移行する

### 要件7: エラーハンドリング

**ユーザーストーリー:** 開発者として、HTTP API操作で包括的なエラーハンドリングを行うことで、クライアントが実行可能なエラーメッセージを受け取れるようにしたい

#### 受入基準

1. WHEN HTTP API操作が設定エラーに遭遇する時、THE Records Lambda SHALL CONFIG_ERRORコードを持つHTTP 500エラーレスポンスを返す
2. WHEN クライアントが無効なnextTokenを提供する時、THE Records Lambda SHALL INVALID_TOKENコードを持つHTTP 400エラーレスポンスを返す
3. WHEN 要求されたアイテムが存在しない時、THE Records Lambda SHALL ITEM_NOT_FOUNDコードを持つHTTP 404エラーレスポンスを返す
4. WHEN トランザクションが部分的に失敗する時、THE Records Lambda SHALL OpErrorオブジェクト（id、code、message）を含むfailedIdsとerrorsの配列を持つ結果オブジェクトを返す
5. THE Records Lambda SHALL JSONレスポンスボディに対して適切なJSON.stringifyを1回のみ実行する

### 要件8: パイプライン処理

**ユーザーストーリー:** コンテンツパイプラインオペレーターとして、システムが記事を複数のステージで処理することで、生コンテンツを公開可能なメディアに変換したい

#### 受入基準

1. THE Pipeline SHALL 順次ステージをサポートする: fetch → translate → normalize → script → TTS → render → publish
2. WHEN ステージが完了する時、THE Pipeline SHALL ステージ固有のメタデータとステータスで記事レコードを更新する
3. THE Pipeline SHALL 中間成果物（翻訳テキスト、音声ファイル、レンダリング動画）をS3アセットバケットに保存する
4. WHERE ステージが失敗する場合、THE Pipeline SHALL 記事にエラーステータスをマークし、詳細をCloudWatchにログ出力する

### 要件9: セキュリティ

**ユーザーストーリー:** セキュリティ管理者として、すべてのAPIアクセスが認証・認可され、Lambda関数が最小権限の原則に従うことで、セキュリティリスクを最小化したい

#### 受入基準

1. THE Records Lambda SHALL すべてのHTTPリクエストでAuthorizationヘッダーのCognito JWTトークンを検証する
2. THE Admin UI SHALL CognitoからJWTトークンを取得し、HTTPリクエストのAuthorizationヘッダーにBearerトークンとして含める
3. WHEN JWTトークンが無効または期限切れの場合、THE Records Lambda SHALL HTTP 401 Unauthorizedエラーを返す
4. THE Mobile App SHALL セキュアな認証のためにPKCEを使用したOIDC認可コードフローを使用する
5. THE Lambda Function URL SHALL CORS設定で許可されたオリジンからのリクエストのみを受け入れる
6. THE Terraform設定 SHALL Records Lambda専用のIAMロール（`ainews-{env}-records-lambda-role`）を作成する
7. THE Records Lambda IAMロール SHALL DynamoDBテーブル（`ainews-{env}-records`）に対する読み取り・書き込み権限（GetItem、PutItem、UpdateItem、DeleteItem、Query、Scan、BatchGetItem、TransactWriteItems）を持つ
8. THE Records Lambda IAMロール SHALL CloudWatch Logsへのログ出力権限（CreateLogGroup、CreateLogStream、PutLogEvents）を持つ
9. THE Records Lambda IAMロール SHALL DynamoDBアクセス権限をテーブルARNで制限し、他のテーブルへのアクセスを禁止する
10. THE Records Lambda IAMロール SHALL S3、SSM、Lambda Invoke権限を持たない
11. THE Records Lambda IAMロール SHALL X-Rayトレーシング権限（xray:PutTraceSegments、xray:PutTelemetryRecords）を持つ
12. THE Terraform設定 SHALL Fetch Lambda専用のIAMロール（`ainews-{env}-fetch-lambda-role`）を作成する
13. THE Fetch Lambda IAMロール SHALL SSM Parameter Storeから特定パスプレフィックス（`/ainews/{env}/key/*`）のパラメータを読み取る権限（ssm:GetParameter、ssm:GetParametersByPath）を持つ
14. THE Fetch Lambda IAMロール SHALL Records Lambda関数（`ainews-{env}-records`）を呼び出す権限（lambda:InvokeFunction）を持つ
15. THE Fetch Lambda IAMロール SHALL CloudWatch Logsへのログ出力権限を持つ
16. THE Fetch Lambda IAMロール SHALL Lambda Invoke権限をRecords Lambda関数ARNで制限し、他のLambda関数の呼び出しを禁止する
17. THE Fetch Lambda IAMロール SHALL DynamoDBへの直接アクセス権限を持たない
18. THE Fetch Lambda IAMロール SHALL S3への直接アクセス権限を持たない
19. THE Fetch Lambda IAMロール SHALL X-Rayトレーシング権限を持つ
20. THE IAMポリシー SHALL JSON形式でAction、Resource、Effectを明確に指定する
21. THE IAMポリシー SHALL ワイルドカード（`*`）の使用を最小限に抑え、可能な限り具体的なリソースARNを指定する。ただし、同条件が並列で並ぶ場合（例: 同一環境の複数テーブル）、単純化のためワイルドカードを使用して良い
22. THE Terraform設定 SHALL CloudWatch LogsとX-Rayアクセスには、AWSマネージドポリシー（AWSLambdaBasicExecutionRole、AWSXRayDaemonWriteAccess）を使用し、ビジネスロジック固有の権限（DynamoDB、SSM、Lambda Invoke）にはカスタムポリシーを使用する
23. THE Terraform設定 SHALL 各IAMロールとポリシーにタグ（Environment、ManagedBy、Purpose）を付与する
24. THE Terraform設定 SHALL IAMロールとポリシーのARNをTerraform outputとして出力する
25. WHEN Records LambdaがDynamoDBアクセスで権限不足エラーに遭遇する時、THE Records Lambda SHALL AccessDeniedExceptionをキャッチし、CloudWatch Logsに詳細なエラーログを出力する
26. WHEN Fetch LambdaがSSMまたはLambda Invoke権限不足エラーに遭遇する時、THE Fetch Lambda SHALL AccessDeniedExceptionをキャッチし、CloudWatch Logsに詳細なエラーログを出力する

### 要件10: 品質保証

**ユーザーストーリー:** 開発者として、自動テストとリンティングを行うことで、モノレポ全体でコード品質を維持したい

#### 受入基準

1. THE Rootワークスペース SHALL すべてのワークスペースで実行されるlint、format、testスクリプトを提供する
2. THE Records Lambda SHALL CRUD操作とシャドー生成ロジックをカバーするVitestユニットテストを含む
3. THE Vitest設定 SHALL 優先順位順（infra/.env.test → infra/.env.local → infra/.env → .env.local → .env）で複数の.envファイルから環境変数を読み込む
4. THE ESLint設定 SHALL @typescript-eslint 8とreact/react-hooksルールを持つflat config形式を使用する
5. THE Prettier設定 SHALL sort-importsプラグインで一貫したフォーマットを強制する

### 要件11: シャドー整合性メンテナンスと設定バージョン管理

**ユーザーストーリー:** システム管理者として、shadow.config更新やスキーマ移行後に既存レコードのシャドー整合性を維持し、設定変更を追跡することで、データの一貫性を保証し、運用の安全性を確保したい

#### 受入基準

**スキーマバージョン管理:**

1. THE shadow.config.json SHALL `$schemaVersion` フィールドを含む
2. THE `$schemaVersion` SHALL セマンティックバージョニング形式（major.minor）を使用する
3. WHEN シャドーフィールドの追加・削除が発生する時、THE システム管理者 SHALL `$schemaVersion` のマイナーバージョンをインクリメントする
4. WHEN シャドーフィールドの型変更が発生する時、THE システム管理者 SHALL `$schemaVersion` のメジャーバージョンをインクリメントする
5. THE Records Lambda SHALL 起動時に `$schemaVersion` を読み込み、グローバル変数にキャッシュする

**設定ハッシュ管理:**

6. THE Records Lambda SHALL shadow.config.json の内容から SHA-256 ハッシュを生成する
7. THE Records Lambda SHALL 起動時に生成したハッシュをグローバル変数にキャッシュする
8. THE Records Lambda SHALL レコード作成時に `data.__configVersion` と `data.__configHash` を保存する
9. THE `data.__configVersion` SHALL レコード作成時の `$schemaVersion` を格納する
10. THE `data.__configHash` SHALL レコード作成時の設定ハッシュを格納する
11. THE Records Lambda SHALL レコード更新時に `data.__configVersion` と `data.__configHash` を更新しない

**レコードメタデータ:**

12. THE Records Lambda SHALL レコード作成時に以下のメタデータを `data` に追加する
    - `__shadowKeys`: 生成済みシャドーレコードのSK配列（既存）
    - `__configVersion`: レコード作成時の `$schemaVersion`（新規）
    - `__configHash`: レコード作成時の設定ハッシュ（新規）
13. THE Records Lambda SHALL メタデータフィールド（`__` プレフィックス）を HTTP レスポンスから除外する
14. THE Records Lambda SHALL 既存レコード（メタデータなし）も正常に処理する（後方互換性）

**Maintenance Lambda 連携:**

15. THE Maintenance Coordinator Lambda SHALL 指定されたリソースとセグメント数でStep Functions実行を開始する
16. THE Step Functions SHALL Map並列ステートでセグメント数に応じてMaintenance Worker Lambdaを並列実行する
17. THE Maintenance Coordinator Lambda SHALL 環境変数 `SHADOW_CONFIG` から現在の設定を読み込む
18. THE Maintenance Worker Lambda SHALL 環境変数 `SHADOW_CONFIG` から現在の設定を読み込む
19. THE Maintenance Worker Lambda SHALL DynamoDB Scanで各セグメントのレコードを走査し、__shadowKeysと影アイテムの整合性を検証する
20. THE Maintenance Worker Lambda SHALL 各レコードの `__configHash` と現在の設定ハッシュを比較する
21. WHEN `__configHash` が一致しない時、THE Maintenance Worker Lambda SHALL 設定ドリフトを検出する
22. WHEN `__configHash` が存在しない時（既存レコード）、THE Maintenance Worker Lambda SHALL 設定ドリフトを検出する
23. WHEN 設定ドリフトを検出する時、THE Maintenance Worker Lambda SHALL シャドーレコードを再生成する
24. WHEN dryRunがtrueの時、THE Maintenance Worker Lambda SHALL 修復が必要なレコードを検出するが実際の修復は実行しない
25. WHEN dryRunがfalseの時、THE Maintenance Worker Lambda SHALL TransactWriteItemsで古い影を削除し新しい影を作成する
26. THE Maintenance Worker Lambda SHALL 修復後に `__configVersion` と `__configHash` を更新する
27. THE Maintenance Worker Lambda SHALL 処理結果（scanned、drifted、repaired、failed、noop）をCloudWatch Logsに出力する
28. THE Maintenance機能 SHALL 手動実行（Lambda Invoke）のみをサポートし、自動スケジューラは含まない
29. THE Maintenance Coordinator SHALL 環境変数ALLOW_RESOURCESで許可されたリソース名のみを受け入れる

**Terraform 統合:**

30. THE Terraform設定 SHALL config/shadow.config.json の内容を base64 エンコードして `SHADOW_CONFIG` 環境変数に設定する
31. THE Terraform設定 SHALL Records Lambda、Maintenance Coordinator Lambda、Maintenance Worker Lambda の3つの Lambda 関数に同じ `SHADOW_CONFIG` 環境変数を設定する
32. THE Terraform設定 SHALL shadow.config.json の変更を検知し、Lambda 関数を自動的に再デプロイする
33. THE Terraform設定 SHALL 環境（dev/stg/prd）ごとに異なる shadow.config.json を使用できる

**監視とログ:**

34. THE Records Lambda SHALL 起動時に現在の `$schemaVersion` と設定ハッシュを CloudWatch Logs に出力する
35. THE Records Lambda SHALL レコード作成時に `__configVersion` と `__configHash` をログに記録する
36. THE Maintenance Worker Lambda SHALL 処理開始時に現在の設定情報（schemaVersion、configHash）をログに出力する
37. THE Maintenance Worker Lambda SHALL 設定ドリフトを検出したレコードの ID と旧設定情報（recordConfigVersion、recordConfigHash）をログに記録する
38. THE Maintenance Worker Lambda SHALL 修復完了時に統計情報（scanned、drifted、repaired、failed、処理時間）をログに出力する
39. THE CloudWatch Logs SHALL 構造化ログ形式（JSON）で出力する

**エラーハンドリング:**

40. WHEN shadow.config.json のパースに失敗する時、THE Records Lambda SHALL CONFIG_ERROR エラーを返す
41. WHEN `$schemaVersion` が不正な形式の時、THE Records Lambda SHALL CONFIG_ERROR エラーを返す
42. WHEN 設定ハッシュの生成に失敗する時、THE Records Lambda SHALL CONFIG_ERROR エラーを返す
43. WHEN Maintenance Worker Lambda がシャドー修復に失敗する時、THE Maintenance Worker Lambda SHALL エラーをログに記録し、処理を継続する
44. THE Maintenance Worker Lambda SHALL 修復失敗したレコードの ID とエラーコード（TRANSACTION_FAILED、VALIDATION_ERROR等）を CloudWatch Logs に出力する

**後方互換性:**

45. THE Records Lambda SHALL `__configVersion` と `__configHash` が存在しないレコードも正常に読み取り・更新する
46. THE Records Lambda SHALL 既存レコードの更新時に `__configVersion` と `__configHash` を追加する
47. THE Maintenance Worker Lambda SHALL メタデータがないレコードを設定ドリフトとして検出する
48. THE Maintenance Worker Lambda SHALL 既存レコードの修復時に `__configVersion` と `__configHash` を追加する

### 要件12: 高度なフィルター検索

**ユーザーストーリー:** コンテンツ管理者として、複数の検索条件（範囲検索、前方一致、後方一致）を組み合わせて記事を検索することで、目的のコンテンツを効率的に見つけたい

#### 受入基準

1. THE Records Lambda SHALL getList操作で拡張フィールド構文（`フィールド名:オペレータ:型`）をサポートする
2. THE Records Lambda SHALL 以下の7種類のフィルター演算子をサポートする: eq（等価）、lt（未満）、lte（以下）、gt（より大きい）、gte（以上）、starts（前方一致）、ends（後方一致）
3. WHEN フィルターフィールドにオペレータが指定されない時、THE Records Lambda SHALL デフォルトでeq（等価）演算子を使用する
4. WHEN フィルターフィールドに型が指定されない時、THE Records Lambda SHALL デフォルトでstring型として扱う
5. THE Records Lambda SHALL 型として string、number、date、boolean をサポートする
6. WHEN getListクエリを実行する時、THE Records Lambda SHALL ソートフィールドのシャドーレコードをDynamoDB Queryで取得し、BatchGetItemで本体レコードを取得した後、Lambda内のメモリでフィルター条件を適用する
7. WHEN フィルター条件の中にソートフィールドと一致するフィールドが存在し、かつその演算子がQuery可能（eq、lt、lte、gt、gte、starts）な時、THE Records Lambda SHALL その条件をDynamoDB QueryのKeyConditionExpressionに含めることで取得レコード数を最適化する
8. WHEN ends演算子が使用される時、THE Records Lambda SHALL メモリ内で後方一致判定を実行する
9. THE Records Lambda SHALL 複数のフィルター条件をAND条件として評価する
10. WHEN フィルターフィールド構文が不正な時、THE Records Lambda SHALL INVALID_FILTERエラーを返す
11. THE Records Lambda SHALL フィルター適用後のレコードに対してページネーションを適用する
12. THE Admin UI SHALL 拡張フィールド構文を使用してフィルター条件を指定できる

**フィルターフィールド構文の例:**
- `name:starts` → nameフィールドが指定値で始まる（string型、デフォルト）
- `priority:gte:number` → priorityフィールドが指定値以上（number型）
- `createdAt:lt:date` → createdAtフィールドが指定日時未満（date型）
- `isPublished:eq:boolean` → isPublishedフィールドがtrueまたはfalse（boolean型）
- `status` → statusフィールドが指定値と等しい（eq演算子、string型、デフォルト）
- `category:eq` → categoryフィールドが指定値と等しい（string型、デフォルト）

### 要件13: DynamoDBクライアントライブラリとデータ設計

**参照:** 詳細な要件定義は [.kiro/specs/dynamodb-client/requirements.md](../dynamodb-client/requirements.md) を参照してください。

**概要:** 
DynamoDB Single-Table設計向けのクライアントライブラリを実装します。MongoDB風のシンプルなAPIでDynamoDBを操作でき、型定義からシャドー設定を自動生成することで、開発効率を向上させ、データ整合性を保証します。

#### プロジェクト固有の適用

**パッケージ名:**
- `@ainews/records` として実装
- `@ainews/records/client` でクライアントSDKを公開
- `@ainews/records/server` でサーバー実装を公開（内部使用）

**型定義パッケージ:**
- `@ainews/api-types` で全リソースの型定義とシャドー設定を管理
- Article、Task等のスキーマ定義を含む

**Lambda実装:**
- `functions/records` でLambda関数を実装
- Lambda Function URLで公開

**クライアント:**
- `apps/admin`: Cognito認証でDynamoClientを使用
- `apps/mobile`: Cognito認証でDynamoClientを使用
- `functions/fetch`: IAM認証でDynamoClientを使用

**設定ファイル:**
- `config/shadow.config.json`: 型定義から自動生成
- Terraform経由でSHADOW_CONFIG環境変数に設定

### 要件14: バルク操作のスケーラビリティ

**ユーザーストーリー:** コンテンツ管理者として、大量のレコードを一括操作（作成・更新・削除）できることで、データインポートやバッチ更新を効率的に実行したい

#### 受入基準

1. THE Records Lambda SHALL createMany、updateMany、deleteManyの各操作で、TransactWriteItemsの100アイテム制限を超えるリクエストを処理できる
2. WHEN バルク操作のアイテム数が100を超える時、THE Records Lambda SHALL リクエストを複数のチャンクに自動分割する
3. THE Records Lambda SHALL 各チャンクを独立したTransactWriteItemsトランザクションとして順次実行する
4. WHEN 1つのチャンクが失敗する時、THE Records Lambda SHALL 後続のチャンクの処理を継続し、部分成功をサポートする
5. THE Records Lambda SHALL 各チャンクの実行結果（成功・失敗）を追跡し、最終的な結果を集約する
6. THE Records Lambda SHALL 成功したレコード、失敗したレコード、エラー詳細を含む包括的なレスポンスを返す
7. WHEN createMany操作でチャンク分割する時、THE Records Lambda SHALL 各レコードのメインアイテムとシャドーアイテムの合計数を考慮してチャンクサイズを計算する
8. WHEN updateMany操作でチャンク分割する時、THE Records Lambda SHALL 各レコードのメインアイテム、削除シャドー、追加シャドーの合計数を考慮してチャンクサイズを計算する
9. WHEN deleteMany操作でチャンク分割する時、THE Records Lambda SHALL 各レコードのメインアイテムとシャドーアイテムの合計数を考慮してチャンクサイズを計算する
10. THE Records Lambda SHALL チャンク分割処理をCloudWatch Logsに記録する（チャンク数、各チャンクのアイテム数、処理時間）
11. THE Records Lambda SHALL 部分失敗時に、失敗したレコードのIDとエラーコード（TRANSACTION_FAILED、VALIDATION_ERROR等）を返す
12. THE Records Lambda SHALL バルク操作のタイムアウトを考慮し、Lambda実行時間制限（最大15分）内で処理を完了する

### 要件15: Fetch実行履歴の記録と管理

**ユーザーストーリー:** システム管理者として、ニュース取得の実行履歴を記録・参照することで、各プロバイダの取得状況を監視し、問題を早期に発見したい

#### 受入基準

**FetchLogリソース:**

1. THE システム SHALL fetchLogsリソースを定義し、DynamoDBに保存する
2. THE FetchLog SHALL 以下のフィールドを含む:
   - `id`: ULID（自動生成）
   - `provider`: プロバイダ名（newsapi、gnews、apitube）
   - `status`: 実行ステータス（success、partial、failure）
   - `fetchedCount`: 取得成功件数
   - `failedCount`: 取得失敗件数
   - `errorMessage`: エラーメッセージ（失敗時）
   - `executedAt`: 実行日時（ISO 8601形式）
   - `createdAt`: レコード作成日時（自動設定）
   - `updatedAt`: レコード更新日時（自動設定）
3. THE FetchLog SHALL provider、status、executedAtをソート可能フィールドとして定義する
4. THE Admin UI SHALL fetchLogsリソースを表示し、プロバイダ・ステータス・実行日時でフィルタリング・ソートできる

**Fetch Lambda統合:**

5. WHEN Fetch Lambdaが実行される時、THE Fetch Lambda SHALL 実行開始時にFetchLogレコードを作成する
6. WHEN ニュース取得が完了する時、THE Fetch Lambda SHALL FetchLogレコードを更新し、取得件数とステータスを記録する
7. WHEN ニュース取得が失敗する時、THE Fetch Lambda SHALL FetchLogレコードを更新し、エラーメッセージとステータス（failure）を記録する
8. WHEN 一部のニュースのみ取得成功する時、THE Fetch Lambda SHALL ステータスをpartialとして記録する

**プロバイダ別実行制御:**

9. THE Fetch Lambda SHALL invocation payloadの`provider`フィールドでプロバイダを指定できる（newsapi、gnews、apitube）
10. WHEN `provider`が指定されない時、THE Fetch Lambda SHALL すべてのプロバイダを順次実行する
11. THE EventBridge Scheduler SHALL 各プロバイダを別々のスケジュールで実行でき、payloadで実行対象を指定する
12. THE システム SHALL 無料枠内での運用を考慮し、各プロバイダの実行頻度を制御できる

### 要件16: Articleデータ保持期間管理

**ユーザーストーリー:** システム管理者として、古いArticleを自動削除することで、データ量をコントロールし、ストレージコストを最適化したい

#### 受入基準

**TTL設定:**

1. THE Article SHALL ttlフィールドを含む（Unix timestamp、秒単位）
2. THE DynamoDB テーブル SHALL TTL機能を有効化し、ttlフィールドを使用する
3. WHEN Articleを作成する時、THE Records Lambda SHALL デフォルトのTTL（作成日時 + 90日）を設定する
4. THE システム SHALL 環境変数ARTICLE_TTL_DAYSでTTL期間を設定できる（デフォルト: 90日）
5. WHEN TTL期限が到達する時、THE DynamoDB SHALL Articleレコードとシャドーレコードを自動削除する

**Admin UI統合:**

6. THE Admin UI SHALL Articleリソースでttlフィールドを表示する（人間が読める形式: YYYY-MM-DD HH:mm:ss）
7. THE Admin UI SHALL Article作成・編集時にTTL期間を指定できる（日数単位）
8. WHEN TTL期間が指定されない時、THE Admin UI SHALL デフォルト値（90日）を使用する
9. THE Admin UI SHALL TTL期限が近いArticle（残り7日以内）を警告表示する

**FetchLog TTL:**

10. THE FetchLog SHALL ttlフィールドを含む（Unix timestamp、秒単位）
11. WHEN FetchLogを作成する時、THE Records Lambda SHALL デフォルトのTTL（作成日時 + 30日）を設定する
12. THE システム SHALL 環境変数FETCHLOG_TTL_DAYSでTTL期間を設定できる（デフォルト: 30日）


### 要件17: TypeScript プロジェクト構造の最適化

**ユーザーストーリー:** 開発者として、TypeScript プロジェクトの構造を最適化することで、ビルド設定を簡素化し、保守性を向上させたい

#### 受入基準

**scripts ディレクトリの統合:**

1. THE @ainews/api-types パッケージ SHALL scripts ディレクトリを src/scripts に移動する
2. THE @ainews/core パッケージ SHALL scripts ディレクトリを src/scripts に移動する
3. THE パッケージ SHALL 単一の tsconfig.json でソースコードとスクリプトの両方をビルドする
4. THE パッケージ SHALL tsconfig.scripts.json を削除する
5. THE パッケージ SHALL package.json の build スクリプトから tsconfig.scripts.json への参照を削除する

**ビルド出力の一貫性:**

6. THE パッケージ SHALL rootDir を "./src" に統一する
7. THE パッケージ SHALL outDir を "./dist" に統一する
8. THE パッケージ SHALL scripts のビルド出力を dist/scripts に配置する
9. THE パッケージ SHALL scripts/__tests__ のビルド出力を dist/scripts/__tests__ に配置する

**インポートパスの更新:**

10. WHEN scripts を src/scripts に移動する時、THE パッケージ SHALL scripts 内のインポートパスを更新する
11. WHEN scripts を src/scripts に移動する時、THE パッケージ SHALL scripts を参照する外部ファイルのインポートパスを更新する
12. THE パッケージ SHALL 相対インポートパス（../../）を適切に調整する

**テストの整合性:**

13. THE パッケージ SHALL scripts/__tests__ を src/scripts/__tests__ に移動する
14. THE パッケージ SHALL テストファイル内のインポートパスを更新する
15. WHEN ビルド後、THE パッケージ SHALL すべてのテストが正常に実行される

**Makefile の更新:**

16. THE パッケージ Makefile SHALL 新しいディレクトリ構造に対応する
17. THE パッケージ Makefile SHALL 依存関係の検知パスを src/scripts に更新する
18. THE ルート Makefile SHALL shadow-config ターゲットのパスを更新する
