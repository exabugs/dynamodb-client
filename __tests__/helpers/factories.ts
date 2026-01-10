/**
 * テストデータファクトリー
 *
 * faker.jsを使用してランダムなテストデータを生成。
 * 各エンティティのファクトリー関数を提供。
 */
import { faker } from '@faker-js/faker';

/**
 * ユーザーデータの型定義
 */
export interface User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  role?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 記事データの型定義
 */
export interface Article {
  id: string;
  title: string;
  content: string;
  authorId: string;
  status: 'draft' | 'published' | 'archived';
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * タスクデータの型定義
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * シャドー設定の型定義
 */
export interface ShadowConfig {
  resource: string;
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'location';
  }>;
}

/**
 * テストデータファクトリー
 */
export const testDataFactory = {
  /**
   * ユーザーデータを生成
   */
  createUser(overrides?: Partial<User>): User {
    const now = new Date().toISOString();
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      status: 'active',
      role: 'user',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  },

  /**
   * 複数のユーザーデータを生成
   */
  createUsers(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  },

  /**
   * 記事データを生成
   */
  createArticle(overrides?: Partial<Article>): Article {
    const now = new Date().toISOString();
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(3),
      authorId: faker.string.uuid(),
      status: 'draft',
      tags: [faker.lorem.word(), faker.lorem.word()],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  },

  /**
   * 複数の記事データを生成
   */
  createArticles(count: number, overrides?: Partial<Article>): Article[] {
    return Array.from({ length: count }, () => this.createArticle(overrides));
  },

  /**
   * タスクデータを生成
   */
  createTask(overrides?: Partial<Task>): Task {
    const now = new Date().toISOString();
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      status: 'todo',
      priority: 'medium',
      assigneeId: faker.string.uuid(),
      dueDate: faker.date.future().toISOString(),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  },

  /**
   * 複数のタスクデータを生成
   */
  createTasks(count: number, overrides?: Partial<Task>): Task[] {
    return Array.from({ length: count }, () => this.createTask(overrides));
  },

  /**
   * シャドー設定を生成
   */
  createShadowConfig(overrides?: Partial<ShadowConfig>): ShadowConfig {
    return {
      resource: 'users',
      fields: [
        { name: 'email', type: 'string' },
        { name: 'name', type: 'string' },
      ],
      ...overrides,
    };
  },
};
