/**
 * 共通型定義
 * 
 * プロジェクト全体で使用される型定義を集約します。
 * MongoDB風のクエリ演算子、更新演算子、結果型などを提供します。
 */

/**
 * フィルタ演算子（$プレフィックスなし）
 *
 * MongoDB風のクエリ演算子を提供します。
 * すべての演算子は$プレフィックスなしで使用します。
 */
export interface FilterOperators<T> {
  /** 等しい */
  eq?: T;
  /** 等しくない */
  ne?: T;
  /** より大きい */
  gt?: T;
  /** 以上 */
  gte?: T;
  /** より小さい */
  lt?: T;
  /** 以下 */
  lte?: T;
  /** いずれかに一致 */
  in?: T[];
  /** いずれにも一致しない */
  nin?: T[];
  /** フィールドの存在チェック */
  exists?: boolean;
  /** 正規表現マッチ */
  regex?: string | RegExp;
}

/**
 * フィルタ定義
 *
 * 型安全なフィルタ条件を定義します。
 * 各フィールドに対して直接値を指定するか、FilterOperatorsを使用できます。
 *
 * @example
 * ```typescript
 * // 直接値を指定
 * const filter: Filter<Product> = { status: 'active' };
 *
 * // 演算子を使用
 * const filter: Filter<Product> = {
 *   price: { gte: 1000, lte: 5000 },
 *   status: { in: ['active', 'pending'] }
 * };
 *
 * // 論理演算子を使用
 * const filter: Filter<Product> = {
 *   or: [
 *     { status: 'active' },
 *     { priority: { gte: 5 } }
 *   ]
 * };
 * ```
 */
export type Filter<T> = {
  [P in keyof T]?: T[P] | FilterOperators<T[P]>;
} & {
  /** AND条件（すべての条件を満たす） */
  and?: Filter<T>[];
  /** OR条件（いずれかの条件を満たす） */
  or?: Filter<T>[];
};

/**
 * 更新演算子（$プレフィックスなし）
 *
 * MongoDB風の更新演算子を提供します。
 * すべての演算子は$プレフィックスなしで使用します。
 *
 * @example
 * ```typescript
 * // フィールドを設定
 * const update: UpdateOperators<Product> = {
 *   set: { status: 'published', updatedAt: new Date().toISOString() }
 * };
 *
 * // フィールドを削除
 * const update: UpdateOperators<Product> = {
 *   unset: ['description', 'tags']
 * };
 *
 * // 数値をインクリメント
 * const update: UpdateOperators<Product> = {
 *   inc: { stock: -1, viewCount: 1 }
 * };
 *
 * // 複数の演算子を組み合わせ
 * const update: UpdateOperators<Product> = {
 *   set: { status: 'published' },
 *   inc: { viewCount: 1 },
 *   unset: ['draft']
 * };
 * ```
 */
export interface UpdateOperators<T> {
  /** フィールドを設定 */
  set?: Partial<T>;
  /** フィールドを削除 */
  unset?: (keyof T)[];
  /** 数値をインクリメント（負の値でデクリメント） */
  inc?: Partial<Record<keyof T, number>>;
}

/**
 * 検索オプション
 */
export interface FindOptions {
  /** ソート条件 */
  sort?: Record<string, 1 | -1 | 'asc' | 'desc'>;
  /** 取得件数の制限 */
  limit?: number;
  /** スキップする件数 */
  skip?: number;
  /** ページネーショントークン（カーソルベースのページネーション用） */
  nextToken?: string;
}

/**
 * 挿入結果
 */
export interface InsertOneResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** 挿入されたドキュメントのID */
  insertedId: string;
}

/**
 * 複数挿入結果
 */
export interface InsertManyResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** 挿入されたドキュメントの数 */
  insertedCount: number;
  /** 挿入されたドキュメントのIDマップ */
  insertedIds: Record<number, string>;
  /** 失敗したドキュメントのIDリスト */
  failedIds?: string[];
  /** エラー情報 */
  errors?: Array<{ id: string; code: string; message: string }>;
}

/**
 * 更新結果
 */
export interface UpdateResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** マッチしたドキュメントの数 */
  matchedCount: number;
  /** 変更されたドキュメントの数 */
  modifiedCount: number;
  /** アップサートされたドキュメントのID（存在する場合） */
  upsertedId?: string;
}

/**
 * 削除結果
 */
export interface DeleteResult {
  /** 操作が確認されたか */
  acknowledged: boolean;
  /** 削除されたドキュメントの数 */
  deletedCount: number;
}