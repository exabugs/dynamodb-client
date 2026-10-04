# ADR 0001: IAM認証バイパス脆弱性の修正

## ステータス

承認・実装済み

## 背景

Records Lambda（`terraform/main.tf`で定義、`src/server/`）は1本のLambda Function URL（`authorization_type: NONE`）で、ブラウザ等からのCognito JWT認証と、サーバー間（Lambda-to-Lambda）呼び出し用のIAM認証の両方を受け付ける設計になっていた。

`src/server/utils/authHandler.ts`の旧実装は、リクエストヘッダーの見た目（`Authorization`ヘッダーが`AWS4-HMAC-SHA256`で始まる、または`x-amz-date`と`x-amz-content-sha256`の両方が存在する）だけでIAM認証とみなし、実際の署名検証は一切行っていなかった。コード中には「実際の検証はAWS側で行われる」というコメントがあったが、これはFunction URLの`authorization_type`が`NONE`である限り誤りで、AWSは署名を検証しない。

この結果、**インターネット上の誰でも、`x-amz-date`と`x-amz-content-sha256`という2つのヘッダーを送るだけで（`Authorization`ヘッダーすら不要）、認証なしで全リソースに対するCRUD操作が可能**という状態になっていた。

実地調査の結果、この未検証IAM経路を実際に利用していたのは、サーバー間呼び出し（クライアントSDKの`src/client/index.iam.ts`、`aws-sigv4.ts`で本物のSigV4署名を生成している）だけだった。ブラウザ・Admin UIはCognito JWT（`handleCognitoAuthentication`）を使っており、この脆弱性の影響を受けていなかった。

調査の過程で、Cognito JWT認証側にも別の問題が見つかった。`verifyAuthHeader`は`clientId`（Cognito App Client ID）を渡せば`aud`クレームを検証する実装になっていたが、Terraform側で`COGNITO_CLIENT_ID`環境変数が設定されておらず、`aud`検証が常にスキップされていた。これにより、同じUser Pool配下の別アプリのJWTでも通ってしまう状態だった。

### 被害調査

本番環境（`asanowa-prd-records`・`asanowa-prd-records-custom`）のCloudWatch Logsを過去90日分（ログ保持期間の上限）調査したが、`"IAM authenticated request"`ログは1件も記録されていなかった。

**【訂正】この調査結果は当初「悪用の痕跡なし」と結論付けたが、誤りだった。** 第三者レビューで判明した通り、このログは`logger.info`で出力される実装だったのに対し、prd環境の`LOG_LEVEL`はTerraform（`infra/apps/*/envs/prd.tfvars`）で`warn`に設定されていた。そのため**このログ行はprdでは実装上そもそも一度も出力されない**（正規のサーバー間呼び出しが同じIAM経路を毎回通っていたにもかかわらず、それすら0件だったことからも裏付けられる）。したがって「0件＝悪用なし」という結論は成立せず、**ログからは過去の悪用有無を判断できない**。この点は未解決の残課題として扱う（「残課題」節を参照）。

## 決定

### 1. IAM認証バイパスの修正: AWS_IAM認証の専用Function URLを新設

- Lambda関数に`iam`という名前のエイリアス（`$LATEST`を指す）を新設した。
- このエイリアス経由で、`authorization_type: AWS_IAM`の2本目のFunction URLを公開する。
- `authHandler.ts`の判定ロジックを、ヘッダーの見た目による判定から**`event.requestContext.authorizer.iam`の有無**による判定に変更した。この値はAWS_IAM認証のFunction URLが実際に署名検証に成功した場合にのみAWSが付与するものであり、クライアントから偽装できない。
- 既存の`NONE`認証のFunction URLからはIAM認証の分岐そのものを削除した。このURLはCognito JWTのみを受け付ける。
- サーバー間呼び出し元（モバイルBFF・weather Lambda・運用スクリプト）は、新しいAWS_IAM認証のFunction URLを呼ぶよう切り替える。呼び出し元のIAMロールに、このエイリアスのARNに対する`lambda:InvokeFunctionUrl`権限を追加する必要がある。

#### 検討した代替案

- **Lambda内でSigV4署名を自前検証する**: 採用しなかった。検証に必要な秘密鍵（呼び出し元のIAMクレデンシャルに対応する秘密鍵）をLambda側が持っていないため、技術的に不可能。

