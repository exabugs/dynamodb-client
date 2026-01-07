# React-Admin 多対多関係コンポーネント - 要件文書

## はじめに

dynamodb-clientライブラリは、MongoDB風インターフェースでLambdaと通信するDataProviderを提供している。現在、React-Adminの基本コンポーネントのみをサポートしているが、多対多関係を扱うための専用コンポーネントが不足している。

本要件では、React-Admin Enterprise Edition（有料版）を使用せずに、中間テーブルを透過的に扱える多対多関係コンポーネントを提供する。

## 用語集

- **System**: dynamodb-clientライブラリのReact-Adminコンポーネント
- **DataProvider**: React-AdminとLambda APIの橋渡しをするインターフェース
- **Through_Table**: 多対多関係を管理する中間テーブル（例: venueManagers）
- **Source_Resource**: 起点となるリソース（例: venues）
- **Target_Resource**: 関連先のリソース（例: users）
- **Using_Keys**: 中間テーブルで使用するキーのペア（例: "venueId,userId"）

## 要件

### 要件 1: 多対多関係の表示

**ユーザーストーリー:** 開発者として、React-Adminで多対多関係を表示したい。中間テーブルを経由して関連レコードを表示できるようにするため。

#### 受入基準

1. WHEN ReferenceManyToManyFieldがレンダリングされる THEN THE System SHALL 中間テーブルを経由して関連レコードを取得する
2. WHEN 起点レコードのIDが提供される THEN THE System SHALL 起点キーを使用して中間テーブルをクエリする
3. WHEN 中間レコードが見つかる THEN THE System SHALL ターゲットIDを使用してターゲットレコードを取得する
4. WHEN ターゲットレコードが取得される THEN THE System SHALL 子コンポーネントにデータを渡してレンダリングする
5. WHEN 中間レコードが存在しない THEN THE System SHALL 空のリストを表示する

### 要件 2: 多対多関係の編集

**ユーザーストーリー:** 開発者として、React-Adminで多対多関係を編集したい。関連レコードを追加・削除できるようにするため。

#### 受入基準

1. WHEN ReferenceManyToManyInputがレンダリングされる THEN THE System SHALL 現在の関連レコードを表示する
2. WHEN ユーザーが新しい関連を追加する THEN THE System SHALL フォーム状態を更新する（DB更新はしない）
3. WHEN ユーザーが関連を削除する THEN THE System SHALL フォーム状態を更新する（DB更新はしない）
4. WHEN 親フォームの保存ボタンが押される THEN THE System SHALL 追加された関連の中間レコードを作成する
5. WHEN 親フォームの保存ボタンが押される THEN THE System SHALL 削除された関連の中間レコードを削除する
6. WHEN 親フォームがキャンセルされる THEN THE System SHALL フォーム状態をリセットする（DB更新なし）

### 要件 3: DataProviderの拡張

**ユーザーストーリー:** 開発者として、DataProviderが多対多操作をサポートしてほしい。コンポーネントが中間レコードを取得・操作できるようにするため。

#### 受入基準

1. WHEN getManyがリソースとIDで呼ばれる THEN THE System SHALL IDに一致するレコードを返す
2. WHEN createManyが中間リソースで呼ばれる THEN THE System SHALL 複数の中間レコードを作成する
3. WHEN deleteManyが中間リソースで呼ばれる THEN THE System SHALL 複数の中間レコードを削除する
4. WHEN getListが中間リソースとフィルタで呼ばれる THEN THE System SHALL フィルタされた中間レコードを返す
5. WHEN DataProviderメソッドが失敗する THEN THE System SHALL 説明的なエラーメッセージを返す

### 要件 4: コンポーネントのプロパティ

**ユーザーストーリー:** 開発者として、コンポーネントが標準的なReact-Adminプロパティを受け入れてほしい。既存コードとシームレスに統合できるようにするため。

#### 受入基準

1. WHEN referenceプロパティが提供される THEN THE System SHALL それをターゲットリソース名として使用する
2. WHEN throughプロパティが提供される THEN THE System SHALL それを中間テーブル名として使用する
3. WHEN usingプロパティが提供される THEN THE System SHALL "sourceKey,targetKey"形式としてパースする
4. WHEN sourceプロパティが省略される THEN THE System SHALL デフォルトで"id"をソースフィールドとして使用する
5. WHEN childrenプロパティが提供される THEN THE System SHALL 取得したデータを子コンポーネントに渡す

