#!/usr/bin/env tsx
/**
 * OpenAPI仕様からMCPツール定義を自動生成するスクリプト（v2）
 * 
 * 設計原則:
 * - OpenAPI仕様をSSOT（Single Source of Truth）とする
 * - 推論ロジックを最小化し、OpenAPIから直接情報を取得
 * - 150行以内のシンプルな実装
 * 
 * Usage:
 *   npm run generate-mcp-tools
 *   make generate-mcp-tools
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as yaml from 'yaml';

// 型定義
interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  requestBody?: {
    content?: {
      'application/json'?: {
        examples?: Record<string, Example>;
      };
    };
  };
}

interface Example {
  summary?: string;
  description?: string;
  value?: unknown;
  schema?: JSONSchema;
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  [key: string]: unknown;
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

/**
 * OpenAPI仕様を読み込む
 */
async function loadOpenAPISpec(): Promise<OpenAPISpec> {
  const specPath = path.join(process.cwd(), 'docs/specs/openapi.yaml');
  const content = await fs.readFile(specPath, 'utf-8');
  const spec = yaml.parse(content);
  
  // 必須フィールドの検証
  if (!spec.openapi || !spec.info || !spec.paths) {
    throw new Error('Invalid OpenAPI specification: missing required fields');
  }
  
  return spec;
}

/**
 * OpenAPI仕様から操作を抽出
 */
function extractOperations(spec: OpenAPISpec): Array<{ name: string; example: Example }> {
  const operations: Array<{ name: string; example: Example }> = [];
  
  // POST /エンドポイントからexamplesを取得
  const postEndpoint = spec.paths['/']?.post;
  const examples = postEndpoint?.requestBody?.content?.['application/json']?.examples;
  
  if (!examples) {
    throw new Error('No examples found in OpenAPI specification');
  }
  
  for (const [name, example] of Object.entries(examples)) {
    operations.push({ name, example });
  }
  
  return operations;
}

/**
 * MCPツール定義を生成
 */
function generateToolDefinition(name: string, example: Example): MCPToolDefinition {
  const toolName = `dynamodb_${name}`;
  const description = example.description || example.summary || `DynamoDB ${name} operation`;
  
  // schemaが定義されている場合はそれを使用、なければ基本的なschemaを生成
  const inputSchema: JSONSchema = example.schema || {
    type: 'object',
    properties: {
      collection: {
        type: 'string',
        description: 'コレクション名（例: venues, users）',
      },
    },
    required: ['collection'],
  };
  
  return {
    name: toolName,
    description,
    inputSchema,
  };
}

/**
 * TypeScriptコードを生成
 */
function generateTypeScriptCode(tools: MCPToolDefinition[]): string {
  const timestamp = new Date().toISOString();
  
  const header = `/**
 * このファイルは自動生成されています。
 * 直接編集しないでください。
 * 
 * 生成元: docs/specs/openapi.yaml
 * 生成日時: ${timestamp}
 * 生成スクリプト: scripts/generate-mcp-tools-v2.ts
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

`;

  const toolsArray = `export const tools: Tool[] = ${JSON.stringify(tools, null, 2)};
`;

  return header + toolsArray;
}

/**
 * ファイルに書き込む
 */
async function writeGeneratedFile(code: string): Promise<void> {
  const outputPath = path.join(process.cwd(), 'src/mcp/tools/generated.ts');
  
  // ディレクトリが存在しない場合は作成
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  
  // ファイルに書き込み
  await fs.writeFile(outputPath, code, 'utf-8');
  
  console.log(`✅ Generated: ${outputPath}`);
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('🔧 Generating MCP tools from OpenAPI specification...\n');
    
    // 1. OpenAPI仕様の読み込み
    const spec = await loadOpenAPISpec();
    console.log(`📖 Loaded OpenAPI spec: ${spec.info.title} v${spec.info.version}`);
    
    // 2. 操作の抽出
    const operations = extractOperations(spec);
    console.log(`📝 Extracted ${operations.length} operations`);
    
    // 3. MCPツール定義の生成
    const tools = operations.map(({ name, example }) => 
      generateToolDefinition(name, example)
    );
    console.log(`🔨 Generated ${tools.length} MCP tool definitions`);
    
    // 4. TypeScriptコードの生成
    const code = generateTypeScriptCode(tools);
    
    // 5. ファイルへの書き込み
    await writeGeneratedFile(code);
    
    console.log('\n✨ MCP tools generated successfully!');
  } catch (error) {
    console.error('❌ Error generating MCP tools:', error);
    process.exit(1);
  }
}

main();
