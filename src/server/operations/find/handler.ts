/**
 * Find操作のメインハンドラー
 * 
 * 429行の大きなhandleFind関数を単一責任の原則に従って分割したメインエントリーポイント
 */

import { createLogger } from '../../../shared/index.js';
import { validateSortField } from '../../utils/validation.js';

import type { FindParams, FindResult } from './types.js';
import { initializeFindConfig, normalizeFindParams } from './utils.js';
import { executeIdQuery } from './idQuery.js';
import { executeShadowQuery } from './shadowQuery.js';

const logger = createLogger({
  service: 'find-handler',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * Find操作のメインハンドラー
 * 
 * 責任:
 * - パラメータの初期化と正規化
 * - クエリタイプの判定（ID最適化 vs シャドウクエリ）
 * - 適切なクエリ実行関数への委譲
 * 
 * @param resource リソース名
 * @param params 検索パラメータ
 * @param requestId リクエストID
 * @returns 検索結果
 */
export async function handleFind(
  resource: string,
  params: FindParams,
  requestId: string
): Promise<FindResult> {
  logger.debug('Executing find', {
    requestId,
    resource,
    params,
  });

  // 設定とパラメータの初期化
  const config = initializeFindConfig();
  const normalizedParams = normalizeFindParams(config, resource, params);

  // ソートフィールドを検証
  validateSortField(config, resource, normalizedParams.sort);

  logger.debug('Find parameters normalized', {
    requestId,
    resource,
    sort: normalizedParams.sort,
    pagination: normalizedParams.pagination,
    filterCount: normalizedParams.parsedFilters.length,
  });

  // sort.field='id'の場合は本体レコードを直接クエリする（最適化）
  if (normalizedParams.sort.field === 'id') {
    return executeIdQuery(resource, normalizedParams, requestId);
  }

  // 通常のシャドーレコードクエリ
  return executeShadowQuery(resource, normalizedParams, requestId);
}