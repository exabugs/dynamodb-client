# Client Example

This example demonstrates how to use the DynamoDB Client SDK to perform CRUD operations.

## Overview

This example shows:

- How to connect to the Lambda Function URL
- How to perform CRUD operations (Create, Read, Update, Delete)
- How to query with sorting and filtering
- How to use batch operations
- Authentication methods (IAM and Cognito)

## Prerequisites

- Lambda function deployed (see [Terraform Examples](../terraform/))
- Shadow config generated (see [Schema Example](../schema/))
- AWS credentials configured (for IAM authentication)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Function URL from Terraform

First, deploy the Lambda function using Terraform:

```bash
cd ../terraform
terraform apply
```

Then get the Function URL from Terraform output:

```bash
terraform output function_url
```

### 3. Set Environment Variables

```bash
# Lambda Function URL (required) - get from Terraform output
export FUNCTION_URL="$(cd ../terraform && terraform output -raw function_url)"

# Or set it manually
export FUNCTION_URL="https://your-function-url.lambda-url.us-east-1.on.aws/"

# AWS Region (optional, default: us-east-1)
export AWS_REGION="us-east-1"
```

### 4. Run the Example

```bash
npm start
```

## What the Example Does

See `index.ts` for a complete example that demonstrates:

1. **Create**: Insert new articles
2. **Read**: Fetch articles by ID
3. **Update**: Modify existing articles
4. **Query**: Search with sorting and filtering
5. **Batch Operations**: Create/update/delete multiple records
6. **Delete**: Remove articles

## Authentication Methods

### IAM Authentication (Default)

Uses AWS credentials from your environment:

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';

const client = new DynamoClient(FUNCTION_URL, { region: AWS_REGION });
```

### Cognito JWT Authentication

Uses Cognito ID token:

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/cognito';

const client = new DynamoClient(FUNCTION_URL, {
  region: AWS_REGION,
  auth: {
    getToken: async () => {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    },
  },
});
```

### Custom Token Authentication

Uses any custom token:

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/token';

const client = new DynamoClient(FUNCTION_URL, {
  region: AWS_REGION,
  auth: {
    getToken: async () => 'your-custom-token',
  },
});
```

## Example Operations

### Create a Record

```typescript
const article = await collection.insertOne({
  title: 'Hello World',
  content: 'This is my first article',
  status: 'published',
});

console.log('Created:', article.insertedId);
```

### Read a Record

```typescript
const articles = await collection.find({ id: 'article-id' }).toArray();
console.log('Article:', articles[0]);
```

### Update a Record

```typescript
await collection.updateOne({ id: 'article-id' }, { set: { status: 'archived' } });
```

### Query with Sorting

```typescript
// Sort by title (ascending)
const articles = await collection.find({ status: 'published' }).sort({ title: 1 }).toArray();

// Sort by updatedAt (descending) - most recent first
const recentArticles = await collection.find({}).sort({ updatedAt: -1 }).limit(10).toArray();
```

### Batch Operations

```typescript
// Create multiple records
const result = await collection.insertMany([
  { title: 'Article 1', status: 'draft' },
  { title: 'Article 2', status: 'published' },
]);

console.log('Created:', result.insertedIds);
```

### Delete a Record

```typescript
await collection.deleteOne({ id: 'article-id' });
```

## Understanding Shadow Records

Shadow records enable efficient sorting without GSIs:

1. **Automatic**: Shadow records are created automatically when you insert/update records
2. **Transparent**: You don't need to manage them manually
3. **Efficient**: Queries use shadow records for fast sorting

### How It Works

When you create a record:

```typescript
await collection.insertOne({
  id: 'article-1',
  title: 'Hello World',
  status: 'published',
  updatedAt: '2024-01-01T00:00:00Z',
});
```

The system automatically creates shadow records:

- `title#Hello World#id#article-1` - for sorting by title
- `status#published#id#article-1` - for sorting by status
- `updatedAt#2024-01-01T00:00:00Z#id#article-1` - for sorting by updatedAt

When you query with sorting:

```typescript
await collection.find({ status: 'published' }).sort({ title: 1 }).toArray();
```

The system uses the shadow records to efficiently return sorted results.

## Next Steps

- Check out the [Schema Example](../schema/) for how to define schemas
- Check out the [Terraform Examples](../terraform/) for Lambda deployment
- Check out the [React Admin Example](../react-admin/) for building admin interfaces
- Read the [API Reference](../../docs/API.md) for all available operations

## Troubleshooting

### Connection Errors

If you see connection errors:

1. Verify the Function URL is correct
2. Check AWS credentials are configured
3. Verify the Lambda function is deployed
4. Check CloudWatch Logs for errors

### Authentication Errors

If you see authentication errors:

1. For IAM: Verify AWS credentials have Lambda invoke permissions
2. For Cognito: Verify the JWT token is valid and not expired
3. Check the Lambda function's authorizer configuration

### Query Errors

If queries don't return expected results:

1. Verify the shadow config is deployed with the Lambda function
2. Check that sortable fields are defined in the schema
3. Verify records have the required fields populated
