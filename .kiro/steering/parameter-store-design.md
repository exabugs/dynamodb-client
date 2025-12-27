# Parameter Store設計ガイドライン

## 基本原則

**Parameter Storeは一方向のデータフローを維持すること**

## 重要な役割分担（絶対に間違えてはいけない）

### データフローの方向性

```
dynamodb-client (書き込み) → Parameter Store → example (読み取り)
```

### dynamodb-client の役割

- ✅ **Parameter Storeに値を書き込む側**
- ✅ Terraformパラメータとして外部から値を受け取る
- ✅ 受け取った値をParameter Storeに書き込む
- ❌ **Parameter Storeから値を読み取ってはいけない**（循環参照になる）

### example の役割

- ✅ **Parameter Storeから値を読み取る側**
- ✅ Terraformパラメータを最小限にする
- ✅ Parameter Storeから直接値を参照する
- ❌ **dynamodb-clientに値を渡してはいけない**（逆方向の依存関係）

## 禁止事項

### ❌ 絶対に避けるべき実装

```hcl
# dynamodb-client側で以下は禁止
data "aws_ssm_parameter" "any_parameter" {
  name = "/${var.project_name}/${var.environment}/..."
}

resource "aws_lambda_function" "records" {
  environment {
    variables = {
      ANY_VAR = data.aws_ssm_parameter.any_parameter.value  # ❌ 循環参照
    }
  }
}
```

### ❌ 間違った修正パターン

- dynamodb-clientにdata sourceを追加する
- dynamodb-clientでParameter Storeから値を読み取る
- 「Parameter Store対応」と称してdynamodb-client側を修正する

## 正しい実装パターン

### ✅ dynamodb-client側（書き込み）

```hcl
# 外部パラメータを受け取る
resource "aws_lambda_function" "records" {
  environment {
    variables = {
      TABLE_NAME = var.dynamodb_table_name  # ✅ 外部パラメータ
    }
  }
}

# Parameter Storeに書き込む
module "parameter_store" {
  dynamodb_table_name = var.dynamodb_table_name  # ✅ 書き込み
}
```

### ✅ example側（読み取り）

```hcl
# Parameter Storeから読み取る
data "aws_ssm_parameter" "records_api_url" {
  name = "/${var.project_name}/${var.environment}/app/records-api-url"
}

# Makefileでも読み取り
aws ssm get-parameter --name '/project/env/app/records-api-url'
```

## チェックリスト

Parameter Store関連の修正を行う際は、以下を確認すること：

- [ ] dynamodb-clientでdata sourceを追加していないか
- [ ] dynamodb-clientでParameter Storeから読み取っていないか
- [ ] データフローが一方向になっているか
- [ ] 循環参照が発生していないか
- [ ] 正しい側（example）を修正しているか

## 違反時の対応

間違った実装を発見した場合：

1. **即座に修正を停止する**
2. **正しい設計を再確認する**
3. **適切な側（example）を修正する**
4. **このガイドラインを再読する**

## 参考ドキュメント

- [Parameter Store移行設計書](../specs/dynamodb-client/parameter-store-migration-design.md)
- dynamodb-client README.md
- dynamodb-client-example QUICKSTART.md