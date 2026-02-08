#!/usr/bin/env tsx
/**
 * OpenAPI仕様からMCPツール定義を自動生成するスクリプト
 * 
 * Usage:
 *   npm run generate-mcp-tools
 *   make generate-mcp-tools
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';

interface OpenAPISpec {
  paths: {
    [path: string]: {
      post?: {
        requestBody?: {
          content?: {
            'application/json'?: {
              schema?: {
                properties?: {
                  op?: {
                    enum?: string[];
                  };
                };
              };
              examples?: {
                [key: string]: {
                  summary?: string;
                  value?: {
                    op: string;
                    resource: string;
                    params?: Record<string, unknown>;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}

/**
 * OpenAPI仕様を読み込む
 */
function loadOpenAPISpec(): OpenAPISpec {
  const specPath = path.join(process.cwd(), 'docs/specs/openapi.yaml');
  const content = fs.readFileSync(specPath, 'utf-8');
  return yaml.parse(content) as OpenAPISpec;
}

/**
 * 操作名をMCPツール名に変換
 * 例: "find" → "dynamodb_find"
 */
function toMCPToolName(operation: string): string {
  return `dynamodb_${operation}`;
}

/**
 * 操作名を説明文に変換
 */
function toDescription(operation: string, summary?: string): string {
  // summaryが日本語でない場合は、デフォルトの日本語説明を使用
  const descriptions: Record<string, string> = {
    find: 'DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。',
    findOne: 'DynamoDBから単一レコードを取得します。IDまたはフィルターで指定。',
    findMany: 'DynamoDBから複数レコードをIDリストで取得します。',
    findManyReference: 'DynamoDBから参照フィールドで関連レコードを取得します。',
    insertOne: 'DynamoDBに単一レコードを作成します。',
    insertMany: 'DynamoDBに複数レコードを一括作成します。',
    updateOne: 'DynamoDBの単一レコードを更新します。',
    updateMany: 'DynamoDBの複数レコードを一括更新します。',
    deleteOne: 'DynamoDBから単一レコードを削除します。',
    deleteMany: 'DynamoDBから複数レコードを一括削除します。',
  };
  
  return descriptions[operation] || `DynamoDB ${operation} operation`;
}

/**
 * パラメータからJSON Schemaを生成
 */
function generateInputSchema(params?: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    collection: {
      type: 'string',
      description: 'コレクション名（例: venues, users）',
    },
  };
  
  if (!params) {
    return {
      type: 'object',
      properties,
      required: ['collection'],
    };
  }
  
  // paramsの各プロパティをスキーマに変換
  for (const [key, value] of Object.entries(params)) {
    properties[key] = inferSchema(key, value);
  }
  
  return {
    type: 'object',
    properties,
    required: ['collection'],
  };
}

/**
 * 値からJSON Schemaを推論
 */
function inferSchema(key: string, value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { type: 'object' };
  }
  
  if (typeof value === 'string') {
    return {
      type: 'string',
      description: getPropertyDescription(key),
    };
  }
  
  if (typeof value === 'number') {
    return {
      type: 'number',
      description: getPropertyDescription(key),
    };
  }
  
  if (typeof value === 'boolean') {
    return {
      type: 'boolean',
      description: getPropertyDescription(key),
    };
  }
  
  if (Array.isArray(value)) {
    return {
      type: 'array',
      description: getPropertyDescription(key),
      items: value.length > 0 ? inferSchema('item', value[0]) : { type: 'object' },
    };
  }
  
  if (typeof value === 'object') {
    // 特殊なプロパティの処理
    if (key === 'sort') {
      return {
        type: 'object',
        description: 'ソート条件',
        properties: {
          field: {
            type: 'string',
            description: 'ソート対象フィールド名',
          },
          order: {
            type: 'string',
            enum: ['ASC', 'DESC'],
            description: 'ソート順序（ASC: 昇順, DESC: 降順）',
          },
        },
        required: ['field', 'order'],
      };
    }
    
    if (key === 'pagination') {
      return {
        type: 'object',
        description: 'ページネーション設定',
        properties: {
          perPage: {
            type: 'number',
            description: '1ページあたりの件数（最大50件）',
            minimum: 1,
            maximum: 50,
          },
          nextToken: {
            type: 'string',
            description: '次ページトークン（前回のレスポンスから取得）',
          },
        },
      };
    }
    
    if (key === 'options') {
      return {
        type: 'object',
        description: '操作オプション',
        properties: {
          upsert: {
            type: 'boolean',
            description: 'レコードが存在しない場合に新規作成するか（デフォルト: false）',
          },
        },
      };
    }
    
    return {
      type: 'object',
      description: getPropertyDescription(key),
    };
  }
  
  return { type: 'object' };
}

