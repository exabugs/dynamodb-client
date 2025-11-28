# PKCE（Proof Key for Code Exchange）実装ガイド

## 概要

このCognito User Poolでは、Admin UIとMobile Appの両方でPKCEを使用した認可コードフローを実装しています。

## なぜPKCEが必要か？

### 従来の認可コードフローの問題

1. **認可コード傍受攻撃**: 攻撃者がリダイレクトURIから認可コードを傍受
2. **クライアントシークレットの管理**: SPAやモバイルアプリではシークレットを安全に保存できない

### PKCEによる解決

PKCEは、クライアントシークレットなしでも安全な認証を実現します：

```
攻撃者が認可コードを傍受しても、
code_verifierがなければトークンを取得できない
```

## 実装詳細

### Admin UI（React + Amplify Auth）

#### 1. Cognito設定

```hcl
# infra/modules/core/cognito/main.tf
resource "aws_cognito_user_pool_client" "admin_ui" {
  name         = "${var.project_name}-${var.environment}-admin-ui"
  user_pool_id = aws_cognito_user_pool.main.id

  # 認可コードフロー
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "profile", "email"]

  # クライアントシークレットなし（PKCEを使用）
  generate_secret = false

  # コールバックURL
  callback_urls = var.admin_callback_urls
  logout_urls   = var.admin_logout_urls
}
```

#### 2. Amplify Auth設定

```typescript
// apps/admin/src/auth/amplifyConfig.ts
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_26bKGhgKT',
      userPoolClientId: '2kc5v7soov084u7u3155uf12tv',
      loginWith: {
        oauth: {
          domain: 'ainews-dev-auth.auth.us-east-1.amazoncognito.com',
          scopes: ['openid', 'profile', 'email'],
          redirectSignIn: ['http://localhost:5173/callback'],
          redirectSignOut: ['http://localhost:5173/logout'],
          responseType: 'code', // 認可コードフロー
          // PKCEは自動的に有効化されます
        }
      }
    }
  }
});
```

#### 3. authProvider実装

```typescript
// apps/admin/src/auth/authProvider.ts
import { AuthProvider } from 'react-admin';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

export const authProvider: AuthProvider = {
  login: async () => {
    // Amplify Authが自動的にPKCEを処理
    await signIn({ provider: 'Cognito' });
  },
  
  logout: async () => {
    await signOut();
  },
  
  checkAuth: async () => {
    try {
      await getCurrentUser();
    } catch {
      throw new Error('Not authenticated');
    }
  },
  
  checkError: (error) => {
    if (error.status === 401 || error.status === 403) {
      return Promise.reject();
    }
    return Promise.resolve();
  },
  
  getIdentity: async () => {
    const user = await getCurrentUser();
    return {
      id: user.userId,
      fullName: user.username,
    };
  },
  
  getPermissions: () => Promise.resolve(),
};
```

### Mobile App（Expo + react-oidc-context）

#### 1. Cognito設定

```hcl
# infra/modules/core/cognito/main.tf
resource "aws_cognito_user_pool_client" "mobile_app" {
  name         = "${var.project_name}-${var.environment}-mobile-app"
  user_pool_id = aws_cognito_user_pool.main.id

  # 認可コードフロー + PKCE
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "profile", "email"]

  # クライアントシークレットなし（PKCE必須）
  generate_secret = false

  # コールバックURL
  callback_urls = var.mobile_callback_urls
  logout_urls   = var.mobile_logout_urls
}
```

#### 2. OIDC設定

```typescript
// apps/mobile/src/auth/cognitoAuthConfig.ts
import { AuthConfiguration } from 'react-oidc-context';

export const cognitoAuthConfig: AuthConfiguration = {
  authority: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_26bKGhgKT',
  client_id: '7u75fip54bo28umn8qeelo3r91',
  redirect_uri: 'exp://localhost:8081/callback',
  response_type: 'code',
  scope: 'openid profile email',
  post_logout_redirect_uri: 'exp://localhost:8081/logout',
  // react-oidc-contextは自動的にPKCEを使用
};
```

#### 3. AuthProvider実装

