import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';
import type { Handler } from 'aws-lambda';

import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';

import type { Article, FetchLog } from '@ainews/api-types';

import { getConfig, log } from './config.js';
import { APITubeProvider } from './providers/apitube.js';
import { DummyNewsProvider } from './providers/dummy.js';
import { GNewsProvider } from './providers/gnews.js';
import { NewsAPIProvider } from './providers/newsapi.js';

/**
 * Fetch Lambda イベント型
 */
interface FetchLambdaEvent {
  /** 実行対象プロバイダー（未指定時は全プロバイダー） */
  provider?: FetchLog['provider'];
}

/**
 * Fetch Lambda ハンドラー
 *
 * ニュース記事を自動取得し、Records Lambdaに保存する
 *
 * 環境変数:
 * - ENV: 環境識別子（dev/stg/prd）
 * - REGION: AWSリージョン
 * - PARAM_PATH: SSM Parameter Storeパス
 * - RECORDS_FUNCTION_NAME: Records Lambda関数名
 * - LOG_LEVEL: ログレベル（debug/info/warn/error）
 *
 * 処理フロー:
 * 1. 環境変数検証
 * 2. SSM Parameter Store読み取り（API Key等）
 * 3. ニュース記事取得（現時点ではダミーデータ）
 * 4. Records Lambda呼び出し（DynamoClient経由でcreateMany操作）
 */

/**
 * DynamoClientインスタンス（Lambda起動時に初期化）
 */
let dynamoClient: DynamoClient | null = null;

/**
 * SSMClientインスタンス（Lambda起動時に初期化）
 */
let ssmClient: SSMClient | null = null;

/**
 * DynamoClientを初期化する
 */
async function initializeDynamoClient(
  recordsFunctionUrl: string,
  region: string
): Promise<DynamoClient> {
  if (!dynamoClient) {
    dynamoClient = new DynamoClient(recordsFunctionUrl, {
      auth: {
        region,
      },
      timeout: 60000, // 60秒
      autoConnect: true,
    });

    await dynamoClient.connect();
    log('info', 'DynamoClient initialized with IAM authentication');
  }

  return dynamoClient;
}

/**
 * SSMClientを初期化する
 */
function initializeSSMClient(region: string): SSMClient {
  if (!ssmClient) {
    ssmClient = new SSMClient({ region });
    log('info', 'SSMClient initialized');
  }

  return ssmClient;
}

/**
 * SSM Parameter Storeからパラメータを読み取る
 *
 * パス構造: /ainews/{env}/key/{provider}
 * 例: /ainews/dev/key/APITUBE
 *
 * @param paramPath - パラメータパス（例: /ainews/dev/key/）
 * @returns パラメータのキーと値のマップ（キー名: プロバイダー名）
 */
