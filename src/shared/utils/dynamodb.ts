/**
 * DynamoDB関連ユーティリティ
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDBクライアントの設定オプション
 */
export interface DynamoDBClientConfig {
  region?: string;
  endpoint?: string;
}

/**
 * ConsistentRead=trueをデフォルトとするDynamoDB Document Clientを作成する
 *
 * このクライアントは、すべての読み取り操作に強整合性を強制するように設定されている。
 *
 * @param config - リージョンとエンドポイントのオプション設定
 * @returns ConsistentRead=trueで設定されたDynamoDBDocumentClient
 */
export function createDynamoDBClient(config: DynamoDBClientConfig = {}): DynamoDBDocumentClient {
  const { region = process.env.AWS_REGION || 'us-east-1', endpoint } = config;

  const client = new DynamoDBClient({
    region,
    ...(endpoint && { endpoint }),
  });

  // ConsistentRead=trueをデフォルトとしてDocument Clientを設定
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });

  return docClient;
}