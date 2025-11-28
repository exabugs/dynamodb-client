/**
 * APITubeプロバイダー
 *
 * APITube API (https://apitube.io/) を使用してニュース記事を取得する
 *
 * APIエンドポイント: https://api.apitube.io/v1/news/everything
 * 認証: api_key クエリパラメータ
 * レート制限: プランに応じて異なる
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

import type { Article } from '@ainews/api-types';

import { log } from '../config.js';
import { generateCanonicalId } from '../utils/canonicalId.js';
import type { FetchOptions, NewsProvider } from './types.js';

/**
 * APITubeレスポンス型
 */
interface APITubeResponse {
  data?: APITubeArticle[];
  articles?: APITubeArticle[]; // フォールバック
}

interface APITubeArticle {
  id?: string | number;
  title: string;
  description?: string;
  url: string;
  image?: string;
  published_at?: string;
  created_at?: string;
  source?: {
    name?: string;
    url?: string;
  };
  language?: {
    code?: string;
  };
}

/**
 * APITubeエラー
 */
export class APITubeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'APITubeError';
  }
}

/**
 * APITubeプロバイダー実装
 */
export class APITubeProvider implements NewsProvider {
  name = 'apitube';
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new APITubeError('API key is required', 'API_KEY_MISSING');
    }

    this.apiKey = apiKey;

    // Axiosクライアント初期化
    this.client = axios.create({
      baseURL: 'https://api.apitube.io/v1',
      timeout: 30000, // 30秒
      headers: {
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
        log('warn', 'Retrying APITube request', {
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
    const language = options?.language;
    const query = options?.query;
    const page = options?.page || 1;

    log('info', 'Fetching articles from APITube', {
      limit,
      language,
      query,
      page,
    });

    try {
      // everything APIエンドポイント
      const params: Record<string, any> = {
        api_key: this.apiKey,
        per_page: Math.min(limit, 100), // 安全のため最大100に制限
        page,
      };

      if (language) {
        params['language.code'] = language;
      }

      if (query) {
        params['q'] = query;
      }

      const response = await this.client.get<APITubeResponse>('/news/everything', {
        params,
      });

      // レスポンスから記事を取得（dataまたはarticlesフィールド）
      const articles = response.data.data || response.data.articles || [];

      log('info', 'APITube articles fetched successfully', {
        count: articles.length,
      });

      // Article型に変換
      return articles.map((article) => this.normalizeArticle(article));
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * APITube記事をArticle型に正規化する
   */
  private normalizeArticle(article: APITubeArticle): Partial<Article> {
    const now = new Date().toISOString();

    // カテゴリの推定（タイトルやソース名から）
    const category = this.inferCategory(article);

    // canonical ID生成（URL優先、タイトルフォールバック）
    // APITubeは独自のIDを持つが、canonical_idを優先
    const id = generateCanonicalId(article.url, article.title);

    return {
      id, // canonical_idをidとして使用
      name: article.title || 'Untitled',
      category,
      status: 'draft', // 初期状態はdraft
      provider: 'apitube',
      description: article.description || undefined,
      url: article.url,
      imageUrl: article.image || undefined,
      publishedAt: article.published_at || article.created_at || now,
      language: article.language?.code || undefined,
      sourceName: article.source?.name || undefined,
      sourceUrl: article.source?.url || undefined,
      createdAt: article.published_at || article.created_at || now,
      updatedAt: now,
    };
  }

  /**
   * カテゴリを推定する
   */
  private inferCategory(article: APITubeArticle): string {
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

      log('error', 'APITube request failed', {
        status,
        message,
        code: error.code,
      });

      // HTTPステータスコードに応じたエラー処理
      switch (status) {
        case 401:
        case 403:
          throw new APITubeError('Invalid API key', 'UNAUTHORIZED', status);
        case 429:
          throw new APITubeError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
        case 500:
        case 502:
        case 503:
          throw new APITubeError('APITube server error', 'SERVER_ERROR', status);
        default:
          throw new APITubeError(`APITube request failed: ${message}`, 'REQUEST_FAILED', status);
      }
    }

    // ネットワークエラーまたはその他のエラー
    log('error', 'Unexpected error in APITube provider', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new APITubeError('Unexpected error occurred', 'UNKNOWN_ERROR');
  }
}
