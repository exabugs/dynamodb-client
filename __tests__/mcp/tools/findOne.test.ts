/**
 * dynamodb_findOne ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { findOneTool } from '../../../src/mcp/tools/findOne.js';

describe('dynamodb_findOne tool', () => {
  it('正しいツール名を持つ', () => {
    expect(findOneTool.name).toBe('dynamodb_findOne');
  });

  it('説明文を持つ', () => {
    expect(findOneTool.description).toBeDefined();
    expect(findOneTool.description).toContain('DynamoDB');
    expect(findOneTool.description).toContain('単一レコード');
  });

  it('正しいinputSchemaを持つ', () => {
    expect(findOneTool.inputSchema).toBeDefined();
    expect(findOneTool.inputSchema.type).toBe('object');
  });

  it('collectionプロパティが必須である', () => {
    expect(findOneTool.inputSchema.required).toContain('collection');
  });

  it('collectionプロパティが文字列型である', () => {
    expect(findOneTool.inputSchema.properties?.collection).toEqual({
      type: 'string',
      description: expect.any(String),
    });
  });

  it('idプロパティが文字列型である', () => {
    expect(findOneTool.inputSchema.properties?.id).toEqual({
      type: 'string',
      description: expect.any(String),
    });
  });
});
