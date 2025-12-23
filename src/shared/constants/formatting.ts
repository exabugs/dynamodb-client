/**
 * フォーマット関連の定数
 *
 * 数値や文字列のフォーマットに関する共通定数
 */

/**
 * 数値フォーマット設定
 */
export const NUMBER_FORMAT = {
  /** シャドウSKで使用する数値の桁数（20桁ゼロ埋め） */
  SHADOW_SK_DIGITS: 20,
  /** ゼロ埋め文字 */
  ZERO_PAD_CHAR: '0',
} as const;