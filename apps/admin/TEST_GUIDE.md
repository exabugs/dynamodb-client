# React Admin + Records Lambda 結合テストガイド

このガイドでは、React Admin の dataProvider と Records Lambda を結合してテストする手順を説明します。

## 認証アーキテクチャ

```
人間（ブラウザ）
  ↓ HTTPS + Cognito JWT
Records Lambda
  ↓ JWT 検証
  ↓
DynamoDB

スクリプト（CLI）
  ↓ HTTPS + AWS SigV4 (IAM)
Records Lambda
  ↓ IAM 検証
  ↓
DynamoDB
```

**セキュリティ:**

- ✅ インターネットに認証なしのエンドポイントを公開しない
- ✅ 人間は Cognito で認証
- ✅ スクリプトは IAM で認証（AWS CLI の認証情報を使用）

---

## 前提条件

1. **Records Lambda が dev 環境にデプロイされていること**
2. **AWS CLI が設定されていること**（スクリプト用）
3. **Cognito User Pool にテストユーザーが作成されていること**（ブラウザ用）

---

## テスト手順

### 1. Cognito テストユーザーの作成

AWS CLI でテストユーザーを作成します：

```bash
# Cognito User Pool ID を確認
cd infra
terraform output

# テストユーザーを作成
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_26bKGhgKT \
  --username test@example.com \
  --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS \
  --region us-east-1

# パスワードを永続化（初回ログイン不要）
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_26bKGhgKT \
  --username test@example.com \
  --password TestPassword123! \
  --permanent \
  --region us-east-1
```

### 2. 環境変数の確認

`.env` ファイルを確認し、以下の設定が正しいことを確認してください：

```bash
# Records Lambda Function URL
VITE_RECORDS_API_URL=https://xxxxx.lambda-url.us-east-1.on.aws/

# Cognito 設定
VITE_COGNITO_USER_POOL_ID=us-east-1_26bKGhgKT
VITE_COGNITO_USER_POOL_CLIENT_ID=2kc5v7soov084u7u3155uf12tv
VITE_COGNITO_DOMAIN=ainews-dev-auth.auth.us-east-1.amazoncognito.com
VITE_COGNITO_REGION=us-east-1
```

### 3. サンプルデータの投入（IAM 認証）

スクリプトは AWS CLI の認証情報を使用して IAM 認証します：

```bash
# apps/admin ディレクトリで実行
cd apps/admin
pnpm seed
```

**出力例:**

```
🚀 サンプルデータ作成を開始します...

📍 API URL: https://xxxxx.lambda-url.us-east-1.on.aws/
📍 Database: ainews
📍 認証: AWS IAM (AWS CLI の認証情報を使用)

📝 Articles を作成中...
  ✅ Created article: AI技術の最新動向 (ID: 01JDXXXXX)
  ...
```

このコマンドで以下のデータが作成されます：

- **Articles**: 5件（technology, development, database, frontend カテゴリ）
- **Tasks**: 5件（todo, in_progress, done ステータス）

### 4. React Admin の起動（Cognito 認証）

```bash
# apps/admin ディレクトリで実行
pnpm dev
```

ブラウザで http://localhost:5173 を開きます。

### 5. Cognito でログイン

1. ログイン画面が表示されます
2. 作成したテストユーザーでログイン：
   - Email: `test@example.com`
   - Password: `TestPassword123!`
3. ログイン成功後、Article と Task のリストが表示されます

### 6. テスト項目

#### 6.1 Article リソースのテスト

**List 表示:**

- ✅ 5件の Article が表示される
- ✅ name, category, status, createdAt, updatedAt が表示される
- ✅ updatedAt でソートされている（最新順）

**フィルター:**

**基本フィルター:**

- ✅ カテゴリでフィルター（technology, development など）
  - フィルターパネルを開く
  - Category を選択
  - "technology" を選択
  - 該当する Article のみが表示される
- ✅ ステータスでフィルター（draft, published）
  - フィルターパネルを開く
  - Status を選択
  - "published" を選択
  - 公開済みの Article のみが表示される

**前方一致検索（`name:starts` オペレーター）:**

- ✅ 名前で前方一致検索
  - フィルターパネルを開く
  - Name (starts with) フィールドに "AI" を入力
  - "AI" で始まる Article のみが表示される（例: "AI技術の最新動向"）
  - ブラウザの開発者ツールで Network タブを確認
  - リクエストボディに `"name:starts": "AI"` が含まれることを確認
  - Lambda ログで "Query optimization applied" が出力されることを確認

