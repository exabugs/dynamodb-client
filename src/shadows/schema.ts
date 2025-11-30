/**
 * Shadow Config スキーマ定義
 *
 * TypeScript でリソーススキーマを定義し、shadow.config.json を自動生成するための型定義。
 * これにより、型安全性を保ちながら Shadow Config を管理できる。
 */

/**
 * シャドーフィールドの型
 */
export type ShadowFieldType = 'string' | 'number' | 'datetime' | 'boolean';

/**
 * シャドーフィールドの定義
 */
export interface ShadowFieldDefinition {
  type: ShadowFieldType;
}

/**
 * リソーススキーマの定義
 *
 * @template T - リソースの型（例: Article, Task など）
 */
export interface ResourceSchema<T = any> {
  /** リソース名（複数形、例: "articles", "tasks"） */
  resource: string;

  /** リソースの型定義（型チェック用） */
  type: T;

  /** シャドー設定 */
  shadows: {
    /** ソート可能なフィールドの定義 */
    sortableFields: Record<string, ShadowFieldDefinition>;
  };

  /** デフォルトソート設定（省略時は自動決定） */
  sortDefaults?: {
    field: string;
    order: 'ASC' | 'DESC';
  };

  /** TTL 設定（省略可） */
  ttl?: {
    days: number;
  };
}

/**
 * スキーマレジストリの設定
 *
 * アプリケーション全体のリソーススキーマを定義する。
 * この設定から shadow.config.json を自動生成する。
 */
export interface SchemaRegistryConfig {
  /** データベース設定 */
  database: {
    /** データベース名 */
    name: string;

    /** タイムスタンプフィールド名 */
    timestamps: {
      createdAt: string;
      updatedAt: string;
    };
  };

  /** リソーススキーマの定義 */
  resources: Record<string, ResourceSchema>;
}
