/**
 * DynamoDBモック
 *
 * 実際のDynamoDBの動作を忠実に再現するメモリ内モック。
 * テストで本物のDynamoDBにアクセスせず、課金を避けるために使用。
 */
import type {
  AttributeValue,
  BatchGetItemInput,
  BatchGetItemOutput,
  BatchWriteItemInput,
  BatchWriteItemOutput,
  DeleteItemInput,
  DeleteItemOutput,
  GetItemInput,
  GetItemOutput,
  PutItemInput,
  PutItemOutput,
  QueryInput,
  QueryOutput,
  ScanInput,
  ScanOutput,
  TransactWriteItemsInput,
  TransactWriteItemsOutput,
  UpdateItemInput,
  UpdateItemOutput,
} from '@aws-sdk/client-dynamodb';

/**
 * DynamoDBアイテム（AttributeValueのマップ）
 */
type DynamoDBItem = Record<string, AttributeValue>;

/**
 * エラーシミュレーション設定
 */
interface ErrorSimulationConfig {
  operation:
    | 'putItem'
    | 'getItem'
    | 'updateItem'
    | 'deleteItem'
    | 'transactWriteItems'
    | 'query'
    | 'scan';
  errorType:
    | 'ConditionalCheckFailedException'
    | 'ResourceNotFoundException'
    | 'ValidationException'
    | 'TransactionCanceledException';
  condition?: (params: any) => boolean;
}

/**
 * トランザクションログエントリ
 */
interface TransactionEntry {
  timestamp: number;
  operation: string;
  params: any;
  success: boolean;
}

/**
 * DynamoDBモッククラス
 */
export class DynamoDBMock {
  /**
   * テーブル名 → (複合キー → アイテム)
   */
  private tables: Map<string, Map<string, DynamoDBItem>> = new Map();

  /**
   * トランザクションログ
   */
  private transactionLog: TransactionEntry[] = [];

  /**
   * エラーシミュレーション設定
   */
  private errorSimulations: ErrorSimulationConfig[] = [];

  /**
   * テーブルを作成
   */
  createTable(tableName: string): void {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
  }

  /**
   * 複合キーを生成（PK#SK形式）
   */
  private makeKey(pk: AttributeValue, sk: AttributeValue): string {
    const pkValue = this.extractValue(pk);
    const skValue = this.extractValue(sk);
    return `${pkValue}#${skValue}`;
  }

  /**
   * AttributeValueから実際の値を抽出
   */
  private extractValue(attr: AttributeValue): string {
    if (attr.S !== undefined) return attr.S;
    if (attr.N !== undefined) return attr.N;
    if (attr.B !== undefined) return attr.B.toString();
    if (attr.BOOL !== undefined) return attr.BOOL.toString();
    if (attr.NULL !== undefined) return 'null';
    return JSON.stringify(attr);
  }

  /**
   * アイテムを取得
   */
  async getItem(params: GetItemInput): Promise<GetItemOutput> {
    this.checkErrorSimulation('getItem', params);

    const tableName = params.TableName!;
    const table = this.tables.get(tableName);

    if (!table) {
      throw new Error(`ResourceNotFoundException: Table ${tableName} not found`);
    }

    const key = this.makeKey(params.Key!.PK, params.Key!.SK);
    const item = table.get(key);

    return {
      Item: item,
    };
  }

  /**
   * アイテムを書き込み
   */
  async putItem(params: PutItemInput): Promise<PutItemOutput> {
    this.checkErrorSimulation('putItem', params);

    const tableName = params.TableName!;
    let table = this.tables.get(tableName);

    if (!table) {
      this.createTable(tableName);
      table = this.tables.get(tableName)!;
    }

    const key = this.makeKey(params.Item!.PK, params.Item!.SK);

    // 条件式のチェック
    if (params.ConditionExpression) {
      const existingItem = table.get(key);
      if (
        !this.evaluateCondition(
          params.ConditionExpression,
          existingItem,
          params.ExpressionAttributeValues
        )
      ) {
        throw new Error('ConditionalCheckFailedException');
      }
    }

    table.set(key, params.Item!);

    this.logTransaction('putItem', params, true);

    return {};
  }

