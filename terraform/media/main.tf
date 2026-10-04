# メディア（ファイルアップロード/処理/配信）機能モジュール
#
# 詳細設計: ../../docs/media-design.md
# 決定事項・トレードオフ: ../../docs/adr/0002-media-design.md
#
# 本モジュールは upload-handler（presign/sign発行）のLambdaを含まない。
# 「誰にpresign/署名URLを発行するか」の認可判断はアプリごとに異なるため、呼び出し側は
# 既存のHTTP APIレイヤー（認証・権限チェック済み）から `../../src/server/media/presign.ts`・
# `sign.ts` を直接呼び出して自前のLambda/ルートに組み込むこと。

locals {
  name_prefix = "${var.project_name}-${var.environment}-media"
}

# ============================================================
# S3バケット（raw/master/cache の3プレフィックス、完全非公開）
# ============================================================

resource "aws_s3_bucket" "media" {
  bucket = local.name_prefix

  tags = {
    Name = local.name_prefix
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# cache/* のみ自動削除。raw/*・master/*は恒久保存
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "expire-cache"
    status = "Enabled"

    filter {
      prefix = "cache/"
    }

    expiration {
      days = var.image_cache_ttl_days
    }
  }
}

# CloudFront OAC経由のアクセスのみ許可。Resourceはmaster/*に限定し、
# raw/*・cache/*をバケットポリシー経由で公開しない（cache/*はmedia-handlerの実行ロール経由のみ）
resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOACReadMasterOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.media.arn}/master/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.media.arn
          }
        }
      }
    ]
  })
}

# ============================================================
# DLQ（process-handlerのon-failure宛先）
# ============================================================

resource "aws_sqs_queue" "process_handler_dlq" {
  name                      = "${local.name_prefix}-process-dlq"
  message_retention_seconds = 1209600 # 14日（SQS上限）

  tags = {
    Name = "${local.name_prefix}-process-dlq"
  }
}

# ============================================================
# sharp Lambda Layer（scripts/build-sharp-layer.shで事前ビルド）
# ============================================================

resource "aws_lambda_layer_version" "sharp" {
  layer_name          = "${local.name_prefix}-sharp"
  filename            = "${path.module}/../../dist/sharp-layer.zip"
  source_code_hash    = filebase64sha256("${path.module}/../../dist/sharp-layer.zip")
  compatible_runtimes = ["nodejs22.x"]
  # sharp-layer.zipはlinux/arm64向けにビルドされる（build-sharp-layer.sh参照）
  compatible_architectures = ["arm64"]
}

# ============================================================
# process-handler Lambda（S3 ObjectCreatedトリガー）
# ============================================================

resource "aws_iam_role" "process_handler" {
  name = "${local.name_prefix}-process-handler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-process-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "process_handler_basic" {
  role       = aws_iam_role.process_handler.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "process_handler_s3" {
  name = "s3-access"
  role = aws_iam_role.process_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.media.arn}/raw/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.media.arn}/master/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "process_handler_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.process_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:BatchGetItem", "dynamodb:Query"]
        Resource = [var.table_arn, "${var.table_arn}/index/*"]
      }
    ]
  })
}

resource "aws_iam_role_policy" "process_handler_ssm" {
  name = "ssm-access"
  role = aws_iam_role.process_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.region}:*:parameter${var.image_policy_param}"
      }
    ]
  })
}

# Lambda非同期呼び出し失敗時のon-failure宛先として送信する権限
resource "aws_iam_role_policy" "process_handler_dlq_send" {
  name = "dlq-send"
  role = aws_iam_role.process_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.process_handler_dlq.arn
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "process_handler" {
  name              = "/aws/lambda/${local.name_prefix}-process-handler"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-process-handler-logs"
  }
}

data "archive_file" "process_handler" {
  type        = "zip"
  source_file = "${path.module}/../../dist/server/media-process-handler.cjs"
  output_path = "${path.module}/../../dist/server/media-process-handler.zip"
}

resource "aws_lambda_function" "process_handler" {
  function_name = "${local.name_prefix}-process-handler"
  description   = "メディア処理（EXIF除去・リサイズ・master配置）。S3 ObjectCreated（raw/*）トリガー"
  role          = aws_iam_role.process_handler.arn

  filename         = data.archive_file.process_handler.output_path
  source_code_hash = data.archive_file.process_handler.output_base64sha256

  runtime       = "nodejs22.x"
  architectures = ["arm64"] # sharp-layer.zip（linux/arm64）に合わせる
  handler       = "media-process-handler.handler"

  timeout     = var.process_handler_timeout
  memory_size = var.process_handler_memory_size

  layers = [aws_lambda_layer_version.sharp.arn]

  environment {
    variables = {
      REGION             = var.region
      TABLE_NAME         = var.table_name
      IMAGE_POLICY_PARAM = var.image_policy_param
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.process_handler,
    aws_iam_role_policy.process_handler_s3,
    aws_iam_role_policy.process_handler_dynamodb,
    aws_iam_role_policy.process_handler_ssm,
  ]

  tags = {
    Name = "${local.name_prefix}-process-handler"
  }
}

resource "aws_lambda_function_event_invoke_config" "process_handler" {
  function_name          = aws_lambda_function.process_handler.function_name
  maximum_retry_attempts = 2

  destination_config {
    on_failure {
      destination = aws_sqs_queue.process_handler_dlq.arn
    }
  }
}

resource "aws_lambda_permission" "s3_invoke_process_handler" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.process_handler.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.media.arn
}

