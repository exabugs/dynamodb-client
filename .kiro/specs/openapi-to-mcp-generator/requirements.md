# OpenAPI駆動開発への移行 - 要件定義

## 概要

現在のプロジェクトは「コードファースト」で開発されていますが、本来あるべき姿は「仕様駆動開発（Specification-Driven Development）」です。OpenAPI仕様を真実の情報源（Single Source of Truth）とし、そこからコードやMCPツール定義を自動生成する体制に移行します。

### 現状の問題

1. **コードが先、仕様が後**: 実装が先行し、OpenAPI仕様が不完全
2. **説明文の重複**: スクリプトにハードコードされた説明文が存在
3. **保守性の低さ**: 仕様とコードの同期が手動で困難
4. **拡張性の欠如**: 新しい操作を追加する際に複数箇所を修正

### 目指す姿：仕様駆動開発

```
OpenAPI仕様（SSOT）
    ↓
    ├─→ MCPツール定義（自動生成）
    ├─→ 型定義（将来）
    └─→ スタブコード（将来）
```

### 移行戦略

本スペックでは、2段階で仕様駆動開発に移行します：

**第1段階：OpenAPI仕様を完全にする**
- 既存コードを分析し、完全なOpenAPI仕様を作成
- 日本語説明文を含む詳細な仕様を整備
- この段階では一時的に「コード → OpenAPI」の逆方向

**第2段階：仕様駆動に移行**
- OpenAPI仕様をSSOTとして確立
- OpenAPIからMCPツール定義を自動生成
- 以降は「OpenAPI → コード/MCP」の正しい方向

## プロジェクト固有の前提条件（受け入れる）

以下はdynamodb-client固有の仕様として受け入れます：

1. **単一エンドポイント**: POST / のみ（+ GET /version）
2. **操作の指定方法**: リクエストボディの`op`フィールドで操作を指定
3. **10個の操作**: find, findOne, findMany, findManyReference, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany
4. **既存の実装**: 既存のコードは動作しており、変更しない（OpenAPI仕様のみを整備）

## ユーザーストーリー

### 第1段階：OpenAPI仕様を完全にする

#### US-1.1: 既存コードの分析とOpenAPI仕様の作成

**As a** 開発者  
**I want** 既存のコードを分析して、完全なOpenAPI仕様を作成したい  
**So that** OpenAPI仕様を真実の情報源（SSOT）として確立できる

**受け入れ基準**:
- 10個の操作すべてについて、詳細なOpenAPI仕様を作成する
- 各操作の説明文を日本語で記述する
- パラメータの型、説明、制約（必須/任意、最小値/最大値等）を記述する
- レスポンスの構造を記述する
- `examples`セクションに実際の使用例を含める

#### US-1.2: パラメータの詳細な仕様化

**As a** 開発者  
**I want** 各操作のパラメータを詳細に仕様化したい  
**So that** 自動生成ツールが正確なスキーマを生成できる

**受け入れ基準**:
- ネストされたオブジェクト（`sort.field`, `pagination.perPage`等）を記述する
- 各プロパティの型（string, number, boolean, object, array）を明記する
- 各プロパティの説明文を日本語で記述する
- 必須/任意を明記する（`required`フィールド）
- 制約を明記する（`minimum`, `maximum`, `enum`等）
- **ResourceName**: `enum: [users, venues, events, participations, notifications]`で明示的に定義
- **MongoDB演算子**: JSON Schemaで厳密に定義（`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$regex`, `$near`）

