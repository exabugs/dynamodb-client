# Maintenance Coordinator Lambda

シャドー整合性メンテナンスを開始するオーケストレーター Lambda 関数です。

## 概要

Maintenance Coordinator Lambda は、shadow.config 更新後の既存レコードのシャドー整合性を修復するメンテナンスシステムの起点となる Lambda 関数です。指定されたリソースとセグメント数で Step Functions 実行を開始し、Maintenance Worker Lambda を並列実行します。

## 主な機能

- **入力検証**: resource、segments、dryRun、pageLimit パラメータの検証
- **リソース名検証**: ALLOW_RESOURCES 環境変数で許可されたリソース名のみを受け入れ
- **Step Functions 実行**: 指定されたパラメータで Step Functions を開始
- **実行 ARN 返却**: Step Functions 実行 ARN をレスポンスとして返却

## 環境変数

| 変数名              | 説明                                 | 例                                                                          |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `ENV`               | 環境識別子                           | `dev`, `stg`, `prd`                                                         |
| `REGION`            | AWS リージョン                       | `us-east-1`                                                                 |
| `STATE_MACHINE_ARN` | Step Functions ステートマシン ARN    | `arn:aws:states:us-east-1:123456789012:stateMachine:ainews-dev-maintenance` |
| `ALLOW_RESOURCES`   | 許可されたリソース名（カンマ区切り） | `articles,tasks,fetchLogs`                                                  |

## 入力パラメータ

```json
{
  "resource": "articles",
  "segments": 8,
  "dryRun": true,
  "pageLimit": 100
}
```

- `resource` (必須): 修復対象のリソース名
- `segments` (オプション): 並列実行するセグメント数（デフォルト: 8）
- `dryRun` (オプション): ドライランモード（デフォルト: true）
- `pageLimit` (オプション): 各セグメントの最大ページ数（デフォルト: 100）

## レスポンス

```json
{
  "executionArn": "arn:aws:states:us-east-1:123456789012:execution:ainews-dev-maintenance:abc123",
  "startDate": "2025-11-26T12:00:00.000Z"
}
```

## エラーコード

- `INVALID_INPUT`: 入力パラメータが不正
- `RESOURCE_NOT_ALLOWED`: 許可されていないリソース名
- `SFN_ERROR`: Step Functions 実行開始エラー

## 使用例

### AWS CLI

```bash
# ドライランモードで実行（実際の修復は行わない）
aws lambda invoke \
  --function-name ainews-dev-maintenance-coordinator \
  --payload '{"resource":"articles","segments":8,"dryRun":true}' \
  response.json

# 修復モードで実行（実際にシャドーレコードを修復）
aws lambda invoke \
  --function-name ainews-dev-maintenance-coordinator \
  --payload '{"resource":"articles","segments":8,"dryRun":false}' \
  response.json
```

### Node.js SDK

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const client = new LambdaClient({ region: 'us-east-1' });

const response = await client.send(
  new InvokeCommand({
    FunctionName: 'ainews-dev-maintenance-coordinator',
    Payload: JSON.stringify({
      resource: 'articles',
      segments: 8,
      dryRun: true,
    }),
  })
);

const result = JSON.parse(new TextDecoder().decode(response.Payload));
console.log('Execution ARN:', result.executionArn);
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

## 関連ドキュメント

- [要件定義書](../../../.kiro/specs/ainews-pipeline/requirements.md) - 要件11
- [設計書](../../../.kiro/specs/ainews-pipeline/design.md)
- [Maintenance Worker Lambda](../worker/README.md)
