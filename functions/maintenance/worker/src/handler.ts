import { generateShadowRecords, getResourceSchema } from '@exabugs/dynamodb-client';
import type { ShadowConfig, ShadowRecord, ShadowSchema } from '@exabugs/dynamodb-client';
import crypto from 'crypto';

import { DynamoDBClient, ScanCommand, ScanCommandInput } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * TODO: eslint flat configとTypeScriptの統合問題
 *
 * 現在、eslint flat configでNode.jsのグローバル変数（process, console）が
 * 正しく認識されない問題があります。TypeScriptコンパイラが型チェックを
 * 行うため、no-undefルールは実質的に不要ですが、eslint設定が反映されません。
 *
 * 根本的な解決策:
 * 1. eslint v9のflat config対応を待つ
 * 2. globals パッケージの設定方法を再調査
 * 3. TypeScript ESLintの推奨設定を確認
 *
 * 参考: https://typescript-eslint.io/linting/troubleshooting/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
 */
/* eslint-disable no-undef */

/**
 * 環境変数
 */
interface EnvironmentConfig {
  ENV: string;
  REGION: string;
  TABLE_NAME: string;
  SHADOW_CONFIG: string;
}

/**
 * Lambda入力パラメータ
 */
export interface WorkerInput {
  resource: string;
  segment: number;
  totalSegments: number;
  dryRun: boolean;
  pageLimit: number;
  runId: string;
}

/**
 * Lambda出力
 */
export interface WorkerOutput {
  segment: number;
  scanned: number;
  drifted: number;
  repaired: number;
  failed: number;
  noop: number;
  errors: Array<{ id: string; code: string; message: string }>;
}

/**
 * DynamoDBレコードのデータ型
 */
interface RecordData {
  __shadowKeys?: string[];
  __configVersion?: string;
  __configHash?: string;
  [key: string]: unknown;
}

/**
 * DynamoDBレコード
 */
interface DynamoDBRecord {
  PK: string;
  SK: string;
  data?: RecordData;
}

/**
 * 設定ドリフト検出結果
 */
interface DriftDetectionResult {
  hasDrift: boolean;
  expectedShadowKeys: string[];
  actualShadowKeys: string[];
  recordConfigHash?: string;
}

/**
 * 環境変数を検証して取得する
 *
 * @returns 環境変数設定
 * @throws 必須環境変数が不足している場合
 */
function getEnvironmentConfig(): EnvironmentConfig {
  const ENV = process.env.ENV;
  const REGION = process.env.REGION || process.env.AWS_REGION;
  const TABLE_NAME = process.env.TABLE_NAME;
  const SHADOW_CONFIG = process.env.SHADOW_CONFIG;

  if (!ENV || !REGION || !TABLE_NAME || !SHADOW_CONFIG) {
    throw new Error(
      'Missing required environment variables: ENV, REGION, TABLE_NAME, SHADOW_CONFIG'
    );
  }

  return { ENV, REGION, TABLE_NAME, SHADOW_CONFIG };
}

/**
 * shadow.config.jsonの内容からSHA-256ハッシュを生成する
 *
 * @param shadowConfig - シャドー設定
 * @returns SHA-256ハッシュ（16進数文字列）
 */
function generateConfigHash(shadowConfig: ShadowConfig): string {
  const configString = JSON.stringify(shadowConfig);
  return crypto.createHash('sha256').update(configString).digest('hex');
}

/**
 * 設定ドリフトを検出する
 *
 * @param record - DynamoDBレコード
 * @param shadowSchema - シャドースキーマ
 * @param currentConfigHash - 現在の設定ハッシュ
 * @returns ドリフト検出結果
 */
