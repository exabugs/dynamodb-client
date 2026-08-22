# TODO

## 検索パターンの体系化（API設計の見直し）

### 背景（検索パターン）

2026-08、`toArray()` が1ページ分しか返さず `nextToken` を呼び出し側が手動で
辿らないと取りこぼす問題を `toArrayAll()`（全件自動走査、1.5.0）で解消した。
しかしこれは「有限だが多ページに渡るデータ」向けの対症療法の一つに過ぎず、
利用側（asanowaプロジェクト等）で"何でも `toArrayAll()`"と誤用すると、
今度は逐次HTTP往復によるレイテンシ・タイムアウトという別の問題を生む
（例: 全国スケールで増え続ける一覧、ユーザーの生涯データ）。

そもそも「リストを取得する」という操作は、対象データの性質によって
まったく異なるアクセスパターンが適切であり、ライブラリ側がそのパターンを
一級のAPIとして用意し、利用側はデータの性質に合ったAPIを選ぶ、という設計に
すべきだった。以下に一般的な検索パターンを整理し、現状の実装とのギャップを
洗い出す。

### 一般的な検索パターン（データの性質による分類）

| # | パターン | 特徴 | 例 |
|---|---|---|---|
| 1 | **有限確定**（Bounded-by-domain） | 件数がドメインモデル上、常に少数に制約される | 1ユーザーの保有デバイス、1会場のイベント |
| 2 | **無制限増加**（Unbounded） | システムの利用度・時間経過とともに際限なく増える | 全ユーザー一覧、全会場一覧（地域絞り込みなし）、ユーザーの生涯チェックイン履歴 |
| 3 | **条件付き有限**（Bounded-by-filter） | フィルタを正しくかければ有限だが、かけ忘れると2と同じになる | 「直近7日のイベント」「アクティブな会場」 |
| 4 | **件数・存在確認のみ**（Count/Exists） | 実データは不要で、件数や存在有無だけが必要 | 「このユーザーは既に上限件数登録済みか」 |
| 5 | **順序付き上位N件**（Top-N / Ranking） | 最初から1ページで完結する設計 | ランキング上位10件、近隣検索上位N件 |
| 6 | **大量走査・ストリーム処理**（Bulk scan） | 件数が多いことを前提に、全部をメモリに載せず1件/1ページずつ処理して捨てる | 移行・修復スクリプト、集計バッチ |

### 現状のAPIとのマッピング

| # | パターン | 対応API | 状態 |
|---|---|---|---|
| 1 | 有限確定 | `cursor.toArrayAll()` | ✅ 1.5.0で追加 |
| 2 | 無制限増加 | `cursor.toArray()` + `getPageInfo().nextToken` を呼び出し側が手動ループ | ⚠️ SDKレベルでは可能だが、「これを使うべき」という一級のガイダンス・型的強制がない。利用側が安易に`toArrayAll()`を選んでしまうリスクがある（実際に asanowa 側で発生） |
| 3 | 条件付き有限 | なし | ❌ フィルタ必須化の仕組みがなく、呼び出し側の規律に依存している |
| 4 | 件数・存在確認 | なし | ❌ `count()`/`exists()` operationが存在せず、全件取得して `length` を見るしかない |
| 5 | 順序付き上位N件 | `cursor.limit(n).toArray()` | ✅ 対応済み |
| 6 | 大量走査・ストリーム処理 | なし（`toArrayAll()`で代用するしかない） | ❌ 全件を配列にため込む設計しかなく、真に大量のデータでは危険。`src/scripts/operations/bulkRecordRepair.ts` も現状 `toArrayAll()` に頼っている |

### 対策 TODO（検索パターン）

- [ ] **`count()` / `exists()` operationの追加**（server: `src/server/operations/`, client: `Collection`）
  - パターン4向け。件数上限チェック（例: asanowa の「開催地メンバーシップ上限」TODO）で全件取得を避けられるようにする
  - サーバー側でDynamoDBの `Select: COUNT` を使えば、アイテム本体を転送せず件数だけ取得でき、`toArrayAll()`より大幅に安価
- [ ] **大量走査用のストリーミングAPI**（例: `cursor.pages()` で `AsyncIterable<TSchema[]>` を返す、または `for await` 対応）
  - パターン6向け。ページ単位で処理して捨てられるようにし、`toArrayAll()`のようにメモリに全件を保持しない
  - `bulkRecordRepair.ts` の `fetchAllRecords()` をこちらに置き換える
- [ ] **「フィルタなし・無制限になりうるfind」の検知・警告**
  - パターン3向け。`toArrayAll()`実行時、フィルタが空またはインデックス化されたスコープフィールド（例: venueId, userId相当のフィールド）を含まない場合に警告ログを出す、等
  - 強制はしすぎない（正当な用途もあるため）が、少なくとも気づけるようにする
- [ ] **README / `docs/CLIENT_USAGE.md` に検索パターン選択ガイドを追加**
  - 上記6パターンの表と、それぞれどのAPIを使うべきかの対応をドキュメント化
  - 利用側（asanowa等）が実装前にこの表を見て正しいAPIを選べるようにする

### 関連

- asanowa側の未対応TODO: `specs/server-tasks.md` の「TODO: 無制限に増える全件取得の見直し（GET /venues, GET /user/checkins）」
  - `GET /venues`（$near無し）はパターン2なのに現状パターン1のAPI（`toArrayAll()`相当）で実装されている
  - `GET /user/checkins`もパターン2寄り（ユーザーの生涯データ、年300件超もありうる）

## 開発プロセス改善（再発防止策）

### 背景

1.4.9 リリース時に以下の問題が発生した:
- コード修正（`executeFilterFirstQuery` 新規実装）に対するテストがなかった
- カバレッジ閾値を意識せずにコミット・プッシュした（CI で初めて気づいた）
- `[publish]` タグの仕組みを理解せずに publish しようとした

### 対策 TODO

- [ ] **`executeFilterFirstQuery` のテストを追加**
  - `selectFilterFirstCandidate`: schema なし → filter-first 無効
  - `selectFilterFirstCandidate`: 低カーディナリティ → filter-first 無効
  - `selectFilterFirstCandidate`: 高カーディナリティ → filter-first 有効
  - `executeFilterFirstQuery`: 複数ページのシャドウを全件ループ取得
  - `executeFilterFirstQuery`: メモリソートが正しく適用される
  - `executeFilterFirstQuery`: オフセットページネーション（nextToken）
  - 対象ファイル: `__tests__/operations/find-filter-first.test.ts`

- [ ] **コミット前チェックの習慣化**
  ```bash
  # コミット前に必ず実行
  npm run test:unit      # ユニットテスト（SSO不要）
  npm run test:coverage  # カバレッジ閾値確認（60%維持）
  npm run build          # ビルド確認
  ```

- [ ] **パブリッシュプロセスの文書化**
  - `docs/PUBLISHING.md` に正しい手順を記載
  - バージョンアップ + `[publish]` タグを同じコミットに含める
  - コミット前にすべてのテストが通ることを確認してから `[publish]` を付ける

### 正しいパブリッシュ手順（暫定メモ）

```bash
# 1. 変更を実装
# 2. テスト・ビルドを確認
npm run test:unit && npm run test:coverage && npm run build

# 3. バージョンアップ
npm version patch  # または minor / major

# 4. [publish] タグ付きコミット（バージョンアップと同じコミット）
git add package.json
git commit -m "chore: bump version to X.Y.Z [publish]"

# 5. push → CI が自動 publish
git push
```
