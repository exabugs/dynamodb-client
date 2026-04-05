/**
 * スキーマ型定義（クエリプランナーへのヒント）
 */

/**
 * リソーススキーマ
 *
 * フィールドのカーディナリティ（値の種類数）を指定することで、
 * フィルタ検索時にどのシャドウインデックスを優先するかを制御できます。
 *
 * カーディナリティが高い（値の種類が多い）フィールドは選択性が高く、
 * フィルタ優先クエリに適しています。
 *
 * @example
 * ```typescript
 * {
 *   cardinality: {
 *     prefecture: 47,  // 47都道府県 → 選択性高 → フィルタ優先に適する
 *     status: 3,       // active/inactive/pending → 選択性低
 *   }
 * }
 * ```
 */
export interface ResourceSchema {
  /** フィールドのカーディナリティ（値の種類数） */
  cardinality?: Record<string, number>;
}

/**
 * スキーマ設定（リソース名 → スキーマ）
 */
export type SchemaConfig = Record<string, ResourceSchema>;