```typescript
// apps/mobile/App.tsx
import { AuthProvider } from 'react-oidc-context';
import { cognitoAuthConfig } from './src/auth/cognitoAuthConfig';

export default function App() {
  return (
    <AuthProvider {...cognitoAuthConfig}>
      <NavigationContainer>
        {/* アプリコンテンツ */}
      </NavigationContainer>
    </AuthProvider>
  );
}
```

## PKCEフロー詳細

### 1. 認可リクエスト

```typescript
// クライアント側（自動処理）
const code_verifier = generateRandomString(128); // ランダム文字列生成
const code_challenge = base64url(sha256(code_verifier)); // SHA256ハッシュ化

// 認可リクエスト
const authUrl = `https://ainews-dev-auth.auth.us-east-1.amazoncognito.com/oauth2/authorize?` +
  `client_id=2kc5v7soov084u7u3155uf12tv&` +
  `response_type=code&` +
  `scope=openid+profile+email&` +
  `redirect_uri=http://localhost:5173/callback&` +
  `code_challenge=${code_challenge}&` +
  `code_challenge_method=S256`;
```

### 2. 認可コード取得

```
ユーザーがログイン
↓
Cognitoが認可コードを発行
↓
http://localhost:5173/callback?code=xxxxx にリダイレクト
```

### 3. トークン交換

```typescript
// クライアント側（自動処理）
const tokenResponse = await fetch('https://ainews-dev-auth.auth.us-east-1.amazoncognito.com/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: '2kc5v7soov084u7u3155uf12tv',
    code: authorizationCode,
    redirect_uri: 'http://localhost:5173/callback',
    code_verifier: code_verifier, // 元のcode_verifierを送信
  }),
});
```

### 4. Cognito側の検証

```
1. code_verifierを受け取る
2. SHA256でハッシュ化
3. 元のcode_challengeと比較
4. 一致すればトークンを発行
```

## セキュリティ上の利点

### 1. 認可コード傍受攻撃の防止

```
攻撃者が認可コードを傍受
↓
トークンエンドポイントにリクエスト
↓
code_verifierがないため失敗 ❌
```

### 2. クライアントシークレット不要

```
従来: クライアントシークレットをアプリに埋め込む（危険）
PKCE: code_verifierは毎回ランダム生成（安全）
```

### 3. 中間者攻撃（MITM）の防止

```
攻撃者がリダイレクトURIを傍受
↓
認可コードを取得
↓
code_verifierがないためトークン取得失敗 ❌
```

## テスト方法

### Admin UIのPKCEテスト

```bash
# 1. Admin UIを起動
cd apps/admin
pnpm dev

# 2. ブラウザでhttp://localhost:5173にアクセス
# 3. ログインボタンをクリック
# 4. ブラウザの開発者ツールでネットワークタブを確認
# 5. /oauth2/authorize リクエストに code_challenge パラメータがあることを確認
# 6. /oauth2/token リクエストに code_verifier パラメータがあることを確認
```

### Mobile AppのPKCEテスト

```bash
# 1. Mobile Appを起動
cd apps/mobile
pnpm start

# 2. Expo Goでアプリを開く
# 3. ログインボタンをタップ
# 4. React Native Debuggerでネットワークリクエストを確認
# 5. code_challenge と code_verifier の存在を確認
```

## トラブルシューティング

### エラー: "invalid_grant"

**原因**: code_verifierが一致しない

**解決策**:
1. code_verifierが正しく保存されているか確認
2. セッションストレージまたはメモリに保存されているか確認
3. ブラウザのキャッシュをクリア

### エラー: "invalid_request"

**原因**: code_challengeが正しく生成されていない

**解決策**:
1. SHA256ハッシュ化が正しく実行されているか確認
2. Base64URLエンコーディングが正しいか確認
3. ライブラリのバージョンを確認

### PKCEが使用されていない

**原因**: クライアントシークレットが設定されている

**解決策**:
1. Cognito User Pool Clientで`generate_secret = false`を確認
2. 既存のクライアントを削除して再作成
3. Terraform applyを実行

## 参考資料

- [RFC 7636: Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [AWS Cognito PKCE Support](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html)
- [Amplify Auth PKCE](https://docs.amplify.aws/javascript/build-a-backend/auth/connect-your-frontend/sign-in/)
- [react-oidc-context](https://github.com/authts/react-oidc-context)