/**
 * プロパティ名から説明文を生成
 */
function getPropertyDescription(key: string): string {
  const descriptions: Record<string, string> = {
    filter: 'フィルター条件（MongoDB形式）。例: { status: "active", age: { $gte: 18 } }',
    data: '作成または更新するデータ',
    id: 'レコードID',
    ids: 'レコードIDの配列',
    target: '参照フィールド名（例: userId）',
  };
  
  return descriptions[key] || `${key}パラメータ`;
}

/**
 * MCPツール定義のTypeScriptコードを生成
 */
function generateToolDefinition(
  operation: string,
  summary: string | undefined,
  params: Record<string, unknown> | undefined
): string {
  const toolName = toMCPToolName(operation);
  const description = toDescription(operation, summary);
  const inputSchema = generateInputSchema(params);
  
  return `/**
 * ${toolName} ツール定義
 * ${description}
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * ${toolName} ツール
 * 
 * ${description}
 */
export const ${operation}Tool: Tool = ${JSON.stringify(
    {
      name: toolName,
      description,
      inputSchema,
    },
    null,
    2
  )};
`;
}

/**
 * tools/index.tsを生成
 */
function generateToolsIndex(operations: string[]): string {
  const imports = operations
    .map((op) => `import { ${op}Tool } from './${op}.js';`)
    .join('\n');
  
  const toolsList = operations.map((op) => `    ${op}Tool,`).join('\n');
  
  return `/**
 * MCPツール定義
 * 
 * このファイルは scripts/generate-mcp-tools.ts によって自動生成されます。
 * 手動で編集しないでください。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
${imports}

/**
 * すべてのMCPツールを取得
 * @returns MCPツール配列
 */
export function getAllTools(): Tool[] {
  return [
${toolsList}
  ];
}
`;
}

/**
 * メイン処理
 */
function main() {
  console.log('🔧 OpenAPI仕様からMCPツール定義を生成中...\n');
  
  // OpenAPI仕様を読み込む
  const spec = loadOpenAPISpec();
  
  // POST /エンドポイントからexamplesを取得
  const postEndpoint = spec.paths['/']?.post;
  const examples = postEndpoint?.requestBody?.content?.['application/json']?.examples;
  
  if (!examples) {
    console.error('❌ OpenAPI仕様にexamplesが見つかりません');
    process.exit(1);
  }
  
  const operations: string[] = [];
  const toolsDir = path.join(process.cwd(), 'src/mcp/tools');
  
  // 各操作のツール定義を生成
  for (const [operation, example] of Object.entries(examples)) {
    console.log(`📝 ${operation}ツールを生成中...`);
    
    const { summary, value } = example;
    const params = value?.params;
    
    const toolCode = generateToolDefinition(operation, summary, params);
    const toolPath = path.join(toolsDir, `${operation}.ts`);
    
    fs.writeFileSync(toolPath, toolCode, 'utf-8');
    operations.push(operation);
    
    console.log(`   ✅ ${toolPath}`);
  }
  
  // tools/index.tsを生成
  console.log('\n📝 tools/index.tsを生成中...');
  const indexCode = generateToolsIndex(operations);
  const indexPath = path.join(toolsDir, 'index.ts');
  fs.writeFileSync(indexPath, indexCode, 'utf-8');
  console.log(`   ✅ ${indexPath}`);
  
  console.log(`\n✨ ${operations.length}個のMCPツール定義を生成しました！`);
  console.log('\n次のステップ:');
  console.log('  1. npm run lint -- --fix  # コードフォーマット');
  console.log('  2. npm test               # テスト実行');
}

// スクリプト実行
main();
