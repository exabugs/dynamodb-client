/**
 * updateOne ツールのユニットテスト
 */
import { describe, expect, it } from 'vitest';

import { updateOneTool } from '../../../src/mcp/tools/updateOne.js';

describe('updateOneTool', () => {
  it('正しいツール名を持つ', () => {
    expect(updateOneTool.name).toBe('dynamodb_updateOne');
  });

  it('説明文が日本語である', () => {
    expect(updateOneTool.description).toContain('DynamoDB');
    expect(updateOneTool.description).toContain('単一レコード');
  });

  it('inputSchemaが正しく定義されている', () => {
    expect(updateOneTool.inputSchema.type).toBe('object');
    expect(updateOneTool.inputSchema.properties).toHaveProperty('collection');
    expect(updateOneTool.inputSchema.properties).toHaveProperty('id');
    expect(updateOneTool.inputSchema.properties).toHaveProperty('data');
    expect(updateOneTool.inputSchema.properties).toHaveProperty('options');
  });

  it('collectionパラメータが必須である', () => {
    expect(updateOneTool.inputSchema.required).toContain('collection');
  });

  it('dataパラメータがobject型である', () => {
    const dataSchema = updateOneTool.inputSchema.properties?.data as { type: string };
    expect(dataSchema.type).toBe('object');
  });

  it('optionsパラメータにupsertが含まれる', () => {
    const optionsSchema = updateOneTool.inputSchema.properties?.options as {
      type: string;
      properties: { upsert: { type: string } };
    };
    expect(optionsSchema.type).toBe('object');
    expect(optionsSchema.properties).toHaveProperty('upsert');
    expect(optionsSchema.properties.upsert.type).toBe('boolean');
  });
});
