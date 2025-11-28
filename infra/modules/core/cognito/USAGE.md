# Cognito モジュール使用ガイド

## デプロイ手順

### 1. 初期化

```bash
cd infra
terraform init
```

### 2. Dev環境へのデプロイ

```bash
terraform workspace select dev
terraform plan -var-file=envs/dev.tfvars -out=tfplan
terraform apply tfplan
```

### 3. 出力値の確認

```bash
terraform output cognito_user_pool_id
terraform output cognito_hosted_ui_url
terraform output cognito_admin_ui_client_id
terraform output cognito_mobile_app_client_id
```

## 環境変数設定

デプロイ後、以下の環境変数をアプリケーションに設定してください。

### Admin UI（React + react-admin）

`.env`ファイルに以下を追加：

```env
VITE_COGNITO_USER_POOL_ID=<terraform output cognito_user_pool_id>
VITE_COGNITO_USER_POOL_CLIENT_ID=<terraform output cognito_admin_ui_client_id>
VITE_COGNITO_DOMAIN=<terraform output cognito_user_pool_domain>
VITE_COGNITO_REGION=us-east-1
```

### Mobile App（Expo/React Native）

`app.json`または環境変数に以下を追加：

```json
{
  "extra": {
    "cognitoUserPoolId": "<terraform output cognito_user_pool_id>",
    "cognitoClientId": "<terraform output cognito_mobile_app_client_id>",
    "cognitoDomain": "<terraform output cognito_user_pool_domain>",
    "cognitoRegion": "us-east-1"
  }
}
```

### Records Lambda

Lambda関数の環境変数に以下を追加：

```hcl
environment {
  variables = {
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_REGION       = var.region
  }
}
```

## テストユーザーの作成

### AWS CLIを使用

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <user-pool-id> \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

### AWS Consoleを使用

1. Cognito User Poolsに移動
2. `ainews-dev-userpool`を選択
3. "Users"タブ → "Create user"
4. メールアドレスとパスワードを入力
5. "Email verified"にチェック

## Hosted UIのテスト

### ログインURLの生成

```
https://<cognito-domain>.auth.<region>.amazoncognito.com/login?client_id=<client-id>&response_type=code&scope=openid+profile+email&redirect_uri=<callback-url>
```

例（Admin UI）:
```
https://ainews-dev-auth.auth.us-east-1.amazoncognito.com/login?client_id=<admin-ui-client-id>&response_type=code&scope=openid+profile+email&redirect_uri=http://localhost:5173/callback
```

## トラブルシューティング

### エラー: "User pool domain already exists"

別の環境で同じドメイン名を使用している可能性があります。`variables.tf`でドメイン名を変更してください。

### エラー: "Invalid callback URL"

`callback_urls`に指定したURLが正しいか確認してください。プロトコル（http/https）とポート番号も含める必要があります。

### JWT検証エラー

Records Lambdaで以下を確認：
1. `COGNITO_USER_POOL_ID`環境変数が正しく設定されているか
2. JWTトークンの有効期限が切れていないか
3. Cognito公開鍵（JWKS）の取得に成功しているか

## セキュリティのベストプラクティス

### 本番環境

1. **MFAを有効化**: `enable_mfa = true`
2. **削除保護を有効化**: `enable_deletion_protection = true`
3. **コールバックURLを制限**: 本番ドメインのみを許可
4. **パスワードポリシーを強化**: 記号を必須にする（`require_symbols = true`）

### 開発環境

1. **テストユーザーの管理**: 定期的に不要なユーザーを削除
2. **ログの監視**: CloudWatch Logsで認証エラーを監視
3. **トークンの有効期限**: 短めに設定（開発中は長めでも可）

## 参考リンク

- [AWS Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [Hosted UI](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)
- [PKCE](https://oauth.net/2/pkce/)
- [JWT検証](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
