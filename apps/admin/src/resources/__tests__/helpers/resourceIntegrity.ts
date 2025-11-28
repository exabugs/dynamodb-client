/**
 * リソース整合性テストのヘルパー関数
 *
 * TypeScript ASTを使ってreact-adminリソース定義を解析し、
 * スキーマ定義との整合性を検証する。
 */
import * as fs from 'fs';
import * as ts from 'typescript';
import { expect, it } from 'vitest';

/**
 * TypeScript ASTからsource属性を抽出
 */
function extractSourcesFromFile(filePath: string): string[] {
  const sources: string[] = [];
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // JSX属性を探す: source="fieldName" または source={'fieldName'}
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (name === 'source' && node.initializer) {
        let value: string | undefined;

        if (ts.isStringLiteral(node.initializer)) {
          // source="fieldName"
          value = node.initializer.text;
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          // source={'fieldName'} または source={variable}
          const expr = node.initializer.expression;
          if (ts.isStringLiteral(expr)) {
            value = expr.text;
          }
        }

        if (value) {
          sources.push(value);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return sources;
}

/**
 * TypeScript ASTから文字列プロパティ値を抽出
 */
function extractStringProperty(filePath: string, propertyName: string): string | undefined {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

  let result: string | undefined;

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === propertyName
    ) {
      if (ts.isStringLiteral(node.initializer)) {
        result = node.initializer.text;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

/**
 * TypeScript ASTから関数形式のrecordRepresentationで使用されているフィールドを抽出
 * 例: (record: Article) => record.name → "name"
 */
function extractRecordRepresentationFields(filePath: string): string[] {
  const fields: string[] = [];
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // recordRepresentationプロパティを探す
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'recordRepresentation'
    ) {
      // アロー関数の場合
      if (ts.isArrowFunction(node.initializer)) {
        const body = node.initializer.body;
        // record.fieldName パターンを探す
        function extractFields(n: ts.Node) {
          if (ts.isPropertyAccessExpression(n)) {
            const expr = n.expression;
            const name = n.name.text;
            // record.fieldName の形式
            if (ts.isIdentifier(expr) && expr.text === 'record') {
              fields.push(name);
            }
          }
          ts.forEachChild(n, extractFields);
        }
        extractFields(body);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return fields;
}

/**
 * 拡張構文から基本フィールド名を抽出
 * 例: "name:starts" -> "name"
 */
function extractBaseField(source: string): string {
  return source.split(':')[0];
}

/**
 * TypeScript型定義ファイルからインターフェースのフィールド一覧を抽出
 *
 * @param typeFilePath - 型定義ファイルのパス（例: packages/api-types/src/models/Article.ts）
 * @param interfaceName - インターフェース名（例: 'Article'）
 * @returns フィールド名の配列
 */
export function extractFieldsFromInterface(typeFilePath: string, interfaceName: string): string[] {
  const fields: string[] = [];
  const fileContent = fs.readFileSync(typeFilePath, 'utf-8');
  const sourceFile = ts.createSourceFile(typeFilePath, fileContent, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // インターフェース宣言を探す
    if (
      ts.isInterfaceDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === interfaceName
    ) {
      // インターフェースのメンバーを走査
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) {
          let fieldName: string | undefined;

          if (ts.isIdentifier(member.name)) {
            fieldName = member.name.text;
          } else if (ts.isStringLiteral(member.name)) {
            // 'no-sort-1' のような文字列リテラルプロパティ
            fieldName = member.name.text;
          }

          if (fieldName) {
            fields.push(fieldName);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return fields;
}

/**
 * リソースファイルのsource属性が型定義に存在することを検証
 */
export function testSourceIntegrity(
  resourceFilePath: string,
  typeFields: string[],
  resourceName: string
): void {
  it('リソースファイルが存在する', () => {
    expect(fs.existsSync(resourceFilePath)).toBe(true);
  });

  it('source属性がすべて型定義に存在する', () => {
    const sources = extractSourcesFromFile(resourceFilePath);
    const uniqueSources = [...new Set(sources)];
    const baseSources = uniqueSources.map(extractBaseField);
    const uniqueBaseSources = [...new Set(baseSources)];

    expect(uniqueBaseSources.length).toBeGreaterThan(0);

    for (const source of uniqueBaseSources) {
      expect(
        typeFields,
        `Field '${source}' (used in ${resourceName}.tsx) should exist in ${resourceName} type`
      ).toContain(source);
    }
  });
}

/**
 * recordRepresentationフィールドが型定義に存在することを検証
 */
export function testRecordRepresentation(
  resourceFilePath: string,
  typeFields: string[],
  resourceName: string
): void {
  it('recordRepresentationフィールドが型定義に存在する', () => {
    // 文字列形式のrecordRepresentationを試す
    const recordRepresentationString = extractStringProperty(
      resourceFilePath,
      'recordRepresentation'
    );

    if (recordRepresentationString) {
      // 文字列形式の場合
      expect(
        typeFields,
        `recordRepresentation field '${recordRepresentationString}' should exist in ${resourceName} type`
      ).toContain(recordRepresentationString);
    } else {
      // 関数形式の場合
      const recordRepresentationFields = extractRecordRepresentationFields(resourceFilePath);
      expect(
        recordRepresentationFields.length,
        `recordRepresentation should be defined in ${resourceName}.tsx`
      ).toBeGreaterThan(0);

      // すべてのフィールドが型定義に存在することを確認
      for (const field of recordRepresentationFields) {
        expect(
          typeFields,
          `recordRepresentation field '${field}' should exist in ${resourceName} type`
        ).toContain(field);
      }
    }
  });
}

/**
 * リソース名が正しく設定されていることを検証
 */
export function testResourceName(resourceFilePath: string, expectedName: string): void {
  it('リソース名が正しく設定されている', () => {
    const resourceName = extractStringProperty(resourceFilePath, 'name');
    expect(resourceName).toBe(expectedName);
  });
}

/**
 * スキーマ定義からresourceフィールドを抽出
 */
export function extractSchemaResource(
  typeFilePath: string,
  schemaName: string
): string | undefined {
  const fileContent = fs.readFileSync(typeFilePath, 'utf-8');
  const sourceFile = ts.createSourceFile(typeFilePath, fileContent, ts.ScriptTarget.Latest, true);

  let resourceValue: string | undefined;

  function visit(node: ts.Node) {
    // export const ArticleSchema: SchemaDefinition<Article> = { ... } を探す
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isVariableDeclaration(declaration) &&
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === schemaName &&
          declaration.initializer &&
          ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          // オブジェクトリテラルのプロパティを探す
          for (const prop of declaration.initializer.properties) {
            if (
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === 'resource' &&
              ts.isStringLiteral(prop.initializer)
            ) {
              resourceValue = prop.initializer.text;
              return;
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return resourceValue;
}

/**
 * スキーマのresourceフィールドとリソースファイルのnameが一致することを検証
 */
export function testSchemaResourceMatch(
  resourceFilePath: string,
  typeFilePath: string,
  schemaName: string
): void {
  it('スキーマのresourceフィールドとリソースファイルのnameが一致する', () => {
    const schemaResource = extractSchemaResource(typeFilePath, schemaName);
    const resourceName = extractStringProperty(resourceFilePath, 'name');

    expect(schemaResource).toBeDefined();
    expect(resourceName).toBeDefined();
    expect(schemaResource).toBe(resourceName);
  });
}
