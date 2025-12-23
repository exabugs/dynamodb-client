/**
 * 単一レコード修復処理
 *
 * 指定されたIDのレコードを修復する
 */
import type { Collection } from '../../client/index.iam.js';
import {
  checkShadowIntegrity,
  repairRecordViaDynamoClient,
  type ShadowIntegrityResult,
} from '../utils/repairUtils.js';

/**
 * 単一レコードを修復
 *
 * @param collection - DynamoClientのコレクション
 * @param recordId - 修復対象のレコードID
 * @param dryRun - ドライランモード（trueの場合は実際の修復は行わない）
 */
export async function repairSingleRecord<TAuthOptions = unknown>(
  collection: Collection<{ id: string; [key: string]: unknown }, TAuthOptions>,
  recordId: string,
  dryRun: boolean
): Promise<void> {
  console.log(`\n=== Checking record: ${recordId} ===`);

  // 本体レコードを取得
  console.log(`Fetching record with id: ${recordId}`);
  const mainRecord = await collection.findOne({ id: recordId });
  console.log(`findOne result:`, mainRecord);

  if (!mainRecord) {
    console.error(`Record not found: ${recordId}`);
    return;
  }

  // 整合性チェック
  const integrityResult = await checkShadowIntegrity();
  logIntegrityResult(integrityResult);

  if (!integrityResult.needsRepair) {
    console.log('✓ No repair needed');
    return;
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would repair this record via DynamoClient.updateOne()');
    return;
  }

  // DynamoClient経由で修復
  console.log('\nRepairing via DynamoClient.updateOne() with IAM auth...');
  await repairRecordViaDynamoClient(collection, recordId);
  console.log('✓ Repaired successfully');
}

/**
 * 整合性チェック結果をログ出力
 *
 * @param result - 整合性チェック結果
 */
function logIntegrityResult(result: ShadowIntegrityResult): void {
  // Records Lambdaは__shadowKeysをレスポンスから除外するため、
  // 実際のシャドー数は確認できません
  console.log(`Missing shadows: ${result.missingShadows}`);
  console.log(`Extra shadows: ${result.extraShadows}`);
}