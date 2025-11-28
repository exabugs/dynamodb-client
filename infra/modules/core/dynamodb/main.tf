# DynamoDB Single-Table設計モジュール

# DynamoDB Single-Table
resource "aws_dynamodb_table" "records" {
  name         = "${var.project_name}-${var.environment}-records"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  # パーティションキー（リソース名）
  attribute {
    name = "PK"
    type = "S"
  }

  # ソートキー（レコードIDまたはシャドーキー）
  attribute {
    name = "SK"
    type = "S"
  }

  # TTL設定
  ttl {
    enabled        = true
    attribute_name = "ttl"
  }

  # Point-in-Time Recovery設定（環境変数で制御）
  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  # AWS管理キーによる暗号化
  server_side_encryption {
    enabled = true
    # kms_key_arnを指定しない場合、AWS管理キー（alias/aws/dynamodb）が使用される
  }

  # ストリーム設定（将来の拡張用）
  stream_enabled   = var.enable_streams
  stream_view_type = var.enable_streams ? "NEW_AND_OLD_IMAGES" : null

  tags = {
    Name = "${var.project_name}-${var.environment}-records"
  }
}
