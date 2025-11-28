# Cognito User Pool モジュール

このモジュールは、AIニュース自動配信パイプラインのユーザー認証基盤として、Cognito User Poolを作成します。

## 機能

- **User Pool作成**: メール認証、パスワードポリシー設定
- **Hosted UI**: 認可コードフロー（code flow）対応
- **User Pool Client**: Admin UI用とMobile App用の2つのクライアント
- **セキュリティ**: PKCE必須、パスワードポリシー（≥8文字、大小英字+数字）

## 使用方法

```hcl
module "cognito" {
  source = "./modules/core/cognito"

  project_name = var.project_name
  environment  = var.environment

  # MFA設定（本番環境では有効化推奨）
  enable_mfa = var.environment == "prd" ? true : false

  # 削除保護（本番環境では有効化推奨）
  enable_deletion_protection = var.environment == "prd" ? true : false

  # Admin UI用コールバックURL
  admin_callback_urls = [
    "http://localhost:5173",
    "http://localhost:5173/callback",
    "https://admin.example.com",
    "https://admin.example.com/callback"
  ]

  admin_logout_urls = [
    "http://localhost:5173",
    "http://localhost:5173/logout",
    "https://admin.example.com",
    "https://admin.example.com/logout"
  ]

  # Mobile App用コールバックURL
  mobile_callback_urls = [
    "exp://localhost:8081",
    "exp://localhost:8081/callback",
    "myapp://callback"
  ]

  mobile_logout_urls = [
    "exp://localhost:8081",
    "exp://localhost:8081/logout",
    "myapp://logout"
  ]
}
```

## 出力

- `user_pool_id`: Cognito User Pool ID
- `user_pool_arn`: Cognito User Pool ARN
- `user_pool_domain`: Hosted UIドメイン
- `admin_ui_client_id`: Admin UI用クライアントID
- `mobile_app_client_id`: Mobile App用クライアントID
- `hosted_ui_url`: Hosted UI完全URL

## パスワードポリシー

- 最小長: 8文字
- 小文字必須: あり
- 大文字必須: あり
- 数字必須: あり
- 記号必須: なし

## 認証フロー

### Admin UI（React + react-admin）

1. ユーザーがAdmin UIにアクセス
2. Amplify AuthがPKCE code verifierを生成
3. Cognito Hosted UIにリダイレクト（code_challengeを含む）
4. ユーザーがログイン
5. 認可コード（code）を取得
6. Admin UIがトークンと交換（code_verifierを使用）
7. JWTトークンをLocalStorageに保存
8. Records Lambda呼び出し時に`Authorization: Bearer <token>`ヘッダーを付与

**注**: Amplify Authは自動的にPKCEを使用します（`generate_secret = false`の場合）

### Mobile App（Expo/React Native）

1. ユーザーがMobile Appを開く
2. react-oidc-contextでCognito OIDCに接続
3. PKCE付き認可コードフローで認証
4. JWTトークンを取得
5. Records Lambda呼び出し時に`Authorization: Bearer <token>`ヘッダーを付与

## セキュリティ

- **PKCE**: 
  - Admin UI: Amplify Authが自動的にPKCEを使用（`generate_secret = false`）
  - Mobile App: react-oidc-contextでPKCE必須（要件9.4）
- **クライアントシークレット**: SPAとモバイルアプリのため無効（セキュリティベストプラクティス）
- **トークン有効期限**: アクセストークン60分、リフレッシュトークン30日
- **MFA**: オプション（本番環境では有効化推奨）
- **削除保護**: オプション（本番環境では有効化推奨）

## 要件

- 要件6.4: Hosted UI、パスワードポリシー、コールバックURL設定
- 要件9.1: Cognito JWT検証
- 要件9.4: OIDC認証（Mobile App）

## PKCE（Proof Key for Code Exchange）について

### Admin UIでのPKCE

Admin UI（React + react-admin + Amplify Auth）では、以下の理由でPKCEが自動的に使用されます：

1. **クライアントシークレットなし**（`generate_secret = false`）
2. **Amplify Authの自動PKCE**: Amplify Authライブラリは、クライアントシークレットがない場合、自動的にPKCEを使用します
3. **OAuth 2.1準拠**: 最新のOAuth 2.1仕様では、すべてのクライアントでPKCE使用が推奨されています

#### Amplify Auth設定例

```typescript
// apps/admin/src/auth/authProvider.ts
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: `${process.env.VITE_COGNITO_DOMAIN}.auth.${process.env.VITE_COGNITO_REGION}.amazoncognito.com`,
          scopes: ['openid', 'profile', 'email'],
          redirectSignIn: ['http://localhost:5173/callback'],
          redirectSignOut: ['http://localhost:5173/logout'],
          responseType: 'code', // 認可コードフロー
          // PKCEは自動的に有効化されます（generate_secret = false の場合）
        }
      }
    }
  }
});
```

### Mobile AppでのPKCE

Mobile App（Expo + react-oidc-context）では、**要件9.4**に従ってPKCEが必須です：

```typescript
// apps/mobile/src/auth/cognitoAuthConfig.ts
import { AuthConfiguration } from 'react-oidc-context';

export const cognitoAuthConfig: AuthConfiguration = {
  authority: `https://cognito-idp.${process.env.EXPO_PUBLIC_COGNITO_REGION}.amazonaws.com/${process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID}`,
  client_id: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
  redirect_uri: 'exp://localhost:8081/callback',
  response_type: 'code',
  scope: 'openid profile email',
  post_logout_redirect_uri: 'exp://localhost:8081/logout',
  // react-oidc-contextは自動的にPKCEを使用します
};
```

### PKCEのメリット

1. **認可コード傍受攻撃の防止**: 攻撃者が認可コードを傍受しても、code_verifierなしではトークンを取得できません
2. **クライアントシークレット不要**: SPAやモバイルアプリでシークレットを安全に保存する必要がありません
3. **業界標準**: OAuth 2.1では、すべてのクライアントタイプでPKCE使用が推奨されています
4. **セキュリティ強化**: 中間者攻撃（MITM）やコード傍受攻撃からの保護

### PKCEの仕組み

```
1. クライアントがcode_verifier（ランダム文字列）を生成
2. code_verifierをSHA256でハッシュ化してcode_challengeを作成
3. 認可リクエストにcode_challengeを含める
4. Cognitoが認可コードを返す
5. トークンリクエストに元のcode_verifierを含める
6. Cognitoがcode_verifierをハッシュ化してcode_challengeと比較
7. 一致すればトークンを発行
```

### 参考リンク

- [RFC 7636: Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [AWS Cognito PKCE Support](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html)
- [Amplify Auth Documentation](https://docs.amplify.aws/javascript/build-a-backend/auth/)
