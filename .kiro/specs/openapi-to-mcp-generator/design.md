# OpenAPI駆動MCP開発への移行 - 設計ドキュメント

## 概要

本設計は、OpenAPI仕様を真実の情報源（Single Source of Truth: SSOT）として確立し、MCPツール定義を自動生成する仕組みを構築します。これにより、仕様駆動開発を実現し、手動メンテナンスの負担を削減します。

### 設計目標

1. **仕様駆動開発の確立**: OpenAPI仕様をSSOTとし、MCPツール定義を自動生成
2. **シンプルさ**: 生成スクリプトは150行以内、依存関係は最小限
3. **型安全性**: TypeScriptの型システムを活用し、実行時エラーを防止
4. **保守性**: 既存コードは変更せず、OpenAPI仕様のみを整備

### 2段階の移行戦略

**第1段階（現在）**: 既存コードを分析し、完全なOpenAPI仕様を作成
- 方向: 既存コード → OpenAPI仕様（一時的に逆方向）
- 目的: 現状の完全な仕様化

**第2段階（本設計）**: OpenAPI仕様をSSOTとして確立
- 方向: OpenAPI仕様 → MCPツール定義（正しい方向）
- 目的: 仕様駆動開発の実現

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenAPI Specification                    │
│                    (openapi-spec.yaml)                       │
│                                                              │
│  - ResourceName enum定義                                     │
│  - MongoDB演算子のJSON Schema定義                            │
│  - 全CRUD操作の詳細仕様                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 読み込み
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              MCP Tool Generator Script                       │
│           (scripts/generate-mcp-tools.ts)                    │
│                                                              │
│  1. OpenAPI仕様の読み込みと検証                              │
│  2. 各operationの解析                                        │
│  3. MCPツール定義の生成                                      │
│  4. TypeScriptコードの出力                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 生成
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Generated MCP Tools                             │
│           (src/mcp/tools/generated.ts)                       │
│                                                              │
│  - 型安全なツール定義配列                                     │
│  - JSON SchemaベースのinputSchema                            │
│  - 自動生成の警告コメント                                     │
└─────────────────────────────────────────────────────────────┘
```


### データフロー

```
OpenAPI仕様ファイル
    ↓
[1] YAML解析
    ↓
OpenAPIオブジェクト
    ↓
[2] 検証（必須フィールド、構造）
    ↓
検証済みOpenAPI仕様
    ↓
[3] Operation抽出
    ↓
Operation配列
    ↓
[4] 各Operationの変換
    ├─ operationId → ツール名
    ├─ description → ツール説明
    ├─ parameters → inputSchema
    └─ requestBody → inputSchema
    ↓
MCPツール定義配列
    ↓
[5] TypeScriptコード生成
    ↓
生成されたツールファイル
```

### コンポーネント設計

#### 1. OpenAPI Loader（仕様読み込み）

**責務**: OpenAPI仕様ファイルを読み込み、構造化されたオブジェクトに変換

```typescript
interface OpenAPILoader {
  load(filePath: string): Promise<OpenAPISpec>;
  validate(spec: OpenAPISpec): ValidationResult;
}
```

**処理フロー**:
1. ファイルシステムからYAMLファイルを読み込み
2. YAMLをJavaScriptオブジェクトに解析
3. OpenAPI 3.1仕様に準拠しているか検証
4. 必須フィールド（openapi, info, paths）の存在確認

**エラーハンドリング**:
- ファイルが存在しない → `FileNotFoundError`
- YAML構文エラー → `YAMLParseError`
- 必須フィールド欠如 → `ValidationError`


#### 2. Operation Extractor（操作抽出）

**責務**: OpenAPI仕様から全operationを抽出し、MCPツール生成に必要な情報を整理

```typescript
interface OperationExtractor {
  extractOperations(spec: OpenAPISpec): Operation[];
}

