/**
 * insertOne 操作
 * 単一レコードを作成する
 *
 * 要件: 4.1, 4.2, 5.2, 5.3
 */
import { PutCommand } from '@aws-sdk/lib-dynamodb';

import {
  createLogger,
  generateShadowRecords,
  getResourceSchema,
  getShadowConfig,
  ulid,
} from '../../index.js';
import { getSchemaVersion, getShadowConfigHash } from '../shadow/config.js';
import { generateMainRecordSK } from '../shadow/index.js';
import type { InsertOneParams, InsertOneResult } from '../types.js';
import {
  executeDynamoDBOperation,
  getDBClient,
  getTableName,
  removeShadowKeys,
} from '../utils/dynamodb.js';
import { addCreateTimestamps } from '../utils/timestamps.js';
import { addTTL } from '../utils/ttl.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * insertOne 操作を実行する
 *
 * 処理フロー:
 * 1. ULIDを生成してレコードIDを作成
 * 2. createdAt, updatedAtタイムスタンプを追加
 * 3. シャドー設定を読み込み、全シャドーSKを生成
 * 4. メインレコードをPutItemで保存
 * 5. シャドーレコードをPutItemで保存
 *
 * @param resource - リソース名
 * @param params - insertOneパラメータ
 * @param requestId - リクエストID
 * @returns 作成されたレコード
 */
export async function handleInsertOne(
  resource: string,
  params: InsertOneParams,
  requestId: string
): Promise<InsertOneResult> {
  logger.debug('Executing insertOne', {
    requestId,
    resource,
  });

  const dbClient = getDBClient();
  const tableName = getTableName();

  // IDを決定（指定されていればそれを使用、なければULIDを生成）
  const id = (params.data.id as string | undefined) || ulid();

  // レコードデータを構築（id、タイムスタンプ、TTLを追加）
  let recordData: Record<string, unknown> = addCreateTimestamps({
    ...params.data,
    id,
  });

  // TTLを追加（リソースに応じて）
  recordData = addTTL(resource, recordData);

  // 設定メタデータを追加（要件: 11.12）
  recordData.__configVersion = getSchemaVersion();
  recordData.__configHash = getShadowConfigHash();

  // シャドー設定を取得（環境変数からキャッシュ付き）
  const shadowConfig = getShadowConfig();
  const shadowSchema = getResourceSchema(shadowConfig, resource);

  // シャドーレコードを生成
  const shadowRecords = generateShadowRecords(recordData, shadowSchema);
  const shadowKeys = shadowRecords.map((shadow) => shadow.SK);

  // メインレコードのSKを生成
  const mainSK = generateMainRecordSK(id);

  // メインレコードを保存（__shadowKeysを含む）
  await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: resource,
            SK: mainSK,
            data: {
              ...recordData,
              __shadowKeys: shadowKeys,
            },
          },
        })
      ),
    'PutItem'
  );

  // シャドーレコードを保存
  for (const shadowRecord of shadowRecords) {
    await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new PutCommand({
            TableName: tableName,
            Item: shadowRecord,
          })
        ),
      'PutItem'
    );
  }

  logger.info('insertOne succeeded', {
    requestId,
    resource,
    id,
    shadowCount: shadowKeys.length,
  });

  // __shadowKeysを除外してレスポンスを返す
  return removeShadowKeys(recordData);
}
