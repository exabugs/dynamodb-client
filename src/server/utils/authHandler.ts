/**
 * 認証ハンドラー
 *
 * IAM認証とCognito JWT認証を処理する
 *
 * このLambdaは2本のFunction URLから呼ばれる:
 * - NONE認証のURL（ブラウザ・Admin UI向け）: Cognito JWTのみを受け付ける
 * - AWS_IAM認証のURL（サーバー間呼び出し向け）: AWSが署名検証済みのリクエストのみ到達する
 *
 * 旧実装はAuthorization/x-amz-date等のヘッダーの「見た目」でIAM認証とみなしていたが、
 * これらはクライアントが自由に送れる値であり、NONE認証のURL上では一切検証されない
 * （署名検証はAWS_IAM認証のURL上でAWS自身が行うものであり、NONEのURLには存在しない）。
 * そのため誰でも `x-amz-date` 等のヘッダーを送るだけでIAM認証を騙り、全リソースへの
 * 認証なしアクセスが可能になっていた。
 *
 * 修正後は `event.requestContext.authorizer.iam` の有無で判定する。この値はAWS_IAM認証の
 * Function URLが実際に署名検証に成功した場合にのみAWS側が付与するものであり、
 * クライアントが送るヘッダーからは偽装できない。
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { createLogger } from '../../shared/index.js';
import { verifyAuthHeader } from './auth.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'auth-handler',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * AWS_IAM認証のFunction URLがリクエストに付与するコンテキスト
 * （AWS Lambda公式の型定義 APIGatewayEventRequestContextIAMAuthorizer と同じ形）
 */
interface IAMAuthorizerContext {
  accessKey: string;
  accountId: string;
  callerId: string;
  cognitoIdentity: null;
  principalOrgId: string;
  userArn: string;
  userId: string;
}

/**
 * NONE/AWS_IAM両方のFunction URLから届き得るイベント
 * （同一のLambdaコードが両方のURLから呼ばれるため、authorizerはオプショナル）
 */
type RecordsEvent = APIGatewayProxyEventV2 & {
  requestContext: {
    authorizer?: {
      iam?: IAMAuthorizerContext;
    };
  };
};

/**
 * 認証を処理する
 *
 * @param event - Lambda Function URLイベント
 * @param requestId - リクエストID
 * @returns 認証が成功した場合はvoid、失敗した場合は例外をスロー
 * @throws {Error} 認証に失敗した場合
 */
export async function handleAuthentication(
  event: RecordsEvent,
  requestId: string
): Promise<void> {
  const iam = event.requestContext.authorizer?.iam;

  if (iam) {
    // AWS_IAM認証のFunction URL経由。AWSが署名検証済みであり、この値はクライアントから偽装できない
    handleIAMAuthentication(iam, requestId);
    return;
  }

  // NONE認証のFunction URL経由。Cognito JWTのみを受け付ける
  const authHeader = event.headers.authorization || event.headers.Authorization;
  await handleCognitoAuthentication(authHeader, requestId);
}

/**
 * IAM認証済みリクエストを処理する
 *
 * @param iam - AWSが検証済みのIAM認証コンテキスト（偽装不可）
 * @param requestId - リクエストID
 */
function handleIAMAuthentication(iam: IAMAuthorizerContext, requestId: string): void {
  logger.info('IAM authenticated request', {
    requestId,
    userArn: iam.userArn,
    accountId: iam.accountId,
    callerId: iam.callerId,
  });
}

/**
 * Cognito JWT認証を処理する
 *
 * @param authHeader - Authorizationヘッダー
 * @param requestId - リクエストID
 * @throws {Error} 認証に失敗した場合
 */
async function handleCognitoAuthentication(
  authHeader: string | undefined,
  requestId: string
): Promise<void> {
  // Cognito JWT認証（ブラウザからのアクセス）
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID; // オプション

  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID environment variable is required');
  }

  const jwtPayload = await verifyAuthHeader(authHeader, userPoolId, clientId);

  logger.debug('Cognito JWT verified', {
    requestId,
    sub: jwtPayload.sub,
    email: jwtPayload.email,
  });

  // TODO: テナント境界の実装
  // jwtPayload.subをレコードのuserIdフィールドと照合する
}
