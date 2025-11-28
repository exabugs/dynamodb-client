# CloudFront CDNモジュール

# CloudFront Origin Access Identity（OAI）
# S3バケットへのアクセスをCloudFrontのみに制限するために使用
resource "aws_cloudfront_origin_access_identity" "assets" {
  comment = "${var.project_name}-${var.environment}-assets-oai"
}

# S3バケットポリシー（CloudFrontからのアクセスのみ許可）
resource "aws_s3_bucket_policy" "assets_cloudfront" {
  bucket = var.s3_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAI"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.assets.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${var.s3_bucket_arn}/*"
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "assets" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name}-${var.environment}-assets-cdn"
  default_root_object = var.default_root_object
  price_class         = var.price_class

  # S3 Origin設定
  origin {
    domain_name = var.s3_bucket_regional_domain_name
    origin_id   = "S3-${var.s3_bucket_id}"

    # OAI設定
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.assets.cloudfront_access_identity_path
    }
  }

  # デフォルトキャッシュビヘイビア
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_id}"

    # キャッシュポリシー（Managed-CachingOptimized）
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # オリジンリクエストポリシー（Managed-CORS-S3Origin）
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"

    # レスポンスヘッダーポリシー（Managed-CORS-with-preflight-and-SecurityHeadersPolicy）
    response_headers_policy_id = "eaab4381-ed33-4a86-88ca-d9558dc6cd63"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  # 動画ファイル用のキャッシュビヘイビア（長期キャッシュ）
  ordered_cache_behavior {
    path_pattern     = "videos/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_id}"

    # キャッシュポリシー（Managed-CachingOptimized）
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # オリジンリクエストポリシー（Managed-CORS-S3Origin）
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"

    viewer_protocol_policy = "redirect-to-https"
    compress               = false    # 動画は圧縮しない
    min_ttl                = 86400    # 1日
    default_ttl            = 604800   # 7日
    max_ttl                = 31536000 # 1年
  }

  # 音声ファイル用のキャッシュビヘイビア
  ordered_cache_behavior {
    path_pattern     = "audio/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_id}"

    # キャッシュポリシー（Managed-CachingOptimized）
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # オリジンリクエストポリシー（Managed-CORS-S3Origin）
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"

    viewer_protocol_policy = "redirect-to-https"
    compress               = false    # 音声は圧縮しない
    min_ttl                = 86400    # 1日
    default_ttl            = 604800   # 7日
    max_ttl                = 31536000 # 1年
  }

  # 地理的制限（オプション）
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_locations
    }
  }

  # SSL/TLS証明書設定
  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == null ? true : false
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  # カスタムエラーレスポンス（404エラー）
  # response_page_pathが指定されている場合のみ設定
  dynamic "custom_error_response" {
    for_each = var.error_404_path != null ? [1] : []
    content {
      error_code            = 404
      response_code         = 404
      response_page_path    = var.error_404_path
      error_caching_min_ttl = 300
    }
  }

  # カスタムエラーレスポンス（403エラー）
  # response_page_pathが指定されている場合のみ設定
  dynamic "custom_error_response" {
    for_each = var.error_403_path != null ? [1] : []
    content {
      error_code            = 403
      response_code         = 403
      response_page_path    = var.error_403_path
      error_caching_min_ttl = 300
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-assets-cdn"
    Environment = var.environment
  }
}
