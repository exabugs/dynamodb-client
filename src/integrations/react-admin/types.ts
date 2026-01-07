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

/**
 * ReferenceManyToManyField プロパティ
 *
 * 多対多関係を表示するためのフィールドコンポーネント。
 * 中間テーブルを経由して関連レコードを取得し、子コンポーネントに渡します。
 *
 * @example
 * ```typescript
 * <ReferenceManyToManyField
 *   reference="users"
 *   through="venueManagers"
 *   using="venueId,userId"
 *   label="管理者"
 * >
 *   <Datagrid>
 *     <TextField source="nickname" />
 *   </Datagrid>
 * </ReferenceManyToManyField>
 * ```
 */
export interface ReferenceManyToManyFieldProps {
  /** ターゲットリソース名（例: 'users'） */
  reference: string;

  /** 中間テーブル名（例: 'venueManagers'） */
  through: string;

  /** キーのペア（例: 'venueId,userId'） */
  using: string;

  /** 起点フィールド名（デフォルト: 'id'） */
  source?: string;

  /** 子コンポーネント（例: <Datagrid>） */
  children: React.ReactElement;

  /** ラベル */
  label?: string;

  /** ソート設定 */
  sort?: { field: string; order: 'ASC' | 'DESC' };

  /** ページサイズ */
  perPage?: number;
}

/**
 * ReferenceManyToManyInput プロパティ
 *
 * 多対多関係を編集するための入力コンポーネント。
 * 中間テーブルを経由して関連レコードを追加・削除します。
 *
 * @example
 * ```typescript
 * <ReferenceManyToManyInput
 *   reference="users"
 *   through="venueManagers"
 *   using="venueId,userId"
 *   label="管理者"
 * >
 *   <AutocompleteArrayInput optionText="nickname" />
 * </ReferenceManyToManyInput>
 * ```
 *
 * @example
 * ```typescript
 * // filterを使用した例
 * <ReferenceManyToManyInput
 *   reference="venues"
 *   through="venueManagers"
 *   using="userId,venueId"
 *   label="管理会場"
 *   filter={{ location: { $near: { latitude: 35.6, longitude: 139.7 } } }}
 * >
 *   <AutocompleteArrayInput optionText="name" />
 * </ReferenceManyToManyInput>
 * ```
 */
export interface ReferenceManyToManyInputProps {
  /** ターゲットリソース名（例: 'users'） */
  reference: string;

  /** 中間テーブル名（例: 'venueManagers'） */
  through: string;

  /** キーのペア（例: 'venueId,userId'） */
  using: string;

  /** 起点フィールド名（デフォルト: 'id'） */
  source?: string;

  /** 子コンポーネント（例: <AutocompleteArrayInput>） */
  children: React.ReactElement;

  /** ラベル */
  label?: string;

  /** 常に適用されるフィルタ（オプション） */
  filter?: Record<string, unknown>;
}
