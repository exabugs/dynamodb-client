import { DEFAULT_HTTP_TIMEOUT_MS } from '../shared/constants/http.js';
import type { Filter, FindOptions } from '../shared/index.js';
import type { AuthHeadersGetter } from './Collection.js';
import type { ClientOptions } from './DynamoClient.js';

/**
 * FindCursor
 *
 * MongoDB風のカーソルAPIを提供します。
 * メソッドチェーンでソート、制限、スキップを設定し、
 * toArray()で結果を取得します。
 *
 * @template TSchema - ドキュメント型
 *
 * @example
 * ```typescript
 * const results = await products
 *   .find({ status: 'active', price: { gte: 1000 } })
 *   .sort({ price: 'desc', createdAt: 'asc' })
 *   .limit(10)
 *   .skip(20)
 *   .toArray();
 * ```
 */
export class FindCursor<
  TSchema extends { id: string; [key: string]: unknown } = { id: string; [key: string]: unknown },
  TAuthOptions = unknown,
> {
  private options: FindOptions;
  private executed: boolean = false;
  private results: TSchema[] = [];
  private pageInfo?: { hasNextPage: boolean; hasPreviousPage: boolean; nextToken?: string };

  /**
   * FindCursorを作成
   *
   * @param endpoint - Lambda Function URL
   * @param collectionName - コレクション名
   * @param filter - フィルタ条件
   * @param options - 検索オプション
   * @param authToken - 認証トークン
   * @param authOptions - 認証オプション
   * @param clientOptions - クライアントオプション
   * @param getAuthHeaders - 認証ヘッダー取得関数
   */
  constructor(
    private endpoint: string,
    private collectionName: string,
    private filter: Filter<TSchema>,
    options: FindOptions = {},
    private authToken?: string,
    private authOptions?: TAuthOptions,
    private clientOptions?: ClientOptions,
    private getAuthHeaders?: AuthHeadersGetter<TAuthOptions>
  ) {
    this.options = { ...options };
  }

  /**
   * ソート条件を設定
   *
   * 複数のフィールドでソートする場合、オブジェクトのキー順序でソート優先度が決まります。
   * 1または'asc'で昇順、-1または'desc'で降順を指定します。
   *
   * @param sort - ソート条件（例: { price: 'desc', createdAt: 'asc' }）
   * @returns this（メソッドチェーン用）
   *
   * @example
   * ```typescript
   * // 価格の降順でソート
   * cursor.sort({ price: 'desc' });
   *
   * // 複数フィールドでソート
   * cursor.sort({ priority: 'desc', createdAt: 'asc' });
   *
   * // 数値形式でも指定可能
   * cursor.sort({ price: -1, createdAt: 1 });
   * ```
   */
  sort(sort: Record<string, 1 | -1 | 'asc' | 'desc'>): this {
    this.options = { ...this.options, sort };
    return this;
  }

  /**
   * 取得件数を制限
   *
   * 返されるドキュメントの最大数を設定します。
   * ページネーション実装時にskip()と組み合わせて使用します。
   *
   * @param limit - 取得件数（正の整数）
   * @returns this（メソッドチェーン用）
   *
   * @example
   * ```typescript
   * // 最初の10件を取得
   * cursor.limit(10);
   *
   * // ページネーション（2ページ目、1ページ10件）
   * cursor.skip(10).limit(10);
   * ```
   */
  limit(limit: number): this {
    this.options = { ...this.options, limit };
    return this;
  }

  /**
   * スキップする件数を設定
   *
   * 指定した件数のドキュメントをスキップします。
   * ページネーション実装時にlimit()と組み合わせて使用します。
   *
   * @param skip - スキップする件数（0以上の整数）
   * @returns this（メソッドチェーン用）
   *
   * @example
   * ```typescript
   * // 最初の20件をスキップ
   * cursor.skip(20);
   *
   * // ページネーション（3ページ目、1ページ10件）
   * cursor.skip(20).limit(10);
   * ```
   */
  skip(skip: number): this {
    this.options = { ...this.options, skip };
    return this;
  }

  /**
   * クエリを実行（内部使用）
   *
   * Lambda Function URLにHTTPリクエストを送信し、結果を取得します。
   * 一度実行されたクエリは再実行されません（結果がキャッシュされます）。
   */
  private async execute(): Promise<void> {
    if (this.executed) {
      return;
    }

    const requestBody = JSON.stringify({
      operation: 'find',
      collection: this.collectionName,
      params: {
        filter: this.filter,
        options: {
          ...this.options,
        },
      },
    });

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 認証ヘッダーを追加（注入された関数を使用）
    if (this.getAuthHeaders) {
      const authHeaders = await this.getAuthHeaders(this.endpoint, requestBody, this.authOptions);
      headers = { ...headers, ...authHeaders };
    }

    // 後方互換性: authTokenが直接指定されている場合（非推奨）
    if (this.authToken && !this.authOptions) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // タイムアウト設定
    const controller = new AbortController();
    const timeout = this.clientOptions?.timeout || DEFAULT_HTTP_TIMEOUT_MS; // デフォルト30秒
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = (await response.json().catch(() => ({ message: response.statusText }))) as {
          message?: string;
        };
        throw new Error(`Request failed: ${error.message || response.statusText}`);
      }

      const result = (await response.json()) as {
        data?: {
          items?: TSchema[];
          documents?: TSchema[];
          pageInfo?: {
            hasNextPage: boolean;
            hasPreviousPage: boolean;
          };
          nextToken?: string;
        };
      };
      // Lambda からのレスポンス: { success: true, data: { items: [...], pageInfo: {...}, nextToken?: string } }
      this.results = result.data?.items || result.data?.documents || [];
      this.pageInfo = result.data?.pageInfo
        ? {
            hasNextPage: result.data.pageInfo.hasNextPage,
            hasPreviousPage: result.data.pageInfo.hasPreviousPage,
            nextToken: result.data.nextToken, // nextTokenはpageInfoの外にある
          }
        : undefined;
      this.executed = true;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // タイムアウトエラーの場合
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * 配列として取得
   *
   * クエリを実行し、結果をドキュメントの配列として返します。
   * このメソッドを呼び出すまで、実際のHTTPリクエストは送信されません。
   *
   * @returns ドキュメントの配列
   *
   * @example
   * ```typescript
   * const results = await products
   *   .find({ status: 'active' })
   *   .sort({ price: 'desc' })
   *   .limit(10)
   *   .toArray();
   *
   * console.log(`Found ${results.length} products`);
   * results.forEach(product => {
   *   console.log(product.name, product.price);
   * });
   * ```
   */
  async toArray(): Promise<TSchema[]> {
    if (!this.executed) {
      await this.execute();
    }
    return this.results;
  }

  /**
   * ページネーション情報を取得
   *
   * クエリを実行し、ページネーション情報を返します。
   * 無限スクロールやカーソルベースのページネーションに使用します。
   *
   * @returns ページネーション情報
   *
   * @example
   * ```typescript
   * const cursor = products
   *   .find({ status: 'active' })
   *   .sort({ price: 'desc' })
   *   .limit(10);
   *
   * const results = await cursor.toArray();
   * const pageInfo = await cursor.getPageInfo();
   *
   * console.log(`Has next page: ${pageInfo.hasNextPage}`);
   * console.log(`Next token: ${pageInfo.nextToken}`);
   * ```
   */
  async getPageInfo(): Promise<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextToken?: string;
  }> {
    if (!this.executed) {
      await this.execute();
    }
    return (
      this.pageInfo || {
        hasNextPage: false,
        hasPreviousPage: false,
      }
    );
  }
}
