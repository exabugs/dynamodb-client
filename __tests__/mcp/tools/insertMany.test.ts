/**
 * insertMany ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { insertManyTool } from '../../../src/mcp/tools/insertMany.js';

describe('insertManyTool', () => {
  it('正しいツール名を持つ', () => {
    expect(insertManyTool.name).toBe('dynamodb_insertMany');
  });

  it('説明文が日本語である', () => {
    expect(insertManyTool.description).toContain('DynamoDB');
    expect(insertManyTool.description).toContain('複数レコード');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect(insertManyTool.inputSchema.type).toBe('object');
    expect(insertManyTool.inputSchema.properties).toHaveProperty('collection');
    expect(insertManyTool.inputSchema.properties).toHaveProperty('data');
  });

  it('collectionパラメータが必須である', () => {
    expect(insertManyTool.inputSchema.required).toContain('collection');
  });

  it('dataパラメータがarray型である', () => {
    const dataSchema = insertManyTool.inputSchema.properties?.data as {
      type: string;
      items: { type: string };
    };
    expect(dataSchema.type).toBe('array');
    expect(dataSchema.items.type).toBe('object');
  });
});
