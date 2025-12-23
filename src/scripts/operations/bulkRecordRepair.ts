/**
 * 一括レコード修復処理
 *
 * 全レコードをスキャンして修復する
 */
import type { Collection } from '../../client/index.iam.js';
import {
  checkShadowIntegrity,
  displayRepairSummary,
  repairRecordViaDynamoClient,
  waitForRateLimit,
  type RepairStats,
} from '../utils/repairUtils.js';

/**
 * 全レコードをスキャンして修復
 *
 * @param collection - DynamoClientのコレクション
 * @param dryRun - ドライランモード（trueの場合は実際の修復は行わない）
 */
export async function repairAllRecords<TAuthOptions = unknown>(
  collection: Collection<{ id: string; [key: string]: unknown }, TAuthOptions>,
  dryRun: boolean
): Promise<void> {
  const stats: RepairStats = {
    scanned: 0,
    needsRepair: 0,
    repaired: 0,
    failed: 0,
    errors: [],
  };

  console.log(`\n=== Scanning all records ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'REPAIR'}`);

  // 全レコードを取得
  const records = await fetchAllRecords(collection);
  console.log(`Found ${records.length} records`);

  // 各レコードを処理
  for (const mainRecord of records) {
    await processRecord(mainRecord, stats, dryRun, collection);
  }

  // 統計情報を表示
  displayRepairSummary(stats);
}

/**
 * 全レコードを取得
 *
 * @param collection - DynamoClientのコレクション
 * @returns 全レコードの配列
 */
async function fetchAllRecords<TAuthOptions = unknown>(
  collection: Collection<{ id: string; [key: string]: unknown }, TAuthOptions>
): Promise<Array<{ id: string; [key: string]: unknown }>> {
  const cursor = collection.find({});
  return await cursor.toArray();
}

/**
 * 単一レコードを処理
 *
 * @param mainRecord - 処理対象のレコード
 * @param stats - 修復統計情報
 * @param dryRun - ドライランモード
 * @param collection - DynamoClientのコレクション
 */
async function processRecord<TAuthOptions = unknown>(
  mainRecord: { id: string; [key: string]: unknown },
  stats: RepairStats,
  dryRun: boolean,
  collection: Collection<{ id: string; [key: string]: unknown }, TAuthOptions>
): Promise<void> {
  stats.scanned++;
  const recordId = mainRecord.id;

  try {
    const { needsRepair, missingShadows, extraShadows } = await checkShadowIntegrity();

    if (needsRepair) {
      stats.needsRepair++;
      console.log(
        `\n[${stats.scanned}] Record ${recordId}: Missing=${missingShadows}, Extra=${extraShadows}`
      );

      if (!dryRun) {
        await repairRecordViaDynamoClient(collection, recordId);
        stats.repaired++;
        console.log(`  ✓ Repaired`);

        // レート制限を避けるため少し待機
        await waitForRateLimit();
      }
    }
  } catch (error: any) {
    stats.failed++;
    stats.errors.push({ id: recordId, error: error.message });
    console.error(`  ✗ Failed: ${error.message}`);
  }
}