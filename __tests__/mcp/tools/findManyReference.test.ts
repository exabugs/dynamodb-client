/**
 * findManyReference ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { findManyReferenceTool } from '../../../src/mcp/tools/findManyReference.js';

describe('findManyReferenceTool', () => {
  it('正しいツール名を持つ', () => {
    expect(findManyReferenceTool.name).toBe('dynamodb_findManyReference');
  });

  it('説明文が日本語である', () => {
    expect(findManyReferenceTool.description).toContain('DynamoDB');
    expect(findManyReferenceTool.description).toContain('参照フィールド');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect(findManyReferenceTool.inputSchema.type).toBe('object');
    expect(findManyReferenceTool.inputSchema.properties).toHaveProperty('collection');
    expect(findManyReferenceTool.inputSchema.properties).toHaveProperty('target');
    expect(findManyReferenceTool.inputSchema.properties).toHaveProperty('id');
    expect(findManyReferenceTool.inputSchema.properties).toHaveProperty('filter');
  });

  it('collectionパラメータが必須である', () => {
    expect(findManyReferenceTool.inputSchema.required).toContain('collection');
  });

  it('collectionパラメータがstring型である', () => {
    const collectionSchema = findManyReferenceTool.inputSchema.properties?.collection as {
      type: string;
      description: string;
    };
    expect(collectionSchema.type).toBe('string');
    expect(collectionSchema.description).toContain('コレクション名');
  });

  it('targetパラメータがstring型である', () => {
    const targetSchema = findManyReferenceTool.inputSchema.properties?.target as {
      type: string;
      description: string;
    };
    expect(targetSchema.type).toBe('string');
    expect(targetSchema.description).toContain('参照フィールド名');
  });

  it('idパラメータがstring型である', () => {
    const idSchema = findManyReferenceTool.inputSchema.properties?.id as {
      type: string;
      description: string;
    };
    expect(idSchema.type).toBe('string');
    expect(idSchema.description).toContain('レコードID');
  });

  it('filterパラメータがobject型である', () => {
    const filterSchema = findManyReferenceTool.inputSchema.properties?.filter as {
      type: string;
      description: string;
    };
    expect(filterSchema.type).toBe('object');
    expect(filterSchema.description).toContain('フィルター条件');
  });
});
