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
import { repairAllRecords } from './operations/bulkRecordRepair.js';
import { repairSingleRecord } from './operations/singleRecordRepair.js';
import { getRecordsApiUrl } from './utils/awsUtils.js';
import { parseRepairScriptArgs, displayScriptConfig } from './utils/cliParser.js';
import { createDynamoClientCollection } from './utils/clientFactory.js';

// 環境変数
const ENV = process.env.ENV || 'dev';
const REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * メイン処理
 */
async function main() {
  try {
    // コマンドライン引数を解析
    const config = parseRepairScriptArgs(process.argv.slice(2));

    // Records Lambda Function URLを取得
    const apiUrl = await getRecordsApiUrl(ENV, REGION);

    // 設定を表示
    displayScriptConfig(config, apiUrl);

    // DynamoClient（IAM認証）を作成
    const { client, collection } = await createDynamoClientCollection(
      apiUrl,
      REGION,
      config.resource
    );

    try {
      // 修復処理を実行
      if (config.recordId) {
        await repairSingleRecord(collection, config.recordId, !config.repair);
      } else {
        await repairAllRecords(collection, !config.repair);
      }
    } finally {
      // クライアントを閉じる
      await client.close();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
