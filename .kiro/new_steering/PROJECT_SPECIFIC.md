# プロジェクト固有ルール（圧縮版）

## npmパブリッシュ

### 手順

1. **テスト・ビルド**: `npm test` → `npm run build`
2. **バージョン更新**: `package.json`と`CHANGELOG.md`を更新
3. **コミット**: `git commit -m "chore: bump version to X.Y.Z [publish]"`
4. **プッシュ**: `git push origin main`

**重要**: コミットメッセージに`[publish]`を含めること

### CI Workflow

- npm Trusted Publishing使用
- CI Workflow (`.github/workflows/ci.yml`) のみパブリッシュ可能
- `NPM_TOKEN`不要（OIDCトークン認証）

## Parameter Store設計

### データフロー（一方向）

```
dynamodb-client (書き込み) → Parameter Store → example (読み取り)
```

### 役割分担

- **dynamodb-client**: Parameter Storeに値を書き込む
  - ✅ Terraformパラメータとして外部から値を受け取る
  - ❌ Parameter Storeから値を読み取らない（循環参照）

- **example**: Parameter Storeから値を読み取る
  - ✅ Parameter Storeから直接値を参照
  - ❌ dynamodb-clientに値を渡さない

## Terraform State管理

### 使用制限

- `terraform state rm`は慎重に使用
- 手順書に明記されている場合のみ実行
- 代替手段を優先: `terraform refresh`, `terraform plan`, `terraform taint`

## スペック管理

- **design.md**: Single Source of Truth
- **更新順序**: design.md → 実装 → ドキュメント更新
- **ADR**: `.kiro/adr/{番号}-{決定事項}.md`に配置
