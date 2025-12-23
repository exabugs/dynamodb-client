# コントリビューションガイド

DynamoDB Client SDKへのコントリビューションをお考えいただき、ありがとうございます！このガイドでは、プロジェクトに貢献するための手順とガイドラインを説明します。

## 目次

- [開発環境のセットアップ](#開発環境のセットアップ)
- [プロジェクト構造](#プロジェクト構造)
- [開発ワークフロー](#開発ワークフロー)
- [コーディング規約](#コーディング規約)
- [テストの書き方](#テストの書き方)
- [プルリクエストのプロセス](#プルリクエストのプロセス)
- [コミットメッセージの規約](#コミットメッセージの規約)
- [リリースプロセス](#リリースプロセス)
- [コミュニティガイドライン](#コミュニティガイドライン)

## 開発環境のセットアップ

### 必要な環境

- **Node.js**: 18.x 以上（推奨: 22.x）
- **npm**: 9.x 以上
- **Git**: 2.x 以上

### セットアップ手順

1. **リポジトリをフォーク**

   GitHubでリポジトリをフォークし、ローカルにクローンします。

   ```bash
   git clone https://github.com/YOUR_USERNAME/dynamodb-client.git
   cd dynamodb-client
   ```

2. **依存関係をインストール**

   ```bash
   npm install
   ```

3. **ビルドを実行**

   ```bash
   npm run build
   ```

4. **テストを実行**

   ```bash
   npm test
   ```

5. **開発用の環境変数を設定**

   テスト用のLambda Function URLを設定します（オプション）。

   ```bash
   cp .env.example .env
   # .envファイルを編集してテスト用のエンドポイントを設定
   ```

## プロジェクト構造

```
dynamodb-client/
├── src/                          # ソースコード
│   ├── client/                   # クライアントSDK
│   │   ├── index.ts             # 共通エクスポート
│   │   ├── index.iam.ts         # IAM認証用クライアント
│   │   ├── index.cognito.ts     # Cognito認証用クライアント
│   │   ├── index.token.ts       # Token認証用クライアント
│   │   ├── Database.ts          # データベースクラス
│   │   ├── Collection.ts        # コレクションクラス
│   │   └── FindCursor.ts        # カーソルクラス
│   ├── server/                  # Lambda関数
│   │   ├── handler.ts           # エントリーポイント
│   │   ├── operations/          # CRUD操作
│   │   └── utils/               # ユーティリティ
│   ├── shared/                  # 共通モジュール
│   │   ├── types/               # 型定義
│   │   ├── errors/              # エラークラス
│   │   ├── utils/               # ユーティリティ
│   │   └── constants/           # 定数
│   ├── shadows/                 # シャドウレコード管理
│   └── integrations/            # 外部統合
│       └── react-admin/         # react-admin統合
├── __tests__/                   # テストファイル
├── docs/                        # ドキュメント
├── scripts/                     # スクリプト
└── examples/                    # サンプルコード
```

## 開発ワークフロー

### 1. Issue の確認

- 新機能やバグ修正を始める前に、関連するIssueが存在するか確認してください
- Issueが存在しない場合は、新しいIssueを作成して議論してください
- 大きな変更の場合は、事前にメンテナーと相談することをお勧めします

### 2. ブランチの作成

メインブランチから新しいブランチを作成します。

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

**ブランチ命名規則:**
- `feature/` - 新機能
- `fix/` - バグ修正
- `docs/` - ドキュメント更新
- `refactor/` - リファクタリング
- `test/` - テスト追加・修正

### 3. 開発

- コードを変更します
- テストを追加・更新します
- ドキュメントを更新します（必要に応じて）

### 4. テストの実行

変更後は必ずテストを実行してください。

```bash
# 全テストを実行
npm test

# 特定のテストファイルを実行
npm test -- __tests__/client/Collection.test.ts

# カバレッジを確認
npm run test:coverage
```

### 5. Lintとフォーマット

コードの品質を保つため、Lintとフォーマットツールでチェックしてください。

```bash
# Lintチェック
npm run lint

# 自動修正
npm run lint:fix

# フォーマット
npm run format
```

### 6. ビルドの確認

```bash
npm run build
```

## コーディング規約

### TypeScript

- **厳密な型定義**: `any`の使用は避け、適切な型を定義してください
- **型安全性**: 型アサーションは最小限に抑えてください
- **インターフェース**: 複雑なオブジェクトには適切なインターフェースを定義してください

```typescript
// ✅ 良い例
interface Product {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive';
}

// ❌ 悪い例
const product: any = { ... };
```

### 命名規則

- **変数・関数**: camelCase（例: `getUserData`, `productCount`）
- **クラス・インターフェース**: PascalCase（例: `Collection`, `FilterOperators`）
- **定数**: UPPER_SNAKE_CASE（例: `DEFAULT_TIMEOUT_MS`）
- **ファイル名**: kebab-case（例: `find-cursor.ts`）またはPascalCase（例: `Collection.ts`）

### コメント

- **JSDocコメント**: すべてのpublic関数・クラスにJSDocコメントを追加してください
- **言語**: コメントは日本語で記述してください（プロジェクトの方針）
- **説明**: 何をするかだけでなく、なぜそうするかも説明してください

```typescript
/**
 * フィルタ条件に一致するドキュメントを検索する
 * 
 * MongoDB風のクエリAPIを提供し、型安全なフィルタリングを実現します。
 * 
 * @param filter - フィルタ条件（省略可）
 * @param options - 検索オプション（省略可）
 * @returns FindCursorインスタンス
 * 
 * @example
 * ```typescript
 * const cursor = collection.find({ status: 'active' });
 * const results = await cursor.toArray();
 * ```
 */
find(filter?: Filter<TSchema>, options?: FindOptions): FindCursor<TSchema> {
  // 実装...
}
```

### エラーハンドリング

- **適切なエラークラス**: カスタムエラークラスを使用してください
- **エラーメッセージ**: 分かりやすく、デバッグに役立つメッセージを提供してください
- **エラーの伝播**: 適切にエラーを上位に伝播させてください

```typescript
// ✅ 良い例
if (!collectionName || collectionName.trim() === '') {
  throw new ValidationError('Collection name cannot be empty');
}

// ❌ 悪い例
if (!collectionName) {
  throw new Error('Invalid input');
}
```

## テストの書き方

### テストの種類

1. **単体テスト**: 個別の関数・クラスのテスト
2. **統合テスト**: 複数のコンポーネントの連携テスト
3. **E2Eテスト**: 実際のLambda Function URLを使用したテスト

### テストファイルの配置

```
__tests__/
├── client/                      # クライアントSDKのテスト
│   ├── Collection.test.ts
│   ├── Database.test.ts
│   └── FindCursor.test.ts
├── server/                      # Lambda関数のテスト
│   ├── handler.test.ts
│   └── operations/
├── shared/                      # 共通モジュールのテスト
└── integrations/                # 統合のテスト
    └── react-admin/
```

### テストの書き方

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Collection } from '../src/client/Collection';

describe('Collection', () => {
  let collection: Collection<TestDocument>;

  beforeEach(() => {
    // テスト前のセットアップ
    collection = new Collection(/* ... */);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
  });

  describe('find()', () => {
    it('フィルタ条件なしで全件検索できる', async () => {
      // Arrange
      const expectedResults = [/* テストデータ */];
      
      // Act
      const cursor = collection.find();
      const results = await cursor.toArray();
      
      // Assert
      expect(results).toEqual(expectedResults);
    });

    it('フィルタ条件ありで絞り込み検索できる', async () => {
      // テスト実装...
    });

    it('不正なフィルタでエラーが発生する', async () => {
      // エラーケースのテスト...
      await expect(collection.find({ invalid: 'filter' }))
        .rejects
        .toThrow('Invalid filter');
    });
  });
});
```

### テストのベストプラクティス

- **AAA パターン**: Arrange（準備）、Act（実行）、Assert（検証）の順序で書く
- **説明的なテスト名**: テストが何を検証するかが分かる名前を付ける
- **独立性**: テスト間で状態を共有しない
- **モック**: 外部依存関係は適切にモックする
- **エッジケース**: 正常系だけでなく異常系もテストする

## プルリクエストのプロセス

### 1. プルリクエストの作成

1. **変更をコミット**

   ```bash
   git add .
   git commit -m "feat: 新機能の説明"
   git push origin feature/your-feature-name
   ```

2. **プルリクエストを作成**

   GitHubでプルリクエストを作成し、以下の情報を含めてください：

   - **タイトル**: 変更内容を簡潔に説明
   - **説明**: 変更の詳細、理由、影響範囲
   - **関連Issue**: `Fixes #123` または `Closes #123`
   - **テスト**: 追加・変更したテストの説明
   - **チェックリスト**: 下記のチェックリストを確認

### 2. プルリクエストのチェックリスト

- [ ] コードが動作することを確認した
- [ ] テストを追加・更新した
- [ ] すべてのテストが通過する
- [ ] Lintエラーがない
- [ ] ドキュメントを更新した（必要に応じて）
- [ ] 破壊的変更がある場合は明記した
- [ ] コミットメッセージが規約に従っている

### 3. レビュープロセス

- **自動チェック**: CI/CDが自動的にテスト・Lintを実行します
- **コードレビュー**: メンテナーがコードをレビューします
- **フィードバック**: 必要に応じて修正を依頼します
- **承認**: レビューが完了すると、プルリクエストがマージされます

### 4. マージ後

- **ブランチの削除**: マージ後は作業ブランチを削除してください
- **ローカルの更新**: mainブランチを最新に更新してください

```bash
git checkout main
git pull origin main
git branch -d feature/your-feature-name
```

## コミットメッセージの規約

[Conventional Commits](https://www.conventionalcommits.org/)に従ってコミットメッセージを書いてください。

### 形式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Type

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの意味に影響しない変更（空白、フォーマット等）
- `refactor`: バグ修正でも新機能でもないコード変更
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更

### 例

```bash
# 新機能
git commit -m "feat(client): Cognito認証サポートを追加"

# バグ修正
git commit -m "fix(server): フィルタ条件の型チェックを修正"

# ドキュメント
git commit -m "docs: APIリファレンスを更新"

# 破壊的変更
git commit -m "feat(client): Collection APIを刷新

BREAKING CHANGE: find()メソッドの戻り値がPromise<T[]>からFindCursor<T>に変更されました"
```

## リリースプロセス

### バージョニング

[Semantic Versioning](https://semver.org/)に従います：

- **MAJOR**: 破壊的変更
- **MINOR**: 後方互換性のある新機能
- **PATCH**: 後方互換性のあるバグ修正

### リリース手順

1. **バージョンの更新**

   ```bash
   # package.jsonのバージョンを更新
   npm version patch  # または minor, major
   ```

2. **CHANGELOGの更新**

   `CHANGELOG.md`に変更内容を記載します。

3. **npmへの公開**

   ```bash
   # コミットメッセージに[publish]を含めてプッシュ
   git commit -m "chore: bump version to 0.1.x [publish]"
   git push origin main
   ```

   GitHub Actionsが自動的にnpmに公開します。

## コミュニティガイドライン

### 行動規範

- **尊重**: すべての参加者を尊重し、建設的な議論を心がけてください
- **包括性**: 多様な背景を持つ人々を歓迎します
- **協力**: 問題解決に向けて協力的に取り組んでください
- **学習**: 間違いから学び、他者の学習も支援してください

### コミュニケーション

- **Issue**: バグ報告や機能要望はGitHub Issueで行ってください
- **Discussion**: 設計に関する議論はGitHub Discussionsを使用してください
- **質問**: 使用方法に関する質問もGitHub Discussionsで受け付けています

### 貢献の種類

コードの貢献以外にも、以下の方法でプロジェクトに貢献できます：

- **バグ報告**: 問題を発見した場合はIssueで報告してください
- **機能要望**: 新機能のアイデアがあればIssueで提案してください
- **ドキュメント改善**: ドキュメントの誤りや改善点があれば修正してください
- **サンプルコード**: 使用例やチュートリアルを作成してください
- **テスト**: テストケースを追加してください
- **レビュー**: 他の人のプルリクエストをレビューしてください

## よくある質問

### Q: 開発環境でテストを実行するにはどうすればよいですか？

A: `npm test`でローカルテストを実行できます。実際のLambda Function URLを使用したE2Eテストを行う場合は、`.env`ファイルでエンドポイントを設定してください。

### Q: 新しい認証方式を追加したいのですが、どこから始めればよいですか？

A: まずIssueで提案し、設計について議論してください。既存の認証方式（`src/client/index.*.ts`）を参考に実装できます。

### Q: react-admin以外のフレームワーク統合を追加できますか？

A: はい！`src/integrations/`ディレクトリに新しい統合を追加できます。まずIssueで提案してください。

### Q: パフォーマンスの問題を発見しました。どうすればよいですか？

A: Issueでパフォーマンスの問題を報告し、可能であれば再現手順やベンチマーク結果を含めてください。

## サポート

質問や問題がある場合は、以下の方法でサポートを受けられます：

- **GitHub Issues**: バグ報告や機能要望
- **GitHub Discussions**: 使用方法や設計に関する質問
- **README**: 基本的な使用方法
- **API Reference**: 詳細なAPI仕様（`docs/API.md`）

---

DynamoDB Client SDKへのコントリビューションをお待ちしています！質問があれば、遠慮なくIssueやDiscussionで聞いてください。