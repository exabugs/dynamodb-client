/**
 * GNewsプロバイダー
 *
 * GNews API (https://gnews.io/) を使用してニュース記事を取得する
 *
 * APIエンドポイント: https://gnews.io/api/v4/top-headlines
 * 認証: X-Api-Key ヘッダー
 * レート制限: プランに応じて異なる
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

import type { Article } from '@ainews/api-types';

import { log } from '../config.js';
import { generateCanonicalId } from '../utils/canonicalId.js';
import type { FetchOptions, NewsProvider } from './types.js';

/**
 * GNewsレスポンス型
 */
interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

/**
 * GNewsエラー
 */
export class GNewsError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GNewsError';
  }
}

/**
 * GNewsプロバイダー実装
 */
export class GNewsProvider implements NewsProvider {
  name = 'gnews';
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new GNewsError('API key is required', 'API_KEY_MISSING');
    }

    this.apiKey = apiKey;

    // Axiosクライアント初期化
    this.client = axios.create({
      baseURL: 'https://gnews.io/api/v4',
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
        log('warn', 'Retrying GNews request', {
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

    log('info', 'Fetching articles from GNews', {
      limit,
      category,
      language,
      query,
      page,
    });

    try {
      // top-headlines APIエンドポイント
      const response = await this.client.get<GNewsResponse>('/top-headlines', {
        params: {
          lang: language,
          topic: category, // GNewsは"topic"パラメータを使用
          q: query,
          max: Math.min(limit, 100), // GNewsの最大値は100
          page,
        },
      });

      const articles = response.data.articles || [];

      log('info', 'GNews articles fetched successfully', {
        count: articles.length,
        totalArticles: response.data.totalArticles,
      });

      // Article型に変換
      return articles.map((article) => this.normalizeArticle(article));
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * GNews記事をArticle型に正規化する
   */
  private normalizeArticle(article: GNewsArticle): Partial<Article> {
    const now = new Date().toISOString();

    // カテゴリの推定（タイトルやソース名から）
    const category = this.inferCategory(article);

    // canonical ID生成（URL優先、タイトルフォールバック）
    const id = generateCanonicalId(article.url, article.title);

    return {
      id, // canonical_idをidとして使用
      name: article.title || 'Untitled',
      category,
      status: 'draft', // 初期状態はdraft
      provider: 'gnews',
      description: article.description || undefined,
      url: article.url,
      imageUrl: article.image || undefined,
      publishedAt: article.publishedAt || now,
      language: undefined, // GNewsはレスポンスに言語情報を含まない（リクエストパラメータのみ）
      sourceName: article.source?.name || undefined,
      sourceUrl: article.source?.url || undefined,
      createdAt: article.publishedAt || now,
      updatedAt: now,
    };
  }

  /**
   * カテゴリを推定する
   */
  private inferCategory(article: GNewsArticle): string {
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

      log('error', 'GNews request failed', {
        status,
        message,
        code: error.code,
      });

      // HTTPステータスコードに応じたエラー処理
      switch (status) {
        case 401:
        case 403:
          throw new GNewsError('Invalid API key', 'UNAUTHORIZED', status);
        case 429:
          throw new GNewsError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
        case 500:
        case 502:
        case 503:
          throw new GNewsError('GNews server error', 'SERVER_ERROR', status);
        default:
          throw new GNewsError(`GNews request failed: ${message}`, 'REQUEST_FAILED', status);
      }
    }

    // ネットワークエラーまたはその他のエラー
    log('error', 'Unexpected error in GNews provider', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new GNewsError('Unexpected error occurred', 'UNKNOWN_ERROR');
  }
}
