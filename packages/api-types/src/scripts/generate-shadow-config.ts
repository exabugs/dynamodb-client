#!/usr/bin/env node
/**
 * シャドウ設定自動生成スクリプト
 *
 * SchemaRegistryConfig から shadow.config.json を自動生成する。
 * TypeScript のスキーマ定義が唯一の情報源（Single Source of Truth）となり、
 * 設定ファイルとの不整合を防ぐ。
 */
import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * シャドウ設定の型定義
 */
interface ShadowConfig {
  $schemaVersion: string;
  $generatedFrom: string;
  database: {
    name: string;
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
 * SchemaRegistryConfig から shadow.config.json を生成
 */
async function generateShadowConfig(): Promise<void> {
  console.log('🔄 Generating shadow.config.json from SchemaRegistryConfig...');

  /**
   * TODO: 動的インポートの型定義改善
   *
   * 現在、動的インポートで型情報が失われるため、as anyを使用しています。
   *
   * 根本的な解決策:
   * 1. SchemaRegistryConfigの型定義をエクスポート
   * 2. 型定義ファイルを別途作成して循環依存を回避
   * 3. ビルド時に型情報を保持する方法を検討
   *
   * 現状の制約:
   * - 動的インポート（await import）は実行時に型情報を持たない
   * - @ts-ignoreで型チェックを回避している
   * - スクリプトファイルのため、実用性を優先
   */

  // 動的インポートで循環依存を回避
  // src/scripts/generate-shadow-config.ts -> dist/scripts/generate-shadow-config.js
  // dist/scripts から dist へは ..
  // @ts-ignore - dist は実行時に存在する
  const schemaModule = await import('../schema.js');

  // 動的インポートの型定義
  interface SchemaModule {
    SchemaRegistryConfig: {
      database: {
        name: string;
        timestamps: {
          createdAt: string;
          updatedAt: string;
        };
      };
      resources: Record<
        string,
        {
          shadows: {
            sortableFields: Record<string, { type: string }>;
          };
          sortDefaults?: {
            field: string;
            order: 'ASC' | 'DESC';
          };
          ttl?: {
            days: number;
          };
        }
      >;
    };
  }

  const SchemaRegistryConfig = (schemaModule as SchemaModule).SchemaRegistryConfig;

  // データベース設定の検証
  if (!SchemaRegistryConfig.database.timestamps) {
    throw new Error('Database timestamps configuration is required');
  }

  // リソーススキーマの変換
  const resources: ShadowConfig['resources'] = {};

  for (const [resourceName, schema] of Object.entries(SchemaRegistryConfig.resources)) {
    // ソート可能フィールドを変換
    const shadows: Record<string, { type: string }> = {};
    for (const [fieldName, fieldDef] of Object.entries(schema.shadows.sortableFields)) {
      shadows[fieldName] = {
        type: fieldDef.type,
      };
    }

    // デフォルトソート設定を決定
    // updatedAt が存在する場合は updatedAt DESC、なければ最初のフィールド ASC
    const sortableFieldNames = Object.keys(shadows);
    const defaultSortField = 'updatedAt' in shadows ? 'updatedAt' : sortableFieldNames[0];
    const defaultSortOrder = 'updatedAt' in shadows ? 'DESC' : 'ASC';

    resources[resourceName] = {
      shadows,
      sortDefaults: {
        field: defaultSortField,
        order: defaultSortOrder,
      },
      ...(schema.ttl && { ttl: schema.ttl }),
    };
  }

  // 設定オブジェクトの構築
  const config: ShadowConfig = {
    $schemaVersion: '1.0',
    $generatedFrom: 'packages/api-types/src/schema.ts (SchemaRegistryConfig)',
    database: {
      name: SchemaRegistryConfig.database.name,
      timestamps: SchemaRegistryConfig.database.timestamps,
    },
    resources,
  };

  // 出力パスの決定（プロジェクトルート/config/shadow.config.json）
  // scripts/generate-shadow-config.ts -> dist/scripts/generate-shadow-config.js
  // packages/api-types/dist/scripts から ../../../../config へ
  const outputPath = resolve(__dirname, '../../../../config/shadow.config.json');

  // JSONファイルとして出力
  const output = JSON.stringify(config, null, 2);
  writeFileSync(outputPath, output, 'utf-8');

  console.log(`✅ Generated shadow.config.json at ${outputPath}`);
  console.log(`📊 Database: ${config.database.name}`);
  console.log(`📊 Resources: ${Object.keys(config.resources).join(', ')}`);
}

// スクリプト実行
try {
  await generateShadowConfig();
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to generate shadow.config.json:', error);
  if (error instanceof Error) {
    console.error(error.stack);
  }
  process.exit(1);
}
