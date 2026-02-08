# DynamoDB Client MCP Server - 要件定義

## 1. 概要

dynamodb-clientライブラリをMCP（Model Context Protocol）サーバーとして提供し、AI AgentがDynamoDBに直接アクセスできるようにする。

## 2. 目的

- AI Agentからの自然言語によるデータ操作を可能にする
- 既存のLambda実装を再利用し、開発コストを最小化する
- npmパッケージとして配布し、既存の配布方式と一貫性を保つ

## 3. ユーザーストーリー

### 3.1 開発者として

- npmパッケージをインストールするだけでMCPサーバーを利用できる
- 環境変数でDynamoDBテーブルとAWS認証情報を設定できる
- mcp.jsonで簡単に設定できる

### 3.2 AI Agentとして

- 自然言語でDynamoDBのデータを検索できる
- レコードの作成・更新・削除ができる
- 地理空間検索（$near）を実行できる

## 4. 機能要件

### 4.1 MCPツール（10個）

既存のLambda操作をMCPツールとして公開：

1. **dynamodb_find**: レコード検索（フィルター、ソート、ページネーション）
2. **dynamodb_find_one**: 単一レコード取得
3. **dynamodb_find_many**: 複数ID指定でレコード取得
4. **dynamodb_find_many_reference**: 外部キー指定でレコード取得
5. **dynamodb_insert_one**: 単一レコード挿入
6. **dynamodb_insert_many**: 複数レコード一括挿入
7. **dynamodb_update_one**: 単一レコード更新
8. **dynamodb_update_many**: 複数レコード一括更新
9. **dynamodb_delete_one**: 単一レコード削除
10. **dynamodb_delete_many**: 複数レコード一括削除

### 4.2 認証

- AWS認証情報を環境変数から取得
- IAM Role、Access Key/Secret Key、プロファイルをサポート

### 4.3 接続方式

- stdio（標準入出力）: ローカルツール向け（優先）
- HTTP/SSE: リモートアクセス向け（将来対応）

### 4.4 設定

環境変数で設定：
- `DYNAMODB_TABLE`: DynamoDBテーブル名（必須）
- `AWS_REGION`: AWSリージョン（デフォルト: us-east-1）
- `AWS_PROFILE`: AWSプロファイル（オプション）
- `AWS_ACCESS_KEY_ID`: アクセスキー（オプション）
- `AWS_SECRET_ACCESS_KEY`: シークレットキー（オプション）

## 5. 非機能要件

### 5.1 パフォーマンス

- レスポンス時間: 1秒以内（DynamoDB操作を除く）
- 常駐プロセスとして動作（コールドスタートなし）

### 5.2 互換性

- Node.js 18.x以上
- MCP Protocol 2024-11-05準拠

### 5.3 保守性

- 既存のLambda実装を最大限再利用
- テストコードも再利用可能

## 6. 制約

### 6.1 技術的制約

- Lambda版とMCP版で同じビジネスロジックを使用
- npmパッケージとして配布（既存の配布方式と一貫性）

### 6.2 セキュリティ制約

- AWS認証情報は環境変数またはIAM Roleから取得
- 認証情報をログに出力しない

## 7. 配布方式

### 7.1 npmパッケージ

```json
{
  "name": "@exabugs/dynamodb-client",
  "version": "1.4.0",
  "bin": {
    "dynamodb-mcp": "./dist/mcp/cli.js"
  },
  "exports": {
    "./server": "./dist/server/index.js",
    "./mcp": "./dist/mcp/index.js"
  }
}
```

### 7.2 利用方法

```bash
# インストール
npm install @exabugs/dynamodb-client

# 実行
npx @exabugs/dynamodb-client mcp --table asanowa-dev-records
```

### 7.3 mcp.json設定例

```json
{
  "mcpServers": {
    "dynamodb": {
      "command": "npx",
      "args": ["@exabugs/dynamodb-client", "mcp"],
      "env": {
        "DYNAMODB_TABLE": "asanowa-dev-records",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

## 8. 受け入れ基準

### 8.1 機能

- [ ] 10個のMCPツールがすべて動作する
- [ ] 既存のLambda実装と同じ結果を返す
- [ ] 環境変数で設定できる
- [ ] mcp.jsonで設定できる

### 8.2 品質

- [ ] 既存のテストがすべてパスする
- [ ] MCPツールの統合テストが追加される
- [ ] ドキュメントが整備される

### 8.3 配布

- [ ] npmパッケージとして公開できる
- [ ] `npx`コマンドで実行できる
- [ ] MCP Protocol Inspectorで動作確認できる

## 9. 優先順位

### P0（必須）

- dynamodb_find, dynamodb_find_one, dynamodb_insert_one
- stdio接続方式
- 環境変数設定

### P1（重要）

- 残り7個のMCPツール
- mcp.json設定例
- ドキュメント

### P2（将来対応）

- HTTP/SSE接続方式
- MCPリソース機能
- MCPプロンプト機能

## 10. リスク

### 10.1 技術的リスク

- MCP Protocol仕様の変更
- AWS SDK互換性問題

### 10.2 対策

- MCP Protocol仕様を定期的に確認
- AWS SDKバージョンを固定
