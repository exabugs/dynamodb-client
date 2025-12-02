/**
 * サーバーサイドシャドウ設定管理（簡素化版）
 *
 * シャドー設定を環境変数から読み込み、グローバル変数にキャッシュします。
 * JSON設定ファイルは廃止され、環境変数のみで管理されます。
 *
 * キャッシュの動作:
 * - 初回呼び出し時: 環境変数から読み込んでキャッシュ
 * - 2回目以降: キャッシュから即座に取得
 * - キャッシュ有効期間: Lambda実行環境が存在する間（通常15分〜数時間）
 *
 * 設定変更の反映:
 * - Terraformで環境変数を変更
 * - Lambda関数が自動的に再デプロイされ、新しい設定が反映される
 *
 * 要件: 2.9-2.11
 */

/**
 * シャドー設定（簡素化版）
 */
export interface ShadowConfig {
  /** タイムスタンプフィールド名 */
  createdAtField: string;
  updatedAtField: string;
  /** プリミティブ型の最大バイト数（array/objectは2倍） */
  stringMaxBytes: number;
  /** 数値のパディング桁数 */
  numberPadding: number;
}

/**
 * グローバル変数にキャッシュ（Lambda実行環境で再利用）
 */
let cachedShadowConfig: ShadowConfig | null = null;

/**
 * シャドー設定を取得（環境変数から）
 *
 * 環境変数から設定を読み込み、グローバル変数にキャッシュします。
 * 初回呼び出し時のみ環境変数を読み込み、以降はキャッシュを使用。
 *
 * @returns シャドー設定
 * @throws 環境変数が不正な値の場合
 *
 * @example
 * ```typescript
 * const config = getShadowConfig();
 * // => { createdAtField: 'createdAt', updatedAtField: 'updatedAt', stringMaxBytes: 100, numberPadding: 20 }
 * ```
 */
export function getShadowConfig(): ShadowConfig {
  if (!cachedShadowConfig) {
    cachedShadowConfig = {
      createdAtField: process.env.SHADOW_CREATED_AT_FIELD || 'createdAt',
      updatedAtField: process.env.SHADOW_UPDATED_AT_FIELD || 'updatedAt',
      stringMaxBytes: parseInt(process.env.SHADOW_STRING_MAX_BYTES || '100', 10),
      numberPadding: parseInt(process.env.SHADOW_NUMBER_PADDING || '15', 10),
    };

    // バリデーション
    if (cachedShadowConfig.stringMaxBytes <= 0) {
      throw new Error('SHADOW_STRING_MAX_BYTES must be positive');
    }
    if (cachedShadowConfig.numberPadding <= 0 || cachedShadowConfig.numberPadding > 15) {
      throw new Error('SHADOW_NUMBER_PADDING must be between 1 and 15');
    }
  }

  return cachedShadowConfig;
}

/**
 * キャッシュをクリアする（テスト用）
 *
 * 本番環境では使用しないこと。
 * テスト環境でのみ、テスト間でキャッシュをクリアするために使用。
 */
export function clearShadowConfigCache(): void {
  cachedShadowConfig = null;
}
