import type { AuthHeadersGetter } from './Collection.js';
import { Database } from './Database.js';

/**
 * クライアントオプション
 *
 * @template TAuthOptions - 認証オプションの型
 */
export interface ClientOptions<TAuthOptions = unknown> {
  /** 認証設定 */
  auth?: TAuthOptions;
  /** 自動接続（デフォルト: false） */
  autoConnect?: boolean;
  /** タイムアウト（ミリ秒、デフォルト: DEFAULT_HTTP_TIMEOUT_MS） */
  timeout?: number;
}

/**
 * DynamoDBクライアント
 *
 * Lambda Function URL経由でDynamoDBにアクセスするHTTPクライアント。
 * MongoDB風のシンプルなAPIを提供します。
 *
 * @template TAuthOptions - 認証オプションの型
 */
export class DynamoClient<TAuthOptions = unknown> {
  private endpoint: string;
  private options?: ClientOptions<TAuthOptions>;
  private authToken?: string;
  private connected: boolean = false;
  private getAuthHeaders: AuthHeadersGetter<TAuthOptions>;

  /**
   * DynamoClientを作成
   *
   * @param endpoint - Lambda Function URL
   * @param options - クライアントオプション
   * @param getAuthHeaders - 認証ヘッダー取得関数
   */
  constructor(
    endpoint: string,
    options: ClientOptions<TAuthOptions> | undefined,
    getAuthHeaders: AuthHeadersGetter<TAuthOptions>
  ) {
    if (!endpoint || endpoint.trim() === '') {
      throw new Error('Endpoint cannot be empty');
    }

    this.endpoint = endpoint;
    this.options = options;
    this.getAuthHeaders = getAuthHeaders;

    if (options?.autoConnect) {
      this.connect().catch((err) => {
        console.error('Auto-connect failed:', err);
      });
    }
  }

  async connect(): Promise<void> {
    // Cognito認証の場合、トークンを取得（getToken関数が存在する場合）
    const auth = this.options?.auth as { getToken?: () => Promise<string> } | undefined;
    if (auth?.getToken) {
      this.authToken = await auth.getToken();
    }

    this.connected = true;
  }

  db(): Database<TAuthOptions> {
    if (!this.connected) {
      throw new Error(
        'Client is not connected. Please call await client.connect() before using the client. ' +
          'Alternatively, set { autoConnect: true } in the client options.'
      );
    }

    return new Database<TAuthOptions>(
      this.endpoint,
      this.authToken,
      this.options?.auth,
      this.options,
      this.getAuthHeaders
    );
  }

  async close(): Promise<void> {
    this.authToken = undefined;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
