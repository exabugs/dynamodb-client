/**
 * AWS関連ユーティリティ
 *
 * AWS CLIやAWSサービスとの連携処理
 */

/**
 * Records Lambda Function URLを取得
 *
 * @param env - 環境名
 * @param region - AWSリージョン
 * @returns Function URL
 * @throws {Error} Function URLの取得に失敗した場合
 */
export async function getRecordsApiUrl(env: string, region: string): Promise<string> {
  // 環境変数から取得を試行
  const envUrl = process.env.RECORDS_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // AWS CLIで取得
  const { execSync } = await import('child_process');
  const functionName = `ainews-${env}-records`;

  try {
    const output = execSync(
      `aws lambda get-function-url-config --function-name ${functionName} --region ${region} --query 'FunctionUrl' --output text`,
      { encoding: 'utf-8' }
    );
    return output.trim();
  } catch {
    throw new Error(`Failed to get Function URL for ${functionName}`);
  }
}