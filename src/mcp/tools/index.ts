/**
 * MCPツール定義
 * 
 * このファイルは scripts/generate-mcp-tools.ts によって自動生成されます。
 * 手動で編集しないでください。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { findTool } from './find.js';
import { findOneTool } from './findOne.js';
import { findManyTool } from './findMany.js';
import { findManyReferenceTool } from './findManyReference.js';
import { insertOneTool } from './insertOne.js';
import { insertManyTool } from './insertMany.js';
import { updateOneTool } from './updateOne.js';
import { updateManyTool } from './updateMany.js';
import { deleteOneTool } from './deleteOne.js';
import { deleteManyTool } from './deleteMany.js';

/**
 * すべてのMCPツールを取得
 * @returns MCPツール配列
 */
export function getAllTools(): Tool[] {
  return [
    findTool,
    findOneTool,
    findManyTool,
    findManyReferenceTool,
    insertOneTool,
    insertManyTool,
    updateOneTool,
    updateManyTool,
    deleteOneTool,
    deleteManyTool,
  ];
}
