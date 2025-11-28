// ========================================
// リソーススキーマのインポート
// ========================================
import { ArticleSchema } from './models/Article.js';
import { FetchLogSchema } from './models/FetchLog.js';
import { TaskSchema } from './models/Task.js';

/**
 * スキーマ定義とシャドウフィールド型
 * DynamoDB Single-Table設計のシャドウレコード管理用
 */

/**
 * シャドウフィールドの型
 * DynamoDBのシャドウレコードで使用されるフィールドの型を定義
 */
export enum ShadowFieldType {
  /** 文字列型 */
  String = 'string',
  /** 数値型（20桁ゼロ埋め文字列に変換） */
  Number = 'number',
  /** 日時型（UTC ISO 8601形式） */
  Datetime = 'datetime',
  /** 真偽値型（"0" または "1" に変換） */
  Boolean = 'boolean',
}

/**
 * シャドウフィールド定義
 * ソート可能なフィールドの型情報を定義
 */
export interface ShadowFieldDefinition {
  /** フィールドの型 */
  type: ShadowFieldType;
}

/**
 * データベース設定
 * タイムスタンプフィールドなど、データベースレベルの設定を定義
 */
export interface DatabaseConfig {
  /** データベース名 */
  name: string;

  /** タイムスタンプフィールドの設定 */
  timestamps?:
    | {
        /** 作成日時フィールド名（デフォルト: 'createdAt'） */
        createdAt: string;
        /** 更新日時フィールド名（デフォルト: 'updatedAt'） */
        updatedAt: string;
      }
    | false; // false で無効化
}

/**
 * スキーマ定義
 * リソースの型定義とシャドー設定を含む
 *
 * @template T - リソースの型
 */
export interface SchemaDefinition<T = any> {
  /** リソース名（例: "products", "orders"） */
  resource: string;

  /** リソースの型（型推論用） */
  type: T;

  /** シャドウレコード設定 */
  shadows: {
    /** ソート可能なフィールドの定義（明示的に定義されたフィールドのみ） */
    sortableFields: Record<string, ShadowFieldDefinition>;
  };

  /** TTL設定（オプション） */
  ttl?: {
    /** TTL期間（日数） */
    days: number;
  };
}

/**
 * スキーマレジストリ設定
 * データベース設定とリソーススキーマを含む
 */
export interface SchemaRegistryConfig {
  /** データベース設定 */
  database: DatabaseConfig;

  /** リソーススキーマ */
  resources: Record<string, SchemaDefinition>;
}

// ========================================
// スキーマレジストリ（Single Source of Truth）
// ========================================

/**
 * スキーマレジストリ設定（Single Source of Truth）
 *
 * このレジストリが唯一の情報源となり、以下が自動生成される:
 * - shadow.config.json（シャドウレコード設定）
 * - タイムスタンプフィールドの自動設定
 * - データベース設定の自動適用
 */
export const SchemaRegistryConfig: SchemaRegistryConfig = {
  // データベース設定
  database: {
    name: 'ainews',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },

  // リソーススキーマ
  resources: {
    articles: ArticleSchema,
    tasks: TaskSchema,
    fetchLogs: FetchLogSchema,
  },
};

/**
 * リソース名の型
 * SchemaRegistryConfig.resources のキーから自動的に型を生成
 */
export type ResourceName = keyof typeof SchemaRegistryConfig.resources;

/**
 * リソース型のマッピング
 * リソース名から対応する型を取得
 */
export type ResourceTypeMap = {
  [K in ResourceName]: (typeof SchemaRegistryConfig.resources)[K]['type'];
};
