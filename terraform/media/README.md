# メディア機能 Terraformモジュール

ファイルアップロード・処理（EXIF除去・リサイズ）・配信機能をデプロイするTerraformモジュールです。

詳細設計: [../../docs/media-design.md](../../docs/media-design.md)
決定事項・トレードオフ: [../../docs/adr/0002-media-design.md](../../docs/adr/0002-media-design.md)

## 概要

このモジュールは、以下のリソースをデプロイします：

- S3バケット（raw/master/cache の3プレフィックス、完全非公開）
- sharp Lambda Layer（`scripts/build-sharp-layer.sh`で事前ビルドが必要）
- process-handler Lambda（S3 ObjectCreatedトリガー、EXIF除去・リサイズ・master配置）
- process-handler-dlq Lambda（SQS DLQトリガー、処理失敗時のfailedレコード書き込み）
- media-handler Lambda（CloudFront `/resize/*` 専用オリジン、オンデマンドリサイズ）
- CloudFront Distribution（`/master/*`はS3直接配信、`/resize/*`はmedia-handler経由、両方とも署名付きURL必須）
- CloudFront Public Key / Key Group（署名鍵は呼び出し側がSSM Parameter Storeに別途登録する）

**含まないもの**: presign/署名URL発行用のLambda。「誰にpresign/署名URLを発行してよいか」の認可判断はアプリごとに異なるため、呼び出し側は既存のHTTP APIレイヤー（認証・権限チェック済み）から `../../src/server/media/presign.ts`・`sign.ts` を直接呼び出して自前のLambda/ルートに組み込んでください。

## 前提条件

1. `npm run build`（`scripts/build-sharp-layer.sh`を含む。Dockerが必要）を実行し、`dist/`配下にLambda成果物を生成しておくこと
2. 署名鍵（RSA 2048bit）を生成し、公開鍵を`signing_public_key_param`で指定するSSM Parameterに登録しておくこと（秘密鍵は呼び出し側のpresign/署名URL発行処理が別途SSM経由で取得する）
3. image policy（`masterMaxDimension`・`allowedContentTypes`・`maxUploadSize`）のJSONを`image_policy_param`で指定するSSM Parameterに登録しておくこと

## 使用方法

```hcl
module "media" {
  source = "github.com/exabugs/dynamodb-client//terraform/media"

  project_name = "my-project"
  environment  = "dev"
  region       = "ap-northeast-1"

  table_name = module.dynamodb.table_name
  table_arn  = module.dynamodb.table_arn

  signing_public_key_param = "/my-project/dev/media/signing-public-key"
  image_policy_param       = "/my-project/dev/media/image-policy"

  # カスタムドメイン使用時のみ（省略時はCloudFrontのデフォルトドメインを使う）
  domain_name         = "media.dev.example.com"
  acm_certificate_arn = module.cloudfront.certificate_arn # us-east-1リージョンの証明書
  route53_zone_id     = var.route53_zone_id
}
```

`module.media`のoutput（`key_pair_id`・`base_url`）を、presign/署名URL発行を行う呼び出し側のLambdaへ変数として渡してください。

## 依存関係の向き

本モジュールは呼び出し側の既存CloudFront・テーブルARNに依存しません（片方向）。循環依存を避けるため、呼び出し側のLambdaが`module.media`のoutputに依存する向きで配線してください。

## 検証

```bash
terraform init -backend=false
terraform validate
```

実際の`terraform plan`/`apply`にはAWS認証情報とダミーでない変数値が必要です。
