/**
 * deleteOne ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { deleteOneTool } from '../../../src/mcp/tools/deleteOne.js';

describe('deleteOneTool', () => {
  it('正しいツール名を持つ', () => {
    expect(deleteOneTool.name).toBe('dynamodb_deleteOne');
  });

  it('説明文が日本語である', () => {
    expect(deleteOneTool.description).toContain('DynamoDB');
    expect(deleteOneTool.description).toContain('単一レコード');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect(deleteOneTool.inputSchema.type).toBe('object');
    expect(deleteOneTool.inputSchema.properties).toHaveProperty('collection');
    expect(deleteOneTool.inputSchema.properties).toHaveProperty('id');
  });

  it('collectionパラメータが必須である', () => {
    expect(deleteOneTool.inputSchema.required).toContain('collection');
  });

  it('idパラメータがstring型である', () => {
    const idSchema = deleteOneTool.inputSchema.properties?.id as { type: string };
    expect(idSchema.type).toBe('string');
  });
});
