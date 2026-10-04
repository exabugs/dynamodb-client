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

本番環境（`asanowa-prd-records`・`asanowa-prd-records-custom`）のCloudWatch Logsを過去90日分（ログ保持期間の上限）調査したが、`"IAM authenticated request"`ログは1件も記録されていなかった。実際の悪用の痕跡は確認されなかった（ただしログ保持期間を超える過去分は確認不能）。

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

- Lambda エイリアスが`$LATEST`を指せること、そのエイリアスにAWS_IAM認証のFunction URLを設定できることを、本番以外のサンドボックス関数（`dynamodb-client-example-dev-records`）上で実際にAWS CLIを使って検証した（作成・確認後、検証用リソースは削除済み）。
- 同一Lambda関数コードに対し、NONE認証のURL（既存、無修飾子）とAWS_IAM認証のURL（エイリアス修飾）を同時に設定できることを確認した。

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

- `lambda:InvokeFunction`権限（`InvokeFunctionUrl`に加えて必要になるかどうか）は、呼び出し側の実装時に実環境で確認する。
- 被害調査はログ保持期間（90日）内に限られる。より長期の不正アクセスがなかったことの確証はない。
