/**
 * シャドーレコード修復ユーティリティ
 *
 * 修復処理で使用する共通ロジック
 */
import type { Collection } from '../../client/index.iam.js';

/**
 * 修復統計情報
 */
export interface RepairStats {
  scanned: number;
  needsRepair: number;
  repaired: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * シャドー整合性チェック結果
 */
export interface ShadowIntegrityResult {
  needsRepair: boolean;
  missingShadows: number;
  extraShadows: number;
}

/**
 * 本体レコードのシャドーキーと実際のシャドーレコードを比較
 *
 * 注: Records Lambdaは__shadowKeysをHTTPレスポンスから除外するため、
 * このスクリプトでは__shadowKeysの有無を確認できません。
 * そのため、すべてのレコードを修復対象とします。
 */
export async function checkShadowIntegrity(): Promise<ShadowIntegrityResult> {
  // Records Lambdaは__shadowKeysを除外するため、常に修復対象とする
  return {
    needsRepair: true,
    missingShadows: 0,
    extraShadows: 0,
  };
}

/**
 * DynamoClient（IAM認証）を使用してシャドーを再生成
 *
 * @param collection - DynamoClientのコレクション
 * @param recordId - レコードID
 */
export async function repairRecordViaDynamoClient<TAuthOptions = unknown>(
  collection: Collection<{ id: string; [key: string]: unknown }, TAuthOptions>,
  recordId: string
): Promise<void> {
  // updateOneを呼び出すと、Records Lambdaと同じロジックでシャドーレコードが再生成される
  await collection.updateOne({ id: recordId }, { set: { updatedAt: new Date().toISOString() } });
}

/**
 * 修復統計情報を表示する
 *
 * @param stats - 修復統計情報
 */
export function displayRepairSummary(stats: RepairStats): void {
  console.log('\n=== Repair Summary ===');
  console.log(`Scanned: ${stats.scanned}`);
  console.log(`Needs repair: ${stats.needsRepair}`);
  console.log(`Repaired: ${stats.repaired}`);
  console.log(`Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(({ id, error }) => {
      console.log(`  - ${id}: ${error}`);
    });
  }
}

/**
 * レート制限を避けるための待機
 *
 * @param ms - 待機時間（ミリ秒）
 */
export async function waitForRateLimit(ms: number = 100): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}