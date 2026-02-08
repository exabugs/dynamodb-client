# DynamoDB Client MCP Server - タスクリスト

## 重要な方針変更

**OpenAPI仕様をSingle Source of Truthとして、MCPツールを自動生成する方式に変更しました。**

- OpenAPI仕様（`docs/specs/openapi.yaml`）がすべてのツール定義の元となります
- MCPツール定義は`make generate-mcp-tools`コマンドで自動生成されます
- **手動でツールファイルを編集しないでください**（自動生成時に上書きされます）
- ツールを追加・変更する場合は、OpenAPI仕様を編集してから`make generate-mcp-tools`を実行してください

## 1. 環境準備

- [x] 1.1 MCP SDK依存関係を追加
- [x] 1.2 tsconfig.mcp.jsonを作成
- [x] 1.3 package.jsonにbinとexportsを追加
- [x] 1.4 自動生成スクリプトを作成（scripts/generate-mcp-tools.ts）
- [x] 1.5 Makefileにgenerate-mcp-toolsターゲットを追加

## 2. MCPサーバー基盤実装

- [x] 2.1 MCPサーバークラスを実装（src/mcp/server.ts）
- [x] 2.2 CLIエントリポイントを実装（src/mcp/cli.ts）
- [x] 2.3 実行可能スクリプトを作成（bin/dynamodb-mcp.js）
- [x] 2.4 環境変数設定を実装

## 3. Adapter Layer実装

- [x] 3.1 MCPAdapterクラスを実装（src/mcp/adapter.ts）
- [x] 3.2 Lambda操作呼び出しロジックを実装
- [x] 3.3 エラーハンドリングを実装
- [x] 3.4 リクエストID生成を実装
- [x] 3.5 キャメルケース→スネークケース変換を実装

## 4. MCPツール実装（P0: 必須）

**注意**: ツール定義は`make generate-mcp-tools`で自動生成されます。テストのみ実装してください。

- [x] 4.1 dynamodb_findツールのテストを実装
  - [x] 4.1.1 ツール定義（自動生成済み: src/mcp/tools/find.ts）
  - [x] 4.1.2 inputSchema（自動生成済み）
  - [x] 4.1.3 MCPAdapter統合（完了済み）
  - [x] 4.1.4 ユニットテスト（__tests__/mcp/tools/find.test.ts）
  - [x] 4.1.5 統合テスト（__tests__/mcp/integration/find.test.ts）

- [x] 4.2 dynamodb_findOneツールのテストを実装
  - [x] 4.2.1 ツール定義（自動生成済み: src/mcp/tools/findOne.ts）
  - [x] 4.2.2 inputSchema（自動生成済み）
  - [x] 4.2.3 MCPAdapter統合（完了済み）
  - [x] 4.2.4 ユニットテスト（__tests__/mcp/tools/findOne.test.ts）
  - [x] 4.2.5 統合テスト（__tests__/mcp/integration/findOne.test.ts）

- [x] 4.3 dynamodb_insertOneツールのテストを実装
  - [x] 4.3.1 ツール定義（自動生成済み: src/mcp/tools/insertOne.ts）
  - [x] 4.3.2 inputSchema（自動生成済み）
  - [x] 4.3.3 MCPAdapter統合（完了済み）
  - [x] 4.3.4 ユニットテスト（__tests__/mcp/tools/insertOne.test.ts）
  - [x] 4.3.5 統合テスト（__tests__/mcp/integration/insertOne.test.ts）

## 5. MCPツール実装（P1: 重要）

**注意**: ツール定義は`make generate-mcp-tools`で自動生成されます。テストのみ実装してください。

- [x] 5.1 dynamodb_findManyツールのテストを実装
  - [x] 5.1.1 ツール定義（自動生成済み: src/mcp/tools/findMany.ts）
  - [x] 5.1.2 ユニットテスト
  - [x] 5.1.3 統合テスト

- [x] 5.2 dynamodb_findManyReferenceツールのテストを実装
  - [x] 5.2.1 ツール定義（自動生成済み: src/mcp/tools/findManyReference.ts）
  - [x] 5.2.2 ユニットテスト
  - [x] 5.2.3 統合テスト

- [x] 5.3 dynamodb_insertManyツールのテストを実装
  - [x] 5.3.1 ツール定義（自動生成済み: src/mcp/tools/insertMany.ts）
  - [x] 5.3.2 ユニットテスト
  - [x] 5.3.3 統合テスト

- [x] 5.4 dynamodb_updateOneツールのテストを実装
  - [x] 5.4.1 ツール定義（自動生成済み: src/mcp/tools/updateOne.ts）
  - [x] 5.4.2 ユニットテスト
  - [x] 5.4.3 統合テスト

