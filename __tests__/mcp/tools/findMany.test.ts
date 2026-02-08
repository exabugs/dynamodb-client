/**
 * findMany ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { findManyTool } from '../../../src/mcp/tools/findMany.js';

describe('findManyTool', () => {
  it('正しいツール名を持つ', () => {
    expect(findManyTool.name).toBe('dynamodb_findMany');
  });

  it('説明文が日本語である', () => {
    expect(findManyTool.description).toContain('DynamoDB');
    expect(findManyTool.description).toContain('複数レコード');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect(findManyTool.inputSchema.type).toBe('object');
    expect(findManyTool.inputSchema.properties).toHaveProperty('collection');
    expect(findManyTool.inputSchema.properties).toHaveProperty('ids');
  });

  it('collectionパラメータが必須である', () => {
    expect(findManyTool.inputSchema.required).toContain('collection');
  });

  it('collectionパラメータがstring型である', () => {
    const collectionSchema = findManyTool.inputSchema.properties?.collection as {
      type: string;
      description: string;
    };
    expect(collectionSchema.type).toBe('string');
    expect(collectionSchema.description).toContain('コレクション名');
  });

  it('idsパラメータがarray型である', () => {
    const idsSchema = findManyTool.inputSchema.properties?.ids as {
      type: string;
      description: string;
      items: { type: string };
    };
    expect(idsSchema.type).toBe('array');
    expect(idsSchema.description).toContain('レコードID');
    expect(idsSchema.items.type).toBe('string');
  });
});
