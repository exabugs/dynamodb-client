# react-admin統合タスク

## 概要

react-adminのdataProviderを`@ainews/core`パッケージにオプショナルエクスポートとして追加します。

## 目標

- react-adminユーザーが簡単にDynamoDBクライアントを使用できる
- react-adminを使わないユーザーには影響を与えない
- 型安全性を保つ
- 依存関係を最小限にする

---

## タスクリスト

- [ ] 1. ディレクトリ構造の作成
  - `packages/core/src/integrations/react-admin/`ディレクトリを作成
  - 統合コードを配置する場所を準備

- [ ] 2. getIdTokenの抽象化
  - `getIdToken`を依存性注入パターンで抽象化
  - `TokenProvider`インターフェースを定義
  - プロジェクト固有の依存を削除

- [ ] 3. dataProviderの移動と修正
  - `apps/admin/src/dataProvider.ts`を`packages/core/src/integrations/react-admin/dataProvider.ts`にコピー
  - `getIdToken`を`TokenProvider`に置き換え
  - インポートパスを修正

- [ ] 4. package.jsonの更新
  - `peerDependencies`に`react-admin`を追加
  - `peerDependenciesMeta`で`react-admin`をオプショナルに設定
  - `exports`に`./integrations/react-admin`を追加

- [ ] 5. 型定義の整理
  - `DataProviderOptions`に`tokenProvider`を追加
  - `TokenProvider`インターフェースをエクスポート
  - 型定義ファイルを作成

- [ ] 6. READMEの更新
  - react-admin統合の使用例を追加
  - インストール手順を記載
  - `TokenProvider`の実装例を提供

- [ ] 7. テストの作成
  - dataProviderのユニットテストを作成
  - モックを使用してreact-adminへの依存を最小化
  - 各操作（getList、getOne、create、update、delete）をテスト

- [ ] 8. apps/adminの更新
  - `apps/admin/src/dataProvider.ts`を`@ainews/core/integrations/react-admin`を使用するように変更
  - `TokenProvider`を実装
  - 動作確認

---

## 詳細設計

### 1. ディレクトリ構造

```
packages/core/src/
├── integrations/
│   └── react-admin/
│       ├── dataProvider.ts      # dataProvider実装
│       ├── types.ts             # 型定義
│       └── index.ts             # エクスポート
```

### 2. TokenProviderインターフェース

```typescript
// packages/core/src/integrations/react-admin/types.ts

/**
 * トークンプロバイダーインターフェース
 * 
 * 認証トークンを取得するための抽象化インターフェース。
 * プロジェクト固有の認証ロジックを注入できます。
 */
export interface TokenProvider {
  /**
   * 認証トークンを取得
   * 
   * @returns 認証トークン（JWT、Bearer tokenなど）
   * @throws トークンが取得できない場合はエラーをスロー
   */
  getToken(): Promise<string>;
}

/**
 * DataProviderオプション
 */
export interface DataProviderOptions {
  /** Records Lambda Function URL */
  apiUrl: string;
  
  /** データベース名 */
  databaseName: string;
  
  /** トークンプロバイダー */
  tokenProvider: TokenProvider;
  
  /** デフォルトのページサイズ（オプション、デフォルト: 25） */
  defaultPerPage?: number;
  
  /** デフォルトのソートフィールド（オプション、デフォルト: 'id'） */
  defaultSortField?: string;
  
  /** デフォルトのソート順（オプション、デフォルト: 'ASC'） */
  defaultSortOrder?: 'ASC' | 'DESC';
}
```

### 3. dataProviderの修正

```typescript
// packages/core/src/integrations/react-admin/dataProvider.ts

import { DataProvider } from 'react-admin';
import { DynamoClient } from '../../client/index.cognito.js';
import type { Filter } from '../../types.js';
import type { DataProviderOptions, TokenProvider } from './types.js';

/**
 * DynamoDB Client ベースの DataProvider を作成
 */
export function createDataProvider(options: DataProviderOptions): DataProvider {
  const {
    apiUrl,
    databaseName,
    tokenProvider,
    defaultPerPage = 25,
    defaultSortField = 'id',
    defaultSortOrder = 'ASC',
  } = options;

  /**
   * DynamoDB Client インスタンスを作成
   */
  function createClient(): DynamoClient {
    return new DynamoClient(apiUrl, {
      auth: {
        getToken: async () => {
          const token = await tokenProvider.getToken();
          if (!token) {
            throw new Error('認証トークンが見つかりません');
          }
          return token;
        },
      },
    });
  }

  // ... 残りの実装
}
```

