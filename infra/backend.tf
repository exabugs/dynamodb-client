# Terraform Backend設定
# S3バックエンドを使用してTerraform状態を管理

terraform {
  backend "s3" {
    # S3バケット名（事前に作成が必要）
    bucket = "ainews-tfstate-us"

    # 状態ファイルのキー（環境ごとに分離）
    key = "terraform.tfstate"

    # ワークスペースごとのキープレフィックス
    # 例: dev環境 -> env:/dev/terraform.tfstate
    #     stg環境 -> env:/stg/terraform.tfstate
    #     prd環境 -> env:/prd/terraform.tfstate
    workspace_key_prefix = "env:"

    # AWSリージョン
    region = "us-east-1"

    # 状態ファイルの暗号化を有効化
    encrypt = true

    # DynamoDBテーブル名（状態ロック用、オプション）
    # 複数人での同時実行や CI/CD を使用する場合のみ必要
    # 個人開発の場合はコメントアウト可能
    # dynamodb_table = "ainews-tfstate-lock"
  }
}