**OpenAPI仕様の例**:
```yaml
examples:
  find:
    summary: Find documents with filter and pagination
    description: DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。
    value:
      op: find
      resource: users
      params:
        filter:
          status: "active"
          age: { $gte: 18 }
        sort:
          field: "createdAt"
          order: "DESC"
        pagination:
          perPage: 10
          nextToken: "..."
    schema:
      type: object
      required: [op, resource]
      properties:
        op:
          type: string
          const: find
        resource:
          type: string
          enum: [users, venues, events, participations, notifications]
          description: リソース名（コレクション名）
        params:
          type: object
          properties:
            filter:
              type: object
              description: |
                フィルター条件（MongoDB形式）。
                
                サポートされる演算子:
                - 比較演算子: $eq, $ne, $gt, $gte, $lt, $lte
                - 配列演算子: $in, $nin
                - 文字列演算子: $regex
                - 地理演算子: $near（プロジェクト固有）
                
                例: { status: "active", age: { $gte: 18 } }
              additionalProperties: true
            sort:
              type: object
              description: ソート条件
              properties:
                field:
                  type: string
                  description: ソート対象フィールド名
                order:
                  type: string
                  enum: [ASC, DESC]
                  description: ソート順序（ASC: 昇順, DESC: 降順）
              required: [field, order]
            pagination:
              type: object
              description: ページネーション設定
              properties:
                perPage:
                  type: number
                  minimum: 1
                  maximum: 50
                  description: 1ページあたりの件数（最大50件）
                nextToken:
                  type: string
                  description: 次ページトークン
```

### 第2段階：仕様駆動に移行

#### US-2.1: OpenAPIからMCPツール定義を自動生成

**As a** 開発者  
**I want** OpenAPI仕様からMCPツール定義を自動生成したい  
**So that** OpenAPI仕様を変更するだけでMCPツール定義が更新される

**受け入れ基準**:
- `scripts/generate-mcp-tools.ts`を新規実装する（既存を完全に置き換え）
- OpenAPI仕様の`examples`セクションから各操作を抽出する
- OpenAPI仕様の`description`をMCPツール定義に反映する
- OpenAPI仕様の`schema`からJSON Schemaを生成する
- 生成されるMCPツール定義は既存と同じ形式とする

#### US-2.2: Makefileターゲットの作成

**As a** 開発者  
**I want** `make generate-mcp-tools`コマンドでMCPツール定義を生成したい  
**So that** 簡単にMCPツール定義を更新できる

**受け入れ基準**:
- `Makefile`に`generate-mcp-tools`ターゲットを追加する
- `tsx scripts/generate-mcp-tools.ts`を実行する
- 生成されたMCPツール定義を`src/mcp/tools/`に出力する
- `src/mcp/tools/index.ts`も自動生成する

#### US-2.3: OpenAPI仕様の検証

**As a** 開発者  
**I want** OpenAPI仕様を検証したい  
**So that** 仕様の品質を保証できる

**受け入れ基準**:
- `make docs-validate`コマンドでOpenAPI仕様を検証できる
- OpenAPI 3.1の仕様に準拠していることを確認する
- 必須フィールドが存在することを確認する
- 型の整合性を確認する

## 非機能要件

### NFR-1: 仕様駆動開発の確立

- OpenAPI仕様を真実の情報源（SSOT）とする
- 説明文、パラメータ定義、制約はすべてOpenAPI仕様で管理
- コードやMCPツール定義はOpenAPI仕様から自動生成

### NFR-2: シンプルさ

- MCPツール生成スクリプトは150行以内
- OpenAPI仕様から直接情報を取得（推論ロジックを最小化）
- ハードコードされた説明文や特殊処理を排除

### NFR-3: 拡張性

- 新しい操作を追加する際は、OpenAPI仕様を更新するだけ
- ジェネレーターのコードを変更する必要がない
- 説明文の変更はOpenAPI仕様のみで完結

### NFR-4: 保守性

- 関数は単一責任の原則に従う
- OpenAPI仕様とMCPツール定義は自動生成（手動編集禁止）
- OpenAPI仕様の検証を自動化

### NFR-5: 将来の拡張性

- OpenAPIから型定義を生成可能な設計
- OpenAPIからスタブコードを生成可能な設計
- OpenAPIからバリデーションロジックを生成可能な設計

## 制約条件

### 技術的制約

