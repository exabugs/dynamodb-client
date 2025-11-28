# 技術スタック

## ビルドシステム

- **Monorepo**: pnpm workspace
- **パッケージマネージャー**: pnpm >= 9.0.0
- **Node.js**: >= 22.0.0
- **TypeScript**: 5.3.0+

## コア技術

### バックエンド
- **ランタイム**: Node.js 22 (ARM64)
- **言語**: TypeScript (ESM/CJS via esbuild)
- **クラウド**: AWS (DynamoDB, Lambda, AppSync, Cognito, S3, CloudFront, Step Functions)
- **IaC**: Terraform >= 1.5.0
- **API**: AppSync GraphQL

### フロントエンド
- **管理UI**: React 19, react-admin 5, MUI 6, Vite
- **モバイルアプリ**: Expo 54, React Native 0.81
- **GraphQLクライアント**: Apollo Client 3
- **認証**: Amplify Auth (Cognito Hosted UI), react-oidc-context (OIDC + PKCE)

### データ層
- **データベース**: DynamoDB Single-Table設計（動的シャドウレコード付き）
- **ストレージ**: S3（音声、動画、中間ファイル用）

## コード品質ツール

- **Linting**: ESLint 9 (flat config) with @typescript-eslint 8
- **フォーマット**: Prettier 3 with @trivago/prettier-plugin-sort-imports
- **テスト**: Vitest 2 with v8 coverage

### Prettier設定

#### 設定ファイル

プロジェクトルートの `prettier.config.cjs` で統一的に管理されています。

**重要**: `.prettierrc` (JSON形式) ではなく、`prettier.config.cjs` (CommonJS形式) を使用してください。これにより、プラグインが正しく読み込まれます。

#### インポート順序の自動ソート

`@trivago/prettier-plugin-sort-imports` プラグインにより、インポート文が以下の順序で自動的にソートされます：

1. `@aws-sdk/*` - AWS SDK
2. `react*` - React 関連
3. `@ainews/*` - プロジェクト内パッケージ
4. `^[./]` - 相対パス

各グループ間には空行が自動的に挿入されます。

**例**:
```typescript
// フォーマット前
import { ulid } from '@ainews/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Article } from '@ainews/api-types';
import { useState } from 'react';
import fs from 'fs';

// フォーマット後
import fs from 'fs';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { useState } from 'react';

import { Article } from '@ainews/api-types';
import { ulid } from '@ainews/core';
```

#### フォーマット実行方法

**ルートから実行（推奨）**:
```bash
# 全ファイルをフォーマット
make format
# または
pnpm format

# フォーマットチェックのみ（CI用）
pnpm format:check
```

**VSCode での自動フォーマット**:
- ファイル保存時に自動的にフォーマットされます
- `.vscode/settings.json` で設定済み
- ルートの `prettier.config.cjs` が自動的に参照されます

#### トラブルシューティング

**問題**: エディタ保存時とコマンド実行時でフォーマット結果が異なる

**解決方法**:
1. VSCode の Prettier 拡張機能がインストールされているか確認
2. VSCode を再起動
3. `prettier.config.cjs` が正しく読み込まれているか確認

**問題**: プラグインが認識されない（"Ignored unknown option" 警告）

**解決方法**:
1. ルートから `pnpm install` を実行
2. `prettier.config.cjs` を使用していることを確認（`.prettierrc` ではない）
3. ルートから `pnpm format` を実行

#### 設定変更時の注意

`prettier.config.cjs` を変更した場合：
1. VSCode を再起動
2. `pnpm format` を実行して全ファイルを再フォーマット
3. 変更をコミット前に確認

## コーディング規約

### コメントとドキュメント

- **すべてのコードコメントは日本語で記述すること**
- 対象となるもの:
  - 関数、クラス、インターフェースのJSDocコメント
  - ロジックを説明するインラインコメント
  - テストの説明文（describe/itブロック）
  - TODO/FIXMEコメント
- 変数名、関数名、コード自体は英語のまま
- READMEファイルや外部ドキュメントは、必要に応じて英語または日本語

**例:**
```typescript
/**
 * ユーザー情報を取得する
 * 
 * @param userId - ユーザーID
 * @returns ユーザー情報
 */
export async function getUser(userId: string): Promise<User> {
  // キャッシュから取得を試みる
  const cached = cache.get(userId);
  if (cached) {
    return cached;
  }
  
  // データベースから取得
  const user = await db.query(userId);
  return user;
}
```

## 共通コマンド

```bash
# 依存関係のインストール
pnpm install

# 全ワークスペースのLint
pnpm lint

# 全ワークスペースのフォーマット
pnpm format

# テスト実行
pnpm test

# 全ワークスペースのビルド
pnpm build

# ビルド成果物のクリーンアップ
pnpm clean
```

## TypeScript設定

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: 有効（noUnusedLocals, noUnusedParameters, noImplicitReturns）
- **Output**: 宣言ファイルとソースマップ

## Lambdaバンドリング

- **バンドラー**: esbuild（フルバンドル）
- **Records Lambda**: TypeScript → CJS出力
- **Fetch Lambda**: TypeScript → ESM出力
- **アーキテクチャ**: ARM64（コスト最適化）
