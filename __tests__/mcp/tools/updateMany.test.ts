/**
 * updateMany ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { updateManyTool } from '../../../src/mcp/tools/updateMany.js';

describe('updateManyTool', () => {
  it('正しいツール名を持つ', () => {
    expect(updateManyTool.name).toBe('dynamodb_updateMany');
  });

  it('説明文が日本語である', () => {
    expect(updateManyTool.description).toContain('DynamoDB');
    expect(updateManyTool.description).toContain('複数レコード');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect(updateManyTool.inputSchema.type).toBe('object');
    expect(updateManyTool.inputSchema.properties).toHaveProperty('collection');
    expect(updateManyTool.inputSchema.properties).toHaveProperty('filter');
    expect(updateManyTool.inputSchema.properties).toHaveProperty('data');
  });

  it('collectionパラメータが必須である', () => {
    expect(updateManyTool.inputSchema.required).toContain('collection');
  });

  it('filterパラメータがobject型である', () => {
    const filterSchema = updateManyTool.inputSchema.properties?.filter as { type: string };
    expect(filterSchema.type).toBe('object');
  });

  it('dataパラメータがobject型である', () => {
    const dataSchema = updateManyTool.inputSchema.properties?.data as { type: string };
    expect(dataSchema.type).toBe('object');
  });
});