**範囲検索（日時フィルター）:**

- ✅ 作成日時で範囲検索
  - フィルターパネルを開く
  - Created After フィールドに日付を入力（例: 2025-11-01）
  - Created Before フィールドに日付を入力（例: 2025-11-30）
  - 指定期間内の Article のみが表示される
  - リクエストボディに `"createdAt:gte:date"` と `"createdAt:lte:date"` が含まれることを確認

**複数フィルター条件の AND 検索:**

- ✅ 複数条件を組み合わせる
  - フィルターパネルを開く
  - Category = "technology" を選択
  - Status = "published" を選択
  - Name (starts with) = "AI" を入力
  - すべての条件に一致する Article のみが表示される
  - リクエストボディに複数のフィルター条件が含まれることを確認

**Query 最適化の動作確認:**

- ✅ ソートフィールドと一致するフィルター条件
  - List を "Name" でソート（昇順または降順）
  - フィルターパネルで Name (starts with) = "R" を入力
  - Lambda ログで以下を確認：
    - "Query optimization applied" が出力される
    - `sortField: "name", operator: "starts", value: "R"` が記録される
    - "Memory filtering applied" で `filtered: 0` （Query で完全にフィルタリング済み）
  - ソートフィールドを "Created At" に変更
  - 同じフィルター条件で再検索
  - Lambda ログで "Query optimization applied" が出力されない（最適化なし）
  - "Memory filtering applied" で `filtered: X` （メモリ内でフィルタリング）

**ソート:**

- ✅ 各カラムをクリックしてソート（昇順・降順）
- ✅ name, category, status, createdAt, updatedAt でソート可能

**Create:**

- ✅ 新しい Article を作成
- ✅ name, category, status を入力
- ✅ 作成後、List に表示される

**Edit:**

- ✅ Article をクリックして編集画面を開く
- ✅ name, category, status を変更
- ✅ 保存後、変更が反映される

**Delete:**

- ✅ Article を削除
- ✅ List から削除される

#### 6.2 Task リソースのテスト

**List 表示:**

- ✅ 5件の Task が表示される
- ✅ name, status, dueDate, createdAt, updatedAt が表示される
- ✅ createdAt でソートされている（最新順）

**フィルター:**

**基本フィルター:**

- ✅ ステータスでフィルター（todo, in_progress, done）
  - フィルターパネルを開く
  - Status を選択
  - "in_progress" を選択
  - 進行中の Task のみが表示される

**前方一致検索（`name:starts` オペレーター）:**

- ✅ 名前で前方一致検索
  - フィルターパネルを開く
  - Name (starts with) フィールドに "Review" を入力
  - "Review" で始まる Task のみが表示される（例: "Review Task"）
  - ブラウザの開発者ツールで Network タブを確認
  - リクエストボディに `"name:starts": "Review"` が含まれることを確認
  - Lambda ログで "Query optimization applied" が出力されることを確認

**範囲検索（日時フィルター）:**

- ✅ 期限日時で範囲検索
  - フィルターパネルを開く
  - Due Date After フィールドに日付を入力（例: 2025-11-20）
  - Due Date Before フィールドに日付を入力（例: 2025-11-30）
  - 指定期間内の Task のみが表示される
  - リクエストボディに `"dueDate:gte:date"` と `"dueDate:lte:date"` が含まれることを確認

**複数フィルター条件の AND 検索:**

- ✅ 複数条件を組み合わせる
  - フィルターパネルを開く
  - Status = "in_progress" を選択
  - Due Date Before = 今日の日付を入力
  - 進行中で期限が過ぎた Task のみが表示される
  - リクエストボディに複数のフィルター条件が含まれることを確認

**Query 最適化の動作確認:**

- ✅ ソートフィールドと一致するフィルター条件
  - List を "Name" でソート（昇順または降順）
  - フィルターパネルで Name (starts with) = "R" を入力
  - Lambda ログで以下を確認：
    - "Query optimization applied" が出力される
    - `sortField: "name", operator: "starts", value: "R"` が記録される
    - "Memory filtering applied" で適切にフィルタリングされている
  - ソートフィールドを "Due Date" に変更
  - 同じフィルター条件で再検索
  - Lambda ログで "Query optimization applied" が出力されない（最適化なし）
  - "Memory filtering applied" でメモリ内フィルタリングが実行される