async function getSSMParameters(
  paramPath: string,
  region: string
): Promise<Record<string, string>> {
  const ssm = initializeSSMClient(region);

  try {
    log('debug', 'Fetching SSM parameters', { paramPath });

    const command = new GetParametersByPathCommand({
      Path: paramPath,
      Recursive: true,
      WithDecryption: true,
    });

    const response = await ssm.send(command);
    const parameters: Record<string, string> = {};

    if (response.Parameters) {
      for (const param of response.Parameters) {
        if (param.Name && param.Value) {
          // パスプレフィックスを削除してキー名のみを取得
          // 例: /ainews/dev/key/APITUBE → APITUBE
          const key = param.Name.replace(paramPath, '').replace(/^\//, '');
          parameters[key] = param.Value;
        }
      }
    }

    log('info', 'SSM parameters fetched successfully', {
      count: Object.keys(parameters).length,
      keys: Object.keys(parameters),
    });

    return parameters;
  } catch (error) {
    log('error', 'Failed to fetch SSM parameters', {
      paramPath,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * プロバイダー別実行結果
 */
interface ProviderResult {
  provider: FetchLog['provider'];
  articles: Partial<Article>[];
  error?: string;
}

/**
 * ニュース記事を取得する
 *
 * SSMからAPIキーを取得し、利用可能なすべてのプロバイダーから記事を取得する
 * - NewsAPI
 * - GNews
 * - APITube
 *
 * APIキーが存在しない場合は、ダミープロバイダーを使用する
 *
 * @param parameters - SSMパラメータ
 * @param targetProvider - 実行対象プロバイダー（指定しない場合は全プロバイダー）
 * @returns プロバイダー別実行結果の配列
 */
async function fetchArticles(
  parameters: Record<string, string>,
  targetProvider?: string
): Promise<ProviderResult[]> {
  const results: ProviderResult[] = [];
  const fetchOptions = {
    limit: 20,
    language: 'en',
  };

  // プロバイダー定義
  const providers: Array<{
    name: FetchLog['provider'];
    keyName: string;
    createProvider: (apiKey: string) => NewsAPIProvider | GNewsProvider | APITubeProvider;
  }> = [
    {
      name: 'newsapi',
      keyName: 'NEWSAPI',
      createProvider: (apiKey) => new NewsAPIProvider(apiKey),
    },
    {
      name: 'gnews',
      keyName: 'GNEWS',
      createProvider: (apiKey) => new GNewsProvider(apiKey),
    },
    {
      name: 'apitube',
      keyName: 'APITUBE',
      createProvider: (apiKey) => new APITubeProvider(apiKey),
    },
  ];

  // 実行対象プロバイダーをフィルタリング
  const targetProviders = targetProvider
    ? providers.filter((p) => p.name === targetProvider)
    : providers;

  if (targetProviders.length === 0) {
    log('warn', 'No matching provider found', { targetProvider });
    return [];
  }

  // 各プロバイダーから記事を取得
  for (const providerDef of targetProviders) {
    const apiKey = parameters[providerDef.keyName];

    if (!apiKey) {
      log('warn', `${providerDef.name} key not found, skipping`, {
        provider: providerDef.name,
      });
      continue;
    }

    try {
      log('info', `Fetching from ${providerDef.name} provider`);
      const provider = providerDef.createProvider(apiKey);
      const articles = await provider.fetchArticles(fetchOptions);

      results.push({
        provider: providerDef.name,
        articles,
      });

      log('info', `${providerDef.name} fetch completed`, { count: articles.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('error', `${providerDef.name} fetch failed`, { error: errorMessage });

      results.push({
        provider: providerDef.name,
        articles: [],
        error: errorMessage,
      });
    }
  }

  // すべてのプロバイダーが失敗した場合はダミープロバイダーを使用
  const totalArticles = results.reduce((sum, r) => sum + r.articles.length, 0);
  if (totalArticles === 0 && !targetProvider) {
    log('warn', 'No articles fetched from any provider, using dummy provider');
    const dummyProvider = new DummyNewsProvider();
    const dummyArticles = await dummyProvider.fetchArticles({ limit: 1 });
    results.push({
      provider: 'newsapi', // ダミーはnewsapiとして記録
      articles: dummyArticles,
    });
  }

  log('info', 'All providers fetch completed', {
    totalArticles: results.reduce((sum, r) => sum + r.articles.length, 0),
    results: results.map((r) => ({
      provider: r.provider,
      count: r.articles.length,
      error: r.error,
    })),
  });

  return results;
}

/**
 * Lambda ハンドラー
 */
export const lambdaHandler: Handler<FetchLambdaEvent> = async (event, context) => {
  const requestId = context.awsRequestId;

  log('info', 'Fetch Lambda invoked', {
    requestId,
    event,
  });

  try {
    // 1. 環境変数検証
    const config = getConfig();

    log('debug', 'Configuration loaded', {
      env: config.env,
      region: config.region,
      paramPath: config.paramPath,
      recordsFunctionName: config.recordsFunctionName,
    });

    // 2. SSM Parameter Store読み取り
    let parameters: Record<string, string> = {};
    try {
      parameters = await getSSMParameters(config.paramPath, config.region);
      log('debug', 'SSM parameters loaded', {
        keys: Object.keys(parameters),
        hasNewsAPI: !!parameters['NEWSAPI'],
        hasGNews: !!parameters['GNEWS'],
        hasAPITube: !!parameters['APITUBE'],
      });
    } catch (error) {
      // SSMパラメータが存在しない場合は警告のみ
      log('warn', 'Failed to load SSM parameters, will use dummy provider', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 3. Records Lambda Function URLを環境変数から取得
    const recordsFunctionUrl = process.env.RECORDS_FUNCTION_URL;
    if (!recordsFunctionUrl) {
      throw new Error('RECORDS_FUNCTION_URL environment variable is required');
    }

    const client = await initializeDynamoClient(recordsFunctionUrl, config.region);
    const db = client.db('ainews');

    // 4. 実行対象プロバイダーをpayloadから取得
    const targetProvider = event?.provider as FetchLog['provider'] | undefined;
    if (targetProvider) {
      log('info', 'Target provider specified from payload', { provider: targetProvider });
    } else {
      log('info', 'No provider specified, will execute all providers');
    }

    // 5. ニュース記事取得
    log('info', 'Fetching news articles...');
    const providerResults = await fetchArticles(parameters, targetProvider);
    log('info', 'News articles fetched', {
      providerCount: providerResults.length,
      totalArticles: providerResults.reduce((sum, r) => sum + r.articles.length, 0),
    });

    // 6. 各プロバイダーの結果を処理
    const fetchLogCollection = db.collection<FetchLog>('fetchLogs');
    const articlesCollection = db.collection<Article>('articles');
    const executedAt = new Date().toISOString();
    const ttlDays = parseInt(process.env.FETCHLOG_TTL_DAYS || '30', 10);
    const ttl = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;

    const fetchLogResults: Array<{
      provider: string;
      fetchedCount: number;
      duplicateCount: number;
      failedCount: number;
    }> = [];

    for (const providerResult of providerResults) {
      const { provider, articles, error } = providerResult;

      // 記事をDynamoDBに保存
      let insertedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      if (articles.length > 0) {
        try {
          // 既存レコードをチェック（重複カウント用）
          const articleIds = articles.map((a) => a.id);
          log('info', `Checking existing articles for ${provider}...`, {
            count: articleIds.length,
          });
          const existingRecords = await articlesCollection.findMany(articleIds);
          duplicateCount = existingRecords.length;
          log('info', `Found ${duplicateCount} existing articles for ${provider}`);

          log('info', `Inserting ${provider} articles into DynamoDB...`, {
            total: articles.length,
            new: articles.length - duplicateCount,
            duplicate: duplicateCount,
          });

          // 全件をinsertMany（新規も重複も上書き）
          const result = await articlesCollection.insertMany(articles as Article[]);
          const totalInserted = result.insertedCount || 0;

          // 失敗したレコードを確認
          failedCount = (result.errors || []).length;

          // 新規追加件数を計算
          insertedCount = totalInserted - duplicateCount - failedCount;

          // デバッグ用：負の場合は警告
          if (insertedCount < 0) {
            log('warn', `Unexpected negative insertedCount for ${provider}`, {
              totalInserted,
              duplicateCount,
              failedCount,
              calculated: insertedCount,
            });
            insertedCount = 0;
          }

          log('info', `${provider} articles inserted successfully`, {
            new: insertedCount,
            duplicate: duplicateCount,
            failed: failedCount,
          });
        } catch (insertError) {
          log('error', `Failed to insert ${provider} articles`, {
            error: insertError instanceof Error ? insertError.message : 'Unknown error',
          });
          failedCount = articles.length;
        }
      }

      // FetchLogを記録
      const status: FetchLog['status'] = error
        ? 'failure'
        : failedCount > 0
          ? 'partial'
          : 'success';

      const fetchLog: Partial<FetchLog> = {
        name: provider, // nameはproviderと同じ
        provider,
        status,
        fetchedCount: insertedCount,
        duplicateCount,
        failedCount,
        errorMessage: error,
        executedAt,
        ttl,
      };

      try {
        await fetchLogCollection.insertOne(fetchLog as FetchLog);
        log('info', `FetchLog recorded for ${provider}`, { status, fetchedCount: insertedCount });
      } catch (logError) {
        log('error', `Failed to record FetchLog for ${provider}`, {
          error: logError instanceof Error ? logError.message : 'Unknown error',
        });
      }

      fetchLogResults.push({
        provider,
        fetchedCount: insertedCount,
        duplicateCount,
        failedCount,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Fetch Lambda executed successfully',
        requestId,
        results: fetchLogResults,
      }),
    };
  } catch (error) {
    log('error', 'Fetch Lambda execution failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // エラーコードの判定
    let errorCode = 'UNKNOWN_ERROR';
    if (error instanceof Error) {
      if (error.message.includes('environment variable')) {
        errorCode = 'CONFIG_ERROR';
      } else if (error.message.includes('AccessDenied')) {
        errorCode = 'ACCESS_DENIED';
      } else if (error.message.includes('API key') || error.message.includes('API_KEY_MISSING')) {
        errorCode = 'API_KEY_MISSING';
      } else if (error.message.includes('Rate limit') || error.message.includes('RATE_LIMIT')) {
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (error.message.includes('NewsAPI') || error.message.includes('provider')) {
        errorCode = 'PROVIDER_ERROR';
      } else if (error.message.includes('SSM')) {
        errorCode = 'SSM_ERROR';
      } else if (error.message.includes('DynamoDB') || error.message.includes('Records Lambda')) {
        errorCode = 'INVOKE_ERROR';
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Fetch Lambda execution failed',
        requestId,
        errorCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
