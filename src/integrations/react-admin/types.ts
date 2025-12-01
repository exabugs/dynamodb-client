/**
 * react-admin統合の型定義
 */

/**
 * トークンプロバイダーインターフェース
 *
 * 認証トークンを取得するための抽象化インターフェース。
 * プロジェクト固有の認証ロジックを注入できます。
 *
 * @example
 * ```typescript
 * // Cognito認証の例
 * const cognitoTokenProvider: TokenProvider = {
 *   getToken: async () => {
 *     const session = await Auth.currentSession();
 *     return session.getIdToken().getJwtToken();
 *   },
 * };
 * ```
 */
export interface TokenProvider {
  /**
   * 認証トークンを取得
   *
   * @returns 認証トークン（JWT、Bearer tokenなど）
   * @throws トークンが取得できない場合はエラーをスロー
   */
  getToken(): Promise<string>;
}

/**
 * DataProviderオプション
 */
export interface DataProviderOptions {
  /** Records Lambda Function URL */
  apiUrl: string;

  /** トークンプロバイダー */
  tokenProvider: TokenProvider;

  /** デフォルトのページサイズ（オプション、デフォルト: 25） */
  defaultPerPage?: number;

  /** デフォルトのソートフィールド（オプション、デフォルト: 'id'） */
  defaultSortField?: string;

  /** デフォルトのソート順（オプション、デフォルト: 'ASC'） */
  defaultSortOrder?: 'ASC' | 'DESC';
}