resource "aws_s3_bucket_notification" "media" {
  bucket = aws_s3_bucket.media.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.process_handler.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw/"
  }

  depends_on = [aws_lambda_permission.s3_invoke_process_handler]
}

# ============================================================
# process-handler-dlq Lambda（SQS DLQトリガー）
# ============================================================

resource "aws_iam_role" "process_handler_dlq" {
  name = "${local.name_prefix}-process-handler-dlq-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-process-handler-dlq-role"
  }
}

resource "aws_iam_role_policy_attachment" "process_handler_dlq_basic" {
  role       = aws_iam_role.process_handler_dlq.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "process_handler_dlq_sqs" {
  name = "sqs-access"
  role = aws_iam_role.process_handler_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.process_handler_dlq.arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "process_handler_dlq_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.process_handler_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:BatchGetItem"]
        Resource = [var.table_arn, "${var.table_arn}/index/*"]
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "process_handler_dlq" {
  name              = "/aws/lambda/${local.name_prefix}-process-handler-dlq"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-process-handler-dlq-logs"
  }
}

data "archive_file" "process_handler_dlq" {
  type        = "zip"
  source_file = "${path.module}/../../dist/server/media-process-handler-dlq.cjs"
  output_path = "${path.module}/../../dist/server/media-process-handler-dlq.zip"
}

