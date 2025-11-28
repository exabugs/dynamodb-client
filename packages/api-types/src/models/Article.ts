/**
 * Article リソースの型定義とスキーマ定義
 */
import { SchemaDefinition, ShadowFieldType } from '../schema.js';

/**
 * Article リソースの型定義
 */
export interface Article {
  /** レコードID（canonical_id） */
  id: string;
  /** 記事タイトル */
  name: string;
  /** カテゴリ */
  category: string;
  /** ステータス */
  status: 'draft' | 'published' | 'archived';
  /** プロバイダー名 */
  provider?: string;
  /** 記事の説明文 */
  description?: string;
  /** 記事URL */
  url?: string;
  /** 画像URL */
  imageUrl?: string;
  /** 公開日時（ISO 8601形式） */
  publishedAt?: string;
  /** 言語コード（ISO 639-1） */
  language?: string;
  /** ソース名 */
  sourceName?: string;
  /** ソースURL */
  sourceUrl?: string;
  /** ソート不可フィールド1 */
  'no-sort-1'?: string;
  /** ソート不可フィールド2 */
  'no-sort-2'?: string;
  /** TTL（Unix timestamp、秒単位） */
  ttl?: number;
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
}

/**
 * Article リソースのスキーマ定義
 *
 * ソート可能なフィールドのみを明示的に定義:
 * - name: 記事タイトルでのソート
 * - category: カテゴリでのソート
 * - status: ステータスでのソート
 * - provider: プロバイダー名でのソート
 * - publishedAt: 公開日時でのソート
 * - language: 言語コードでのソート
 * - createdAt: 作成日時でのソート
 * - updatedAt: 更新日時でのソート
 *
 * 注意:
 * - id フィールドはPKとして使用されるため、シャドーレコードは生成しない
 * - description, url, imageUrl, sourceName, sourceUrl はソート不要のため、sortableFieldsに含めない
 * - no-sort-1, no-sort-2 はソート不要のため、sortableFieldsに含めない
 */
export const ArticleSchema: SchemaDefinition<Article> = {
  resource: 'articles',
  type: {} as Article,
  shadows: {
    sortableFields: {
      name: { type: 'string' as ShadowFieldType.String },
      category: { type: 'string' as ShadowFieldType.String },
      status: { type: 'string' as ShadowFieldType.String },
      provider: { type: 'string' as ShadowFieldType.String },
      publishedAt: { type: 'datetime' as ShadowFieldType.Datetime },
      language: { type: 'string' as ShadowFieldType.String },
      createdAt: { type: 'datetime' as ShadowFieldType.Datetime },
      updatedAt: { type: 'datetime' as ShadowFieldType.Datetime },
    },
  },
  ttl: {
    days: 90, // 90日後に自動削除
  },
};
