# Terraform State管理ガイドライン

## 基本原則

**`terraform state rm`は慎重に使用し、必要な場合のみ実行すること**

## ルール

### 1. `terraform state rm`の使用制限

**原則**: `terraform state rm`は以下の場合のみ使用を許可する：

1. **手順書に明記されている場合**
   - `publish-and-deploy.md`などの手順書に明示的に記載されている場合のみ
   - 手順書の指示に従って実行する

2. **リソースの削除・再作成が必要な場合**
   - AWS側でリソースが削除されているが、Terraform stateに残っている場合
   - リソースの再作成が必要な場合（例: Lambda Function URLの403エラー）

3. **ユーザーの明示的な指示がある場合**
   - ユーザーが「state rmを実行してください」と明示的に指示した場合のみ

### 2. 禁止事項

以下の場合は**絶対に`terraform state rm`を実行してはならない**：

- ❌ エラーが発生したからといって、安易にstate rmを実行する
- ❌ 「No changes」と表示されたからといって、state rmを実行する
- ❌ 手順書に記載されていないのに、独自判断でstate rmを実行する
- ❌ 複数のリソースを一度にstate rmする（手順書に明記されている場合を除く）

### 3. 実行前の確認事項

`terraform state rm`を実行する前に、以下を確認すること：

- [ ] 手順書に明記されているか
- [ ] ユーザーの明示的な指示があるか
- [ ] 削除するリソースが正しいか
- [ ] 削除後の影響を理解しているか
- [ ] バックアップや復旧方法を確認したか

### 5. 安全な代替手段

`terraform state rm`の代わりに、以下の方法を検討すること：

1. **terraform refresh**
   ```bash
   terraform refresh -var-file=envs/dev.tfvars
   ```

2. **terraform plan**
   ```bash
   terraform plan -var-file=envs/dev.tfvars
   ```

3. **terraform taint**（リソースの再作成が必要な場合）
   ```bash
   terraform taint module.dynamodb_client_api.aws_lambda_function.records
   ```

4. **手順書の確認**
   - まず手順書を確認し、記載されている方法に従う

## 実践例

### ✅ 良い例

```bash
# 手順書に従って実行
# AWS側でリソースが削除されているが、stateに残っている場合

# 1. AWS Consoleで確認
# リソースが実際に削除されていることを確認

# 2. stateから削除
terraform state rm module.sns.aws_sns_topic.deleted_topic
```

### ❌ 悪い例

```bash
# エラーが発生したので、安易にstate rmを実行
terraform state rm module.sns.aws_sns_topic.general_notifications

# 複数のリソースを一度に削除
terraform state rm module.sns.aws_sns_topic.general_notifications \
  module.sns.aws_sns_topic.emergency_notifications \
  module.sns.aws_sns_topic.weather_notifications
```

## トラブルシューティング

### 問題1: Terraformが変更を検知しない

**症状**:
```
No changes. Your infrastructure matches the configuration.
```

**対応順序**:
1. **まず手順書を確認**: `publish-and-deploy.md`に記載されている手順に従う
2. **terraform refresh**: 状態を最新化
3. **terraform plan**: 変更を確認
4. **手順書に従ってstate rm**: 手順書に記載されている場合のみ

**禁止**: 安易に`terraform state rm`を実行しない

### 問題2: リソースが見つからない

**症状**:
```
Error: reading SNS Topic: operation error SNS: GetTopicAttributes
```

**対応順序**:
1. **AWS Consoleで確認**: リソースが実際に存在するか確認
2. **terraform refresh**: 状態を最新化
3. **手順書を確認**: 手順書に記載されている対応方法に従う
4. **ユーザーに確認**: 不明な場合はユーザーに確認

**禁止**: 独自判断で`terraform state rm`を実行しない

## チェックリスト

`terraform state rm`を実行する前に、以下を確認：

- [ ] 手順書に明記されているか
- [ ] ユーザーの明示的な指示があるか
- [ ] 削除するリソースが正しいか（モジュール名、リソース名）
- [ ] 削除後の影響を理解しているか
- [ ] 代替手段（refresh, plan, taint）を検討したか
- [ ] バックアップや復旧方法を確認したか

## 参考

- [publish-and-deploy.md](./publish-and-deploy.md) - パブリッシュ＆デプロイ手順
- [standard-procedures.md](./standard-procedures.md) - 標準手順の遵守
- [Terraform State Command](https://www.terraform.io/docs/cli/commands/state/index.html)

## 更新履歴

- 2026-01-02: 初版作成（`terraform state rm`の不用意な使用を防ぐため）