### 4. package.jsonの更新

```json
{
  "exports": {
    "./integrations/react-admin": {
      "import": "./dist/integrations/react-admin/index.js",
      "types": "./dist/integrations/react-admin/index.d.ts"
    }
  },
  "peerDependencies": {
    "react-admin": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "react-admin": {
      "optional": true
    }
  }
}
```

### 5. 使用例（apps/admin）

```typescript
// apps/admin/src/dataProvider.ts

import { createDataProvider } from '@ainews/core/integrations/react-admin';
import type { TokenProvider } from '@ainews/core/integrations/react-admin';
import { getIdToken } from './authProvider';

/**
 * Cognito用のTokenProvider実装
 */
const cognitoTokenProvider: TokenProvider = {
  getToken: async () => {
    const token = await getIdToken();
    if (!token) {
      throw new Error('認証トークンが見つかりません');
    }
    return token;
  },
};

/**
 * DataProviderを作成
 */
export const dataProvider = createDataProvider({
  apiUrl: import.meta.env.VITE_RECORDS_API_URL,
  databaseName: 'ainews',
  tokenProvider: cognitoTokenProvider,
  defaultPerPage: 25,
  defaultSortField: 'updatedAt',
  defaultSortOrder: 'DESC',
});
```

### 6. READMEの追加内容

```markdown
## react-admin統合

`@ainews/core`は、react-adminとの統合をサポートしています。

### インストール

```bash
pnpm add @ainews/core react-admin
```

### 使用方法

```typescript
import { createDataProvider } from '@ainews/core/integrations/react-admin';
import type { TokenProvider } from '@ainews/core/integrations/react-admin';

// TokenProviderを実装
const tokenProvider: TokenProvider = {
  getToken: async () => {
    // 認証トークンを取得するロジック
    return 'your-auth-token';
  },
};

// DataProviderを作成
const dataProvider = createDataProvider({
  apiUrl: 'https://your-lambda-url.amazonaws.com',
  databaseName: 'your-database',
  tokenProvider,
});

// react-adminで使用
<Admin dataProvider={dataProvider}>
  {/* ... */}
</Admin>
```

### Cognito認証の例

```typescript
import { Auth } from 'aws-amplify';

const cognitoTokenProvider: TokenProvider = {
  getToken: async () => {
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  },
};
```
```

---

## 検証方法

### 1. ビルドの確認

```bash
pnpm --filter @ainews/core build
```

### 2. テストの実行

```bash
pnpm --filter @ainews/core test
```

### 3. apps/adminでの動作確認

```bash
pnpm --filter @ainews/admin dev
```

### 4. react-adminなしでのビルド確認

```bash
# react-adminをインストールせずにビルドできることを確認
pnpm --filter @ainews/core build
```

---

## 成功基準

- [ ] ビルドが成功する
- [ ] テストが全て通過する
- [ ] apps/adminで正常に動作する
- [ ] react-adminをインストールしなくてもビルドできる
- [ ] 型定義が正しく生成される
- [ ] READMEに使用例が記載されている

---

## 注意事項

### peerDependenciesの扱い

- `react-admin`は`peerDependencies`に指定
- `peerDependenciesMeta`で`optional: true`に設定
- ユーザーが`react-admin`を使用する場合のみインストール

### 型定義の扱い

- `react-admin`の型定義は`@types/react-admin`ではなく、`react-admin`パッケージに含まれる
- `peerDependencies`に指定することで、型チェックが機能する

### eslint-disableの扱い

- `react-admin`の型定義による`any`の使用は避けられない
- コメントで理由を明記する
- 可能な限り型安全性を保つ

---

## 参考情報

- [react-admin DataProvider](https://marmelab.com/react-admin/DataProviderWriting.html)
- [pnpm peerDependencies](https://pnpm.io/package_json#peerdependencies)
- [TypeScript Conditional Exports](https://www.typescriptlang.org/docs/handbook/modules/reference.html#conditional-exports)
