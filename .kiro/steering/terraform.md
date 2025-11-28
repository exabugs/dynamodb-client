---
inclusion: always
---

# Terraform操作ガイドライン

## 基本原則

**重要**: Terraformの操作は、必ず`infra/Makefile`を使用してください。直接`terraform`コマンドを実行しないでください。

Kiro AI は Terraform 操作時に必ず以下のコマンドを使用すること：
- `make plan [ENV=<dev|stg|prd>]` - プランの確認
- `make apply [ENV=<dev|stg|prd>]` - 変更の適用（対話的）
- `make apply-auto [ENV=<dev|stg|prd>]` - 変更の適用（自動承認）
- `make status` - 現在の状態確認

直接 `terraform` コマンドを実行することは禁止されています。

## 理由

1. **環境変数ファイルの適用**: `make`を使用することで、`envs/dev.tfvars`などの環境固有の変数ファイルが自動的に適用されます
2. **ワークスペースの自動切り替え**: 環境に応じたワークスペースが自動的に選択されます
3. **一貫性**: チーム全体で同じ手順を使用できます

## 使用方法

### プランの確認

```bash
cd infra
make plan           # dev環境（デフォルト）
make plan ENV=stg   # stg環境
make plan ENV=prd   # prd環境
```

### 変更の適用

```bash
cd infra
make apply           # dev環境（対話的に確認）
make apply-auto      # dev環境（自動承認）
make apply ENV=stg   # stg環境
```

### 現在の状態確認

```bash
cd infra
make status
```

### ワークスペースの切り替え

```bash
cd infra
make switch ENV=stg
```

## 禁止事項

以下のコマンドは使用しないでください：

```bash
# ❌ 直接terraformコマンドを実行
terraform plan
terraform apply
terraform apply -auto-approve

# ❌ AWS CLIで直接リソースを変更
aws lambda update-function-code ...
aws cognito-idp update-user-pool-client ...
```

## 例外

以下の場合のみ、直接`terraform`コマンドを使用できます：

1. **デバッグ目的**: `terraform state list`, `terraform show`など、読み取り専用のコマンド
2. **初期化**: `terraform init`（初回のみ）
3. **緊急時**: Makefileが壊れている場合の復旧作業

## 設定ファイルの環境変数設定

### 原則

設定ファイル（JSON、YAML等）を Lambda 環境変数として設定する場合の原則：

1. **Base64エンコード**:
   - 改行や特殊文字を含む設定ファイルは base64 エンコードする
   - 例: `SHADOW_CONFIG = base64encode(file("${path.root}/../config/shadow.config.json"))`

2. **自動再デプロイ**:
   - 設定ファイルの変更を検知して Lambda を自動再デプロイ
   - `source_code_hash` または `environment.variables` の変更で検知
   - 例: `source_code_hash = filebase64sha256("${path.root}/../config/shadow.config.json")`

3. **複数 Lambda への配布**:
   - 同じ設定を複数の Lambda 関数で共有する場合、locals で定義
   - 例:
     ```hcl
     locals {
       shadow_config = base64encode(file("${path.root}/../config/shadow.config.json"))
     }
     
     resource "aws_lambda_function" "records" {
       environment {
         variables = {
           SHADOW_CONFIG = local.shadow_config
         }
       }
     }
     
     resource "aws_lambda_function" "maintenance_worker" {
       environment {
         variables = {
           SHADOW_CONFIG = local.shadow_config
         }
       }
     }
     ```

4. **環境ごとの設定**:
   - 環境（dev/stg/prd）ごとに異なる設定ファイルを使用する場合
   - ワークスペース名を使用してパスを切り替える
   - 例: `file("${path.root}/../config/shadow.config.${terraform.workspace}.json")`

## トラブルシューティング

### 差分が残っている場合

```bash
cd infra
make plan  # 差分を確認
make apply-auto  # 自動承認で適用
```

### ワークスペースが不明な場合

```bash
cd infra
make status  # 現在のワークスペースを確認
```

### 設定ファイル変更が反映されない場合

```bash
cd infra
make plan  # Lambda の environment.variables に差分があるか確認
make apply-auto  # 差分があれば適用
```

設定ファイルの変更が検知されない場合は、`source_code_hash` に設定ファイルのハッシュを含めているか確認してください。

### リソースを強制的に再作成する場合

```bash
cd infra
terraform taint module.lambda_records.aws_lambda_function.records
make apply-auto
```

ただし、`terraform taint`は慎重に使用してください。リソースの再作成により、設定が失われる可能性があります。
