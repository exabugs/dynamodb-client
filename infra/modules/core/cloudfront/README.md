# CloudFront CDNモジュール

このモジュールは、S3アセットバケットの前段に配置するCloudFront Distributionを作成します。音声・動画・画像などのメディアファイルを高速に配信するためのCDNとして機能します。

## 機能

- **Origin Access Identity (OAI)**: S3バケットへのアクセスをCloudFrontのみに制限
- **S3 Origin設定**: S3バケットをオリジンとして設定
- **キャッシュ最適化**: 
  - デフォルト: AWS Managed Cache Policy（CachingOptimized）
  - 動画ファイル（videos/*）: 長期キャッシュ（最大1年）
  - 音声ファイル（audio/*）: 長期キャッシュ（最大1年）
- **HTTPS強制**: すべてのリクエストをHTTPSにリダイレクト
- **圧縮**: テキストベースのコンテンツを自動圧縮（動画・音声は除外）
- **CORS対応**: AWS Managed CORS Policy適用
- **セキュリティヘッダー**: AWS Managed Security Headers Policy適用
- **カスタムエラーページ**: 404/403エラーのカスタマイズ対応
- **地理的制限**: オプションで特定国からのアクセスを制限可能
- **カスタムドメイン**: ACM証明書を使用したカスタムドメイン対応

## 使用方法

```hcl
module "cloudfront" {
  source = "./modules/core/cloudfront"

  project_name = "ainews"
  environment  = "dev"
  
  # S3バケット情報（S3モジュールの出力を使用）
  s3_bucket_id                     = module.s3.bucket_name
  s3_bucket_arn                    = module.s3.bucket_arn
  s3_bucket_regional_domain_name   = module.s3.bucket_regional_domain_name
  
  # オプション設定
  price_class              = "PriceClass_100"  # コスト最適化
  geo_restriction_type     = "none"
  geo_restriction_locations = []
  
  # カスタムドメイン使用時（オプション）
  # acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/xxxxx"
}
```

## 入力変数

| 変数名 | 説明 | 型 | デフォルト値 | 必須 |
|--------|------|-----|-------------|------|
| project_name | プロジェクト名 | string | - | はい |
| environment | 環境識別子（dev, stg, prd） | string | - | はい |
| s3_bucket_id | S3バケットID | string | - | はい |
| s3_bucket_arn | S3バケットARN | string | - | はい |
| s3_bucket_regional_domain_name | S3バケットリージョナルドメイン名 | string | - | はい |
| default_root_object | デフォルトルートオブジェクト | string | "" | いいえ |
| price_class | CloudFront価格クラス | string | "PriceClass_100" | いいえ |
| geo_restriction_type | 地理的制限タイプ | string | "none" | いいえ |
| geo_restriction_locations | 地理的制限対象の国コードリスト | list(string) | [] | いいえ |
| acm_certificate_arn | ACM証明書ARN（カスタムドメイン使用時） | string | null | いいえ |
| error_404_path | 404エラーページのパス | string | null | いいえ |
| error_403_path | 403エラーページのパス | string | null | いいえ |

## 出力値

| 出力名 | 説明 |
|--------|------|
| distribution_id | CloudFront Distribution ID |
| distribution_arn | CloudFront Distribution ARN |
| distribution_domain_name | CloudFront Distribution ドメイン名 |
| distribution_hosted_zone_id | CloudFront Distribution Hosted Zone ID |
| oai_iam_arn | Origin Access Identity IAM ARN |
| oai_cloudfront_access_identity_path | Origin Access Identity CloudFront Access Identity Path |

## キャッシュ戦略

### デフォルトキャッシュビヘイビア
- **対象**: すべてのファイル（パスパターン指定なし）
- **キャッシュポリシー**: AWS Managed CachingOptimized
- **圧縮**: 有効
- **TTL**: AWS Managed Policyのデフォルト値

### 動画ファイル（videos/*）
- **対象**: `videos/` プレフィックスのファイル
- **圧縮**: 無効（動画は既に圧縮済み）
- **TTL**: 
  - 最小: 1日（86400秒）
  - デフォルト: 7日（604800秒）
  - 最大: 1年（31536000秒）

### 音声ファイル（audio/*）
- **対象**: `audio/` プレフィックスのファイル
- **圧縮**: 無効（音声は既に圧縮済み）
- **TTL**: 
  - 最小: 1日（86400秒）
  - デフォルト: 7日（604800秒）
  - 最大: 1年（31536000秒）

## セキュリティ

- **OAI**: S3バケットへの直接アクセスをブロックし、CloudFront経由のみ許可
- **HTTPS強制**: すべてのHTTPリクエストをHTTPSにリダイレクト
- **TLS 1.2以上**: 最小プロトコルバージョンをTLSv1.2_2021に設定
- **セキュリティヘッダー**: AWS Managed Security Headers Policyを適用
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
  - Strict-Transport-Security: max-age=31536000

## コスト最適化

- **Price Class 100**: 北米・ヨーロッパのエッジロケーションのみ使用（最もコスト効率が良い）
- **長期キャッシュ**: 動画・音声ファイルは最大1年キャッシュしてオリジンリクエストを削減
- **圧縮**: テキストベースのコンテンツを圧縮して転送量を削減

## 価格クラス

| Price Class | エッジロケーション | 用途 |
|-------------|-------------------|------|
| PriceClass_100 | 北米・ヨーロッパ | コスト最適化（推奨） |
| PriceClass_200 | 北米・ヨーロッパ・アジア・中東・アフリカ | バランス型 |
| PriceClass_All | 全世界 | 最高パフォーマンス |

## カスタムドメイン設定

カスタムドメインを使用する場合は、以下の手順を実施してください：

1. ACM証明書を**us-east-1リージョン**で作成
2. `acm_certificate_arn` 変数に証明書ARNを設定
3. Route 53でエイリアスレコードを作成（`distribution_domain_name` と `distribution_hosted_zone_id` を使用）

```hcl
# Route 53エイリアスレコード例
resource "aws_route53_record" "cdn" {
  zone_id = var.route53_zone_id
  name    = "cdn.example.com"
  type    = "A"

  alias {
    name                   = module.cloudfront.distribution_domain_name
    zone_id                = module.cloudfront.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}
```

## 要件

- 要件8.3: パイプライン処理（中間成果物保存）
- 要件8.7: CDN配信（静的アセット配信）

## 注意事項

- CloudFront Distributionのデプロイには15〜20分程度かかります
- キャッシュの無効化（Invalidation）には追加コストが発生します
- ACM証明書は必ず**us-east-1リージョン**で作成してください（CloudFrontの要件）