function detectConfigDrift(
  record: DynamoDBRecord,
  shadowSchema: ShadowSchema,
  currentConfigHash: string
): DriftDetectionResult {
  const recordConfigHash = record.data?.__configHash;
  const actualShadowKeys = record.data?.__shadowKeys || [];

  // 期待されるシャドーキーを生成
  const expectedShadowRecords = generateShadowRecords(record.data || {}, shadowSchema);
  const expectedShadowKeys = expectedShadowRecords.map((sr: ShadowRecord) => sr.SK);

  // 設定ドリフトの判定
  let hasDrift = false;

  // 1. __configHashが存在しない（既存レコード）
  if (!recordConfigHash) {
    hasDrift = true;
  }
  // 2. __configHashが現在のハッシュと一致しない
  else if (recordConfigHash !== currentConfigHash) {
    hasDrift = true;
  }
  // 3. __shadowKeysが期待値と一致しない
  else if (
    actualShadowKeys.length !== expectedShadowKeys.length ||
    !actualShadowKeys.every((sk, i) => sk === expectedShadowKeys[i])
  ) {
    hasDrift = true;
  }

  return {
    hasDrift,
    expectedShadowKeys,
    actualShadowKeys,
    recordConfigHash,
  };
}

/**
 * シャドーレコードを修復する
 *
 * @param docClient - DynamoDB Document Client
 * @param tableName - テーブル名
 * @param record - DynamoDBレコード
 * @param expectedShadowKeys - 期待されるシャドーキー
 * @param actualShadowKeys - 実際のシャドーキー
 * @param currentConfigVersion - 現在の設定バージョン
 * @param currentConfigHash - 現在の設定ハッシュ
 * @param shadowSchema - シャドースキーマ
 */
async function repairShadowRecords(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  record: DynamoDBRecord,
  expectedShadowKeys: string[],
  actualShadowKeys: string[],
  currentConfigVersion: string,
  currentConfigHash: string,
  shadowSchema: ShadowSchema
): Promise<void> {
  interface TransactItem {
    Delete?: {
      TableName: string;
      Key: { PK: string; SK: string };
    };
    Put?: {
      TableName: string;
      Item: {
        PK: string;
        SK: string;
        data: RecordData;
      };
    };
    Update?: {
      TableName: string;
      Key: { PK: string; SK: string };
      UpdateExpression: string;
      ExpressionAttributeNames: Record<string, string>;
      ExpressionAttributeValues: Record<string, unknown>;
    };
  }

  const transactItems: TransactItem[] = [];

  // 1. 古いシャドーレコードを削除
  for (const oldSK of actualShadowKeys) {
    if (!expectedShadowKeys.includes(oldSK)) {
      transactItems.push({
        Delete: {
          TableName: tableName,
          Key: { PK: record.PK, SK: oldSK },
        },
      });
    }
  }

  // 2. 新しいシャドーレコードを作成
  const newShadowRecords = generateShadowRecords(record.data || {}, shadowSchema);

  for (const shadowRecord of newShadowRecords) {
    if (!actualShadowKeys.includes(shadowRecord.SK)) {
      transactItems.push({
        Put: {
          TableName: tableName,
          Item: {
            ...shadowRecord,
            PK: record.PK,
          },
        },
      });
    }
  }

  // 3. 本体レコードの__configVersionと__configHashを更新
  transactItems.push({
    Update: {
      TableName: tableName,
      Key: { PK: record.PK, SK: record.SK },
      UpdateExpression:
        'SET #data.#shadowKeys = :shadowKeys, #data.#configVersion = :configVersion, #data.#configHash = :configHash',
      ExpressionAttributeNames: {
        '#data': 'data',
        '#shadowKeys': '__shadowKeys',
        '#configVersion': '__configVersion',
        '#configHash': '__configHash',
      },
      ExpressionAttributeValues: {
        ':shadowKeys': expectedShadowKeys,
        ':configVersion': currentConfigVersion,
        ':configHash': currentConfigHash,
      },
    },
  });

  // TransactWriteItemsで実行（最大100アイテム）
  if (transactItems.length > 100) {
    throw new Error(`Too many transaction items: ${transactItems.length}. Maximum is 100.`);
  }

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: transactItems,
    })
  );
}

/**
 * Maintenance Worker Lambda Handler
 *
 * DynamoDBレコードを走査してシャドー整合性を検証・修復するワーカー。
 *
 * @param event - Lambda入力イベント
 * @returns 処理結果（scanned、drifted、repaired、failed、noop）
 */