resource "aws_lambda_function" "process_handler_dlq" {
  function_name = "${local.name_prefix}-process-handler-dlq"
  description   = "process-handlerのリトライが尽きた場合にfailedレコードを書き込む（SQS DLQトリガー）"
  role          = aws_iam_role.process_handler_dlq.arn

  filename         = data.archive_file.process_handler_dlq.output_path
  source_code_hash = data.archive_file.process_handler_dlq.output_base64sha256

  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  handler       = "media-process-handler-dlq.handler"

  timeout     = 30
  memory_size = 256

  environment {
    variables = {
      REGION     = var.region
      TABLE_NAME = var.table_name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.process_handler_dlq,
    aws_iam_role_policy.process_handler_dlq_sqs,
    aws_iam_role_policy.process_handler_dlq_dynamodb,
  ]

  tags = {
    Name = "${local.name_prefix}-process-handler-dlq"
  }
}

resource "aws_lambda_event_source_mapping" "process_handler_dlq" {
  event_source_arn = aws_sqs_queue.process_handler_dlq.arn
  function_name    = aws_lambda_function.process_handler_dlq.arn
  batch_size       = 1
}

# ============================================================
# media-handler Lambda（CloudFront /resize/* 専用オリジン）
# ============================================================

resource "aws_iam_role" "media_handler" {
  name = "${local.name_prefix}-media-handler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-media-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "media_handler_basic" {
  role       = aws_iam_role.media_handler.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 署名鍵へのSSM権限・DynamoDB権限は付与しない（最小権限。media-handlerに不要なため）
resource "aws_iam_role_policy" "media_handler_s3" {
  name = "s3-access"
  role = aws_iam_role.media_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.media.arn}/master/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${aws_s3_bucket.media.arn}/cache/*"
      },
      {
        # s3:ListBucket が無いロールでGetObjectが存在しないキーを指すと、S3は
        # NoSuchKey（404相当）ではなく403 AccessDeniedを返す（存在確認防止のためのAWS仕様）。
        # これを許可しないと tryGetFromS3() の NoSuchKey 判定に当たらず、
        # cache未生成時の初回リクエストが常に500になる。
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.media.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["master/*", "cache/*"]
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "media_handler_ssm" {
  name = "ssm-access"
  role = aws_iam_role.media_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.region}:*:parameter${var.image_policy_param}"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "media_handler" {
  name              = "/aws/lambda/${local.name_prefix}-handler"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-handler-logs"
  }
}

data "archive_file" "media_handler" {
  type        = "zip"
  source_file = "${path.module}/../../dist/server/media-handler.cjs"
  output_path = "${path.module}/../../dist/server/media-handler.zip"
}

resource "aws_lambda_function" "media_handler" {
  function_name = "${local.name_prefix}-handler"
  description   = "CloudFront /resize/* 専用オリジン。オンデマンドリサイズ"
  role          = aws_iam_role.media_handler.arn

  filename         = data.archive_file.media_handler.output_path
  source_code_hash = data.archive_file.media_handler.output_base64sha256

  runtime       = "nodejs22.x"
  architectures = ["arm64"] # sharp-layer.zip（linux/arm64）に合わせる
  handler       = "media-handler.handler"

  timeout     = 30
  memory_size = var.media_handler_memory_size

  layers = [aws_lambda_layer_version.sharp.arn]

  environment {
    variables = {
      REGION             = var.region
      MEDIA_BUCKET       = aws_s3_bucket.media.bucket
      IMAGE_POLICY_PARAM = var.image_policy_param
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.media_handler,
    aws_iam_role_policy.media_handler_s3,
    aws_iam_role_policy.media_handler_ssm,
  ]

  tags = {
    Name = "${local.name_prefix}-handler"
  }
}

# CloudFrontからのみ呼び出し可能にする（AWS_IAM認証、CloudFront OAC経由）
resource "aws_lambda_function_url" "media_handler" {
  function_name      = aws_lambda_function.media_handler.function_name
  authorization_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cloudfront_invoke_media_handler" {
  statement_id           = "AllowCloudFrontInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.media_handler.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.media.arn
  function_url_auth_type = "AWS_IAM"
}

# ============================================================
# CloudFront配信（署名付きURL必須、/master/*・/resize/*の2ビヘイビア）
# ============================================================

resource "aws_cloudfront_origin_access_control" "media_s3" {
  name                              = "${local.name_prefix}-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "media_handler" {
  name                              = "${local.name_prefix}-lambda-oac"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_ssm_parameter" "signing_public_key" {
  name = var.signing_public_key_param
}

resource "aws_cloudfront_public_key" "media" {
  name        = "${local.name_prefix}-signing-key"
  encoded_key = data.aws_ssm_parameter.signing_public_key.value
  comment     = "Media delivery signing key (2048bit RSA)"
}

resource "aws_cloudfront_key_group" "media" {
  name  = "${local.name_prefix}-key-group"
  items = [aws_cloudfront_public_key.media.id]
}

# width クエリパラメータのみキャッシュキーに含め、署名パラメータは除外する
resource "aws_cloudfront_cache_policy" "resize" {
  name    = "${local.name_prefix}-resize-cache-policy"
  comment = "width のみキャッシュキーに含める。署名付きURLのExpires/Signature/Key-Pair-Idは除外"

  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["width"]
      }
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

locals {
  # AWSマネージドポリシー（キャッシュポリシー/オリジンリクエストポリシー）のID
  # CachingOptimized: S3静的ファイル配信向けの標準キャッシュポリシー
  managed_caching_optimized_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  # AllViewerExceptHostHeader: Hostヘッダーのみ転送しない（Function URLがHostヘッダー転送時に403を返すため）
  managed_all_viewer_except_host_header_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"

  media_handler_function_url_domain = replace(
    replace(aws_lambda_function_url.media_handler.function_url, "https://", ""),
    "/",
    ""
  )

  has_custom_domain = var.domain_name != null && var.acm_certificate_arn != null
}

resource "aws_cloudfront_distribution" "media" {
  enabled     = true
  comment     = "${local.name_prefix} delivery"
  price_class = "PriceClass_200"

  aliases = local.has_custom_domain ? [var.domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "s3-media"
    origin_access_control_id = aws_cloudfront_origin_access_control.media_s3.id
  }

  origin {
    domain_name              = local.media_handler_function_url_domain
    origin_id                = "lambda-media-handler"
    origin_access_control_id = aws_cloudfront_origin_access_control.media_handler.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # デフォルトビヘイビア（想定外のパス）。masterと同じ扱いにしておく
  default_cache_behavior {
    target_origin_id       = "s3-media"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = local.managed_caching_optimized_policy_id
    trusted_key_groups     = [aws_cloudfront_key_group.media.id]
  }

  ordered_cache_behavior {
    path_pattern           = "/master/*"
    target_origin_id       = "s3-media"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = local.managed_caching_optimized_policy_id
    trusted_key_groups     = [aws_cloudfront_key_group.media.id]
  }

  ordered_cache_behavior {
    path_pattern             = "/resize/*"
    target_origin_id         = "lambda-media-handler"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = aws_cloudfront_cache_policy.resize.id
    origin_request_policy_id = local.managed_all_viewer_except_host_header_policy_id
    trusted_key_groups       = [aws_cloudfront_key_group.media.id]
  }

  # 404/403応答がネガティブキャッシュ（既定約10秒）で長引かないようにする
  custom_error_response {
    error_code            = 403
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 404
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.has_custom_domain ? null : true
    acm_certificate_arn            = local.has_custom_domain ? var.acm_certificate_arn : null
    ssl_support_method             = local.has_custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_custom_domain ? "TLSv1.2_2021" : null
  }

  tags = {
    Name = local.name_prefix
  }
}

resource "aws_route53_record" "media" {
  count = local.has_custom_domain && var.route53_zone_id != null ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.media.domain_name
    zone_id                = aws_cloudfront_distribution.media.hosted_zone_id
    evaluate_target_health = false
  }
}
