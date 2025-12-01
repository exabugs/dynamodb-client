#!/usr/bin/env node

/**
 * Shadow Config 自動生成スクリプト
 *
 * TypeScript スキーマファイルから shadow.config.json を自動生成する。
 * TypeScript のスキーマ定義が唯一の情報源（Single Source of Truth）となり、
 * 設定ファイルとの不整合を防ぐ。
 *
 * 使用方法:
 *   npx generate-shadow-config <schema-file> -o <output-file>
 *
 * 例:
 *   npx generate-shadow-config schema.ts -o shadow.config.json
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';

import type { SchemaRegistryConfig } from '../shadows/schema.js';

/**
 * shadow.config.json の型定義
 */
interface ShadowConfig {
  $schemaVersion: string;
  $generatedFrom: string;
  database: {
    timestamps: {
      createdAt: string;
      updatedAt: string;
    };
  };
  resources: Record<
    string,
    {
      shadows: Record<string, { type: string }>;
      sortDefaults: {
        field: string;
        order: 'ASC' | 'DESC';
      };
      ttl?: {
        days: number;
      };
    }
  >;
}

/**
 * コマンドライン引数をパース
 */
function parseArgs(): { schemaFile: string; outputFile: string } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage: generate-shadow-config <schema-file> [options]

Arguments:
  <schema-file>    TypeScript schema file path

Options:
  -o, --output     Output file path (default: shadow.config.json)
  -h, --help       Show this help message

Example:
  generate-shadow-config schema.ts -o shadow.config.json
`);
    process.exit(0);
  }

  const schemaFile = args[0];
  const outputIndex = args.findIndex((arg) => arg === '-o' || arg === '--output');
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : 'shadow.config.json';

  if (!schemaFile) {
    console.error('❌ Error: Schema file is required');
    process.exit(1);
  }

  return { schemaFile, outputFile };
}

/**
 * TypeScript スキーマファイルから SchemaRegistryConfig を読み込む
 */
async function loadSchemaFile(schemaFile: string): Promise<SchemaRegistryConfig> {
  const absolutePath = resolve(process.cwd(), schemaFile);

  console.log(`📖 Loading schema from: ${absolutePath}`);

  try {
    // 動的インポートでスキーマファイルを読み込む
    const module = await import(absolutePath);

    // エクスポートされた SchemaRegistryConfig を探す
    const schemaConfig =
      module.default ||
      module.SchemaRegistryConfig ||
      module.MySchema ||
      module.schema ||
      module.config;

    if (!schemaConfig) {
      throw new Error(
        'SchemaRegistryConfig not found. Please export as default or named export (SchemaRegistryConfig, MySchema, schema, config)'
      );
    }

    // 基本的な検証
    if (!schemaConfig.database || !schemaConfig.resources) {
      throw new Error('Invalid schema: missing database or resources');
    }

    return schemaConfig as SchemaRegistryConfig;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Failed to load schema file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * SchemaRegistryConfig から shadow.config.json を生成
 */
function generateShadowConfig(
  schemaConfig: SchemaRegistryConfig,
  schemaFile: string
): ShadowConfig {
  console.log('🔄 Generating shadow.config.json...');

  // データベース設定の検証
  if (!schemaConfig.database.timestamps) {
    throw new Error('Database timestamps configuration is required');
  }

  // リソーススキーマの変換
  const resources: ShadowConfig['resources'] = {};

  for (const [resourceName, schema] of Object.entries(schemaConfig.resources)) {
    // ソート可能フィールドを変換
    const shadows: Record<string, { type: string }> = {};
    for (const [fieldName, fieldDef] of Object.entries(schema.shadows.sortableFields)) {
      shadows[fieldName] = {
        type: fieldDef.type,
      };
    }

    // デフォルトソート設定を決定
    // schema.sortDefaults が指定されていればそれを使用
    // なければ updatedAt が存在する場合は updatedAt DESC、なければ最初のフィールド ASC
    let sortDefaults: { field: string; order: 'ASC' | 'DESC' };

    if (schema.sortDefaults) {
      sortDefaults = schema.sortDefaults;
    } else {
      const sortableFieldNames = Object.keys(shadows);
      const defaultSortField = 'updatedAt' in shadows ? 'updatedAt' : sortableFieldNames[0];
      const defaultSortOrder = 'updatedAt' in shadows ? 'DESC' : 'ASC';
      sortDefaults = {
        field: defaultSortField,
        order: defaultSortOrder,
      };
    }

    resources[resourceName] = {
      shadows,
      sortDefaults,
      ...(schema.ttl && { ttl: schema.ttl }),
    };
  }

  // 設定オブジェクトの構築
  const config: ShadowConfig = {
    $schemaVersion: '2.0',
    $generatedFrom: schemaFile,
    database: {
      timestamps: schemaConfig.database.timestamps,
    },
    resources,
  };

  return config;
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    // コマンドライン引数をパース
    const { schemaFile, outputFile } = parseArgs();

    // スキーマファイルを読み込む
    const schemaConfig = await loadSchemaFile(schemaFile);

    // shadow.config.json を生成
    const config = generateShadowConfig(schemaConfig, schemaFile);

    // ファイルに出力
    const outputPath = resolve(process.cwd(), outputFile);
    const output = JSON.stringify(config, null, 2);
    writeFileSync(outputPath, output, 'utf-8');

    console.log(`✅ Generated shadow.config.json at ${outputPath}`);
    console.log(`📊 Resources: ${Object.keys(config.resources).join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to generate shadow.config.json:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// スクリプト実行
main();
