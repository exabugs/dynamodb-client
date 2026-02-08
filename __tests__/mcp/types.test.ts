/**
 * MCP型定義のテスト
 */
import { describe, it, expect } from 'vitest';
import type { MCPServerConfig } from '../../src/mcp/types.js';

describe('MCPServerConfig型定義', () => {
  it('必須フィールドtableNameを持つこと', () => {
    const config: MCPServerConfig = {
      tableName: 'test-table',
    };

    expect(config.tableName).toBe('test-table');
  });

  it('オプションフィールドregionを持つこと', () => {
    const config: MCPServerConfig = {
      tableName: 'test-table',
      region: 'ap-northeast-1',
    };

    expect(config.region).toBe('ap-northeast-1');
  });

  it('オプションフィールドprofileを持つこと', () => {
    const config: MCPServerConfig = {
      tableName: 'test-table',
      profile: 'test-profile',
    };

    expect(config.profile).toBe('test-profile');
  });

  it('オプションフィールドaccessKeyIdを持つこと', () => {
    const config: MCPServerConfig = {
      tableName: 'test-table',
      accessKeyId: 'test-access-key',
    };

    expect(config.accessKeyId).toBe('test-access-key');
  });

  it('オプションフィールドsecretAccessKeyを持つこと', () => {
    const config: MCPServerConfig = {
      tableName: 'test-table',
      secretAccessKey: 'test-secret-key',
    };

    expect(config.secretAccessKey).toBe('test-secret-key');
  });

  it('すべてのフィールドを設定できること', () => {
    const config: MCPServerConfig = {
      tableName: 'test-table',
      region: 'ap-northeast-1',
      profile: 'test-profile',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    };

    expect(config.tableName).toBe('test-table');
    expect(config.region).toBe('ap-northeast-1');
    expect(config.profile).toBe('test-profile');
    expect(config.accessKeyId).toBe('test-access-key');
    expect(config.secretAccessKey).toBe('test-secret-key');
  });
});
