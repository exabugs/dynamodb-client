/**
 * ニュースプロバイダーの型定義
 */
import type { Article } from '@ainews/api-types';

/**
 * ニュースプロバイダーインターフェース
 */
export interface NewsProvider {
  /**
   * プロバイダー名
   */
  name: string;

  /**
   * ニュース記事を取得する
   *
   * @param options - 取得オプション
   * @returns 記事の配列
   */
  fetchArticles(options?: FetchOptions): Promise<Partial<Article>[]>;
}

/**
 * 記事取得オプション
 */
export interface FetchOptions {
  /**
   * 取得する記事の最大数
   */
  limit?: number;

  /**
   * カテゴリフィルター
   */
  category?: string;

  /**
   * 言語フィルター（ISO 639-1コード）
   */
  language?: string;

  /**
   * 検索キーワード
   */
  query?: string;

  /**
   * ページ番号（ページネーション用）
   */
  page?: number;
}