export async function lambdaHandler(event: WorkerInput): Promise<WorkerOutput> {
  const startTime = Date.now();
  console.log('Maintenance Worker Lambda invoked', { event });

  try {
    // 環境変数を取得
    const config = getEnvironmentConfig();
    console.log('Environment config loaded', {
      ENV: config.ENV,
      REGION: config.REGION,
      TABLE_NAME: config.TABLE_NAME,
    });

    // シャドー設定を読み込み
    const shadowConfigJson = Buffer.from(config.SHADOW_CONFIG, 'base64').toString('utf-8');
    const shadowConfig = JSON.parse(shadowConfigJson) as ShadowConfig;
    const shadowSchema = getResourceSchema(shadowConfig, event.resource);
    const currentConfigVersion = shadowConfig.$schemaVersion;
    const currentConfigHash = generateConfigHash(shadowConfig);

    console.log('Shadow config loaded', {
      schemaVersion: currentConfigVersion,
      configHash: currentConfigHash,
    });

    // DynamoDBクライアントを作成
    const dynamoClient = new DynamoDBClient({ region: config.REGION });
    const docClient = DynamoDBDocumentClient.from(dynamoClient);

    // 統計情報
    let scanned = 0;
    let drifted = 0;
    let repaired = 0;
    let failed = 0;
    let noop = 0;
    const errors: Array<{ id: string; code: string; message: string }> = [];

    // DynamoDB Scanパラメータ
    const scanParams: ScanCommandInput = {
      TableName: config.TABLE_NAME,
      Segment: event.segment,
      TotalSegments: event.totalSegments,
      FilterExpression: 'PK = :resource AND begins_with(SK, :idPrefix)',
      ExpressionAttributeValues: {
        ':resource': { S: event.resource },
        ':idPrefix': { S: 'id#' },
      },
    };

    let pageCount = 0;
    let exclusiveStartKey:
      | Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>
      | undefined;

    // ページネーションでScan
    do {
      pageCount++;
      if (pageCount > event.pageLimit) {
        console.log('Page limit reached', { pageLimit: event.pageLimit });
        break;
      }

      const scanCommand = new ScanCommand({
        ...scanParams,
        ExclusiveStartKey: exclusiveStartKey,
      });

      const scanResult = await dynamoClient.send(scanCommand);

      if (!scanResult.Items || scanResult.Items.length === 0) {
        break;
      }

      // 各レコードを処理
      for (const item of scanResult.Items) {
        const record = unmarshall(item) as DynamoDBRecord;
        scanned++;

        try {
          // 設定ドリフトを検出
          const driftResult = detectConfigDrift(record, shadowSchema, currentConfigHash);

          if (!driftResult.hasDrift) {
            noop++;
            continue;
          }

          drifted++;

          console.log('Config drift detected', {
            id: record.SK.replace(/^id#/, ''),
            recordConfigHash: driftResult.recordConfigHash,
            currentConfigHash,
            expectedShadowKeys: driftResult.expectedShadowKeys,
            actualShadowKeys: driftResult.actualShadowKeys,
          });

          // dryRunモードの場合は修復しない
          if (event.dryRun) {
            continue;
          }

          // シャドーレコードを修復
          await repairShadowRecords(
            docClient,
            config.TABLE_NAME,
            record,
            driftResult.expectedShadowKeys,
            driftResult.actualShadowKeys,
            currentConfigVersion,
            currentConfigHash,
            shadowSchema
          );

          repaired++;
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorCode = errorMessage.includes('TransactionCanceledException')
            ? 'TRANSACTION_FAILED'
            : 'VALIDATION_ERROR';

          errors.push({
            id: record.SK.replace(/^id#/, ''),
            code: errorCode,
            message: errorMessage,
          });

          console.error('Failed to repair record', {
            id: record.SK.replace(/^id#/, ''),
            error: errorMessage,
          });
        }
      }

      exclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const duration = Date.now() - startTime;

    console.log('Maintenance Worker Lambda completed', {
      segment: event.segment,
      scanned,
      drifted,
      repaired,
      failed,
      noop,
      duration,
    });

    return {
      segment: event.segment,
      scanned,
      drifted,
      repaired,
      failed,
      noop,
      errors,
    };
  } catch (error) {
    console.error('Error in Maintenance Worker Lambda', { error });
    throw error;
  }
}
