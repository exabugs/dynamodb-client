# DynamoDB Client MCP Server - 設計書

## 1. アーキテクチャ

### 1.1 全体構成

```
┌─────────────────────────────────────────┐
│ AI Agent (Claude, GPT, etc.)           │
└─────────────────┬───────────────────────┘
                  │ MCP Protocol
                  │ (stdio)
┌─────────────────▼───────────────────────┐
│ MCP Server                              │
│ (@exabugs/dynamodb-client mcp)         │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ MCP Tools (10個)                 │  │
│  │ - dynamodb_find                  │  │
│  │ - dynamodb_insert_one            │  │
│  │ - ...                            │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────▼───────────────────┐  │
│  │ Adapter Layer                    │  │
│  │ (MCP → Lambda操作変換)           │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────▼───────────────────┐  │
│  │ Existing Lambda Operations       │  │
│  │ (既存のビジネスロジック再利用)   │  │
│  └──────────────┬───────────────────┘  │
└─────────────────┼───────────────────────┘
                  │ AWS SDK
┌─────────────────▼───────────────────────┐
│ DynamoDB                                │
└─────────────────────────────────────────┘
```

### 1.2 ディレクトリ構造

```
dynamodb-client/
├── src/
│   ├── server/              # 既存Lambda実装
│   │   ├── handler.ts
│   │   ├── operations/
│   │   └── types.ts
│   └── mcp/                 # 新規MCPサーバー実装
│       ├── index.ts         # MCPサーバーエントリポイント
│       ├── cli.ts           # CLIエントリポイント
│       ├── server.ts        # MCPサーバー本体
│       ├── tools/           # MCPツール定義
│       │   ├── index.ts
│       │   ├── find.ts
│       │   ├── insertOne.ts
│       │   └── ...
│       ├── adapter.ts       # Lambda操作 → MCPツール変換
│       └── types.ts         # MCP固有型定義
├── bin/
│   └── dynamodb-mcp.js      # 実行可能スクリプト
└── __tests__/
    └── mcp/                 # MCPサーバーテスト
        ├── tools/
        └── integration/
```

## 2. MCPツール設計

### 2.1 ツール定義

各Lambda操作をMCPツールとして公開：

