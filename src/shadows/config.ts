import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ResourceShadowConfig, ShadowConfig, ShadowFieldConfig } from './types.js';

/**
 * shadow.config.jsonファイルから読み込む
 *
 * @param configPath - 設定ファイルのパス（デフォルト: './shadow.config.json'）
 * @returns パースされたシャドー設定
 * @throws 設定ファイルが存在しない、または不正な形式の場合
 */
export async function loadShadowConfig(
  configPath: string = './shadow.config.json'
): Promise<ShadowConfig> {
  try {
    // ファイルシステムから読み込む
    const absolutePath = resolve(configPath);
    const content = await readFile(absolutePath, 'utf-8');
    const config = JSON.parse(content) as ShadowConfig;

    // 基本的なバリデーション
    if (!config.$schemaVersion) {
      throw new Error('Missing $schemaVersion in shadow.config.json');
    }

    if (!config.resources || typeof config.resources !== 'object') {
      throw new Error('Missing or invalid resources in shadow.config.json');
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load shadow config: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 特定のリソースのシャドー設定を取得する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名（例: 'articles', 'tasks'）
 * @returns リソースのシャドー設定
 * @throws リソースが設定に存在しない場合
 */
export function getResourceConfig(
  config: ShadowConfig,
  resourceName: string
): ResourceShadowConfig {
  const resourceConfig = config.resources[resourceName];

  if (!resourceConfig) {
    throw new Error(`Resource '${resourceName}' not found in shadow config`);
  }

  return resourceConfig;
}

/**
 * リソースの全シャドーフィールドを取得する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名
 * @returns 全シャドーフィールドの設定
 */
export function getAllShadowFields(
  config: ShadowConfig,
  resourceName: string
): Record<string, ShadowFieldConfig> {
  const resourceConfig = getResourceConfig(config, resourceName);
  return resourceConfig.shadows;
}

/**
 * 指定されたフィールドが有効なシャドーフィールドかどうかを検証する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名
 * @param fieldName - 検証するフィールド名
 * @returns フィールドが有効な場合true
 */
export function isValidShadowField(
  config: ShadowConfig,
  resourceName: string,
  fieldName: string
): boolean {
  try {
    const allFields = getAllShadowFields(config, resourceName);
    return fieldName in allFields;
  } catch {
    return false;
  }
}

/**
 * リソースのデフォルトソート設定を取得する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名
 * @returns デフォルトソート設定
 */
export function getDefaultSort(
  config: ShadowConfig,
  resourceName: string
): { field: string; order: 'ASC' | 'DESC' } {
  const resourceConfig = getResourceConfig(config, resourceName);
  return resourceConfig.sortDefaults;
}

/**
 * 設定ファイルから環境変数経由でパスを取得する
 *
 * @param envVar - 環境変数名（デフォルト: 'SHADOW_CONFIG_PATH'）
 * @returns 設定ファイルのパス
 */
export function getConfigPathFromEnv(envVar: string = 'SHADOW_CONFIG_PATH'): string {
  return process.env[envVar] || './shadow.config.json';
}
