/**
 * DynamoClientファクトリー
 *
 * DynamoClientの初期化処理
 */
import { DynamoClient, type Collection } from '../../client/index.iam.js';

/**
 * DynamoClient（IAM認証）を作成・初期化する
 *
 * @param apiUrl - Records API URL
 * @param region - AWSリージョン
 * @param resource - リソース名
 * @returns 初期化されたコレクション
 */
export async function createDynamoClientCollection(
  apiUrl: string,
  region: string,
  resource: string
): Promise<{
  client: DynamoClient;
  collection: Collection<{ id: string; [key: string]: unknown }>;
}> {
  console.log(`\nCreating DynamoClient with IAM auth...`);
  console.log(`Region: ${region}`);
  console.log(`Endpoint: ${apiUrl}`);

  const client = new DynamoClient(apiUrl, {
    auth: {
      region: region,
    },
    autoConnect: true,
  });

  console.log(`Client connected: ${client.isConnected()}\n`);

  const collection = client
    .db()
    .collection<{ id: string; [key: string]: unknown }>(resource);

  return { client, collection: collection as any };
}