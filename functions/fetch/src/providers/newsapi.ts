/**
 * NewsAPIプロバイダー
 *
 * NewsAPI (https://newsapi.org/) を使用してニュース記事を取得する
 *
 * APIエンドポイント: https://newsapi.org/v2/top-headlines
 * 認証: X-Api-Key ヘッダー
 * レート制限: 無料プラン 100リクエスト/日
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

import type { Article } from '@ainews/api-types';

import { log } from '../config.js';
import { generateCanonicalId } from '../utils/canonicalId.js';
import type { FetchOptions, NewsProvider } from './types.js';

/**
 * NewsAPIレスポンス型
 */
interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

/**
 * NewsAPIエラー
 */
export class NewsAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'NewsAPIError';
  }
}

/**
 * NewsAPIプロバイダー実装
 */
export class NewsAPIProvider implements NewsProvider {
  name = 'newsapi';
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new NewsAPIError('API key is required', 'API_KEY_MISSING');
    }

    this.apiKey = apiKey;

    // Axiosクライアント初期化
    this.client = axios.create({
      baseURL: 'https://newsapi.org/v2',
      timeout: 30000, // 30秒
      headers: {
        'X-Api-Key': this.apiKey,
        'User-Agent': 'ainews-fetch/1.0',
      },
    });

    // リトライ設定（429エラー時）
    axiosRetry(this.client, {
      retries: 5,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // 429（レート制限）またはネットワークエラーの場合リトライ
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429
        );
      },
      onRetry: (retryCount, error) => {
        log('warn', 'Retrying NewsAPI request', {
          retryCount,
          error: error.message,
          status: error.response?.status,
        });
      },
    });
  }

  /**
   * ニュース記事を取得する
   */
  async fetchArticles(options?: FetchOptions): Promise<Partial<Article>[]> {
    const limit = options?.limit || 20;
    const category = options?.category;
    const language = options?.language || 'en';
    const query = options?.query;
    const page = options?.page || 1;

    log('info', 'Fetching articles from NewsAPI', {
      limit,
      category,
      language,
      query,
      page,
    });

    try {
      // top-headlines APIエンドポイント
      const response = await this.client.get<NewsAPIResponse>('/top-headlines', {
        params: {
          language,
          category,
          q: query,
          pageSize: Math.min(limit, 100), // NewsAPIの最大値は100
          page,
        },
      });

      const articles = response.data.articles || [];

      log('info', 'NewsAPI articles fetched successfully', {
        count: articles.length,
        totalResults: response.data.totalResults,
      });

      // Article型に変換
      return articles.map((article) => this.normalizeArticle(article));
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * NewsAPI記事をArticle型に正規化する
   */
  private normalizeArticle(article: NewsAPIArticle): Partial<Article> {
    const now = new Date().toISOString();

    // カテゴリの推定（タイトルやソース名から）
    const category = this.inferCategory(article);

    // canonical ID生成（URL優先、タイトルフォールバック）
    // id = canonical_id として使用することで、同じ記事は常に同じIDを持つ
    const id = generateCanonicalId(article.url, article.title);

    return {
      id, // canonical_idをidとして使用
      name: article.title || 'Untitled',
      category,
      status: 'draft', // 初期状態はdraft
      provider: 'newsapi',
      description: article.description || undefined,
      url: article.url,
      imageUrl: article.urlToImage || undefined,
      publishedAt: article.publishedAt || now,
      language: undefined, // NewsAPIはレスポンスに言語情報を含まない
      sourceName: article.source?.name || undefined,
      sourceUrl: undefined, // NewsAPIはソースURLを提供しない
      createdAt: article.publishedAt || now,
      updatedAt: now,
    };
  }

  /**
   * カテゴリを推定する
   *
   * NewsAPIのtop-headlinesはカテゴリパラメータを受け取るが、
   * レスポンスにはカテゴリ情報が含まれないため、推定する
   */
  private inferCategory(article: NewsAPIArticle): string {
    const title = (article.title || '').toLowerCase();
    const source = (article.source?.name || '').toLowerCase();

    // キーワードベースの簡易カテゴリ推定
    if (title.includes('tech') || title.includes('ai') || source.includes('tech')) {
      return 'tech';
    }
    if (title.includes('business') || title.includes('economy') || source.includes('business')) {
      return 'business';
    }
    if (title.includes('health') || title.includes('medical') || source.includes('health')) {
      return 'health';
    }
    if (title.includes('science') || source.includes('science')) {
      return 'science';
    }
    if (title.includes('sports') || source.includes('sports')) {
      return 'sports';
    }

    // デフォルト
    return 'general';
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      log('error', 'NewsAPI request failed', {
        status,
        message,
        code: error.code,
      });

      // HTTPステータスコードに応じたエラー処理
      switch (status) {
        case 401:
          throw new NewsAPIError('Invalid API key', 'UNAUTHORIZED', 401);
        case 429:
          throw new NewsAPIError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
        case 500:
        case 502:
        case 503:
          throw new NewsAPIError('NewsAPI server error', 'SERVER_ERROR', status);
        default:
          throw new NewsAPIError(`NewsAPI request failed: ${message}`, 'REQUEST_FAILED', status);
      }
    }

    // ネットワークエラーまたはその他のエラー
    log('error', 'Unexpected error in NewsAPI provider', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new NewsAPIError('Unexpected error occurred', 'UNKNOWN_ERROR');
  }
}
