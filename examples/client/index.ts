/**
 * Basic Client Usage Example
 *
 * This example demonstrates how to use the DynamoDB Client SDK
 * to connect to a Lambda Function URL and perform CRUD operations.
 */
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';
import type { Article } from '../schema';

/**
 * Configuration
 *
 * Get FUNCTION_URL from Terraform output:
 *   cd ../terraform
 *   terraform output function_url
 *
 * Then set it as an environment variable:
 *   export FUNCTION_URL="<your-function-url>"
 */
const FUNCTION_URL = process.env.FUNCTION_URL;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

if (!FUNCTION_URL) {
  console.error('❌ Error: FUNCTION_URL environment variable is required');
  console.error('\nTo get the Function URL:');
  console.error('  1. Deploy with Terraform: cd ../terraform && terraform apply');
  console.error('  2. Get the output: terraform output function_url');
  console.error('  3. Set environment variable: export FUNCTION_URL="<your-function-url>"');
  console.error('\nExample:');
  console.error('  export FUNCTION_URL="https://abc123.lambda-url.us-east-1.on.aws/"');
  process.exit(1);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 DynamoDB Client Example\n');

  // Create client with IAM authentication
  const client = new DynamoClient(FUNCTION_URL, { region: AWS_REGION });

  // Get database and collection
  const db = client.db();
  const articles = db.collection<Article>('articles');

  console.log('📝 Creating a new article...');

  // Create (insertOne)
  const newArticle = await articles.insertOne({
    title: 'Getting Started with DynamoDB Client',
    content: 'This is a comprehensive guide to using the DynamoDB Client library...',
    status: 'draft' as const,
    author: 'John Doe',
    tags: ['tutorial', 'dynamodb', 'aws'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ Article created:', {
    id: newArticle.id,
    title: newArticle.title,
  });

  // Read (findOne)
  console.log('\n📖 Reading the article...');
  const foundArticle = await articles.findOne({ id: newArticle.id });
  console.log('✅ Article found:', {
    id: foundArticle?.id,
    title: foundArticle?.title,
    status: foundArticle?.status,
  });

  // Update (updateOne)
  console.log('\n✏️  Updating the article...');
  const updatedArticle = await articles.updateOne(
    { id: newArticle.id },
    {
      $set: {
        status: 'published' as const,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  console.log('✅ Article updated:', {
    id: updatedArticle.id,
    status: updatedArticle.status,
  });

  // Query with sorting (find)
  console.log('\n🔍 Querying published articles...');
  const publishedArticles = await articles
    .find({ status: 'published' })
    .sort({ updatedAt: -1 }) // Sort by updatedAt descending
    .limit(10)
    .toArray();

  console.log(`✅ Found ${publishedArticles.length} published article(s)`);
  publishedArticles.forEach((article, index) => {
    console.log(`   ${index + 1}. ${article.title} (${article.updatedAt})`);
  });

  // Query with pagination
  console.log('\n📄 Querying with pagination...');
  const page1 = await articles
    .find({})
    .sort({ title: 1 }) // Sort by title ascending
    .limit(5)
    .toArray();

  console.log(`✅ Page 1: ${page1.length} article(s)`);

  // Batch operations (insertMany)
  console.log('\n📦 Creating multiple articles...');
  const moreArticles = await articles.insertMany([
    {
      title: 'Advanced DynamoDB Patterns',
      content: 'Learn advanced patterns...',
      status: 'draft' as const,
      author: 'Jane Smith',
      tags: ['advanced', 'patterns'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      title: 'Shadow Records Explained',
      content: 'Understanding shadow records...',
      status: 'published' as const,
      author: 'Bob Johnson',
      tags: ['shadow-records', 'tutorial'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  console.log(`✅ Created ${moreArticles.length} articles`);

  // Query by author (using shadow records)
  console.log('\n👤 Querying articles by author...');
  const johnArticles = await articles
    .find({ author: 'John Doe' })
    .sort({ createdAt: -1 })
    .toArray();

  console.log(`✅ Found ${johnArticles.length} article(s) by John Doe`);

  // Delete (deleteOne)
  console.log('\n🗑️  Deleting the first article...');
  await articles.deleteOne({ id: newArticle.id });
  console.log('✅ Article deleted');

  // Verify deletion
  const deletedArticle = await articles.findOne({ id: newArticle.id });
  console.log('✅ Verification:', deletedArticle ? 'Still exists' : 'Successfully deleted');

  console.log('\n✨ Example completed!');
}

/**
 * Run the example
 */
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
