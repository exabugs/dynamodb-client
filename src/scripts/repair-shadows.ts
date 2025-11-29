#!/usr/bin/env tsx

/**
 * シャドーレコード修復スクリプト
 *
 * DynamoClient（IAM認証）を使用してレコードを更新し、シャドーレコードを再生成します。
 *
 * 使用方法:
 *   pnpm --filter @exabugs/dynamodb-client tsx scripts/repair-shadows.ts --resource articles --dry-run
 *   pnpm --filter @exabugs/dynamodb-client tsx scripts/repair-shadows.ts --resource articles --id C8CD6F0D81B2B030696E300752 --repair
 *   pnpm --filter @exabugs/dynamodb-client tsx scripts/repair-shadows.ts --resource articles --repair
 */
import { type Collection, DynamoClient } from '../client/index.iam.js';

// 環境変数
const ENV = process.env.ENV || 'dev';
const REGION = process.env.AWS_REGION || 'us-east-1';

// Records Lambda Function URLを取得
let RECORDS_API_URL = process.env.RECORDS_API_URL || '';

interface RepairStats {
  scanned: number;
  needsRepair: number;
  repaired: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Records Lambda Function URLを取得
 */
async function getRecordsApiUrl(): Promise<string> {
  if (RECORDS_API_URL) {
    return RECORDS_API_URL;
  }

  // AWS CLIで取得
  const { execSync } = await import('child_process');
  const functionName = `ainews-${ENV}-records`;

  try {
    const output = execSync(
      `aws lambda get-function-url-config --function-name ${functionName} --region ${REGION} --query 'FunctionUrl' --output text`,
      { encoding: 'utf-8' }
    );
    RECORDS_API_URL = output.trim();
    return RECORDS_API_URL;
  } catch {
    throw new Error(`Failed to get Function URL for ${functionName}`);
  }
}

/**
 * 本体レコードのシャドーキーと実際のシャドーレコードを比較
 *
 * 注: Records Lambda は __shadowKeys を HTTP レスポンスから除外するため、
 * このスクリプトでは __shadowKeys の有無を確認できません。
 * そのため、すべてのレコードを修復対象とします。
 */
async function checkShadowIntegrity(): Promise<{
  needsRepair: boolean;
  missingShadows: number;
  extraShadows: number;
}> {
  // Records Lambda は __shadowKeys を除外するため、常に修復対象とする
  return {
    needsRepair: true,
    missingShadows: 0,
    extraShadows: 0,
  };
}

/**
 * DynamoClient（IAM認証）を使用してシャドーを再生成
 */
async function repairRecordViaDynamoClient<TAuthOptions = unknown>(
  collection: Collection<{ id: string; [key: string]: unknown }, TAuthOptions>,
  recordId: string
): Promise<void> {
  // updateOneを呼び出すと、Records Lambdaと同じロジックでシャドーレコードが再生成される
  await collection.updateOne({ id: recordId }, { set: { updatedAt: new Date().toISOString() } });
}

/**
 * 単一レコードを修復
 */
async function repairSingleRecord<TAuthOptions = unknown>(
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
  const { needsRepair, missingShadows, extraShadows } = await checkShadowIntegrity();

  // Records Lambdaは__shadowKeysをレスポンスから除外するため、
  // 実際のシャドー数は確認できません
  console.log(`Missing shadows: ${missingShadows}`);
  console.log(`Extra shadows: ${extraShadows}`);

  if (!needsRepair) {
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
 * 全レコードをスキャンして修復
 */
async function repairAllRecords<TAuthOptions = unknown>(
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
  const cursor = collection.find({});
  const records = await cursor.toArray();

  console.log(`Found ${records.length} records`);

  for (const mainRecord of records) {
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
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } catch (error: any) {
      stats.failed++;
      stats.errors.push({ id: recordId, error: error.message });
      console.error(`  ✗ Failed: ${error.message}`);
    }
  }

  // 統計情報を表示
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
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const resourceIndex = args.indexOf('--resource');
  const idIndex = args.indexOf('--id');
  const dryRun = args.includes('--dry-run');
  const repair = args.includes('--repair');

  if (resourceIndex === -1 || !args[resourceIndex + 1]) {
    console.error(
      'Usage: pnpm --filter @exabugs/dynamodb-client tsx scripts/repair-shadows.ts --resource <resource> [--id <id>] [--dry-run|--repair]'
    );
    process.exit(1);
  }

  const resource = args[resourceIndex + 1];
  const recordId = idIndex !== -1 ? args[idIndex + 1] : undefined;

  // Records Lambda Function URLを取得
  const apiUrl = await getRecordsApiUrl();

  console.log(`Records API: ${apiUrl}`);
  console.log(`Resource: ${resource}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : repair ? 'REPAIR' : 'DRY RUN (default)'}`);

  // DynamoClient（IAM認証）を作成
  console.log(`\nCreating DynamoClient with IAM auth...`);
  console.log(`Region: ${REGION}`);
  console.log(`Endpoint: ${apiUrl}`);

  const client = new DynamoClient(apiUrl, {
    auth: {
      region: REGION,
    },
    autoConnect: true,
  });

  console.log(`Client connected: ${client.isConnected()}\n`);

  const collection = client
    .db('ainews')
    .collection<{ id: string; [key: string]: unknown }>(resource);

  if (recordId) {
    await repairSingleRecord(collection, recordId, !repair);
  } else {
    await repairAllRecords(collection, !repair);
  }

  await client.close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