  /**
   * アイテムを更新
   */
  async updateItem(params: UpdateItemInput): Promise<UpdateItemOutput> {
    this.checkErrorSimulation('updateItem', params);

    const tableName = params.TableName!;
    const table = this.tables.get(tableName);

    if (!table) {
      throw new Error(`ResourceNotFoundException: Table ${tableName} not found`);
    }

    const key = this.makeKey(params.Key!.PK, params.Key!.SK);
    let item = table.get(key);

    if (!item) {
      throw new Error('ResourceNotFoundException: Item not found');
    }

    // 条件式のチェック
    if (params.ConditionExpression) {
      if (
        !this.evaluateCondition(params.ConditionExpression, item, params.ExpressionAttributeValues)
      ) {
        throw new Error('ConditionalCheckFailedException');
      }
    }

    // 更新式の適用（簡易実装）
    if (params.UpdateExpression) {
      item = this.applyUpdateExpression(
        item,
        params.UpdateExpression,
        params.ExpressionAttributeValues
      );
      table.set(key, item);
    }

    this.logTransaction('updateItem', params, true);

    return {
      Attributes: item,
    };
  }

  /**
   * アイテムを削除
   */
  async deleteItem(params: DeleteItemInput): Promise<DeleteItemOutput> {
    this.checkErrorSimulation('deleteItem', params);

    const tableName = params.TableName!;
    const table = this.tables.get(tableName);

    if (!table) {
      throw new Error(`ResourceNotFoundException: Table ${tableName} not found`);
    }

    const key = this.makeKey(params.Key!.PK, params.Key!.SK);
    const item = table.get(key);

    if (!item) {
      throw new Error('ResourceNotFoundException: Item not found');
    }

    // 条件式のチェック
    if (params.ConditionExpression) {
      if (
        !this.evaluateCondition(params.ConditionExpression, item, params.ExpressionAttributeValues)
      ) {
        throw new Error('ConditionalCheckFailedException');
      }
    }

    table.delete(key);

    this.logTransaction('deleteItem', params, true);

    return {
      Attributes: item,
    };
  }

  /**
   * バッチ取得（未実装）
   */
  async batchGetItem(params: BatchGetItemInput): Promise<BatchGetItemOutput> {
    throw new Error('Not implemented yet');
  }

  /**
   * バッチ書き込み（未実装）
   */
  async batchWriteItem(params: BatchWriteItemInput): Promise<BatchWriteItemOutput> {
    throw new Error('Not implemented yet');
  }

  /**
   * トランザクション書き込み（未実装）
   */
  async transactWriteItems(params: TransactWriteItemsInput): Promise<TransactWriteItemsOutput> {
    throw new Error('Not implemented yet');
  }

  /**
   * クエリ（未実装）
   */
  async query(params: QueryInput): Promise<QueryOutput> {
    throw new Error('Not implemented yet');
  }

  /**
   * スキャン（未実装）
   */
  async scan(params: ScanInput): Promise<ScanOutput> {
    throw new Error('Not implemented yet');
  }

  /**
   * エラーシミュレーション設定
   */
  setErrorSimulation(config: ErrorSimulationConfig): void {
    this.errorSimulations.push(config);
  }

  /**
   * エラーシミュレーションをクリア
   */
  clearErrorSimulations(): void {
    this.errorSimulations = [];
  }

  /**
   * データをクリア
   */
  clear(): void {
    this.tables.clear();
    this.transactionLog = [];
    this.errorSimulations = [];
  }

  /**
   * トランザクションログを取得
   */
  getTransactionLog(): TransactionEntry[] {
    return [...this.transactionLog];
  }

  /**
   * エラーシミュレーションをチェック
   */
  private checkErrorSimulation(operation: string, params: any): void {
    for (const config of this.errorSimulations) {
      if (config.operation === operation) {
        if (!config.condition || config.condition(params)) {
          throw new Error(config.errorType);
        }
      }
    }
  }

  /**
   * 条件式を評価（簡易実装）
   */
  private evaluateCondition(
    expression: string,
    item: DynamoDBItem | undefined,
    values?: Record<string, AttributeValue>
  ): boolean {
    // 簡易実装: attribute_not_exists のみサポート
    if (expression.includes('attribute_not_exists')) {
      return item === undefined;
    }
    // その他の条件式は常にtrueを返す（TODO: 完全実装）
    return true;
  }

  /**
   * 更新式を適用（簡易実装）
   */
  private applyUpdateExpression(
    item: DynamoDBItem,
    expression: string,
    values?: Record<string, AttributeValue>
  ): DynamoDBItem {
    // 簡易実装: SET のみサポート
    const updatedItem = { ...item };

    if (expression.includes('SET') && values) {
      // TODO: 完全な更新式パーサーを実装
      // 現在は単純なSET操作のみサポート
      for (const [key, value] of Object.entries(values)) {
        const attrName = key.replace(':', '');
        updatedItem[attrName] = value;
      }
    }

    return updatedItem;
  }

  /**
   * トランザクションをログに記録
   */
  private logTransaction(operation: string, params: any, success: boolean): void {
    this.transactionLog.push({
      timestamp: Date.now(),
      operation,
      params,
      success,
    });
  }
}
