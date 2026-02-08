/**
 * dynamodb_insertOne ツールのユニットテスト
 */
import { describe, it, expect } from 'vitest';
import { insertOneTool } from '../../../src/mcp/tools/insertOne.js';

describe('dynamodb_insertOne tool', () => {
  it('正しいツール名を持つ', () => {
    expect(insertOneTool.name).toBe('dynamodb_insertOne');
  });

  it('説明文を持つ', () => {
    expect(insertOneTool.description).toBeDefined();
    expect(insertOneTool.description).toContain('DynamoDB');
    expect(insertOneTool.description).toContain('単一レコード');
    expect(insertOneTool.description).toContain('作成');
  });

  it('正しいinputSchemaを持つ', () => {
    expect(insertOneTool.inputSchema).toBeDefined();
    expect(insertOneTool.inputSchema.type).toBe('object');
  });

  it('collectionプロパティが必須である', () => {
    expect(insertOneTool.inputSchema.required).toContain('collection');
  });

  it('collectionプロパティが文字列型である', () => {
    expect(insertOneTool.inputSchema.properties?.collection).toEqual({
      type: 'string',
      description: expect.any(String),
    });
  });

  it('dataプロパティがオブジェクト型である', () => {
    expect(insertOneTool.inputSchema.properties?.data).toEqual({
      type: 'object',
      description: expect.any(String),
    });
  });
});
