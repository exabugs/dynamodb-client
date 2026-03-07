/**
 * updateMany 操作
 * 複数レコードを一括更新する（JSON Merge Patch形式）
 *
 * 要件: 4.2, 4.4, 5.2, 5.3, 7.4, 13.1, 13.2, 13.3, 13.8, 13.12
 */
import { BatchGetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import { ErrorCode, createLogger, ulid } from '../../shared/index.js';
import { generateShadowRecords, getShadowConfig } from '../shadow/index.js';
import { calculateShadowDiff, generateMainRecordSK } from '../shadow/index.js';
import type { OperationError, UpdateManyParams, UpdateManyResult } from '../types.js';
import {
  calculateTimeoutRisk,
  logBulkOperationComplete,
  logLargeBatchWarning,
  logPartialFailure,
  logPreparationTimeoutRisk,
} from '../utils/bulkOperations.js';
import { calculateChunks, executeChunks } from '../utils/chunking.js';
import { CostTracker } from '../utils/cost-tracker.js';
import {
  executeDynamoDBOperation,
  getDBClient,
  getTableName,
  removeShadowKeys,
} from '../utils/dynamodb.js';
import { addUpdateTimestamp } from '../utils/timestamps.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * 準備済み更新レコードデータ（チャンク分割用）
 */
interface PreparedUpdateRecord {
  /** レコードID */
  id: string;
  /** 更新後の完全なレコードデータ */
  updatedData: Record<string, unknown>;
  /** 旧シャドーSK配列 */
  oldShadowKeys: string[];
  /** 新シャドーSK配列 */
  newShadowKeys: string[];
  /** メインレコードSK */
  mainSK: string;
}

/**
 * ドット記法のキーをネストされたオブジェクトに変換する
 *
 * 例: { "settings.locationEnabled": true } → { settings: { locationEnabled: true } }
 *
 * @param patch - パッチオブジェクト（ドット記法を含む可能性がある）
 * @returns ネストされたオブジェクト
 */
function expandDotNotation(patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (key.includes('.')) {
      // ドット記法の場合、ネストされたオブジェクトに変換
      const keys = key.split('.');
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in current)) {
          current[k] = {};
        } else if (typeof current[k] !== 'object' || Array.isArray(current[k])) {
          // 既存の値がオブジェクトでない場合は上書き
          current[k] = {};
        }
        current = current[k] as Record<string, unknown>;
      }

      // 最後のキーに値を設定
      const lastKey = keys[keys.length - 1];
      current[lastKey] = value;
    } else {
      // ドット記法でない場合はそのまま設定
      result[key] = value;
    }
  }

  return result;
}

/**
 * JSON Merge Patch (RFC 7396) を適用する
 *
 * ドット記法のサポート:
 * - "settings.locationEnabled" のようなドット記法を自動的にネストされたオブジェクトに変換
 * - 例: { "settings.locationEnabled": true } → { settings: { locationEnabled: true } }
 *
 * @param target - 対象オブジェクト
 * @param patch - パッチオブジェクト（ドット記法を含む可能性がある）
 * @returns マージされたオブジェクト
 */
