# コアルール（圧縮版）

## 基本原則

1. **日本語使用**: チャットは日本語、コードコメントも日本語推奨
2. **根本解決**: 症状でなく根本原因を解決（型アサーション・eslint-disable禁止）
3. **npm使用**: ビルド・テストは`npm`コマンド（直接実行OK）
4. **Git安全**: `git add .`禁止、個別ファイル追加、コミット前に必ず確認
5. **標準手順**: ステアリング・ドキュメントの手順に従う

## 禁止事項

- ❌ `git add .` / `git reset --hard` / `git push --force`
- ❌ `as any` / `eslint-disable`（理由なし）
- ❌ `terraform` コマンド直接実行（`make infra-*`使用）

## 推奨事項

- ✅ `npm test` / `npm run build` / `npm run lint`
- ✅ `git add <specific-file>` → `git status` → `git diff --staged`
- ✅ 型定義改善で型アサーション不要に
- ✅ 3回以上の重複は共通化（DRY原則）

## チェックリスト

- [ ] 個別ファイル追加（`git add .`禁止）
- [ ] コミット前に`git status`と`git diff --staged`確認
- [ ] 型アサーション・eslint-disable使用していない
- [ ] テスト・ビルドが成功している
