/**
 * テストデータクリーンアップスクリプト
 *
 * Article と Task のすべてのデータを削除します。
 *
 * 使い方:
 *   pnpm clean
 */

import { DynamoClient } from '@ainews/core/client/iam';
import 'dotenv/config';

// Records Lambda Function URL（環境変数から取得）
const API_URL = process.env.VITE_RECORDS_API_URL;
const DATABASE_NAME = process.env.VITE_DATABASE_NAME || 'ainews';

if (!API_URL) {
  console.error('❌ VITE_RECORDS_API_URL が設定されていません');
  process.exit(1);
}

/**
 * メイン処理
 */
async function main() {
  console.log('🧹 データクリーンアップを開始します...\n');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`📍 Database: ${DATABASE_NAME}`);
  console.log(`📍 認証: AWS IAM (AWS CLI の認証情報を使用)\n`);

  // 確認プロンプト
  console.log('⚠️  警告: すべての Article と Task データが削除されます！');
  console.log('続行するには Ctrl+C で中断してください（5秒後に開始）...\n');

  await new Promise((resolve) => setTimeout(resolve, 5000));

  // DynamoDB Client を作成（IAM 認証）
  const client = new DynamoClient(API_URL, {
    auth: {
      region: process.env.VITE_COGNITO_REGION || 'us-east-1',
    },
  });
  await client.connect();

  try {
    const db = client.db(DATABASE_NAME);

    // Articles を削除
    console.log('🗑️  Articles を削除中...');
    const articlesCollection = db.collection('articles');
    const articles = await articlesCollection.find({}).limit(100).toArray();

    if (articles.length > 0) {
      const articleIds = articles.map((article) => article.id);
      await articlesCollection.deleteMany({ id: { in: articleIds } });
      console.log(`  ✅ ${articles.length} 件の Article を削除しました`);
    } else {
      console.log('  ℹ️  削除する Article がありません');
    }

    // Tasks を削除
    console.log('\n🗑️  Tasks を削除中...');
    const tasksCollection = db.collection('tasks');
    const tasks = await tasksCollection.find({}).limit(100).toArray();

    if (tasks.length > 0) {
      const taskIds = tasks.map((task) => task.id);
      await tasksCollection.deleteMany({ id: { in: taskIds } });
      console.log(`  ✅ ${tasks.length} 件の Task を削除しました`);
    } else {
      console.log('  ℹ️  削除する Task がありません');
    }

    console.log('\n✅ データクリーンアップが完了しました！');
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// スクリプト実行
main().catch((error) => {
  console.error('❌ 予期しないエラー:', error);
  process.exit(1);
});