```typescript
// src/mcp/tools/find.ts
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

### 2.2 ツール一覧

| ツール名 | 説明 | 対応Lambda操作 |
|---------|------|---------------|
| dynamodb_find | レコード検索 | handleFind |
| dynamodb_find_one | 単一レコード取得 | handleFindOne |
| dynamodb_find_many | 複数ID指定取得 | handleFindMany |
| dynamodb_find_many_reference | 外部キー指定取得 | handleFindManyReference |
| dynamodb_insert_one | 単一レコード挿入 | handleInsertOne |
| dynamodb_insert_many | 複数レコード一括挿入 | handleInsertMany |
| dynamodb_update_one | 単一レコード更新 | handleUpdateOne |
| dynamodb_update_many | 複数レコード一括更新 | handleUpdateMany |
| dynamodb_delete_one | 単一レコード削除 | handleDeleteOne |
| dynamodb_delete_many | 複数レコード一括削除 | handleDeleteMany |

## 3. Adapter Layer設計

### 3.1 役割

MCPツール呼び出しを既存のLambda操作に変換：

```typescript
// src/mcp/adapter.ts
export class MCPAdapter {
  /**
   * MCPツール呼び出しをLambda操作に変換
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const requestId = generateRequestId();
    
    switch (toolName) {
      case 'dynamodb_find':
        return this.handleFind(args, requestId);
      case 'dynamodb_insert_one':
        return this.handleInsertOne(args, requestId);
      // ... 他のツール
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleFind(
    args: Record<string, unknown>,
    requestId: string
  ): Promise<unknown> {
    const { collection, filter, sort, pagination } = args;
    
    // 既存のhandleFindを呼び出し
    const result = await handleFind(
      collection as string,
      {
        filter: filter as Filter,
        sort: sort as Sort,
        pagination: pagination as Pagination,
      },
      requestId
    );
    
    return result;
  }
}
```

### 3.2 エラーハンドリング

```typescript
try {
  const result = await adapter.executeTool(toolName, args);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
} catch (error) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error.message}`,
      },
    ],
    isError: true,
  };
}
```

## 4. MCPサーバー実装

### 4.1 サーバー初期化

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

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
    // ツール一覧を返す
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: getAllTools(),
    }));

    // ツールを実行
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

### 4.2 CLI実装

```typescript
// src/mcp/cli.ts
import { DynamoDBMCPServer } from './server.js';

async function main() {
  const config = {
    tableName: process.env.DYNAMODB_TABLE,
    region: process.env.AWS_REGION || 'us-east-1',
  };

  if (!config.tableName) {
    console.error('Error: DYNAMODB_TABLE environment variable is required');
    process.exit(1);
  }

  const server = new DynamoDBMCPServer(config);
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

## 5. 設定管理

### 5.1 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| DYNAMODB_TABLE | ✅ | - | DynamoDBテーブル名 |
| AWS_REGION | ❌ | us-east-1 | AWSリージョン |
| AWS_PROFILE | ❌ | - | AWSプロファイル |
| AWS_ACCESS_KEY_ID | ❌ | - | アクセスキー |
| AWS_SECRET_ACCESS_KEY | ❌ | - | シークレットキー |

### 5.2 mcp.json設定例

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

## 6. パッケージ設定

### 6.1 package.json

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
  },
  "scripts": {
    "build": "tsc",
    "build:mcp": "tsc --project tsconfig.mcp.json",
    "test:mcp": "vitest run __tests__/mcp"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "@aws-sdk/client-dynamodb": "^3.x",
    "@aws-sdk/lib-dynamodb": "^3.x"
  }
}
```

### 6.2 tsconfig.mcp.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/mcp",
    "rootDir": "./src/mcp"
  },
  "include": ["src/mcp/**/*"]
}
```

## 7. テスト戦略

### 7.1 ユニットテスト

```typescript
// __tests__/mcp/tools/find.test.ts
describe('dynamodb_find tool', () => {
  it('正しいinputSchemaを持つ', () => {
    expect(findTool.name).toBe('dynamodb_find');
    expect(findTool.inputSchema.required).toContain('collection');
  });
});
```

### 7.2 統合テスト

```typescript
// __tests__/mcp/integration/server.test.ts
describe('MCP Server Integration', () => {
  it('dynamodb_findツールを実行できる', async () => {
    const adapter = new MCPAdapter(config);
    const result = await adapter.executeTool('dynamodb_find', {
      collection: 'venues',
      filter: { status: 'active' },
    });
    
    expect(result.items).toBeDefined();
  });
});
```

## 8. デプロイ・配布

### 8.1 ビルド

```bash
# 全体ビルド
npm run build

# MCP部分のみビルド
npm run build:mcp
```

### 8.2 npmパブリッシュ

```bash
# バージョン更新
npm version minor  # 1.3.x → 1.4.0

# パブリッシュ
npm publish
```

### 8.3 利用方法

```bash
# インストール
npm install @exabugs/dynamodb-client

# 実行
npx @exabugs/dynamodb-client mcp
```

## 9. パフォーマンス

### 9.1 目標

- 起動時間: 1秒以内
- ツール実行時間: 1秒以内（DynamoDB操作を除く）
- メモリ使用量: 100MB以内

### 9.2 最適化

- 既存のLambda実装を再利用（追加オーバーヘッド最小化）
- 常駐プロセスとして動作（コールドスタートなし）

## 10. セキュリティ

### 10.1 認証情報管理

- 環境変数から取得
- ログに出力しない
- IAM Roleを優先的に使用

### 10.2 入力検証

- MCPツールの引数を検証
- 既存のLambda実装の検証ロジックを再利用

## 11. 将来拡張

### 11.1 MCPリソース機能

```typescript
// テーブル一覧をリソースとして公開
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'dynamodb://venues',
      name: 'Venues Collection',
      mimeType: 'application/json',
    },
  ],
}));
```

### 11.2 MCPプロンプト機能

```typescript
// クエリテンプレートをプロンプトとして公開
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'find_active_venues',
      description: 'アクティブな開催地を検索',
      arguments: [
        {
          name: 'limit',
          description: '取得件数',
          required: false,
        },
      ],
    },
  ],
}));
```

### 11.3 HTTP/SSE接続方式

```typescript
// リモートアクセス向け
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const transport = new SSEServerTransport('/mcp', response);
await server.connect(transport);
```
