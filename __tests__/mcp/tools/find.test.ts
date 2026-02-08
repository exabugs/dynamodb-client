/**
 * dynamodb_find ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { findTool } from '../../../src/mcp/tools/find.js';

describe('dynamodb_find tool', () => {
  it('正しいツール名を持つ', () => {
    expect(findTool.name).toBe('dynamodb_find');
  });

  it('説明文を持つ', () => {
    expect(findTool.description).toBeDefined();
    expect(findTool.description).toContain('DynamoDB');
    expect(findTool.description).toContain('検索');
  });

  it('正しいinputSchemaを持つ', () => {
    expect(findTool.inputSchema).toBeDefined();
    expect(findTool.inputSchema.type).toBe('object');
  });

  it('collectionプロパティが必須である', () => {
    expect(findTool.inputSchema.required).toContain('collection');
  });

  it('collectionプロパティが文字列型である', () => {
    expect(findTool.inputSchema.properties?.collection).toEqual({
      type: 'string',
      description: expect.any(String),
    });
  });

  it('filterプロパティがオブジェクト型である', () => {
    expect(findTool.inputSchema.properties?.filter).toEqual({
      type: 'object',
      description: expect.any(String),
    });
  });

  it('sortプロパティが正しい構造を持つ', () => {
    const sortSchema = findTool.inputSchema.properties?.sort;
    expect(sortSchema).toBeDefined();
    expect(sortSchema?.type).toBe('object');
    expect(sortSchema?.properties).toHaveProperty('field');
    expect(sortSchema?.properties).toHaveProperty('order');
    expect(sortSchema?.required).toEqual(['field', 'order']);
  });

  it('sort.orderがASCとDESCのenumである', () => {
    const sortSchema = findTool.inputSchema.properties?.sort;
    expect(sortSchema?.properties?.order).toEqual({
      type: 'string',
      enum: ['ASC', 'DESC'],
      description: expect.any(String),
    });
  });

  it('paginationプロパティが正しい構造を持つ', () => {
    const paginationSchema = findTool.inputSchema.properties?.pagination;
    expect(paginationSchema).toBeDefined();
    expect(paginationSchema?.type).toBe('object');
    expect(paginationSchema?.properties).toHaveProperty('perPage');
    expect(paginationSchema?.properties).toHaveProperty('nextToken');
  });

  it('pagination.perPageが1から50の範囲である', () => {
    const paginationSchema = findTool.inputSchema.properties?.pagination;
    expect(paginationSchema?.properties?.perPage).toEqual({
      type: 'number',
      description: expect.any(String),
      minimum: 1,
      maximum: 50,
    });
  });

  it('pagination.nextTokenが文字列型である', () => {
    const paginationSchema = findTool.inputSchema.properties?.pagination;
    expect(paginationSchema?.properties?.nextToken).toEqual({
      type: 'string',
      description: expect.any(String),
    });
  });
});