interface Operation {
  operationId: string;
  method: string;
  path: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Responses;
}
```

**処理フロー**:
1. `paths`オブジェクトを走査
2. 各パス配下のHTTPメソッド（get, post, put, delete）を抽出
3. 各operationのメタデータを収集
4. Operation配列として返却

**抽出対象**:
- `operationId`: MCPツール名として使用
- `description`: ツールの説明文
- `parameters`: クエリパラメータ、パスパラメータ
- `requestBody`: リクエストボディのスキーマ
- `responses`: レスポンススキーマ（200番台）

#### 3. Schema Converter（スキーマ変換）

**責務**: OpenAPIのパラメータ定義をMCPのinputSchemaに変換

```typescript
interface SchemaConverter {
  convertParameters(parameters: Parameter[]): JSONSchema;
  convertRequestBody(requestBody: RequestBody): JSONSchema;
  mergeSchemas(schemas: JSONSchema[]): JSONSchema;
}
```

**変換ルール**:

1. **パラメータの変換**:
   - `in: query` → `properties`配列に追加
   - `in: path` → `required`配列に追加
   - `schema` → そのままJSON Schemaとして使用

2. **RequestBodyの変換**:
   - `content['application/json'].schema` → JSON Schemaとして抽出
   - `required: true` → `required`配列に追加

3. **スキーマのマージ**:
   - parametersとrequestBodyのスキーマを統合
   - `properties`をマージ
   - `required`配列を結合


**JSON Schema制約の保持**:

以下の制約は変換後も保持される:
- `enum`: 列挙値（例: ResourceName）
- `pattern`: 正規表現パターン
- `minimum`, `maximum`: 数値の範囲
- `minLength`, `maxLength`: 文字列の長さ
- `type`: データ型
- `oneOf`, `anyOf`: 複合型定義

#### 4. Tool Definition Generator（ツール定義生成）

**責務**: 抽出したoperationからMCPツール定義を生成

```typescript
interface ToolDefinitionGenerator {
  generateTool(operation: Operation): MCPToolDefinition;
  generateAllTools(operations: Operation[]): MCPToolDefinition[];
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

**生成ルール**:

1. **ツール名**: `operationId`をそのまま使用
   - 例: `findRecords` → `findRecords`

2. **説明文**: `description`を使用、なければ`summary`を使用
   - 例: "Find records with optional filtering and pagination"

3. **inputSchema**: 変換されたJSON Schemaを使用
   - `type: "object"`
   - `properties`: パラメータとrequestBodyの統合
   - `required`: 必須パラメータの配列

**特殊な処理**:

- **ResourceName enum**: 明示的に定義された値のみを許可
  ```json
  {
    "type": "string",
    "enum": ["users", "venues", "events", "participations", "notifications"]
  }
  ```

- **MongoDB演算子**: JSON Schemaで厳密に定義
  ```json
  {
    "type": "object",
    "properties": {
      "$eq": { "type": ["string", "number", "boolean"] },
      "$ne": { "type": ["string", "number", "boolean"] },
      "$gt": { "type": "number" },
      "$gte": { "type": "number" },
      "$lt": { "type": "number" },
      "$lte": { "type": "number" },
      "$in": { "type": "array" },
      "$nin": { "type": "array" },
      "$regex": { "type": "string" },
      "$near": { /* 簡易形式のみ */ }
    }
  }
  ```


- **$near演算子（簡易形式のみ）**:
  ```json
  {
    "type": "object",
    "required": ["latitude", "longitude"],
    "properties": {
      "latitude": {
        "type": "number",
        "minimum": -90,
        "maximum": 90,
        "description": "緯度（-90〜90）"
      },
      "longitude": {
        "type": "number",
        "minimum": -180,
        "maximum": 180,
        "description": "経度（-180〜180）"
      },
      "maxDistance": {
        "type": "number",
        "minimum": 0,
        "description": "最大距離（メートル）"
      },
      "minDistance": {
        "type": "number",
        "minimum": 0,
        "description": "最小距離（メートル）"
      }
    }
  }
  ```

#### 5. Code Generator（コード生成）

**責務**: MCPツール定義配列からTypeScriptコードを生成

```typescript
interface CodeGenerator {
  generateCode(tools: MCPToolDefinition[]): string;
  writeToFile(code: string, outputPath: string): Promise<void>;
}
```

**生成されるコードの構造**:

```typescript
// 自動生成の警告コメント
/**
 * このファイルは自動生成されています。
 * 直接編集しないでください。
 * 
 * 生成元: openapi-spec.yaml
 * 生成日時: 2026-01-XX XX:XX:XX
 * 生成スクリプト: scripts/generate-mcp-tools.ts
 */

// 必要なimport
import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ツール定義配列
export const tools: Tool[] = [
  {
    name: 'findRecords',
    description: 'Find records with optional filtering and pagination',
    inputSchema: { /* JSON Schema */ }
  },
  // ... 他のツール定義
];
```


**コード生成の詳細**:

1. **ヘッダーコメント**: 自動生成の警告と生成情報
2. **Import文**: MCPのTool型をインポート
3. **ツール配列**: `export const tools: Tool[]`として定義
4. **フォーマット**: Prettierで整形（既存の設定を使用）

## OpenAPI仕様の詳細構造

### 仕様ファイルの配置

```
openapi-spec.yaml  # プロジェクトルートに配置
```

### 仕様の構造

```yaml
openapi: 3.1.0
info:
  title: DynamoDB Client API
  version: 1.0.0
  description: RESTful API for DynamoDB operations with MongoDB-like query syntax

paths:
  /records/{resource}:
    get:
      operationId: findRecords
      summary: Find records
      description: Find records with optional filtering and pagination
      parameters:
        - name: resource
          in: path
          required: true
          schema:
            type: string
            enum: [users, venues, events, participations, notifications]
        - name: filter
          in: query
          required: false
          schema:
            type: object
            additionalProperties:
              oneOf:
                - type: string
                - type: number
                - type: boolean
                - type: object  # MongoDB演算子
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      type: object
```

### ResourceName Enumの定義

```yaml
components:
  schemas:
    ResourceName:
      type: string
      enum:
        - users
        - venues
        - events
        - participations
        - notifications
      description: Available resource types in the system
```


### MongoDB演算子のJSON Schema定義

```yaml
components:
  schemas:
    MongoDBOperators:
      type: object
      properties:
        $eq:
          oneOf:
            - type: string
            - type: number
            - type: boolean
          description: Matches values that are equal to a specified value
        $ne:
          oneOf:
            - type: string
            - type: number
            - type: boolean
          description: Matches values that are not equal to a specified value
        $gt:
          type: number
          description: Matches values that are greater than a specified value
        $gte:
          type: number
          description: Matches values that are greater than or equal to a specified value
        $lt:
          type: number
          description: Matches values that are less than a specified value
        $lte:
          type: number
          description: Matches values that are less than or equal to a specified value
        $in:
          type: array
          items:
            oneOf:
              - type: string
              - type: number
              - type: boolean
          description: Matches any of the values specified in an array
        $nin:
          type: array
          items:
            oneOf:
              - type: string
              - type: number
              - type: boolean
          description: Matches none of the values specified in an array
        $regex:
          type: string
          description: Matches values that match a specified regular expression
        $near:
          $ref: '#/components/schemas/NearOperator'
          description: Matches documents near a specified point (simple format only)

    NearOperator:
      type: object
      required:
        - latitude
        - longitude
      properties:
        latitude:
          type: number
          minimum: -90
          maximum: 90
          description: Latitude (-90 to 90)
        longitude:
          type: number
          minimum: -180
          maximum: 180
          description: Longitude (-180 to 180)
        maxDistance:
          type: number
          minimum: 0
          description: Maximum distance in meters
        minDistance:
          type: number
          minimum: 0
          description: Minimum distance in meters
```


### 全CRUD操作の定義

OpenAPI仕様には以下の操作を定義します:

1. **findRecords** (GET /records/{resource})
2. **getRecord** (GET /records/{resource}/{id})
3. **createRecord** (POST /records/{resource})
4. **updateRecord** (PUT /records/{resource}/{id})
5. **deleteRecord** (DELETE /records/{resource}/{id})
6. **createMany** (POST /records/{resource}/bulk)
7. **updateMany** (PUT /records/{resource}/bulk)
8. **deleteMany** (DELETE /records/{resource}/bulk)

各操作には以下の情報を含めます:
- `operationId`: MCPツール名
- `description`: 操作の詳細説明
- `parameters`: パスパラメータ、クエリパラメータ
- `requestBody`: リクエストボディのスキーマ（POST/PUT）
- `responses`: レスポンススキーマ

## MCPツール生成スクリプトの設計

### スクリプトの配置

```
scripts/generate-mcp-tools.ts  # 生成スクリプト
```

### スクリプトの構造（150行以内）

```typescript
#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

// 型定義（20行程度）
interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
}

interface Operation {
  operationId: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
}

// メイン処理（130行程度）
async function main() {
  try {
    // 1. OpenAPI仕様の読み込み（10行）
    const spec = await loadOpenAPISpec();
    
    // 2. 操作の抽出（20行）
    const operations = extractOperations(spec);
    
    // 3. MCPツール定義の生成（30行）
    const tools = operations.map(generateToolDefinition);
    
    // 4. TypeScriptコードの生成（30行）
    const code = generateTypeScriptCode(tools);
    
    // 5. ファイルへの書き込み（10行）
    await writeGeneratedFile(code);
    
    console.log('✅ MCP tools generated successfully');
  } catch (error) {
    console.error('❌ Error generating MCP tools:', error);
    process.exit(1);
  }
}

// ヘルパー関数（各10-20行）
async function loadOpenAPISpec(): Promise<OpenAPISpec> { /* ... */ }
function extractOperations(spec: OpenAPISpec): Operation[] { /* ... */ }
function generateToolDefinition(op: Operation): MCPToolDefinition { /* ... */ }
function generateTypeScriptCode(tools: MCPToolDefinition[]): string { /* ... */ }
async function writeGeneratedFile(code: string): Promise<void> { /* ... */ }

main();
```


### 各関数の詳細設計

#### loadOpenAPISpec()

```typescript
async function loadOpenAPISpec(): Promise<OpenAPISpec> {
  const specPath = path.join(process.cwd(), 'openapi-spec.yaml');
  const content = await fs.readFile(specPath, 'utf-8');
  const spec = yaml.parse(content);
  
  // 必須フィールドの検証
  if (!spec.openapi || !spec.info || !spec.paths) {
    throw new Error('Invalid OpenAPI specification: missing required fields');
  }
  
  return spec;
}
```

**エラーハンドリング**:
- ファイルが存在しない → `ENOENT`エラーをキャッチして説明的なメッセージを表示
- YAML構文エラー → `yaml.parse()`の例外をキャッチして行番号を表示
- 必須フィールド欠如 → カスタムエラーメッセージを表示

#### extractOperations()

```typescript
function extractOperations(spec: OpenAPISpec): Operation[] {
  const operations: Operation[] = [];
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (['get', 'post', 'put', 'delete'].includes(method)) {
        operations.push({
          ...operation,
          method,
          path,
        });
      }
    }
  }
  
  return operations;
}
```

**処理内容**:
- `paths`オブジェクトを走査
- 各HTTPメソッドの操作を抽出
- メソッドとパス情報を追加

#### generateToolDefinition()

```typescript
function generateToolDefinition(operation: Operation): MCPToolDefinition {
  const inputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };
  
  // parametersの変換
  if (operation.parameters) {
    for (const param of operation.parameters) {
      inputSchema.properties[param.name] = param.schema;
      if (param.required) {
        inputSchema.required.push(param.name);
      }
    }
  }
  
  // requestBodyの変換
  if (operation.requestBody) {
    const bodySchema = operation.requestBody.content['application/json']?.schema;
    if (bodySchema) {
      Object.assign(inputSchema.properties, bodySchema.properties || {});
      if (bodySchema.required) {
        inputSchema.required.push(...bodySchema.required);
      }
    }
  }
  
  return {
    name: operation.operationId,
    description: operation.description || operation.summary || '',
    inputSchema,
  };
}
```


**スキーマ変換の詳細**:
- OpenAPIの`schema`オブジェクトをそのままJSON Schemaとして使用
- `enum`, `pattern`, `minimum`, `maximum`などの制約を保持
- `oneOf`, `anyOf`などの複合型定義も保持

#### generateTypeScriptCode()

```typescript
function generateTypeScriptCode(tools: MCPToolDefinition[]): string {
  const timestamp = new Date().toISOString();
  
  const header = `/**
 * このファイルは自動生成されています。
 * 直接編集しないでください。
 * 
 * 生成元: openapi-spec.yaml
 * 生成日時: ${timestamp}
 * 生成スクリプト: scripts/generate-mcp-tools.ts
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
`;

  const toolsArray = `
export const tools: Tool[] = ${JSON.stringify(tools, null, 2)};
`;

  return header + toolsArray;
}
```

**コード生成の特徴**:
- 自動生成の警告コメントを含む
- 生成日時を記録
- JSON.stringify()で整形（インデント2スペース）
- Prettierによる後処理は不要（JSON.stringify()で十分）

#### writeGeneratedFile()

```typescript
async function writeGeneratedFile(code: string): Promise<void> {
  const outputPath = path.join(
    process.cwd(),
    'src/mcp/tools/generated.ts'
  );
  
  // ディレクトリが存在しない場合は作成
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  
  // ファイルに書き込み
  await fs.writeFile(outputPath, code, 'utf-8');
}
```

**エラーハンドリング**:
- ディレクトリ作成失敗 → 権限エラーを説明的に表示
- ファイル書き込み失敗 → ディスク容量不足などを説明的に表示

## データモデル

### OpenAPI仕様の型定義

```typescript
interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
  };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
}

interface Operation {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
}

interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header';
  required?: boolean;
  schema: Schema;
}

interface RequestBody {
  required?: boolean;
  content: {
    'application/json'?: {
      schema: Schema;
    };
  };
}

interface Response {
  description: string;
  content?: {
    'application/json'?: {
      schema: Schema;
    };
  };
}

interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  oneOf?: Schema[];
  anyOf?: Schema[];
  items?: Schema;
  additionalProperties?: boolean | Schema;
}
```


### MCPツール定義の型定義

```typescript
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;  // その他のJSON Schema属性
}
```

## エラーハンドリング

### エラーの分類

1. **ファイルシステムエラー**
   - ファイルが存在しない
   - 読み込み権限がない
   - 書き込み権限がない
   - ディスク容量不足

2. **YAML解析エラー**
   - 構文エラー
   - インデントエラー
   - 不正な文字

3. **OpenAPI検証エラー**
   - 必須フィールドの欠如
   - 不正な構造
   - サポートされていないバージョン

4. **スキーマ変換エラー**
   - 不正なスキーマ定義
   - サポートされていない型

### エラーメッセージの設計

```typescript
class OpenAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'OpenAPIError';
  }
}

// 使用例
throw new OpenAPIError(
  'OpenAPI specification file not found',
  'FILE_NOT_FOUND',
  { path: specPath }
);
```

### エラーハンドリングパターン

```typescript
async function main() {
  try {
    // 処理
  } catch (error) {
    if (error instanceof OpenAPIError) {
      console.error(`❌ ${error.message}`);
      if (error.details) {
        console.error('Details:', error.details);
      }
    } else if (error.code === 'ENOENT') {
      console.error('❌ File not found:', error.path);
    } else if (error.name === 'YAMLParseError') {
      console.error('❌ YAML syntax error:', error.message);
    } else {
      console.error('❌ Unexpected error:', error);
    }
    process.exit(1);
  }
}
```

### ログ出力の設計

**成功時**:
```
✅ MCP tools generated successfully
   - Loaded OpenAPI spec: openapi-spec.yaml
   - Extracted 8 operations
   - Generated 8 MCP tools
   - Written to: src/mcp/tools/generated.ts
```

**エラー時**:
```
❌ Error generating MCP tools: Invalid OpenAPI specification
   Details: Missing required field 'paths'
   File: openapi-spec.yaml
```


## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。プロパティは、人間が読める仕様と機械が検証できる正確性保証の橋渡しをします。*

### Property 1: OpenAPI仕様の解析

*任意の*有効なOpenAPI 3.1仕様ファイルに対して、システムはそれを構造化されたOpenAPIオブジェクトに正しく解析できる

**Validates: Requirements 1.1**

### Property 2: 無効なYAMLのエラーハンドリング

*任意の*無効なYAML文字列に対して、システムは説明的なエラーメッセージを返す

**Validates: Requirements 1.2**

### Property 3: 必須フィールドの検証

*任意の*OpenAPI仕様において、必須フィールド（openapi, info, paths）が欠けている場合、システムはバリデーションエラーを返す

**Validates: Requirements 1.3**

### Property 4: ResourceName enumの抽出

*任意の*ResourceNameパラメータを持つoperationに対して、システムは定義済みのenum値（users, venues, events, participations, notifications）を正しく抽出する

**Validates: Requirements 2.1, 5.1**

### Property 5: filterパラメータのスキーマ抽出

*任意の*filterパラメータを持つoperationに対して、システムはそのJSON Schema定義を正しく抽出する

**Validates: Requirements 2.2**

### Property 6: requestBodyのスキーマ抽出

*任意の*requestBodyを持つoperationに対して、システムはそのschema定義を正しく抽出する

**Validates: Requirements 2.3**

### Property 7: responseスキーマの抽出

*任意の*response schemaを持つoperationに対して、システムはそれをMCPツール定義用に正しく抽出する

**Validates: Requirements 2.4**

### Property 8: operation数とツール数の一致

*任意の*OpenAPI仕様に対して、生成されるMCPツールの数はoperationの数と一致する

**Validates: Requirements 3.1**

### Property 9: descriptionの含有

*任意の*operationに対して、生成されるMCPツール定義にはそのoperationのdescriptionが含まれる

**Validates: Requirements 3.2**

### Property 10: パラメータからinputSchemaへの変換

*任意の*OpenAPIパラメータに対して、システムはそれを適切なMCP inputSchemaに変換する

**Validates: Requirements 3.3**

### Property 11: JSON Schema制約の保持

*任意の*JSON Schema制約（enum, pattern, minimum, maximum等）に対して、生成されるMCPツール定義でその制約が保持される

**Validates: Requirements 3.4**

### Property 12: 有効なTypeScriptコードの生成

*任意の*MCPツール定義配列に対して、生成されるTypeScriptコードは構文エラーなしでパース可能である

**Validates: Requirements 4.1**

### Property 13: 必要なimport文の含有

*任意の*生成されたコードに対して、必要なimport文（@modelcontextprotocol/sdk/types.js）が含まれる

**Validates: Requirements 4.2**

### Property 14: tools配列のexport

*任意の*生成されたコードに対して、`export const tools: Tool[]`という形式でtools配列がexportされる

**Validates: Requirements 4.3**


### Property 15: MongoDB演算子の網羅性

*任意の*MongoDB演算子フィールドに対して、抽出されたスキーマはサポート対象の全演算子（$eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regex, $near）を含む

**Validates: Requirements 5.2**

### Property 16: $near演算子の簡易形式サポート

*任意の*$near演算子スキーマに対して、簡易形式（latitude, longitude, maxDistance, minDistance）がサポートされる

**Validates: Requirements 5.3**

### Property 17: OpenAPIエラーの説明的ログ

*任意の*無効なOpenAPI仕様に対して、システムは説明的なエラーメッセージをログ出力する

**Validates: Requirements 6.1**

### Property 18: ファイルシステムエラーの適切な処理

*任意の*ファイルシステムエラー（権限エラー、ディスク容量不足等）に対して、システムはそれを適切に処理し、説明的なエラーメッセージを表示する

**Validates: Requirements 6.2**

### Property 19: 仕様更新時の再生成の一貫性

*任意の*OpenAPI仕様の更新に対して、システムを再実行すると、更新された定義が反映されたMCPツールが生成される

**Validates: Requirements 7.1**

### Property 20: operation追加時の新ツール生成

*任意の*OpenAPI仕様へのoperation追加に対して、システムは対応する新しいMCPツールを生成する

**Validates: Requirements 7.2**

### Property 21: operation削除時のツール非生成

*任意の*OpenAPI仕様からのoperation削除に対して、システムは削除されたoperationに対応するMCPツールを生成しない

**Validates: Requirements 7.3**

## テスト戦略

### デュアルテストアプローチ

本プロジェクトでは、ユニットテストとプロパティベーステストの両方を使用します:

- **ユニットテスト**: 具体的な例、エッジケース、エラー条件を検証
- **プロパティテスト**: 全入力に対する普遍的なプロパティを検証

両者は補完的であり、包括的なカバレッジに必要です。

### ユニットテスト

**対象**:
- 具体的なOpenAPI仕様の例
- エッジケース（空のpaths、パラメータなしのoperation等）
- エラー条件（ファイルが存在しない、YAML構文エラー等）

**テストファイル**:
```
tests/unit/
  ├── loader.test.ts          # OpenAPI読み込みのテスト
  ├── extractor.test.ts       # Operation抽出のテスト
  ├── converter.test.ts       # スキーマ変換のテスト
  ├── generator.test.ts       # ツール定義生成のテスト
  └── code-generator.test.ts  # コード生成のテスト
```

**例**:
```typescript
describe('OpenAPI Loader', () => {
  it('有効なOpenAPI仕様を読み込める', async () => {
    const spec = await loadOpenAPISpec('fixtures/valid-spec.yaml');
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.paths).toBeDefined();
  });

  it('ファイルが存在しない場合はエラーを返す', async () => {
    await expect(
      loadOpenAPISpec('non-existent.yaml')
    ).rejects.toThrow('File not found');
  });
});
```


### プロパティベーステスト

**対象**:
- 正確性プロパティセクションで定義された全プロパティ
- ランダム生成された入力に対する普遍的な性質

**テストライブラリ**: `fast-check`（TypeScript向けプロパティベーステストライブラリ）

**テストファイル**:
```
tests/property/
  ├── parsing.property.test.ts      # Property 1-3
  ├── extraction.property.test.ts   # Property 4-7
  ├── generation.property.test.ts   # Property 8-14
  ├── compliance.property.test.ts   # Property 15-16
  ├── errors.property.test.ts       # Property 17-18
  └── updates.property.test.ts      # Property 19-21
```

**設定**:
- 各プロパティテストは最低100回実行
- タグ形式: `Feature: openapi-to-mcp-generator, Property N: [プロパティ名]`

**例**:
```typescript
import fc from 'fast-check';

describe('Property Tests', () => {
  /**
   * Feature: openapi-to-mcp-generator, Property 1: OpenAPI仕様の解析
   * 
   * 任意の有効なOpenAPI 3.1仕様ファイルに対して、
   * システムはそれを構造化されたOpenAPIオブジェクトに正しく解析できる
   */
  it('Property 1: 有効なOpenAPI仕様を解析できる', async () => {
    await fc.assert(
      fc.asyncProperty(
        validOpenAPISpecArbitrary(),
        async (spec) => {
          const parsed = await parseOpenAPISpec(spec);
          expect(parsed).toHaveProperty('openapi');
          expect(parsed).toHaveProperty('info');
          expect(parsed).toHaveProperty('paths');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: openapi-to-mcp-generator, Property 8: operation数とツール数の一致
   * 
   * 任意のOpenAPI仕様に対して、
   * 生成されるMCPツールの数はoperationの数と一致する
   */
  it('Property 8: operation数とツール数が一致する', async () => {
    await fc.assert(
      fc.asyncProperty(
        validOpenAPISpecArbitrary(),
        async (spec) => {
          const operations = extractOperations(spec);
          const tools = await generateTools(spec);
          expect(tools.length).toBe(operations.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Arbitrary（ランダムデータ生成器）の設計

```typescript
// 有効なOpenAPI仕様を生成
function validOpenAPISpecArbitrary() {
  return fc.record({
    openapi: fc.constant('3.1.0'),
    info: fc.record({
      title: fc.string(),
      version: fc.string(),
    }),
    paths: fc.dictionary(
      fc.string(),  // パス
      fc.record({
        get: fc.option(operationArbitrary()),
        post: fc.option(operationArbitrary()),
        put: fc.option(operationArbitrary()),
        delete: fc.option(operationArbitrary()),
      })
    ),
  });
}

// Operationを生成
function operationArbitrary() {
  return fc.record({
    operationId: fc.string(),
    description: fc.option(fc.string()),
    parameters: fc.option(fc.array(parameterArbitrary())),
    requestBody: fc.option(requestBodyArbitrary()),
    responses: fc.dictionary(
      fc.string(),
      responseArbitrary()
    ),
  });
}

// ResourceName enumを生成
function resourceNameArbitrary() {
  return fc.constantFrom(
    'users',
    'venues',
    'events',
    'participations',
    'notifications'
  );
}
```


### テスト実行

```bash
# 全テストを実行
npm test

# ユニットテストのみ
npm run test:unit

# プロパティテストのみ
npm run test:property

# カバレッジレポート
npm run test:coverage
```

### テストカバレッジ目標

- **ステートメントカバレッジ**: 90%以上
- **ブランチカバレッジ**: 85%以上
- **関数カバレッジ**: 95%以上
- **ラインカバレッジ**: 90%以上

## 実装の制約

### 技術的制約

1. **スクリプトサイズ**: 150行以内
2. **依存関係**: `yaml`パッケージのみ（標準ライブラリ以外）
3. **Node.jsバージョン**: 18.x以上
4. **TypeScriptバージョン**: 5.x以上

### 設計上の制約

1. **既存コードは変更しない**: `src/mcp/adapter.ts`や個別ツールファイルは変更しない
2. **OpenAPI仕様のみを整備**: 第1段階で完全な仕様を作成
3. **生成ファイルは上書き**: `src/mcp/tools/generated.ts`は毎回完全に再生成

### パフォーマンス制約

1. **実行時間**: 典型的な仕様（8 operations）で5秒以内
2. **メモリ使用量**: 最小限のメモリフットプリント
3. **スケーラビリティ**: 50 operationsまで性能劣化なし

## 実装の優先順位

### Phase 1: 基本機能（必須）

1. OpenAPI仕様の読み込みと検証
2. Operation抽出
3. 基本的なスキーマ変換
4. MCPツール定義生成
5. TypeScriptコード生成

### Phase 2: 高度な機能（推奨）

1. ResourceName enumの厳密な検証
2. MongoDB演算子の完全なサポート
3. $near演算子の2形式サポート
4. 詳細なエラーメッセージ

### Phase 3: 最適化（オプション）

1. パフォーマンス最適化
2. より詳細なログ出力
3. 設定ファイルのサポート

## 将来の拡張性

### 考慮すべき拡張

1. **複数の出力形式**: JSON、YAML、Markdown等
2. **カスタムテンプレート**: コード生成のカスタマイズ
3. **バリデーションルール**: カスタムバリデーションの追加
4. **ドキュメント生成**: OpenAPI仕様からドキュメントを自動生成

### 拡張のための設計

- **プラグインアーキテクチャ**: 将来的にプラグインで機能拡張可能
- **設定ファイル**: `openapi-mcp.config.js`で動作をカスタマイズ
- **フック**: 生成前後にカスタム処理を挿入可能

## まとめ

本設計により、以下を実現します:

1. **仕様駆動開発**: OpenAPI仕様をSSOTとして確立
2. **自動化**: MCPツール定義の手動メンテナンスを排除
3. **型安全性**: TypeScriptの型システムによる実行時エラーの防止
4. **保守性**: シンプルで理解しやすい150行のスクリプト
5. **拡張性**: 将来の機能追加に対応可能な設計

この設計に基づいて実装することで、OpenAPI駆動のMCP開発ワークフローを確立し、開発効率と品質を向上させることができます。
