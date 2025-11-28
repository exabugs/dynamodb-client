# DynamoDB Single-Table モジュール

このモジュールは、AIニュースパイプラインのためのDynamoDB Single-Table設計を実装します。

## 機能

- **Single-Table設計**: PK（リソース名）とSK（レコードIDまたはシャドーキー）による柔軟なデータモデル
- **TTL設定**: 自動データ削除のためのTTL属性サポート
- **PITR**: 環境変数で制御可能なPoint-in-Time Recovery
- **暗号化**: AWS管理キー（alias/aws/dynamodb）による保存データの暗号化
- **DynamoDB Streams**: オプションで有効化可能（将来の拡張用）

## テーブル構造

| 属性 | 型     | 説明                                           |
| ---- | ------ | ---------------------------------------------- |
| PK   | String | パーティションキー（リソース名: articles, tasks等） |
| SK   | String | ソートキー（id#<ULID> または シャドーキー）      |
| data | Map    | 実データ + __shadowKeys メタデータ              |
| ttl  | Number | TTL（オプション、Unix timestamp）              |

## 使用例

```hcl
module "dynamodb" {
  source = "./modules/core/dynamodb"

  project_name = var.project_name
  environment  = var.environment
  enable_pitr  = var.enable_pitr
  enable_streams = false
}
```

## 入力変数

| 変数名         | 型     | デフォルト | 説明                            |
| -------------- | ------ | ---------- | ------------------------------- |
| project_name   | string | -          | プロジェクト名                  |
| environment    | string | -          | 環境識別子（dev, stg, prd）     |
| enable_pitr    | bool   | false      | Point-in-Time Recoveryを有効化  |
| enable_streams | bool   | false      | DynamoDB Streamsを有効化        |

## 出力

| 出力名           | 説明                               |
| ---------------- | ---------------------------------- |
| table_name       | DynamoDBテーブル名                 |
| table_arn        | DynamoDBテーブルARN                |
| table_id         | DynamoDBテーブルID                 |
| table_stream_arn | DynamoDB StreamのARN（有効な場合） |

## 環境別設定

### Dev環境
- PITR: 無効（コスト削減）
- Streams: 無効

### Staging環境
- PITR: 有効（データ保護）
- Streams: 無効

### Production環境
- PITR: 有効（データ保護）
- Streams: 必要に応じて有効化

## セキュリティ

- すべてのデータはAWS管理キー（alias/aws/dynamodb）で暗号化
- 最小権限の原則に基づくIAMポリシー推奨

## コスト最適化

- PAY_PER_REQUEST課金モード（未使用時は課金なし）
- TTLによる自動データ削除
- Dev環境ではPITR無効化
