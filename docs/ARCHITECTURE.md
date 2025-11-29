# @ainews/core アーキテクチャ

## コード共通化戦略

**依存性注入（Dependency Injection）パターン**を使用して、認証ハンドラーのみを外部から注入し、ビジネスロジックは100%共通化しています。

### ディレクトリ構造

```
packages/core/src/client/
├── Collection.ts                  # コレクション（共通実装）★
├── Database.ts                    # データベース（共通実装）★
├── DynamoClient.ts                # クライアント（共通実装）★
├── FindCursor.ts                  # カーソル（共通実装）★
├── aws-sigv4.ts                   # AWS署名（Node.js専用）
├── index.ts                       # 共通エクスポート
├── index.iam.ts                   # IAM認証用エントリーポイント
├── index.cognito.ts               # Cognito認証用エントリーポイント
└── index.token.ts                 # Token認証用エントリーポイント
```

★ = 完全に共通化されたファイル（環境別の重複なし）

### 依存性注入パターン

#### 1. 認証ハンドラーの型定義

```typescript
// Collection.ts
export type AuthHeadersGetter = (
  endpoint: string,
  body: string,
  authOptions?: any
) => Promise<Record<string, string>>;
```

#### 2. 共通実装（Collection.ts - 199行）

```typescript
export class Collection<TSchema = any, TAuthOptions = any> {
  constructor(
    private endpoint: string,
    private databaseName: string,
    private collectionName: string,
    private authToken: string | undefined,
    private authOptions: TAuthOptions | undefined,
    private clientOptions: ClientOptions | undefined,
    private getAuthHeaders: AuthHeadersGetter // ★ 認証ハンドラーを注入
  ) {}

  private async request(operation: string, params: any) {
    // ★ 注入された認証ハンドラーを使用
    const authHeaders = await this.getAuthHeaders(this.endpoint, requestBody, this.authOptions);
    // ... 共通ビジネスロジック（100%共通）
  }

  // find, findOne, insertOne, updateOne, deleteOne など
  // すべてのCRUD操作が100%共通
}
```

#### 3. IAM認証用エントリーポイント（index.iam.ts - 約50行）

```typescript
import {
  type ClientOptions as BaseClientOptions,
  DynamoClient as BaseDynamoClient,
} from './DynamoClient.js';
import { signRequest } from './aws-sigv4.js';

export { Database } from './Database.js';
export { Collection } from './Collection.js';
export { FindCursor } from './FindCursor.js';

export interface IAMAuthOptions {
  region: string;
}

export interface ClientOptions extends Omit<BaseClientOptions<IAMAuthOptions>, 'auth'> {
  auth: IAMAuthOptions;
}

export class DynamoClient extends BaseDynamoClient<IAMAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    // ★ IAM認証ハンドラーを注入
    super(endpoint, options, async (url: string, body: string, auth?: IAMAuthOptions) => {
      if (!auth) {
        throw new Error('IAM auth options are required');
      }
      return await signRequest(url, body, auth.region);
    });
  }
}
```

#### 4. Cognito認証用エントリーポイント（index.cognito.ts - 約40行）

```typescript
import {
  type ClientOptions as BaseClientOptions,
  DynamoClient as BaseDynamoClient,
} from './DynamoClient.js';

export { Database } from './Database.js';
export { Collection } from './Collection.js';
export { FindCursor } from './FindCursor.js';

export interface CognitoAuthOptions {
  getToken: () => Promise<string>;
}

export interface ClientOptions extends Omit<BaseClientOptions<CognitoAuthOptions>, 'auth'> {
  auth: CognitoAuthOptions;
}

export class DynamoClient extends BaseDynamoClient<CognitoAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    // ★ Cognito認証ハンドラーを注入
    super(endpoint, options, async (_url: string, _body: string, auth?: CognitoAuthOptions) => {
      if (!auth) {
        throw new Error('Cognito auth options are required');
      }
      const token = await auth.getToken();
      return {
        Authorization: `Bearer ${token}`,
      };
    });
  }
}
```

#### 5. Token認証用エントリーポイント（index.token.ts - 約40行）

```typescript
import {
  type ClientOptions as BaseClientOptions,
  DynamoClient as BaseDynamoClient,
} from './DynamoClient.js';

export { Database } from './Database.js';
export { Collection } from './Collection.js';
export { FindCursor } from './FindCursor.js';

export interface TokenAuthOptions {
  token: string;
}

export interface ClientOptions extends Omit<BaseClientOptions<TokenAuthOptions>, 'auth'> {
  auth: TokenAuthOptions;
}

export class DynamoClient extends BaseDynamoClient<TokenAuthOptions> {
  constructor(endpoint: string, options: ClientOptions) {
    // ★ Token認証ハンドラーを注入
    super(endpoint, options, async (_url: string, _body: string, auth?: TokenAuthOptions) => {
      if (!auth) {
        throw new Error('Token auth options are required');
      }
      return {
        Authorization: `Bearer ${auth.token}`,
      };
    });
  }
}
```

### 認証ハンドラーの実装

認証ハンドラーは各エントリーポイントに直接実装されています。共通のビジネスロジック（Collection.ts、Database.ts、DynamoClient.ts）は、認証ハンドラーを関数として受け取り、依存性注入パターンで実装されています。

