/**
 * 統合テストヘルパー
 *
 * テスト環境のセットアップ・クリーンアップを簡素化。
 * カスタムアサーションとデータシード機能を提供。
 */
import { DynamoDBMock } from './dynamodb-mock.js';

/**
 * テストコンテキスト
 */
export interface TestContext {
  dynamoMock: DynamoDBMock;
  tableName: string;
}

/**
 * 統合テストヘルパー
 */
export class IntegrationTestHelper {
  private dynamoMock: DynamoDBMock;
  private defaultTableName = 'test-table';

  constructor() {
    this.dynamoMock = new DynamoDBMock();
  }

  /**
   * テスト環境をセットアップ
   */
  async setup(): Promise<TestContext> {
    this.dynamoMock.clear();
    this.dynamoMock.createTable(this.defaultTableName);

    return {
      dynamoMock: this.dynamoMock,
      tableName: this.defaultTableName,
    };
  }

  /**
   * テスト環境をクリーンアップ
   */
  async teardown(context: TestContext): Promise<void> {
    context.dynamoMock.clear();
  }

  /**
   * DynamoDBモックを取得
   */
  getDynamoDBMock(): DynamoDBMock {
    return this.dynamoMock;
  }

  /**
   * テストデータを投入
   */
  async seedData(data: Record<string, any[]>): Promise<void> {
    for (const [resource, items] of Object.entries(data)) {
      for (const item of items) {
        await this.dynamoMock.putItem({
          TableName: this.defaultTableName,
          Item: {
            PK: { S: resource },
            SK: { S: `MAIN#${item.id}` },
            ...this.convertToAttributeValues(item),
          },
        });
      }
    }
  }

  /**
   * JavaScriptオブジェクトをDynamoDB AttributeValueに変換
   */
  private convertToAttributeValues(obj: any): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        result[key] = { NULL: true };
      } else if (typeof value === 'string') {
        result[key] = { S: value };
      } else if (typeof value === 'number') {
        result[key] = { N: value.toString() };
      } else if (typeof value === 'boolean') {
        result[key] = { BOOL: value };
      } else if (Array.isArray(value)) {
        result[key] = { L: value.map((v) => this.convertToAttributeValues({ v }).v) };
      } else if (typeof value === 'object') {
        result[key] = { M: this.convertToAttributeValues(value) };
      }
    }

    return result;
  }
}

/**
 * カスタムアサーション
 */
export const assertions = {
  /**
   * シャドーレコードの存在を確認
   */
  toHaveShadowRecords(item: any, expectedCount: number): void {
    const shadowKeys = item.__shadowKeys || [];
    if (shadowKeys.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} shadow records, but found ${shadowKeys.length}`);
    }
  },

  /**
   * DynamoDBアイテムの一致を確認
   */
  toMatchDynamoDBItem(actual: any, expected: any): void {
    for (const [key, value] of Object.entries(expected)) {
      if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
        throw new Error(
          `Expected ${key} to be ${JSON.stringify(value)}, but got ${JSON.stringify(actual[key])}`
        );
      }
    }
  },
};

/**
 * グローバルヘルパーインスタンス
 */
export const integrationTestHelper = new IntegrationTestHelper();