- TypeScript/Node.js環境で動作すること
- 既存の依存関係（yaml、fs、path）のみを使用すること
- 既存のMCPツール定義との形式互換性を保つこと
- OpenAPI 3.1仕様に準拠すること

### ビジネス制約

- 既存のコードは変更しない（動作している実装を維持）
- 既存の`make generate-mcp-tools`コマンドは引き続き動作すること
- 生成されるMCPツール定義は現在と同じ形式であること
- OpenAPI仕様の検証を必須とする

## 成功基準

1. **仕様駆動の確立**: OpenAPI仕様がSSOTとして機能している
2. **説明文の一元管理**: すべての説明文がOpenAPI仕様で管理されている
3. **自動生成の達成**: `make generate-mcp-tools`でMCPツール定義を生成可能
4. **コード量の削減**: MCPツール生成スクリプトが150行以内
5. **形式互換性**: 既存のMCPツール定義と同じ出力を生成
6. **検証の自動化**: `make docs-validate`でOpenAPI仕様を検証可能

## 設計の方向性

### 第1段階：OpenAPI仕様の完全化

#### OpenAPI仕様の構造

```yaml
openapi: 3.1.0
info:
  title: DynamoDB Client API
  version: 1.3.45
  description: MongoDB-like API for DynamoDB

paths:
  /:
    post:
      summary: Execute MongoDB-style operation
      requestBody:
        content:
          application/json:
            examples:
              find:
                summary: Find documents with filter and pagination
                description: DynamoDBからレコードを検索します。フィルター、ソート、ページネーションをサポート。
                value:
                  op: find
                  resource: users
                  params:
                    filter: { status: "active" }
                    sort: { field: "createdAt", order: "DESC" }
                    pagination: { perPage: 10 }
                schema:
                  type: object
                  required: [op, resource]
                  properties:
                    op:
                      type: string
                      const: find
                    resource:
                      type: string
                      enum: [users, venues, events, participations, notifications]
                      description: リソース名（コレクション名）
                    params:
                      type: object
                      properties:
                        filter:
                          type: object
                          description: |
                            フィルター条件（MongoDB形式）。
                            
                            サポートされる演算子:
                            - 比較演算子: $eq, $ne, $gt, $gte, $lt, $lte
                            - 配列演算子: $in, $nin
                            - 文字列演算子: $regex
                            - 地理演算子: $near（プロジェクト固有）
                          additionalProperties: true
                        sort:
                          type: object
                          description: ソート条件
                          properties:
                            field:
                              type: string
                              description: ソート対象フィールド名
                            order:
                              type: string
                              enum: [ASC, DESC]
                              description: ソート順序
                        pagination:
                          type: object
                          description: ページネーション設定
                          properties:
                            perPage:
                              type: number
                              minimum: 1
                              maximum: 50
                              description: 1ページあたりの件数
```

#### ResourceNameの定義

ResourceNameは、プロジェクト固有のリソース（コレクション）名を明示的に定義します：

```yaml
resource:
  type: string
  enum: [users, venues, events, participations, notifications]
  description: リソース名（コレクション名）
```

この定義により：
- MCPツール生成時に、有効なリソース名を自動的に検証可能
- OpenAPI仕様から直接リソース一覧を取得可能
- 新しいリソースを追加する際は、OpenAPI仕様のenumを更新するだけ

#### MongoDB演算子の定義

MongoDB演算子は、JSON Schemaで厳密に定義します。ただし、フィルターオブジェクト自体は`additionalProperties: true`とし、動的なフィールド名を許可します。

**フィルターオブジェクトの基本構造**:
```yaml
filter:
  type: object
  description: |
    フィルター条件（MongoDB形式）。
    
    サポートされる演算子:
    - 比較演算子: $eq, $ne, $gt, $gte, $lt, $lte
    - 配列演算子: $in, $nin
    - 文字列演算子: $regex
    - 地理演算子: $near（プロジェクト固有）
  additionalProperties: true
```