**ソート:**

- ✅ 各カラムをクリックしてソート（昇順・降順）
- ✅ name, status, dueDate, createdAt, updatedAt でソート可能

**Create:**

- ✅ 新しい Task を作成
- ✅ name, status, dueDate, assignee, description を入力
- ✅ 作成後、List に表示される

**Edit:**

- ✅ Task をクリックして編集画面を開く
- ✅ すべてのフィールドを変更
- ✅ 保存後、変更が反映される

**Delete:**

- ✅ Task を削除
- ✅ List から削除される

#### 6.3 一括操作のテスト

**一括更新:**

- ✅ 複数の Article/Task を選択
- ✅ 一括でステータスを変更
- ✅ すべて更新される

**一括削除:**

- ✅ 複数の Article/Task を選択
- ✅ 一括削除
- ✅ すべて削除される

#### 6.4 ページネーション（無限スクロール）

- ✅ スクロールすると追加データが読み込まれる
- ✅ 最後まで到達すると読み込みが停止する

### 7. Lambda ログの確認

フィルター機能のデバッグやパフォーマンス確認のために、Lambda ログを確認します：

```bash
# リアルタイムでログを表示
aws logs tail /aws/lambda/ainews-dev-records --follow --since 1m

# 過去のログを表示
aws logs tail /aws/lambda/ainews-dev-records --since 10m
```

**確認すべきログ:**

**Query 最適化が適用された場合:**

```json
{
  "level": "debug",
  "message": "Query optimization applied",
  "sortField": "name",
  "operator": "starts",
  "type": "string",
  "value": "R",
  "skValue": "name#R"
}
```

**メモリ内フィルタリング:**

```json
{
  "level": "debug",
  "message": "Memory filtering applied",
  "filtersCount": 1,
  "itemsBeforeFilter": 10,
  "itemsAfterFilter": 3,
  "filtered": 7
}
```

**パフォーマンス指標:**

- `itemsBeforeFilter`: Query で取得したアイテム数
- `itemsAfterFilter`: フィルタリング後のアイテム数
- `filtered`: フィルタリングで除外されたアイテム数

Query 最適化が正しく動作している場合、`filtered` は 0 またはごく少数になります。

### 8. データのクリーンアップ

テスト後、データをクリーンアップする場合：

```bash
# apps/admin ディレクトリで実行
pnpm clean
```

⚠️ **警告**: このコマンドはすべての Article と Task を削除します！

---

## トラブルシューティング

### エラー: "Request failed: Unauthorized"

**原因:** 認証に失敗しています。

**解決方法:**

**ブラウザの場合:**

1. Cognito でログインしているか確認
2. ログアウトして再ログイン
3. ブラウザのキャッシュをクリア

**スクリプトの場合:**

1. AWS CLI が設定されているか確認：`aws sts get-caller-identity`
2. Lambda Function URL を呼び出す権限があるか確認
3. IAM ポリシーを確認

### エラー: "VITE_RECORDS_API_URL が設定されていません"

`.env` ファイルに Records Lambda の Function URL を設定してください：

```bash
VITE_RECORDS_API_URL=https://xxxxx.lambda-url.us-east-1.on.aws/
```

### データが表示されない

1. Records Lambda が正しくデプロイされているか確認
2. DynamoDB テーブルにデータが存在するか確認（`pnpm seed` を実行）
3. ブラウザの開発者ツールでネットワークエラーを確認
4. Cognito でログインしているか確認

### CORS エラー

Records Lambda の CORS 設定を確認してください。開発環境では `allow_origins = ["*"]` が設定されているはずです。

### AWS CLI の認証エラー

```bash
# AWS CLI の設定を確認
aws configure list

# 認証情報を再設定
aws configure
```

---

## 次のステップ

テストが成功したら：

1. **本番環境へのデプロイ**: Terraform で本番環境にデプロイ
2. **追加機能の実装**: 新しいリソースや機能を追加
3. **パフォーマンステスト**: 大量データでのテスト

---

## 参考資料

- [React Admin ドキュメント](https://marmelab.com/react-admin/)
- [DynamoDB Client SDK](../../packages/core/README.md)
- [Records Lambda 実装](../../functions/records/README.md)
- [AWS Cognito ドキュメント](https://docs.aws.amazon.com/cognito/)
- [AWS IAM 認証](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
