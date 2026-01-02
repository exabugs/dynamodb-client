/**
 * $near演算子を使用した近隣検索の実装
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

import { DEFAULT_GEOHASH_CONFIG, type NearQuery } from '../../../shared/geohash/index.js';
import { createLogger } from '../../../shared/index.js';
import { executeNearSearch } from '../../query/nearSearch.js';
import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
} from '../../utils/dynamodb.js';
import type { FindResult } from './types.js';

const logger = createLogger({
  service: 'near-query',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * $near検索を実行する
 *
 * @param resource - リソース名
 * @param fieldName - 地理座標フィールド名
 * @param nearQuery - $nearクエリ
 * @param limit - 取得件数
 * @param requestId - リクエストID
 * @returns 検索結果
 */
export async function executeNearQuery(
  resource: string,
  fieldName: string,
  nearQuery: NearQuery,
  limit: number,
  requestId: string
): Promise<FindResult> {
  logger.debug('Executing $near query', {
    requestId,
    resource,
    fieldName,
    nearQuery,
    limit,
  });

  // DynamoDBから検索する関数
  const searchFunction = async (geohashPrefix: string): Promise<Record<string, unknown>[]> => {
    const dbClient = getDBClient();
    const tableName = getTableName();

    logger.debug('Searching shadow records', {
      requestId,
      resource,
      fieldName,
      geohashPrefix,
      skPrefix: `${fieldName}#${geohashPrefix}`,
    });

    // シャドウレコードを検索
    // SKプレフィックス: location#<geohash>
    // 完全なSK: location#<geohash>#id#<venue-id>
    const queryResult = await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': resource,
              ':skPrefix': `${fieldName}#${geohashPrefix}`,
            },
            ConsistentRead: false, // シャドウレコードは結果整合性で十分
          })
        ),
      'Query'
    );

    const shadowRecords = queryResult.Items || [];

    logger.debug('Shadow records found', {
      requestId,
      resource,
      geohashPrefix,
      count: shadowRecords.length,
    });

    // 本体レコードのIDを抽出
    // 完全なSK: location#<geohash>#id#<venue-id>
    // #id#で分割して venue-id を取得
    const mainRecordIds = shadowRecords
      .map((item) => {
        const sk = item.SK as string;
        // location#xn74rnmx#id#venue-001 → venue-001
        const parts = sk.split('#id#');
        return parts.length === 2 ? parts[1] : null;
      })
      .filter((id): id is string => id !== null);

    logger.debug('Main record IDs extracted', {
      requestId,
      resource,
      geohashPrefix,
      ids: mainRecordIds,
    });

    // 本体レコードを取得
    // PK: venues, SK: id#<venue-id>
    const mainRecords = await Promise.all(
      mainRecordIds.map(async (id) => {
        const result = await executeDynamoDBOperation(
          () =>
            dbClient.send(
              new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :pk AND SK = :sk',
                ExpressionAttributeValues: {
                  ':pk': resource, // venues
                  ':sk': `id#${id}`,
                },
                ConsistentRead: true,
              })
            ),
          'Query'
        );
        return result.Items?.[0];
      })
    );

    const validRecords = mainRecords.filter(
      (item): item is Record<string, unknown> => item !== undefined
    );

    logger.debug('Main records retrieved', {
      requestId,
      resource,
      geohashPrefix,
      count: validRecords.length,
    });

    // data属性からレコードを抽出し、__shadowKeysを除外
    // 本体レコードは { PK, SK, data: { ...actual fields } } という構造
    const cleanRecords = validRecords.map((record) => {
      logger.debug('Before extractCleanRecord', {
        requestId,
        resource,
        recordKeys: Object.keys(record),
        hasData: 'data' in record,
      });

      const clean = extractCleanRecord(record);

      logger.debug('After extractCleanRecord', {
        requestId,
        resource,
        cleanKeys: Object.keys(clean),
        hasLocation: 'location' in clean,
      });

      return clean;
    });

    logger.debug('Clean records extracted', {
      requestId,
      resource,
      geohashPrefix,
      count: cleanRecords.length,
      sampleKeys: cleanRecords[0] ? Object.keys(cleanRecords[0]) : [],
    });

    return cleanRecords;
  };

  // 9ブロック検索を実行
  const result = await executeNearSearch(
    nearQuery,
    fieldName,
    limit,
    searchFunction,
    DEFAULT_GEOHASH_CONFIG
  );

  // searchFunctionが既にクリーンなレコード（data属性から抽出済み）を返しているので、
  // そのまま使用する
  const items = result.documents;

  logger.info('$near query succeeded', {
    requestId,
    resource,
    fieldName,
    count: items.length,
    iterations: result.metadata.iterations,
    candidatesFound: result.metadata.candidatesFound,
  });

  return {
    items,
    pageInfo: {
      hasNextPage: false, // $near検索はページネーション非対応
      hasPreviousPage: false,
    },
  };
}
