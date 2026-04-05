# TODO

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
