/**
 * Task リソースの型定義とスキーマ定義
 */
import { SchemaDefinition, ShadowFieldType } from '../schema.js';

/**
 * Task リソースの型定義
 */
export interface Task {
  /** レコードID（ULID） */
  id: string;
  /** タスク名 */
  name: string;
  /** ステータス */
  status: 'todo' | 'in_progress' | 'done';
  /** 期限日時（ISO 8601形式） */
  dueDate?: string;
  /** 担当者 */
  assignee?: string;
  /** 説明 */
  description?: string;
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
}

/**
 * Task リソースのスキーマ定義
 *
 * ソート可能なフィールドのみを明示的に定義:
 * - name: タスク名でのソート
 * - status: ステータスでのソート
 * - dueDate: 期限日時でのソート
 * - createdAt: 作成日時でのソート
 * - updatedAt: 更新日時でのソート
 *
 * 注意:
 * - id フィールドはPKとして使用されるため、シャドーレコードは生成しない
 * - assignee, description はソート不要のため、sortableFieldsに含めない
 */
export const TaskSchema: SchemaDefinition<Task> = {
  resource: 'tasks',
  type: {} as Task,
  shadows: {
    sortableFields: {
      name: { type: 'string' as ShadowFieldType.String },
      status: { type: 'string' as ShadowFieldType.String },
      dueDate: { type: 'datetime' as ShadowFieldType.Datetime },
      createdAt: { type: 'datetime' as ShadowFieldType.Datetime },
      updatedAt: { type: 'datetime' as ShadowFieldType.Datetime },
    },
  },
};
