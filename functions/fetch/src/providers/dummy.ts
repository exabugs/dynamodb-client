/**
 * ダミーニュースプロバイダー
 *
 * テスト用のダミーデータを生成する
 * 将来的には、実際のニュースプロバイダー（APITube、GNews、NewsAPIなど）に置き換える
 */
import type { Article } from '@ainews/api-types';

import type { FetchOptions, NewsProvider } from './types.js';

/**
 * ダミーニュースプロバイダー
 */
export class DummyNewsProvider implements NewsProvider {
  name = 'dummy';

  /**
   * ダミーニュース記事を生成する
   */
  async fetchArticles(options?: FetchOptions): Promise<Partial<Article>[]> {
    const limit = options?.limit || 1;
    const category = options?.category || 'tech';
    const now = new Date().toISOString();

    const articles: Partial<Article>[] = [];

    for (let i = 0; i < limit; i++) {
      articles.push({
        name: `Dummy Article ${Date.now()}-${i}`,
        category,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      });
    }

    return articles;
  }
}