**演算子の詳細定義**（説明文として記述）:

```yaml
# 比較演算子の例
age:
  oneOf:
    - type: number  # 直接指定（$eqと同等）
    - type: object
      properties:
        $eq: { type: number, description: "等しい" }
        $ne: { type: number, description: "等しくない" }
        $gt: { type: number, description: "より大きい" }
        $gte: { type: number, description: "以上" }
        $lt: { type: number, description: "より小さい" }
        $lte: { type: number, description: "以下" }

# 配列演算子の例
status:
  oneOf:
    - type: string  # 直接指定（$eqと同等）
    - type: object
      properties:
        $in:
          type: array
          items: { type: string }
          description: "配列内のいずれかに一致"
        $nin:
          type: array
          items: { type: string }
          description: "配列内のいずれにも一致しない"

# 文字列演算子の例
name:
  oneOf:
    - type: string  # 直接指定（$eqと同等）
    - type: object
      properties:
        $regex:
          type: string
          description: "正規表現マッチ"

# 地理演算子の例（$near）
location:
  type: object
  properties:
    $near:
      oneOf:
        # GeoJSON形式
        - type: object
          required: [$geometry]
          properties:
            $geometry:
              type: object
              required: [type, coordinates]
              properties:
                type: { type: string, const: Point }
                coordinates:
                  type: array
                  items: { type: number }
                  minItems: 2
                  maxItems: 2
            $maxDistance: { type: number, minimum: 0 }
            $minDistance: { type: number, minimum: 0 }
        # 簡易形式
        - type: object
          required: [latitude, longitude]
          properties:
            latitude: { type: number, minimum: -90, maximum: 90 }
            longitude: { type: number, minimum: -180, maximum: 180 }
            maxDistance: { type: number, minimum: 0 }
            minDistance: { type: number, minimum: 0 }
```

この定義により：
- 各演算子の型と制約を明確に定義
- MCPツール生成時に、演算子の説明文を自動的に取得可能
- OpenAPI仕様から直接演算子一覧を取得可能
- 新しい演算子を追加する際は、OpenAPI仕様を更新するだけ

### 第2段階：MCPツール生成スクリプトの構造

```typescript
// scripts/generate-mcp-tools.ts

// 1. OpenAPI仕様を読み込む
const spec = yaml.parse(readFile('docs/specs/openapi.yaml'));

// 2. 各操作のMCPツール定義を生成
const examples = spec.paths['/'].post.requestBody.content['application/json'].examples;

for (const [name, example] of Object.entries(examples)) {
  // OpenAPI仕様から直接情報を取得（推論不要）
  const toolName = `dynamodb_${name}`;
  const description = example.description || example.summary;
  const schema = example.schema;
  
  // MCPツール定義を生成
  const code = generateToolCode(toolName, description, schema);
  writeFile(`src/mcp/tools/${name}.ts`, code);
}

// 3. index.tsを生成
const indexCode = generateIndex(Object.keys(examples));
writeFile('src/mcp/tools/index.ts', indexCode);
```

### Makefileターゲット

```makefile
# MCPツール定義を生成
generate-mcp-tools:
	@echo "Generating MCP tools from OpenAPI specification..."
	@tsx scripts/generate-mcp-tools.ts

# OpenAPI仕様を検証
docs-validate:
	@echo "Validating OpenAPI specification..."
	@npx @redocly/cli lint docs/specs/openapi.yaml
```

## MongoDB演算子の詳細仕様

### サポートされる演算子

dynamodb-clientは以下のMongoDB形式の演算子をサポートします：

#### 比較演算子

| 演算子 | 説明 | 例 |
|--------|------|-----|
| `$eq` | 等しい | `{ age: { $eq: 25 } }` または `{ age: 25 }` |
| `$ne` | 等しくない | `{ status: { $ne: "deleted" } }` |
| `$gt` | より大きい | `{ age: { $gt: 18 } }` |
| `$gte` | 以上 | `{ age: { $gte: 18 } }` |
| `$lt` | より小さい | `{ age: { $lt: 65 } }` |
| `$lte` | 以下 | `{ age: { $lte: 65 } }` |