#### IAM認証（index.iam.ts）

```typescript
async (url: string, body: string, auth?: IAMAuthOptions) => {
  if (!auth) {
    throw new Error('IAM auth options are required');
  }
  return await signRequest(url, body, auth.region);
};
```

#### Cognito認証（index.cognito.ts）

```typescript
async (_url: string, _body: string, auth?: CognitoAuthOptions) => {
  if (!auth) {
    throw new Error('Cognito auth options are required');
  }
  const token = await auth.getToken();
  return {
    Authorization: `Bearer ${token}`,
  };
};
```

#### Token認証（index.token.ts）

```typescript
async (_url: string, _body: string, auth?: TokenAuthOptions) => {
  if (!auth) {
    throw new Error('Token auth options are required');
  }
  return {
    Authorization: `Bearer ${auth.token}`,
  };
};
```

### パッケージエクスポート

#### IAM認証（Node.js専用）

```typescript
import { DynamoClient } from '@ainews/core/client/iam';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    region: 'ap-northeast-1',
  },
});
```

#### Cognito認証（Node.js/ブラウザ）

```typescript
import { DynamoClient } from '@ainews/core/client/cognito';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    getToken: async () => {
      // トークン取得ロジック
      return token;
    },
  },
});
```

#### Token認証（Node.js/ブラウザ）

```typescript
import { DynamoClient } from '@ainews/core/client/token';

const client = new DynamoClient(FUNCTION_URL, {
  auth: {
    token: 'your-static-token',
  },
});
```

### 型システム

```typescript
// IAM認証（Node.js専用）
interface IAMAuthOptions {
  region: string;
}

// Cognito認証（Node.js/ブラウザ）
interface CognitoAuthOptions {
  getToken: () => Promise<string>;
}

// Token認証（Node.js/ブラウザ）
interface TokenAuthOptions {
  token: string;
}
```

### ビルド成果物

#### 共通ファイル（環境共通）

```
dist/client/
├── Collection.js               # 共通実装（約250行）
├── Database.js                 # 共通実装（約60行）
├── DynamoClient.ts             # 共通実装（約100行）
└── FindCursor.js               # 共通実装（約150行）
```

#### 認証別エントリーポイント

```
dist/client/
├── index.js                    # 共通エクスポート
├── index.iam.js                # IAM認証用（約50行）
├── index.cognito.js            # Cognito認証用（約40行）
└── index.token.js              # Token認証用（約40行）
```

#### AWS署名（Node.js専用）

```
dist/client/
└── aws-sigv4.js                # AWS Signature V4実装
```

### コード共通化の効果

| ファイル                 | 行数        | 共通化率 | 備考         |
| ------------------------ | ----------- | -------- | ------------ |
| Collection.ts            | 約250行     | 100%     | 完全共通     |
| Database.ts              | 約60行      | 100%     | 完全共通     |
| DynamoClient.ts          | 約100行     | 100%     | 完全共通     |
| FindCursor.ts            | 約150行     | 100%     | 完全共通     |
| **ビジネスロジック合計** | **約560行** | **100%** | **完全共通** |
| index.iam.ts             | 約50行      | 局所化   | IAM認証      |
| index.cognito.ts         | 約40行      | 局所化   | Cognito認証  |
| index.token.ts           | 約40行      | 局所化   | Token認証    |
| **認証別コード合計**     | **約130行** | -        | 約19%        |

**結論**: 約560行のビジネスロジックが100%共通化され、認証別のコードは約130行（約19%）のみです。

### 利点

1. **完全な共通化**: ビジネスロジックに重複コードが一切ない
2. **保守性**: バグ修正や機能追加が1箇所で済む
3. **一貫性**: Node.js版とブラウザ版で動作が完全に一致
4. **型安全性**: 環境に応じた型チェックが可能
5. **テスト容易性**: 共通ロジックのテストは1回で済む
6. **依存性の明示**: 認証ハンドラーが明示的に注入される

### トレードオフ

- **コンストラクタの複雑化**: 認証ハンドラーを引数として渡す必要がある
  - → ラッパークラスで隠蔽することで解決
- **型パラメータの追加**: `TAuthOptions` ジェネリクスが必要
  - → 型推論により、ユーザーコードでは意識不要

### 設計パターン

この実装は以下の設計パターンを組み合わせています：

1. **依存性注入（Dependency Injection）**: 認証ハンドラーを外部から注入
2. **ストラテジーパターン（Strategy Pattern）**: 認証方式を切り替え可能
3. **ファサードパターン（Facade Pattern）**: ラッパークラスで複雑さを隠蔽
4. **テンプレートメソッドパターン（Template Method Pattern）**: 共通ロジックを基底クラスに実装

### まとめ

依存性注入パターンにより、**ビジネスロジックの完全な共通化**を実現しました。認証別のコードは各エントリーポイントの約130行のみで、約560行のビジネスロジックは共通ファイル（Collection.ts、Database.ts、DynamoClient.ts、FindCursor.ts）で管理されています。

各認証方式のエントリーポイント（index.iam.ts、index.cognito.ts、index.token.ts）は、認証ハンドラーを無名関数として直接実装し、BaseDynamoClientのコンストラクタに注入します。これにより、認証ロジックの局所化とビジネスロジックの完全な共通化を両立しています。
