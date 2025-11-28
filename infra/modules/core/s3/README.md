# S3 Assets Bucketモジュール

このモジュールは、音声・動画・画像などのアセットファイルを保存するためのS3バケットを作成します。

## 機能

- **バージョニング**: すべてのオブジェクトのバージョン管理を有効化
- **KMS暗号化**: AWS管理キー（alias/aws/s3）による暗号化
- **Public Access Block**: パブリックアクセスを完全にブロック
- **ライフサイクルポリシー**: 
  - 30日後にStandard-IAへ移行
  - 90日後にGlacier Flexible Retrievalへ移行
  - 古いバージョンは365日後に削除（オプション）
- **CORS設定**: CloudFront経由でのアクセスをサポート

## 使用方法

```hcl
module "s3" {
  source = "./modules/core/s3"

  project_name = "ainews"
  environment  = "dev"
  
  # オプション設定
  enable_version_expiration = true
  cors_allowed_origins      = ["*"]
}
```

## 入力変数

| 変数名 | 説明 | 型 | デフォルト値 | 必須 |
|--------|------|-----|-------------|------|
| project_name | プロジェクト名 | string | - | はい |
| environment | 環境識別子（dev, stg, prd） | string | - | はい |
| enable_version_expiration | 古いバージョンの自動削除を有効化 | bool | true | いいえ |
| cors_allowed_origins | CORS許可オリジンのリスト | list(string) | ["*"] | いいえ |

## 出力値

| 出力名 | 説明 |
|--------|------|
| bucket_name | S3バケット名 |
| bucket_arn | S3バケットARN |
| bucket_domain_name | S3バケットドメイン名 |
| bucket_regional_domain_name | S3バケットリージョナルドメイン名 |

## ストレージクラス移行

```
作成時: STANDARD
  ↓ 30日
STANDARD_IA
  ↓ 60日
GLACIER (作成から90日後)
```

## セキュリティ

- すべてのパブリックアクセスがブロックされています
- KMS暗号化が有効化されています
- CloudFront経由でのみアクセス可能（OAI設定が必要）

## 要件

- 要件6.2: Infrastructure as Code
- 要件8.3: パイプライン処理（中間成果物保存）
