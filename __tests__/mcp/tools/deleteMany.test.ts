/**
 * deleteMany ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { deleteManyTool } from '../../../src/mcp/tools/deleteMany.js';

describe('deleteManyTool', () => {
  it('正しいツール名を持つ', () => {
    expect(deleteManyTool.name).toBe('dynamodb_deleteMany');
  });

  it('説明文が日本語である', () => {
    expect(deleteManyTool.description).toContain('DynamoDB');
    expect(deleteManyTool.description).toContain('複数レコード');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect(deleteManyTool.inputSchema.type).toBe('object');
    expect(deleteManyTool.inputSchema.properties).toHaveProperty('collection');
    expect(deleteManyTool.inputSchema.properties).toHaveProperty('filter');
  });

  it('collectionパラメータが必須である', () => {
    expect(deleteManyTool.inputSchema.required).toContain('collection');
  });

  it('filterパラメータがobject型である', () => {
    const filterSchema = deleteManyTool.inputSchema.properties?.filter as { type: string };
    expect(filterSchema.type).toBe('object');
  });
});