- [x] 5.5 dynamodb_updateManyツールのテストを実装
  - [x] 5.5.1 ツール定義（自動生成済み: src/mcp/tools/updateMany.ts）
  - [x] 5.5.2 ユニットテスト
  - [x] 5.5.3 統合テスト

- [x] 5.6 dynamodb_deleteOneツールのテストを実装
  - [x] 5.6.1 ツール定義（自動生成済み: src/mcp/tools/deleteOne.ts）
  - [x] 5.6.2 ユニットテスト
  - [x] 5.6.3 統合テスト

- [x] 5.7 dynamodb_deleteManyツールのテストを実装
  - [x] 5.7.1 ツール定義（自動生成済み: src/mcp/tools/deleteMany.ts）
  - [x] 5.7.2 ユニットテスト
  - [x] 5.7.3 統合テスト

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

### OpenAPI駆動の開発ワークフロー

このプロジェクトでは、OpenAPI仕様をSingle Source of Truthとして使用します。

#### ツールを追加・変更する場合

1. **OpenAPI仕様を編集**
   ```bash
   vim docs/specs/openapi.yaml
   ```
   
   `paths['/'].post.requestBody.content['application/json'].examples`セクションに新しい操作を追加します：
   
   ```yaml
   examples:
     newOperation:
       summary: 新しい操作の説明
       value:
         op: newOperation
         resource: users
         params:
           # パラメータ例
           filter: { status: "active" }
   ```

2. **MCPツール定義を自動生成**
   ```bash
   make generate-mcp-tools
   # または
   npm run generate-mcp-tools
   ```
   
   これにより、以下のファイルが自動生成されます：
   - `src/mcp/tools/newOperation.ts` - ツール定義
   - `src/mcp/tools/index.ts` - ツールエクスポート（更新）

3. **テストを実装**
   - ユニットテスト: `__tests__/mcp/tools/newOperation.test.ts`
   - 統合テスト: `__tests__/mcp/integration/newOperation.test.ts`

4. **動作確認**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

#### 重要な注意事項

- **自動生成されたファイルは手動で編集しないでください**
- 各ツールファイルには以下の警告コメントがあります：
  ```typescript
  /**
   * このファイルは scripts/generate-mcp-tools.ts によって自動生成されます。
   * 手動で編集しないでください。
   */
  ```
- ツール定義を変更する場合は、必ずOpenAPI仕様を編集してから再生成してください

### 1.1 MCP SDK依存関係を追加

```bash
cd dynamodb-client
npm install @modelcontextprotocol/sdk
```

### 1.4 自動生成スクリプトを作成

`scripts/generate-mcp-tools.ts`は以下の処理を行います：

1. `docs/specs/openapi.yaml`を読み込む
2. `examples`セクションから各操作を抽出
3. 各操作のパラメータからJSON Schemaを生成
4. TypeScriptのツール定義ファイルを生成
5. `src/mcp/tools/index.ts`を更新

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

### 3.5 キャメルケース→スネークケース変換を実装

MCPAdapterは、MCPツール名（例: `dynamodb_findOne`）を以下のように処理します：

1. プレフィックス除去: `dynamodb_findOne` → `findOne`
2. スネークケース変換（検証用）: `findOne` → `find_one`
3. 有効な操作名リストと照合
4. キャメルケース変換（API呼び出し用）: `find_one` → `findOne`

これにより、MCPツール名とRPC API操作名の両方をサポートします。

### 4.x.4 ユニットテストの実装パターン

各ツールのユニットテストは以下をテストします：

```typescript
// __tests__/mcp/tools/[operation].test.ts
describe('[operation]Tool', () => {
  it('正しいツール名を持つ', () => {
    expect([operation]Tool.name).toBe('dynamodb_[operation]');
  });

  it('説明文が日本語である', () => {
    expect([operation]Tool.description).toContain('DynamoDB');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect([operation]Tool.inputSchema.type).toBe('object');
    expect([operation]Tool.inputSchema.properties).toHaveProperty('collection');
  });

  // パラメータ固有のテスト
  // ...
});
```

### 4.x.5 統合テストの実装パターン

各ツールの統合テストは以下をテストします：

```typescript
// __tests__/mcp/integration/[operation].test.ts
describe('MCPAdapter - [operation]', () => {
  it('正常系: [operation]が成功する', async () => {
    // DynamoDBクライアントをモック
    // MCPAdapterを初期化
    // executeTool()を呼び出し
    // 結果を検証
  });

  it('異常系: collectionパラメータが必須', async () => {
    // collectionなしで呼び出し
    // MCPErrorがスローされることを確認
  });

  // その他のエッジケース
  // ...
});
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
