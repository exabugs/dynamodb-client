import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

/**
 * TODO: eslint flat configとTypeScriptの統合問題
 *
 * 現在、eslint flat configでNode.jsのグローバル変数（process, console）が
 * 正しく認識されない問題があります。TypeScriptコンパイラが型チェックを
 * 行うため、no-undefルールは実質的に不要ですが、eslint設定が反映されません。
 *
 * 根本的な解決策:
 * 1. eslint v9のflat config対応を待つ
 * 2. globals パッケージの設定方法を再調査
 * 3. TypeScript ESLintの推奨設定を確認
 *
 * 参考: https://typescript-eslint.io/linting/troubleshooting/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
 */
/* eslint-disable no-undef */

/**
 * 環境変数
 */
interface EnvironmentConfig {
  ENV: string;
  REGION: string;
  STATE_MACHINE_ARN: string;
  ALLOW_RESOURCES: string;
}

/**
 * Lambda入力パラメータ
 */
export interface CoordinatorInput {
  resource: string;
  segments?: number;
  dryRun?: boolean;
  pageLimit?: number;
}

/**
 * Lambda出力
 */
export interface CoordinatorOutput {
  executionArn: string;
  startDate: string;
}

/**
 * エラーレスポンス
 */
export interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * 環境変数を検証して取得する
 *
 * @returns 環境変数設定
 * @throws 必須環境変数が不足している場合
 */
function getEnvironmentConfig(): EnvironmentConfig {
  const ENV = process.env.ENV;
  const REGION = process.env.REGION || process.env.AWS_REGION;
  const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;
  const ALLOW_RESOURCES = process.env.ALLOW_RESOURCES;

  if (!ENV || !REGION || !STATE_MACHINE_ARN || !ALLOW_RESOURCES) {
    throw new Error(
      'Missing required environment variables: ENV, REGION, STATE_MACHINE_ARN, ALLOW_RESOURCES'
    );
  }

  return { ENV, REGION, STATE_MACHINE_ARN, ALLOW_RESOURCES };
}

/**
 * 入力パラメータを検証する
 *
 * @param input - Lambda入力パラメータ
 * @param allowedResources - 許可されたリソース名のセット
 * @throws 入力パラメータが不正な場合
 */
function validateInput(input: CoordinatorInput, allowedResources: Set<string>): void {
  // resourceは必須
  if (!input.resource || typeof input.resource !== 'string') {
    throw new Error('Invalid input: resource is required and must be a string');
  }

  // resourceが許可リストに含まれているか確認
  if (!allowedResources.has(input.resource)) {
    throw new Error(
      `Resource not allowed: ${input.resource}. Allowed resources: ${Array.from(allowedResources).join(', ')}`
    );
  }

  // segmentsは正の整数
  if (input.segments !== undefined) {
    if (
      typeof input.segments !== 'number' ||
      input.segments <= 0 ||
      !Number.isInteger(input.segments)
    ) {
      throw new Error('Invalid input: segments must be a positive integer');
    }
  }

  // dryRunはboolean
  if (input.dryRun !== undefined && typeof input.dryRun !== 'boolean') {
    throw new Error('Invalid input: dryRun must be a boolean');
  }

  // pageLimitは正の整数
  if (input.pageLimit !== undefined) {
    if (
      typeof input.pageLimit !== 'number' ||
      input.pageLimit <= 0 ||
      !Number.isInteger(input.pageLimit)
    ) {
      throw new Error('Invalid input: pageLimit must be a positive integer');
    }
  }
}

/**
 * Step Functions実行名を生成する
 *
 * @param resource - リソース名
 * @returns 実行名（例: articles-1732627200000-abc123）
 */
function generateExecutionName(resource: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${resource}-${timestamp}-${random}`;
}

/**
 * Maintenance Coordinator Lambda Handler
 *
 * シャドー整合性メンテナンスを開始するオーケストレーター。
 * 指定されたリソースとセグメント数でStep Functions実行を開始する。
 *
 * @param event - Lambda入力イベント
 * @returns Step Functions実行ARNと開始日時
 */
export async function lambdaHandler(event: CoordinatorInput): Promise<CoordinatorOutput> {
  console.log('Maintenance Coordinator Lambda invoked', { event });

  try {
    // 環境変数を取得
    const config = getEnvironmentConfig();
    console.log('Environment config loaded', {
      ENV: config.ENV,
      REGION: config.REGION,
      ALLOW_RESOURCES: config.ALLOW_RESOURCES,
    });

    // 許可されたリソース名のセットを作成
    const allowedResources = new Set(config.ALLOW_RESOURCES.split(',').map((r) => r.trim()));

    // 入力パラメータを検証
    validateInput(event, allowedResources);

    // デフォルト値を設定
    const input = {
      resource: event.resource,
      segments: event.segments ?? 8,
      dryRun: event.dryRun ?? true,
      pageLimit: event.pageLimit ?? 100,
    };

    console.log('Starting Step Functions execution', { input });

    // Step Functionsクライアントを作成
    const sfnClient = new SFNClient({ region: config.REGION });

    // Step Functions実行を開始
    const executionName = generateExecutionName(input.resource);
    const command = new StartExecutionCommand({
      stateMachineArn: config.STATE_MACHINE_ARN,
      name: executionName,
      input: JSON.stringify(input),
    });

    const response = await sfnClient.send(command);

    console.log('Step Functions execution started', {
      executionArn: response.executionArn,
      startDate: response.startDate,
    });

    if (!response.executionArn || !response.startDate) {
      throw new Error('Step Functions execution response is missing required fields');
    }

    return {
      executionArn: response.executionArn,
      startDate: response.startDate.toISOString(),
    };
  } catch (error) {
    console.error('Error in Maintenance Coordinator Lambda', { error });

    // エラーの種類に応じてエラーコードを設定
    let errorCode = 'SFN_ERROR';
    let errorMessage = 'Failed to start Step Functions execution';

    if (error instanceof Error) {
      if (error.message.includes('Invalid input')) {
        errorCode = 'INVALID_INPUT';
        errorMessage = error.message;
      } else if (error.message.includes('Resource not allowed')) {
        errorCode = 'RESOURCE_NOT_ALLOWED';
        errorMessage = error.message;
      } else if (error.message.includes('Missing required environment variables')) {
        errorCode = 'CONFIG_ERROR';
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }

    throw new Error(`${errorCode}: ${errorMessage}`);
  }
}
