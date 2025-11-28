# Cognito デプロイ完了

## デプロイ済みリソース（Dev環境）

### User Pool
- **User Pool ID**: `us-east-1_26bKGhgKT`
- **User Pool ARN**: `arn:aws:cognito-idp:us-east-1:901762418858:userpool/us-east-1_26bKGhgKT`
- **Domain**: `ainews-dev-auth`
- **Hosted UI URL**: `https://ainews-dev-auth.auth.us-east-1.amazoncognito.com`

### Clients
- **Admin UI Client ID**: `2kc5v7soov084u7u3155uf12tv`
- **Mobile App Client ID**: `7u75fip54bo28umn8qeelo3r91`

## 次のステップ

### 1. Admin UI設定

`apps/admin/.env`ファイルを作成：

```env
VITE_COGNITO_USER_POOL_ID=us-east-1_26bKGhgKT
VITE_COGNITO_USER_POOL_CLIENT_ID=2kc5v7soov084u7u3155uf12tv
VITE_COGNITO_DOMAIN=ainews-dev-auth
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
```

### 2. Mobile App設定

`apps/mobile/app.json`または環境変数に追加：

```json
{
  "extra": {
    "cognitoUserPoolId": "us-east-1_26bKGhgKT",
    "cognitoClientId": "7u75fip54bo28umn8qeelo3r91",
    "cognitoDomain": "ainews-dev-auth",
    "cognitoRegion": "us-east-1"
  }
}
```

### 3. Records Lambda設定

Lambda関数の環境変数に追加（次のタスクで実装）：

```hcl
environment {
  variables = {
    COGNITO_USER_POOL_ID = "us-east-1_26bKGhgKT"
    COGNITO_REGION       = "us-east-1"
  }
}
```

### 4. テストユーザーの作成

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_26bKGhgKT \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

### 5. Hosted UIのテスト

Admin UI用ログインURL:
```
https://ainews-dev-auth.auth.us-east-1.amazoncognito.com/login?client_id=2kc5v7soov084u7u3155uf12tv&response_type=code&scope=openid+profile+email&redirect_uri=http://localhost:5173/callback
```

Mobile App用ログインURL:
```
https://ainews-dev-auth.auth.us-east-1.amazoncognito.com/login?client_id=7u75fip54bo28umn8qeelo3r91&response_type=code&scope=openid+profile+email&redirect_uri=exp://localhost:8081/callback
```

## パスワードポリシー

- 最小長: 8文字
- 小文字必須: あり
- 大文字必須: あり
- 数字必須: あり
- 記号必須: なし

## セキュリティ設定

- **PKCE**: 
  - ✅ Admin UI: Amplify Authが自動的にPKCEを使用（`generate_secret = false`）
  - ✅ Mobile App: react-oidc-contextでPKCE必須（要件9.4）
- **クライアントシークレット**: なし（SPA/モバイルアプリのため）
- **トークン有効期限**:
  - アクセストークン: 60分
  - IDトークン: 60分
  - リフレッシュトークン: 30日
- **MFA**: 無効（Dev環境、本番環境では有効化推奨）
- **削除保護**: 無効（Dev環境、本番環境では有効化推奨）

### PKCEについて

両方のクライアント（Admin UI、Mobile App）でPKCEが使用されます：

- **Admin UI**: Amplify Authライブラリが自動的にPKCEを実装
- **Mobile App**: react-oidc-contextライブラリが自動的にPKCEを実装

PKCEにより、認可コード傍受攻撃から保護され、クライアントシークレットなしでも安全な認証が可能です。

## トラブルシューティング

### ログインできない場合

1. ユーザーが作成されているか確認：
   ```bash
   aws cognito-idp list-users --user-pool-id us-east-1_26bKGhgKT
   ```

2. メールアドレスが検証済みか確認：
   ```bash
   aws cognito-idp admin-get-user \
     --user-pool-id us-east-1_26bKGhgKT \
     --username testuser@example.com
   ```

3. パスワードポリシーを満たしているか確認（≥8文字、大小英字+数字）

### コールバックURLエラー

コールバックURLが正確に一致しているか確認：
- プロトコル（http/https）
- ポート番号
- パス（/callback）

現在設定されているコールバックURL:
- Admin UI: `http://localhost:5173`, `http://localhost:5173/callback`
- Mobile App: `exp://localhost:8081`, `exp://localhost:8081/callback`