#### 配列演算子

| 演算子 | 説明 | 例 |
|--------|------|-----|
| `$in` | 配列内のいずれかに一致 | `{ status: { $in: ["active", "pending"] } }` |
| `$nin` | 配列内のいずれにも一致しない | `{ status: { $nin: ["deleted", "archived"] } }` |

#### 文字列演算子

| 演算子 | 説明 | 例 |
|--------|------|-----|
| `$regex` | 正規表現マッチ | `{ name: { $regex: "^John" } }` |

#### 地理演算子（プロジェクト固有）

| 演算子 | 説明 | 形式 |
|--------|------|------|
| `$near` | 近隣検索 | GeoJSON形式または簡易形式 |

### $near演算子の詳細

`$near`演算子は、指定された地点から近い順にドキュメントを検索します。2つの形式をサポートします。

#### GeoJSON形式

```yaml
location:
  $near:
    $geometry:
      type: Point
      coordinates: [139.7036, 35.6895]  # [経度, 緯度]
    $maxDistance: 5000  # メートル（オプション）
    $minDistance: 0     # メートル（オプション）
```

**OpenAPI Schema**:
```yaml
location:
  type: object
  properties:
    $near:
      type: object
      required: [$geometry]
      properties:
        $geometry:
          type: object
          required: [type, coordinates]
          properties:
            type:
              type: string
              const: Point
              description: GeoJSONのジオメトリタイプ（Pointのみサポート）
            coordinates:
              type: array
              items:
                type: number
              minItems: 2
              maxItems: 2
              description: 座標 [経度, 緯度]。経度: -180〜180, 緯度: -90〜90
        $maxDistance:
          type: number
          minimum: 0
          description: 最大距離（メートル）。省略時は無制限
        $minDistance:
          type: number
          minimum: 0
          description: 最小距離（メートル）。省略時は0
```

#### 簡易形式

```yaml
location:
  $near:
    latitude: 35.6895
    longitude: 139.7036
    maxDistance: 5000  # メートル（オプション）
    minDistance: 0     # メートル（オプション）
```

**OpenAPI Schema**:
```yaml
location:
  type: object
  properties:
    $near:
      type: object
      required: [latitude, longitude]
      properties:
        latitude:
          type: number
          minimum: -90
          maximum: 90
          description: 緯度（-90〜90）
        longitude:
          type: number
          minimum: -180
          maximum: 180
          description: 経度（-180〜180）
        maxDistance:
          type: number
          minimum: 0
          description: 最大距離（メートル）。省略時は無制限
        minDistance:
          type: number
          minimum: 0
          description: 最小距離（メートル）。省略時は0
```

#### $near検索の動作

1. **シャドウレコード**: 地理座標フィールドに対して、GeoHashベースのシャドウレコードが自動生成される
2. **検索精度**: GeoHash精度6（±610m）から開始し、段階的に精度を下げて検索
3. **9ブロック検索**: 中心ブロック + 周囲8ブロックを検索して候補を収集
4. **距離計算**: Haversine公式で正確な距離を計算し、距離順にソート
5. **結果**: 指定された件数（limit）まで、距離の近い順に返す

#### $near検索の制約

- **ページネーション非対応**: `$near`検索では`nextToken`を使用できない
- **単一フィールド**: 1つのクエリで複数の地理座標フィールドを検索できない
- **他の演算子との併用**: `$near`と他のフィルター条件を併用できない

### OpenAPI仕様での演算子の表現

#### フィルターオブジェクトの定義

