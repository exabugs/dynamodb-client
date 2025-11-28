# Maintenance Worker Lambda

DynamoDBレコードを走査してシャドー整合性を検証・修復するワーカー Lambda 関数です。

## 概要

Maintenance Worker Lambda は、shadow.config 更新後の既存レコードのシャドー整合性を修復するメンテナンスシステムのワーカーです。Step Functions から並列実行され、各セグメントのレコードを走査して設定ドリフトを検出し、必要に応じてシャドーレコードを修復します。

## 主な機能

- **DynamoDB Scan**: 指定されたセグメントのレコードを走査
- **設定ドリフト検出**: `__configHash` と現在の設定ハッシュを比較
- **シャドーレコード修復**: TransactWriteItems で古い影を削除し新しい影を作成
- **ドライランモード**: 実際の修復を行わず、修復が必要なレコードを検出するだけ
- **統計情報出力**: scanned、drifted、repaired、failed、noop を CloudWatch Logs に出力

## 環境変数

| 変数名          | 説明                             | 例                                     |
| --------------- | -------------------------------- | -------------------------------------- |
| `ENV`           | 環境識別子                       | `dev`, `stg`, `prd`                    |
| `REGION`        | AWS リージョン                   | `us-east-1`                            |
| `TABLE_NAME`    | DynamoDB テーブル名              | `ainews-dev-records`                   |
| `SHADOW_CONFIG` | シャドー設定（base64エンコード） | `eyJzY2hlbWFWZXJzaW9uIjoiMS4wIiwuLi59` |

## 入力パラメータ

```json
{
  "resource": "articles",
  "segment": 0,
  "totalSegments": 8,
  "dryRun": true,
  "pageLimit": 100,
  "runId": "articles-1732627200000-abc123"
}
```

- `resource` (必須): 修復対象のリソース名
- `segment` (必須): このワーカーが処理するセグメント番号（0-based）
- `totalSegments` (必須): 並列実行するセグメント数
- `dryRun` (必須): ドライランモード（true: 検出のみ、false: 修復実行）
- `pageLimit` (必須): 各セグメントの最大ページ数
- `runId` (必須): 実行ID（ログ追跡用）

## レスポンス

```json
{
  "segment": 0,
  "scanned": 1250,
  "drifted": 45,
  "repaired": 43,
  "failed": 2,
  "noop": 1205,
  "errors": [
    {
      "id": "01JDQR8X9Y0Z1A2B3C4D5E6F7G",
      "code": "TRANSACTION_FAILED",
      "message": "TransactionCanceledException: ..."
    }
  ]
}
```

- `segment`: 処理したセグメント番号
- `scanned`: 走査したレコード数
- `drifted`: 設定ドリフトを検出したレコード数
- `repaired`: 修復に成功したレコード数
- `failed`: 修復に失敗したレコード数
- `noop`: 修復不要だったレコード数
- `errors`: 修復失敗したレコードのエラー情報

## 設定ドリフト検出ロジック

以下のいずれかに該当する場合、設定ドリフトと判定します：

1. `__configHash` が存在しない（既存レコード）
2. `__configHash` が現在の設定ハッシュと一致しない
3. `__shadowKeys` が期待値と一致しない

## シャドーレコード修復ロジック

1. **古いシャドーレコードを削除**: `actualShadowKeys` に含まれるが `expectedShadowKeys` に含まれないシャドーレコードを削除
2. **新しいシャドーレコードを作成**: `expectedShadowKeys` に含まれるが `actualShadowKeys` に含まれないシャドーレコードを作成
3. **本体レコードを更新**: `__shadowKeys`、`__configVersion`、`__configHash` を更新

すべての操作は TransactWriteItems で実行され、アトミック性が保証されます。

## エラーコード

- `TRANSACTION_FAILED`: TransactWriteItems が失敗（条件チェックエラー、スロットリング等）
- `VALIDATION_ERROR`: バリデーションエラー（不正なデータ形式等）

## 使用例

### AWS CLI（直接実行）

```bash
# ドライランモードで実行
aws lambda invoke \
  --function-name ainews-dev-maintenance-worker \
  --payload '{"resource":"articles","segment":0,"totalSegments":8,"dryRun":true,"pageLimit":100,"runId":"test-123"}' \
  response.json

cat response.json | jq .
```

### Step Functions経由（推奨）

通常は Maintenance Coordinator Lambda 経由で Step Functions から実行されます。

```bash
# Coordinator Lambda を実行
aws lambda invoke \
  --function-name ainews-dev-maintenance-coordinator \
  --payload '{"resource":"articles","segments":8,"dryRun":true}' \
  response.json
```

## ビルド

```bash
pnpm build
```

## テスト

```bash
pnpm test
```

## デプロイ

Terraform で自動的にデプロイされます。

```bash
cd ../../../infra
make apply ENV=dev
```

## パフォーマンス考慮事項

- **並列実行**: セグメント数を増やすことで並列度を向上（推奨: 8-16セグメント）
- **ページ制限**: `pageLimit` で各セグメントの最大ページ数を制限（デフォルト: 100）
- **Lambda タイムアウト**: 大量のレコードを処理する場合、Lambda タイムアウトを延長（推奨: 15分）
- **DynamoDB スロットリング**: 大量の修復を実行する場合、DynamoDB のキャパシティを考慮

## 関連ドキュメント

- [要件定義書](../../../.kiro/specs/ainews-pipeline/requirements.md) - 要件11
- [設計書](../../../.kiro/specs/ainews-pipeline/design.md)
- [Maintenance Coordinator Lambda](../coordinator/README.md)