function applyJsonMergePatch(
  target: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  // ドット記法をネストされたオブジェクトに変換
  const expandedPatch = expandDotNotation(patch);

  const result = { ...target };

  for (const [key, value] of Object.entries(expandedPatch)) {
    if (value === null) {
      delete result[key];
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = applyJsonMergePatch(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * updateMany 操作を実行する
 *
 * 処理フロー:
 * 1. idsまたはfilterから対象レコードを特定
 * 2. BatchGetItemで既存レコードを取得
 * 3. 各レコードにJSON Merge Patchを適用
 * 4. updatedAtタイムスタンプを更新
 * 5. 新しいシャドーSKを生成し、差分を計算
 * 6. アイテム数を計算してチャンク分割（1 + 削除シャドー数 + 追加シャドー数）
 * 7. 各チャンクをTransactWriteItemsで順次実行
 * 8. 部分失敗をハンドリング
 *
 * upsertオプション:
 * - upsert: true の場合、存在しないレコードは新規作成される
 * - $setOnInsert オペレーターは初回作成時のみ適用される
 *
 * @param resource - リソース名
 * @param params - updateManyパラメータ
 * @param requestId - リクエストID
 * @returns 更新結果（成功レコード、失敗ID、エラー情報）
 */
export async function handleUpdateMany(
  resource: string,
  params: UpdateManyParams,
  requestId: string
): Promise<UpdateManyResult> {
  const { data: patchData, options } = params;
  const upsert = options?.upsert ?? false;
  const startTime = Date.now();
  const costTracker = new CostTracker();

  logger.debug('Executing updateMany', {
    requestId,
    resource,
    upsert,
  });

  // idsまたはfilterから対象レコードIDリストを取得
  let ids: string[];

  if ('ids' in params) {
    // idsが指定されている場合
    ids = params.ids;

    logger.debug('Executing updateMany with ids', {
      requestId,
      resource,
      count: ids.length,
    });
  } else {
    // filterが指定されている場合
    logger.debug('Executing updateMany with filter', {
      requestId,
      resource,
      filter: params.filter,
    });

    // filterで検索（find操作を使用）
    const { handleFind } = await import('./find.js');
    const findResult = await handleFind(resource, { filter: params.filter }, requestId);

    ids = findResult.items.map((item) => item.id as string);

    logger.debug('Found records with filter', {
      requestId,
      resource,
      count: ids.length,
    });

    // filter版でレコードが見つからない場合
    if (ids.length === 0) {
      if (upsert) {
        // upsert: true の場合、新規レコードを作成
        // 新しいIDを生成
        const newId = ulid();
        ids = [newId];

        logger.info('Creating new record with filter (upsert: true)', {
          requestId,
          resource,
          newId,
          filter: params.filter,
        });

        // filterの条件を$setOnInsertにマージ
        // これにより、filterで指定されたフィールドが新規レコードに含まれる
        if (patchData.$setOnInsert) {
          patchData.$setOnInsert = {
            ...params.filter,
            ...patchData.$setOnInsert,
          };
        } else if (patchData.$set) {
          // $setOnInsertがない場合は、filterを$setOnInsertとして追加
          patchData.$setOnInsert = params.filter;
        } else {
          // $setも$setOnInsertもない場合は、filterを$setOnInsertとして追加
          patchData.$setOnInsert = params.filter;
        }
      } else {
        // upsert: false の場合は空レスポンスを返す
        return {
          count: 0,
          successIds: {},
          failedIds: {},
          errors: {},
          consumedCapacity: costTracker.getAggregated(),
        };
      }
    }
  }

  // 大量レコード処理時の警告ログ出力（要件: 13.12）
  logLargeBatchWarning('updateMany', ids.length, requestId, resource);

  const dbClient = getDBClient();
  const tableName = getTableName();

  // BatchGetItemで既存レコードを取得
  const keys = ids.map((id) => ({
    PK: resource,
    SK: generateMainRecordSK(id),
  }));

  const batchGetResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: keys,
              ConsistentRead: true,
            },
          },
          ReturnConsumedCapacity: 'TOTAL',
        })
      ),
    'BatchGetItem'
  );

  // コスト情報を収集
  if (Array.isArray(batchGetResult.ConsumedCapacity)) {
    for (const capacity of batchGetResult.ConsumedCapacity) {
      costTracker.add(capacity);
    }
  } else {
    costTracker.add(batchGetResult.ConsumedCapacity);
  }

  const existingItems = batchGetResult.Responses?.[tableName] || [];

  // 存在するレコードのIDセットを作成
  const existingIds = new Set(
    existingItems.map((item) => {
      const data = item.data as Record<string, unknown>;
      return data.id as string;
    })
  );

  // 存在しないIDを特定
  const notFoundIds = ids.filter((id) => !existingIds.has(id));

  // upsert: false の場合、存在しないIDはエラーとして扱う
  if (!upsert && notFoundIds.length > 0) {
    logger.warn('Records not found (upsert: false)', {
      requestId,
      resource,
      notFoundCount: notFoundIds.length,
      notFoundIds: notFoundIds.slice(0, 10), // 最初の10件のみログ
    });
  }

  // upsert: true の場合、存在しないIDに対して新規レコードを作成
  if (upsert && notFoundIds.length > 0) {
    logger.info('Creating new records (upsert: true)', {
      requestId,
      resource,
      notFoundCount: notFoundIds.length,
      notFoundIds: notFoundIds.slice(0, 10), // 最初の10件のみログ
    });
  }

  // シャドー設定を取得（環境変数からキャッシュ付き）
  const shadowConfig = getShadowConfig();

  const preparedRecords: PreparedUpdateRecord[] = [];
  const preparationFailedIds: string[] = [];
  const preparationErrors: OperationError[] = [];

  // 既存レコードを準備
  for (const item of existingItems) {
    try {
      const existingData = item.data as Record<string, unknown>;
      const id = existingData.id as string;
      // 新構造（トップレベル）→ 旧構造（data内）の順でフォールバック
      const oldShadowKeys = ((item.__shadowKeys ?? existingData.__shadowKeys) as string[]) ?? [];

      // UpdateOperators形式の場合、$set のみを抽出（$setOnInsert は無視）
      const actualPatchData = patchData.$set
        ? (patchData.$set as Record<string, unknown>)
        : patchData;

      // JSON Merge Patchを適用
      const mergedData = applyJsonMergePatch(removeShadowKeys(existingData), actualPatchData);

      // updatedAt を更新（タイムスタンプフィールド名は動的に取得）
      const updatedData: Record<string, unknown> = addUpdateTimestamp({
        ...mergedData,
        id,
      });

      // 新しいシャドーレコードを生成（自動フィールド検出）
      const newShadowRecords = generateShadowRecords(updatedData, resource, shadowConfig);
      const newShadowKeys = newShadowRecords.map((shadow) => shadow.SK);

      // メインレコードのSKを生成
      const mainSK = generateMainRecordSK(id);

      preparedRecords.push({
        id,
        updatedData,
        oldShadowKeys,
        newShadowKeys,
        mainSK,
      });
    } catch (error) {
      // 準備段階で失敗したレコードを記録
      const existingData = item.data as Record<string, unknown>;
      const failedId = (existingData.id as string) || 'unknown-id';
      const errorMessage = error instanceof Error ? error.message : 'Unknown preparation error';
      const errorCode = getPreparationErrorCode(error);

      logger.error('Failed to prepare record for update', {
        requestId,
        recordId: failedId,
        error: errorMessage,
        errorCode,
      });

      // 準備失敗をエラーリストに追加
      preparationFailedIds.push(failedId);
      preparationErrors.push({
        id: failedId,
        code: errorCode,
        message: errorMessage,
      });
    }
  }

  // upsert: true の場合、存在しないIDに対して新規レコードを作成
  if (upsert && notFoundIds.length > 0) {
    // タイムスタンプヘルパーをインポート
    const { addCreateTimestamps } = await import('../utils/timestamps.js');

    for (const id of notFoundIds) {
      try {
        // $setと$setOnInsertをマージ（$setが優先）
        const setData = patchData.$set ? (patchData.$set as Record<string, unknown>) : patchData;
        const setOnInsertData = patchData.$setOnInsert
          ? (patchData.$setOnInsert as Record<string, unknown>)
          : {};

        // $setOnInsertを先に適用し、その後$setで上書き
        const mergedData = {
          ...setOnInsertData,
          ...setData,
          id,
        };

        // createdAtとupdatedAtを追加
        const newData: Record<string, unknown> = addCreateTimestamps(mergedData);

        // 新しいシャドーレコードを生成
        const newShadowRecords = generateShadowRecords(newData, resource, shadowConfig);
        const newShadowKeys = newShadowRecords.map((shadow) => shadow.SK);

        // メインレコードのSKを生成
        const mainSK = generateMainRecordSK(id);

        preparedRecords.push({
          id,
          updatedData: newData,
          oldShadowKeys: [], // 新規作成なので空
          newShadowKeys,
          mainSK,
        });
      } catch (error) {
        // 準備段階で失敗したレコードを記録
        const errorMessage = error instanceof Error ? error.message : 'Unknown preparation error';
        const errorCode = getPreparationErrorCode(error);

        logger.error('Failed to prepare new record for upsert', {
          requestId,
          recordId: id,
          error: errorMessage,
          errorCode,
        });

        // 準備失敗をエラーリストに追加
        preparationFailedIds.push(id);
        preparationErrors.push({
          id,
          code: errorCode,
          message: errorMessage,
        });
      }
    }
  }

  // アイテム数計算関数（1 + 削除シャドー数 + 追加シャドー数）
  const getItemCount = (record: PreparedUpdateRecord): number => {
    const shadowDiff = calculateShadowDiff(record.oldShadowKeys, record.newShadowKeys);
    return 1 + shadowDiff.toDelete.length + shadowDiff.toAdd.length;
  };

  // チャンク分割
  const { chunks } = calculateChunks(preparedRecords, getItemCount);

  // 準備段階の経過時間をチェック（要件: 13.12）
  const preparationRiskInfo = calculateTimeoutRisk(startTime);
  logPreparationTimeoutRisk(
    requestId,
    resource,
    preparedRecords.length,
    chunks.length,
    preparationRiskInfo
  );

  // チャンク実行関数
  const executeChunk = async (chunk: PreparedUpdateRecord[]): Promise<PreparedUpdateRecord[]> => {
    const transactItems: Array<{
      Put?: { TableName: string; Item: Record<string, unknown> };
      Delete?: { TableName: string; Key: Record<string, string> };
    }> = [];

    // チャンク内の各レコードをTransactItemsに変換
    for (const record of chunk) {
      // シャドー差分を計算
      const shadowDiff = calculateShadowDiff(record.oldShadowKeys, record.newShadowKeys);

      // メインレコードを更新
      transactItems.push({
        Put: {
          TableName: tableName,
          Item: {
            PK: resource,
            SK: record.mainSK,
            __shadowKeys: record.newShadowKeys,
            data: {
              ...record.updatedData,
            },
          },
        },
      });

      // 旧シャドーを削除
      for (const shadowSK of shadowDiff.toDelete) {
        transactItems.push({
          Delete: {
            TableName: tableName,
            Key: {
              PK: resource,
              SK: shadowSK,
            },
          },
        });
      }

      // 新シャドーを追加
      for (const shadowSK of shadowDiff.toAdd) {
        transactItems.push({
          Put: {
            TableName: tableName,
            Item: {
              PK: resource,
              SK: shadowSK,
              data: {},
            },
          },
        });
      }
    }

    // TransactWriteItemsを実行
    const result = await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new TransactWriteCommand({
            TransactItems: transactItems,
            ReturnConsumedCapacity: 'TOTAL',
          })
        ),
      'TransactWriteItems'
    );

    // コスト情報を収集（TransactWriteCommandは配列の可能性がある）
    if (Array.isArray(result.ConsumedCapacity)) {
      for (const capacity of result.ConsumedCapacity) {
        costTracker.add(capacity);
      }
    } else {
      costTracker.add(result.ConsumedCapacity);
    }

    // 成功したレコードを返す
    return chunk;
  };

  // チャンクを順次実行
  const {
    successRecords,
    failedIds: chunkFailedIds,
    errors: chunkErrors,
  } = await executeChunks(chunks, executeChunk, (record) => record.id);

  // 統一レスポンス形式を構築
  // successIds: インデックス付きオブジェクト（元の配列のインデックスとIDのマッピング）
  // items: 更新したフィールドのみを含むレコード配列（ADR 001）
  const successIds: Record<number, string> = {};
  const items: Array<Record<string, unknown>> = [];
  const failedIdsMap: Record<number, string> = {};
  const errorsMap: Record<number, OperationError> = {};

  // UpdateOperators形式の場合、$set のみを抽出（$setOnInsert は無視）
  const actualPatchData = patchData.$set ? (patchData.$set as Record<string, unknown>) : patchData;
  const setOnInsertData = patchData.$setOnInsert
    ? (patchData.$setOnInsert as Record<string, unknown>)
    : {};

  // 成功したレコードのインデックスを特定
  const successIdSet = new Set(successRecords.map((r) => r.id));
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (successIdSet.has(id)) {
      successIds[i] = id;

      // 新規作成されたレコードの場合は、$setと$setOnInsertをマージ
      if (upsert && notFoundIds.includes(id)) {
        items.push({
          id,
          ...setOnInsertData,
          ...actualPatchData,
        });
      } else {
        // 既存レコード更新の場合は、$setのみ
        items.push({
          id,
          ...actualPatchData,
        });
      }
    }
  }

  // 存在しないIDのインデックスを特定（upsert: false の場合のみ）
  if (!upsert) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (notFoundIds.includes(id)) {
        failedIdsMap[i] = id;
        errorsMap[i] = {
          id,
          code: 'ITEM_NOT_FOUND',
          message: `Record not found: ${id}`,
        };
      }
    }
  }

  // 準備失敗のインデックスを特定
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (preparationFailedIds.includes(id)) {
      failedIdsMap[i] = id;
      const error = preparationErrors.find((e) => e.id === id);
      if (error) {
        errorsMap[i] = error;
      }
    }
  }

  // チャンク実行失敗のインデックスを特定
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (chunkFailedIds.includes(id)) {
      failedIdsMap[i] = id;
      const error = chunkErrors.find((e) => e.id === id);
      if (error) {
        errorsMap[i] = {
          id: error.id,
          code: error.code,
          message: error.message,
        };
      }
    }
  }

  const count = Object.keys(successIds).length;
  const allFailedIds = Object.values(failedIdsMap);

  // 総実行時間を計算（要件: 13.12）
  const completionRiskInfo = calculateTimeoutRisk(startTime);

  logBulkOperationComplete(
    'updateMany',
    requestId,
    resource,
    ids.length,
    count,
    allFailedIds.length,
    completionRiskInfo,
    {
      updated: count,
      notFound: upsert ? 0 : notFoundIds.length, // upsert: true の場合は0
      preparationFailed: preparationFailedIds.length,
      chunkExecutionFailed: chunkFailedIds.length,
      upserted: upsert ? notFoundIds.length : 0, // upsert: true の場合は新規作成数
    }
  );

  // 部分失敗の場合、詳細なエラーサマリーをログ出力
  if (allFailedIds.length > 0) {
    logPartialFailure(
      'updateMany',
      requestId,
      resource,
      ids.length,
      count,
      allFailedIds.length,
      Object.values(errorsMap).map((e) => e.code),
      {
        notFoundCount: upsert ? 0 : notFoundIds.length, // upsert: true の場合は0
        preparationFailures: preparationFailedIds.length,
        chunkExecutionFailures: chunkFailedIds.length,
      }
    );
  }

  // 統一レスポンス形式で返却
  return {
    count,
    successIds,
    failedIds: failedIdsMap,
    errors: errorsMap,
    items, // 更新したフィールドのみを含むレコード配列（ADR 001）
    consumedCapacity: costTracker.getAggregated(),
  };
}

/**
 * 準備段階のエラーからエラーコードを抽出する
 *
 * @param error - エラーオブジェクト
 * @returns エラーコード
 */
function getPreparationErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    // カスタムエラー
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    // AWS SDK エラー
    if ('name' in error && typeof error.name === 'string') {
      return error.name;
    }
  }
  return ErrorCode.VALIDATION_ERROR;
}