### 要件 5: エラーハンドリング

**ユーザーストーリー:** 開発者として、操作が失敗したときに明確なエラーメッセージがほしい。問題を素早くデバッグできるようにするため。

#### 受入基準

1. WHEN 中間テーブルが存在しない THEN THE System SHALL 説明的なエラーを返す
2. WHEN ターゲットリソースが存在しない THEN THE System SHALL 説明的なエラーを返す
3. WHEN usingプロパティの形式が無効 THEN THE System SHALL バリデーションエラーを返す
4. WHEN DataProviderメソッドが失敗する THEN THE System SHALL エラーメッセージをReact-Adminに伝播する
5. WHEN ネットワークエラーが発生する THEN THE System SHALL ユーザーフレンドリーなエラー通知を表示する

### 要件 6: パフォーマンス最適化

**ユーザーストーリー:** 開発者として、コンポーネントがAPI呼び出しを最小化してほしい。アプリケーションの応答性を維持するため。

#### 受入基準

1. WHEN 関連レコードを取得する THEN THE System SHALL 中間クエリをバッチ処理する
2. WHEN ターゲットレコードを取得する THEN THE System SHALL 複数IDでgetManyを使用する
3. WHEN 起点レコードが変更される THEN THE System SHALL 保留中のリクエストをキャンセルする
4. WHEN データが既にキャッシュされている THEN THE System SHALL キャッシュされたデータを再利用する
5. WHEN ページネーションが必要 THEN THE System SHALL ページネーションパラメータをサポートする

### 要件 7: TypeScript型安全性

**ユーザーストーリー:** 開発者として、完全なTypeScriptサポートがほしい。コンパイル時にエラーを検出できるようにするため。

#### 受入基準

1. WHEN コンポーネントを使用する THEN THE System SHALL TypeScript型定義を提供する
2. WHEN プロパティが無効 THEN THE System SHALL TypeScriptエラーを表示する
3. WHEN DataProviderメソッドが呼ばれる THEN THE System SHALL 型安全性を強制する
4. WHEN ジェネリック型が使用される THEN THE System SHALL レコード型を正しく推論する
5. WHEN コンポーネントをエクスポートする THEN THE System SHALL 型宣言を含める

### 要件 8: React-Admin統合

**ユーザーストーリー:** 開発者として、コンポーネントがReact-Adminフックと連携してほしい。標準的なパターンを使用できるようにするため。

#### 受入基準

1. WHEN useRecordContextを使用する THEN THE System SHALL 現在のレコードにアクセスする
2. WHEN useDataProviderを使用する THEN THE System SHALL DataProviderインスタンスにアクセスする
3. WHEN useNotifyを使用する THEN THE System SHALL 通知を表示する
4. WHEN useRefreshを使用する THEN THE System SHALL 変更後にデータを更新する
5. WHEN useListContextを使用する THEN THE System SHALL リストビューと統合する

### 要件 9: ドキュメントとサンプル

**ユーザーストーリー:** 開発者として、明確なドキュメントとサンプルがほしい。多対多関係を素早く実装できるようにするため。

#### 受入基準

1. WHEN ドキュメントを読む THEN THE System SHALL ReferenceManyToManyFieldの使用例を提供する
2. WHEN ドキュメントを読む THEN THE System SHALL ReferenceManyToManyInputの使用例を提供する
3. WHEN ドキュメントを読む THEN THE System SHALL usingプロパティの形式を説明する
4. WHEN ドキュメントを読む THEN THE System SHALL DataProvider拡張の例を示す
5. WHEN ドキュメントを読む THEN THE System SHALL TypeScript型の例を含める

### 要件 10: 既存コードとの互換性

**ユーザーストーリー:** 開発者として、新しいコンポーネントが後方互換性を持ってほしい。既存コードが引き続き動作するようにするため。

#### 受入基準

1. WHEN 新しいコンポーネントを追加する THEN THE System SHALL 既存のDataProviderメソッドを壊さない
2. WHEN 新しいコンポーネントを追加する THEN THE System SHALL 既存リソースへの変更を要求しない
3. WHEN 新しいコンポーネントを使用する THEN THE System SHALL 既存のReact-Adminバージョン（v4.x）と動作する
4. WHEN 新しいコンポーネントをエクスポートする THEN THE System SHALL 既存のエクスポート構造を維持する
5. WHEN ライブラリを更新する THEN THE System SHALL セマンティックバージョニングに従う
