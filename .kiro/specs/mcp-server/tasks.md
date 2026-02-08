# DynamoDB Client MCP Server - タスクリスト

## 1. 環境準備

- [x] 1.1 MCP SDK依存関係を追加
- [x] 1.2 tsconfig.mcp.jsonを作成
- [x] 1.3 package.jsonにbinとexportsを追加

## 2. MCPサーバー基盤実装

- [x] 2.1 MCPサーバークラスを実装（src/mcp/server.ts）
- [x] 2.2 CLIエントリポイントを実装（src/mcp/cli.ts）
- [x] 2.3 実行可能スクリプトを作成（bin/dynamodb-mcp.js）
- [x] 2.4 環境変数設定を実装

## 3. Adapter Layer実装

- [ ] 3.1 MCPAdapterクラスを実装（src/mcp/adapter.ts）
- [ ] 3.2 Lambda操作呼び出しロジックを実装
- [ ] 3.3 エラーハンドリングを実装
- [ ] 3.4 リクエストID生成を実装

## 4. MCPツール実装（P0: 必須）

- [ ] 4.1 dynamodb_findツールを実装
  - [ ] 4.1.1 ツール定義（src/mcp/tools/find.ts）
  - [ ] 4.1.2 inputSchemaを定義
  - [ ] 4.1.3 handleFindとの統合
  - [ ] 4.1.4 ユニットテスト
  - [ ] 4.1.5 統合テスト

- [ ] 4.2 dynamodb_find_oneツールを実装
  - [ ] 4.2.1 ツール定義（src/mcp/tools/findOne.ts）
  - [ ] 4.2.2 inputSchemaを定義
  - [ ] 4.2.3 handleFindOneとの統合
  - [ ] 4.2.4 ユニットテスト
  - [ ] 4.2.5 統合テスト

- [ ] 4.3 dynamodb_insert_oneツールを実装
  - [ ] 4.3.1 ツール定義（src/mcp/tools/insertOne.ts）
  - [ ] 4.3.2 inputSchemaを定義
  - [ ] 4.3.3 handleInsertOneとの統合
  - [ ] 4.3.4 ユニットテスト
  - [ ] 4.3.5 統合テスト

## 5. MCPツール実装（P1: 重要）

- [ ] 5.1 dynamodb_find_manyツールを実装
- [ ] 5.2 dynamodb_find_many_referenceツールを実装
- [ ] 5.3 dynamodb_insert_manyツールを実装
- [ ] 5.4 dynamodb_update_oneツールを実装
- [ ] 5.5 dynamodb_update_manyツールを実装
- [ ] 5.6 dynamodb_delete_oneツールを実装
- [ ] 5.7 dynamodb_delete_manyツールを実装

## 6. テスト

- [ ] 6.1 MCPサーバーユニットテスト
- [ ] 6.2 Adapterユニットテスト
- [ ] 6.3 各ツールのユニットテスト
- [ ] 6.4 統合テスト（全ツール）
- [ ] 6.5 MCP Protocol Inspectorでの動作確認

## 7. ドキュメント

- [ ] 7.1 README.mdにMCPサーバーセクションを追加
- [ ] 7.2 mcp.json設定例を追加
- [ ] 7.3 使用例を追加
- [ ] 7.4 トラブルシューティングガイドを追加

## 8. ビルド・配布

- [ ] 8.1 ビルドスクリプトを追加
- [ ] 8.2 package.jsonを更新（bin, exports）
- [ ] 8.3 npmパブリッシュ前の確認
- [ ] 8.4 バージョン1.4.0でパブリッシュ

## 9. 動作確認

- [ ] 9.1 ローカルでnpx実行確認
- [ ] 9.2 mcp.jsonで設定確認
- [ ] 9.3 AI Agentからの呼び出し確認
- [ ] 9.4 全ツールの動作確認

## 10. 将来拡張（P2）

- [ ]* 10.1 MCPリソース機能を実装
- [ ]* 10.2 MCPプロンプト機能を実装
- [ ]* 10.3 HTTP/SSE接続方式を実装

## タスク詳細

### 1.1 MCP SDK依存関係を追加

```bash
cd dynamodb-client
npm install @modelcontextprotocol/sdk
```

### 2.1 MCPサーバークラスを実装

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export class DynamoDBMCPServer {
  private server: Server;
  private adapter: MCPAdapter;

  constructor(config: MCPServerConfig) {
    this.server = new Server(
      {
        name: 'dynamodb-client',
        version: '1.4.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.adapter = new MCPAdapter(config);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: getAllTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return this.adapter.executeTool(name, args ?? {});
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### 4.1.1 dynamodb_findツール定義

```typescript
// src/mcp/tools/find.ts
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const findTool: Tool = {
  name: 'dynamodb_find',
  description: 'DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。',
  inputSchema: {
    type: 'object',
    properties: {
      collection: {
        type: 'string',
        description: 'コレクション名（例: venues, users）',
      },
      filter: {
        type: 'object',
        description: 'フィルター条件（MongoDB形式）',
      },
      sort: {
        type: 'object',
        description: 'ソート条件',
        properties: {
          field: { type: 'string' },
          order: { type: 'string', enum: ['ASC', 'DESC'] },
        },
      },
      pagination: {
        type: 'object',
        description: 'ページネーション設定',
        properties: {
          perPage: { type: 'number' },
          nextToken: { type: 'string' },
        },
      },
    },
    required: ['collection'],
  },
};
```

## 完了条件

- [ ] すべてのP0タスクが完了
- [ ] すべてのP1タスクが完了
- [ ] テストがすべてパス（`npm test`）
- [ ] Lintがエラーなし（`npm run lint`）
- [ ] ビルドが成功（`npm run build`）
- [ ] MCP Protocol Inspectorで動作確認
- [ ] ドキュメントが整備されている
- [ ] npmパッケージとして公開されている
