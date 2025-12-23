/**
 * コマンドライン引数解析ユーティリティ
 *
 * スクリプトのコマンドライン引数を解析する
 */

/**
 * 修復スクリプトの設定
 */
export interface RepairScriptConfig {
  resource: string;
  recordId?: string;
  dryRun: boolean;
  repair: boolean;
}

/**
 * コマンドライン引数を解析する
 *
 * @param args - process.argv.slice(2)の結果
 * @returns 解析された設定
 * @throws {Error} 必須引数が不足している場合
 */
export function parseRepairScriptArgs(args: string[]): RepairScriptConfig {
  const resourceIndex = args.indexOf('--resource');
  const idIndex = args.indexOf('--id');
  const dryRun = args.includes('--dry-run');
  const repair = args.includes('--repair');

  if (resourceIndex === -1 || !args[resourceIndex + 1]) {
    throw new Error(
      'Usage: pnpm --filter @exabugs/dynamodb-client tsx scripts/repair-shadows.ts --resource <resource> [--id <id>] [--dry-run|--repair]'
    );
  }

  const resource = args[resourceIndex + 1];
  const recordId = idIndex !== -1 ? args[idIndex + 1] : undefined;

  return {
    resource,
    recordId,
    dryRun,
    repair,
  };
}

/**
 * スクリプト設定を表示する
 *
 * @param config - スクリプト設定
 * @param apiUrl - Records API URL
 */
export function displayScriptConfig(config: RepairScriptConfig, apiUrl: string): void {
  console.log(`Records API: ${apiUrl}`);
  console.log(`Resource: ${config.resource}`);
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : config.repair ? 'REPAIR' : 'DRY RUN (default)'}`);
  
  if (config.recordId) {
    console.log(`Target Record ID: ${config.recordId}`);
  }
}