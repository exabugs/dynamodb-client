/**
 * Vitestセットアップファイル
 *
 * テスト実行前に環境変数を設定
 */

// テスト用の環境変数を設定
process.env.TABLE_NAME = 'test-table';
process.env.SHADOW_CONFIG = JSON.stringify({
  users: {
    fields: [
      { name: 'email', type: 'string' },
      { name: 'name', type: 'string' },
    ],
  },
  articles: {
    fields: [
      { name: 'title', type: 'string' },
      { name: 'authorId', type: 'string' },
    ],
  },
  tasks: {
    fields: [
      { name: 'title', type: 'string' },
      { name: 'status', type: 'string' },
    ],
  },
});