```yaml
filter:
  type: object
  description: |
    フィルター条件（MongoDB形式）。
    
    サポートされる演算子:
    - 比較演算子: $eq, $ne, $gt, $gte, $lt, $lte
    - 配列演算子: $in, $nin
    - 文字列演算子: $regex
    - 地理演算子: $near（プロジェクト固有）
    
    例:
    - 単純な等価: { status: "active" }
    - 比較演算子: { age: { $gte: 18 } }
    - 配列演算子: { status: { $in: ["active", "pending"] } }
    - 複数条件: { status: "active", age: { $gte: 18 } }
    - 地理検索: { location: { $near: { latitude: 35.6895, longitude: 139.7036, maxDistance: 5000 } } }
  additionalProperties: true
  examples:
    - status: "active"
    - age: { $gte: 18 }
    - status: { $in: ["active", "pending"] }
    - location:
        $near:
          latitude: 35.6895
          longitude: 139.7036
          maxDistance: 5000
```

## 参考資料

- [Model Context Protocol (MCP) Specification](https://modelcontextprotocol.io/)
- [OpenAPI Specification 3.1](https://spec.openapis.org/oas/v3.1.0)
- [JSON Schema](https://json-schema.org/)
- [Specification-Driven Development](https://swagger.io/resources/articles/adopting-an-api-first-approach/)
- [MongoDB Query Operators](https://www.mongodb.com/docs/manual/reference/operator/query/)
- [GeoJSON Specification](https://geojson.org/)
- 既存実装: `scripts/generate-mcp-tools.ts`
- 既存OpenAPI仕様: `docs/specs/openapi.yaml`
- 既存MCPツール定義: `src/mcp/tools/*.ts`
- 既存操作ハンドラー: `src/server/operations/*.ts`
- 既存Makefile: `Makefile`
- $near演算子の実装: `src/server/operations/find/nearQuery.ts`
- GeoHash型定義: `src/shared/geohash/types.ts`

## 実装の優先順位

### 第1段階：OpenAPI仕様を完全にする（優先度: 最高）

1. 既存コードを分析し、各操作のパラメータを理解する
2. OpenAPI仕様に詳細な`schema`セクションを追加する
3. 10個の操作すべてについて、以下を記述する：
   - 操作の説明文（日本語）
   - パラメータの型と説明
   - 必須/任意の指定
   - 制約（minimum, maximum, enum等）
4. OpenAPI仕様を検証する（`make docs-validate`）

### 第2段階：仕様駆動に移行（優先度: 高）

1. `scripts/generate-mcp-tools.ts`を完全に新規実装
2. OpenAPI仕様から直接情報を取得（推論ロジックを最小化）
3. `Makefile`に`generate-mcp-tools`ターゲットを更新
4. 生成されたMCPツール定義を検証
5. 既存のMCPツール定義と比較テスト

### 第3段階（将来）：さらなる自動化

1. OpenAPIから型定義を生成
2. OpenAPIからスタブコードを生成
3. OpenAPIからバリデーションロジックを生成
4. OpenAPIからテストケースを生成

## 移行のメリット

### 短期的なメリット

1. **説明文の一元管理**: OpenAPI仕様のみを更新すればよい
2. **保守性の向上**: ハードコードされた説明文や特殊処理を排除
3. **拡張性の向上**: 新しい操作を追加する際に、ジェネレーターのコードを変更不要

### 長期的なメリット

1. **仕様駆動開発の確立**: OpenAPI仕様が真実の情報源（SSOT）
2. **自動生成の拡大**: 型定義、スタブコード、バリデーションロジックも自動生成可能
3. **品質の向上**: OpenAPI仕様の検証により、仕様の品質を保証
4. **ドキュメントの自動生成**: OpenAPI仕様からAPIドキュメントを自動生成

## 次のステップ

1. 設計ドキュメント（design.md）の作成
2. 実装タスク（tasks.md）の作成
3. 第1段階の実装（OpenAPI仕様の完全化）
4. 第2段階の実装（MCPツール生成の新規実装）
5. 統合テスト
6. 既存のMCPツール定義との比較検証