#### 実地検証

- Lambda エイリアスが`$LATEST`を指せること、そのエイリアスにAWS_IAM認証のFunction URLを設定できることを、本番以外のサンドボックス関数（`dynamodb-client-example-dev-records`）上で実際にAWS CLIを使って検証した。
- 同一Lambda関数コードに対し、NONE認証のURL（既存、無修飾子）とAWS_IAM認証のURL（エイリアス修飾）を同時に設定できることを確認した。
- **【訂正】「検証用リソースは削除済み」としていたが誤りだった。** 2026-10-04の第三者レビューで、この`dynamodb-client-example-dev-records`（および同様のサンプル`ainews-dev-records`・`my-project-dev-records`）がus-east-1に残存し、**修正前の脆弱なコードのまま、公開NONE認証Function URLで稼働し続けていた**ことが判明した（実際に偽装ヘッダーで認証バイパスできることを確認）。本番（asanowa/asaichiのap-northeast-1環境）とは無関係だが、同じ脆弱性を持つ野良環境が放置されていた事実として記録する。`dynamodb-client-example-dev-records`・`my-project-dev-records`は発見後ただちに削除した（`ainews-dev-records`は別プロジェクトのため対象外、別途対応）。

### 2. Cognito JWTのaud検証を有効化

- `cognito_client_id`というTerraform変数を新設し、`COGNITO_CLIENT_ID`環境変数としてLambdaに渡すようにした。
- アプリケーションコード（`auth.ts`・`authHandler.ts`）は元々`clientId`を受け取ってaud検証する実装になっていたため、コード変更は不要で、Terraformの配線漏れを直すだけで直った。
- 呼び出し側（asanowa等）は、このLambdaを呼び出すクライアント（Admin UI）が属するCognito App Client IDを渡す。

## 影響範囲

- `src/server/utils/authHandler.ts`: 認証ロジックの変更
- `terraform/{main,variables,outputs}.tf`: エイリアス・AWS_IAM Function URL・`cognito_client_id`変数の追加
- `__tests__/server/utils/authHandler.test.ts`: 旧脆弱性を前提にしたテストを、新しい判定ロジックに合わせて書き直し。回帰防止のため「ヘッダーを偽装してもIAM認証扱いにならないこと」を明示的にテストする項目を追加した
- 呼び出し側アプリ（asanowa/asaichi）側の対応は別途そちらのリポジトリ・ADRで管理する:
  - サーバー間呼び出し元（`functions/records-asanowa/src/dynamodb-client.ts`、`functions/records-asaichi/src/dynamodb-client.ts`、`functions/weather/src/index.ts`、運用スクリプト）をAWS_IAM認証URLへ切り替える
  - 呼び出し元LambdaのIAMロールに`lambda:InvokeFunctionUrl`権限を追加する
  - `cognito_client_id`変数（Admin UIのApp Client ID）を配線する

## 残課題

- ~~`lambda:InvokeFunction`権限（`InvokeFunctionUrl`に加えて必要になるかどうか）は、呼び出し側の実装時に実環境で確認する。~~ **解決済み（2026-10-04確認）**: asanowa/asaichi側のIAMポリシー（records-asanowa・records-asaichi・weather）はいずれも`lambda:InvokeFunction`と`lambda:InvokeFunctionUrl`の両方を許可しており、prd環境で実際にIAM経路への呼び出しが届いていることをCloudWatch Metricsで確認済み。
- **被害調査は実質的に未解決（上記「被害調査」節の訂正を参照）**。prdの`LOG_LEVEL=warn`設定により、脆弱性調査に使った`"IAM authenticated request"`ログがそもそも出力されない状態だったため、「過去90日間悪用がなかった」という結論は裏付けられていない。ログ保持期間を超える過去分も含め、確証は得られていない。
- 呼び出し側（asanowa）の運用スクリプト（seed/migrate/backfill等）が、修正後も旧NONE認証URLを参照したままだった（SSMパラメータの向き先が旧URLのまま）。401で失敗するため安全ではあるが、「切り替え済み」という本ADRの記述と実態が食い違っていた。呼び出し側リポジトリで別途対応する。
