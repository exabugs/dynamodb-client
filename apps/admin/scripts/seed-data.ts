/**
 * テスト用サンプルデータ作成スクリプト
 *
 * Article と Task のサンプルデータを Records Lambda に投入します。
 *
 * 使い方:
 *   pnpm seed
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
 * サンプル Article データ
 */
const sampleArticles = [
  {
    name: 'AI技術の最新動向',
    category: 'technology',
    status: 'published',
  },
  {
    name: 'クラウドネイティブアーキテクチャ入門',
    category: 'technology',
    status: 'published',
  },
  {
    name: 'サーバーレス開発のベストプラクティス',
    category: 'development',
    status: 'draft',
  },
  {
    name: 'DynamoDB Single-Table設計パターン',
    category: 'database',
    status: 'published',
  },
  {
    name: 'React Admin カスタマイズガイド',
    category: 'frontend',
    status: 'draft',
  },
];

/**
 * サンプル Task データ
 */
const sampleTasks = [
  {
    name: 'Records Lambda のデプロイ',
    status: 'done',
    dueDate: new Date('2025-11-20').toISOString(),
    assignee: 'sakurai',
    description: 'Records Lambda を dev 環境にデプロイする',
  },
  {
    name: 'React Admin の動作確認',
    status: 'in_progress',
    dueDate: new Date('2025-11-23').toISOString(),
    assignee: 'sakurai',
    description: 'Article と Task リソースの CRUD 操作をテストする',
  },
  {
    name: 'Shadow Config の更新',
    status: 'todo',
    dueDate: new Date('2025-11-24').toISOString(),
    assignee: 'sakurai',
    description: 'shadow.config.json を v2.0 に更新する',
  },
  {
    name: 'Terraform Apply',
    status: 'todo',
    dueDate: new Date('2025-11-25').toISOString(),
    assignee: 'sakurai',
    description: 'インフラを本番環境にデプロイする',
  },
  {
    name: 'ドキュメント作成',
    status: 'todo',
    dueDate: new Date('2025-11-26').toISOString(),
    assignee: 'sakurai',
    description: 'システムの使い方をドキュメント化する',
  },
];

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 サンプルデータ作成を開始します...\n');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`📍 Database: ${DATABASE_NAME}`);
  console.log(`📍 認証: AWS IAM (AWS CLI の認証情報を使用)\n`);

  // DynamoDB Client を作成（IAM 認証）
  const client = new DynamoClient(API_URL, {
    auth: {
      region: process.env.VITE_COGNITO_REGION || 'us-east-1',
    },
  });
  await client.connect();

  try {
    const db = client.db(DATABASE_NAME);

    // Articles を作成
    console.log('📝 Articles を作成中...');
    const articlesCollection = db.collection('articles');

    for (const article of sampleArticles) {
      const result = await articlesCollection.insertOne(article);
      console.log(`  ✅ Created article: ${article.name} (ID: ${result.insertedId})`);
    }

    console.log(`\n✨ ${sampleArticles.length} 件の Article を作成しました\n`);

    // Tasks を作成
    console.log('📝 Tasks を作成中...');
    const tasksCollection = db.collection('tasks');

    for (const task of sampleTasks) {
      const result = await tasksCollection.insertOne(task);
      console.log(`  ✅ Created task: ${task.name} (ID: ${result.insertedId})`);
    }

    console.log(`\n✨ ${sampleTasks.length} 件の Task を作成しました\n`);

    // 作成されたデータを確認
    console.log('📊 作成されたデータを確認中...\n');

    const articles = await articlesCollection.find({}).limit(10).toArray();
    console.log(`📄 Articles (${articles.length} 件):`);
    articles.forEach((article) => {
      console.log(`  - ${article.name} [${article.status}]`);
    });

    const tasks = await tasksCollection.find({}).limit(10).toArray();
    console.log(`\n📋 Tasks (${tasks.length} 件):`);
    tasks.forEach((task) => {
      console.log(`  - ${task.name} [${task.status}]`);
    });

    console.log('\n✅ サンプルデータの作成が完了しました！');
    console.log('\n次のステップ:');
    console.log('  1. pnpm dev で React Admin を起動');
    console.log('  2. ブラウザで http://localhost:5173 を開く');
    console.log('  3. Articles と Tasks を確認');
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
