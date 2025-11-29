/**
 * find 操作
 * リスト取得（フィルター・ソート・ページネーション対応）
 *
 * 要件: 4.3, 5.4, 5.5, 12.1-12.12
 */
import { BatchGetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { ConfigError, createLogger, getResourceSchema, getShadowConfig } from '../../index.js';
import type { ShadowConfig } from '../shadow/index.js';
import type { FindParams, FindResult } from '../types.js';
import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
} from '../utils/dynamodb.js';
import {
  type ParsedFilterField,
  findOptimizableFilter,
  matchesAllFilters,
  parseFilterField,
} from '../utils/filter.js';
import { decodeNextToken, encodeNextToken } from '../utils/pagination.js';
import { normalizePagination, normalizeSort, validateSortField } from '../utils/validation.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * find 操作を実行する
 *
 * 処理フロー:
 * 1. シャドー設定を読み込み、ソートフィールドを検証
 * 2. シャドーレコードをQueryで取得（ソート済み）
 * 3. 本体レコードをBatchGetItemで取得
 * 4. フィルター条件を適用
 * 5. ページネーション情報を生成してレスポンスを返す
 *
 * @param resource - リソース名
 * @param params - findパラメータ
 * @param requestId - リクエストID
 * @returns リストデータ
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

  // シャドー設定を取得（環境変数からキャッシュ付き）
  const shadowConfig = getShadowConfig();

  logger.debug('Shadow config loaded', {
    requestId,
    resource,
    hasResources: !!shadowConfig.resources,
    resourceNames: Object.keys(shadowConfig.resources || {}),
  });

  // ソート条件を正規化（デフォルト値を適用）
  logger.debug('Normalizing sort', {
    requestId,
    resource,
    inputSort: params.sort,
  });

  const sort = normalizeSort(shadowConfig as ShadowConfig, resource, params.sort);

  logger.debug('Sort normalized', {
    requestId,
    resource,
    sort,
  });

  // ソートフィールドを検証
  validateSortField(shadowConfig as ShadowConfig, resource, sort);

  // ページネーション条件を正規化
  const { perPage, nextToken } = normalizePagination(params.pagination);

  // フィルター条件をパース（拡張フィールド構文対応）
  // 要件: 12.1, 12.3, 12.4
  const parsedFilters: Array<{ parsed: ParsedFilterField; value: unknown }> = [];
  if (params.filter && Object.keys(params.filter).length > 0) {
    for (const [fieldKey, value] of Object.entries(params.filter)) {
      try {
        const parsed = parseFilterField(fieldKey);
        parsedFilters.push({ parsed, value });
      } catch (error) {
        logger.error('Invalid filter field syntax', {
          requestId,
          fieldKey,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new ConfigError(`Invalid filter field syntax: ${fieldKey}`, {
          field: fieldKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const dbClient = getDBClient();
  const tableName = getTableName();

  // sort.field='id'の場合は本体レコードを直接クエリする（最適化）
  // idフィールドは本体レコード（SK = id#{ULID}）として既に存在するため、
  // 別途シャドーレコードを参照する必要がない
  if (sort.field === 'id') {
    // filter.idが指定されている場合は、特定のIDのレコードを取得
    const idFilter = parsedFilters.find((f) => f.parsed.field === 'id');

    if (idFilter && idFilter.parsed.operator === 'eq') {
      // 特定のIDのレコードを取得（GetItemの代わりにQueryを使用）
      const targetId = String(idFilter.value);
      const queryResult = await executeDynamoDBOperation(
        () =>
          dbClient.send(
            new QueryCommand({
              TableName: tableName,
              KeyConditionExpression: 'PK = :pk AND SK = :sk',
              ExpressionAttributeValues: {
                ':pk': resource,
                ':sk': `id#${targetId}`,
              },
              ConsistentRead: true,
            })
          ),
        'Query'
      );

      const mainRecords = queryResult.Items || [];

      // クリーンなレコードに変換
      const items = mainRecords.map((item) => extractCleanRecord(item));

      logger.info('find succeeded (id sort optimization with filter)', {
        requestId,
        resource,
        count: items.length,
        hasNextPage: false,
      });

      return {
        items,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    // filter.idが指定されていない場合は、全レコードを取得
    // ExclusiveStartKeyの設定（nextTokenがある場合）
    let exclusiveStartKey: Record<string, string> | undefined;
    if (nextToken) {
      const decoded = decodeNextToken(nextToken);
      exclusiveStartKey = {
        PK: decoded.PK,
        SK: decoded.SK,
      };
    }

    // 本体レコードを直接Queryで取得
    const queryResult = await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': resource,
              ':skPrefix': 'id#',
            },
            ScanIndexForward: sort.order === 'ASC', // ASC: true, DESC: false
            Limit: perPage,
            ExclusiveStartKey: exclusiveStartKey,
            ConsistentRead: true,
          })
        ),
      'Query'
    );

    const mainRecords = queryResult.Items || [];

    // 本体レコードが0件の場合は空レスポンスを返す
    if (mainRecords.length === 0) {
      return {
        items: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    // クリーンなレコードに変換
    let items = mainRecords.map((item) => extractCleanRecord(item));

    // フィルター条件を適用（メモリ内フィルタリング）
    // 要件: 12.6, 12.9
    if (parsedFilters.length > 0) {
      items = items.filter((record) => matchesAllFilters(record, parsedFilters));
    }

    // ページネーション情報を生成
    // DynamoDBのクエリ結果がperPage件未満の場合、次のページは確実にない
    // クエリ結果がperPage件ちょうどの場合、LastEvaluatedKeyがあれば次のページがある可能性がある
    const hasNextPage =
      mainRecords.length < perPage ? false : queryResult.LastEvaluatedKey !== undefined;
    const nextTokenValue =
      hasNextPage && queryResult.LastEvaluatedKey
        ? encodeNextToken(
            queryResult.LastEvaluatedKey.PK as string,
            queryResult.LastEvaluatedKey.SK as string
          )
        : undefined;

    logger.info('find succeeded (id sort optimization)', {
      requestId,
      resource,
      count: items.length,
      hasNextPage,
    });

    return {
      items,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!nextToken,
      },
      ...(nextTokenValue && { nextToken: nextTokenValue }),
    };
  }

  // 通常のシャドーレコードクエリ（sort.field != 'id'の場合）
  // シャドーフィールドの型情報を取得
  const shadowSchema = getResourceSchema(shadowConfig, resource);
  const sortFieldType = shadowSchema.sortableFields[sort.field]?.type;

  if (!sortFieldType) {
    throw new ConfigError(`Sort field type not found: ${sort.field}`, {
      field: sort.field,
      resource,
    });
  }

  // Query最適化: ソートフィールドと一致するフィルター条件を検出
  // 要件: 12.7
  const optimizableFilter = findOptimizableFilter(sort.field, parsedFilters);

  // シャドーSKのプレフィックスを生成
  const skPrefix = `${sort.field}#`;

  // ExclusiveStartKeyの設定（nextTokenがある場合）
  let exclusiveStartKey: Record<string, string> | undefined;
  if (nextToken) {
    const decoded = decodeNextToken(nextToken);
    exclusiveStartKey = {
      PK: decoded.PK,
      SK: decoded.SK,
    };
  }

  // KeyConditionExpressionを構築（Query最適化を適用）
  let keyConditionExpression: string;
  const expressionAttributeValues: Record<string, unknown> = {
    ':pk': resource,
  };

  if (optimizableFilter) {
    // 最適化あり: ソートフィールドのフィルター条件をKeyConditionExpressionに含める
    const { operator, type } = optimizableFilter.parsed;
    const value = optimizableFilter.value;

    // 値をシャドーSK形式にエンコード（簡易実装）
    let encodedValue: string;
    if (type === 'number') {
      encodedValue = String(value).padStart(20, '0');
    } else if (type === 'date') {
      encodedValue = new Date(String(value)).toISOString();
    } else if (type === 'boolean') {
      encodedValue = String(value);
    } else {
      // string型: エスケープ処理（# → ##、スペース → #）
      encodedValue = String(value).replace(/#/g, '##').replace(/ /g, '#');
    }

    // SK形式: {field}#{encodedValue}#id#{recordId}
    const skValue = `${sort.field}#${encodedValue}`;

    switch (operator) {
      case 'eq':
        // 完全一致: {field}#{value}#id# で始まるレコードを取得
        keyConditionExpression = 'PK = :pk AND begins_with(SK, :skValue)';
        expressionAttributeValues[':skValue'] = `${skValue}#id#`;
        break;
      case 'gt':
        // より大きい: {field}#{value}#id#~ より大きいSKを取得
        // ~ は # の次の文字なので、{field}#{value}#id#{任意のID} より大きくなる
        keyConditionExpression = 'PK = :pk AND SK > :skValue';
        expressionAttributeValues[':skValue'] = `${skValue}#id#~`;
        break;
      case 'gte':
        // 以上: {field}#{value}#id# 以上のSKを取得
        keyConditionExpression = 'PK = :pk AND SK >= :skValue';
        expressionAttributeValues[':skValue'] = `${skValue}#id#`;
        break;
      case 'lt':
        // より小さい: {field}#{value}#id# より小さいSKを取得
        keyConditionExpression = 'PK = :pk AND SK < :skValue';
        expressionAttributeValues[':skValue'] = `${skValue}#id#`;
        break;
      case 'lte':
        // 以下: {field}#{value}#id#~ 以下のSKを取得
        keyConditionExpression = 'PK = :pk AND SK <= :skValue';
        expressionAttributeValues[':skValue'] = `${skValue}#id#~`;
        break;
      case 'starts':
        // 前方一致: {field}#{value} で始まるSKを取得
        keyConditionExpression = 'PK = :pk AND begins_with(SK, :skValue)';
        expressionAttributeValues[':skValue'] = `${skValue}`;
        break;
      default:
        // フォールバック: 前方一致のみ
        keyConditionExpression = 'PK = :pk AND begins_with(SK, :skPrefix)';
        expressionAttributeValues[':skPrefix'] = skPrefix;
    }

    logger.debug('Query optimization applied', {
      requestId,
      sortField: sort.field,
      operator,
      type,
      value,
      skValue,
    });
  } else {
    // 最適化なし: 前方一致のみ
    keyConditionExpression = 'PK = :pk AND begins_with(SK, :skPrefix)';
    expressionAttributeValues[':skPrefix'] = skPrefix;
  }

  // シャドーレコードをQueryで取得
  const queryResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: keyConditionExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ScanIndexForward: sort.order === 'ASC', // ASC: true, DESC: false
          Limit: perPage,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
        })
      ),
    'Query'
  );

  const shadowItems = queryResult.Items || [];

  // シャドーレコードが0件の場合は空レスポンスを返す
  if (shadowItems.length === 0) {
    return {
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  // シャドーSKからレコードIDを抽出
  const recordIds = shadowItems.map((item) => {
    const sk = item.SK as string;
    // SK形式: {field}#{value}#id#{recordId}
    const parts = sk.split('#id#');
    return parts[parts.length - 1];
  });

  // 重複を除去（同じレコードに対して複数のシャドーレコードが存在する場合）
  const uniqueRecordIds = Array.from(new Set(recordIds));

  // 本体レコードをBatchGetItemで取得
  const batchGetResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: uniqueRecordIds.map((id) => ({
                PK: resource,
                SK: `id#${id}`,
              })),
              ConsistentRead: true,
            },
          },
        })
      ),
    'BatchGetItem'
  );

  const mainRecords = batchGetResult.Responses?.[tableName] || [];

  // IDでマッピングを作成（順序を保持するため）
  const recordMap = new Map(
    mainRecords.map((item) => {
      const data = item.data as Record<string, unknown>;
      return [data.id as string, extractCleanRecord(item)];
    })
  );

  // シャドーの順序でレコードを並べる（重複を除去）
  // 元のrecordIdsの順序を保持しつつ、重複を除去する
  const seenIds = new Set<string>();
  let items = recordIds
    .filter((id) => {
      if (seenIds.has(id)) {
        return false; // 既に処理済みのIDはスキップ
      }
      seenIds.add(id);
      return true;
    })
    .map((id) => recordMap.get(id))
    .filter((record): record is Record<string, unknown> => record !== undefined);

  // フィルター条件を適用（メモリ内フィルタリング）
  // 要件: 12.6, 12.9, 12.11
  // Query 最適化はあくまで候補を絞り込むためのもので、完全なフィルタリングではない
  // （例: starts オペレーターは SK の前方一致だが、値の途中にマッチする可能性がある）
  // そのため、すべてのフィルター条件をメモリ内で再適用する
  if (parsedFilters.length > 0) {
    const itemsBeforeFilter = items.length;
    items = items.filter((record) => matchesAllFilters(record, parsedFilters));

    logger.debug('Memory filtering applied', {
      requestId,
      filtersCount: parsedFilters.length,
      itemsBeforeFilter,
      itemsAfterFilter: items.length,
      filtered: itemsBeforeFilter - items.length,
    });
  }

  // ページネーション情報を生成
  // DynamoDBのクエリ結果がperPage件未満の場合、次のページは確実にない
  // クエリ結果がperPage件ちょうどの場合、LastEvaluatedKeyがあれば次のページがある可能性がある
  // （フィルタリング後のitemsが少なくても、次のページにフィルタリング後のデータがある可能性がある）
  const hasNextPage =
    shadowItems.length < perPage ? false : queryResult.LastEvaluatedKey !== undefined;
  const nextTokenValue =
    hasNextPage && queryResult.LastEvaluatedKey
      ? encodeNextToken(
          queryResult.LastEvaluatedKey.PK as string,
          queryResult.LastEvaluatedKey.SK as string
        )
      : undefined;

  logger.info('find succeeded', {
    requestId,
    resource,
    count: items.length,
    hasNextPage,
  });

  return {
    items,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!nextToken,
    },
    ...(nextTokenValue && { nextToken: nextTokenValue }),
  };
}
