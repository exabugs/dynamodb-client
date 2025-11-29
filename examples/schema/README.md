# Schema Example

This example demonstrates how to define TypeScript schemas and generate `shadow.config.json`.

## Overview

This example shows:

- How to define a TypeScript schema for your resources
- How to generate `shadow.config.json` from the schema
- How the generated configuration enables efficient sorting and querying

## Files

- **`schema.ts`** - TypeScript schema definition with type-safe resource definitions
- **`shadow.config.json`** - Generated shadow configuration (example output)

## Quick Start

### 1. Install Dependencies

```bash
npm install @exabugs/dynamodb-client
```

### 2. Define Your Schema

See `schema.ts` for a complete example. The schema defines:

- Resource types (e.g., `Article`)
- Sortable fields with their types (string, number, datetime)
- Database configuration (name, timestamps)

```typescript
import { SchemaRegistryConfig, ShadowFieldType } from '@exabugs/dynamodb-client/shadows';

export interface Article {
  id: string;
  title: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export const MySchemaRegistry: SchemaRegistryConfig = {
  database: {
    name: 'myapp',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  resources: {
    articles: {
      resource: 'articles',
      type: {} as Article,
      shadows: {
        sortableFields: {
          title: { type: ShadowFieldType.String },
          status: { type: ShadowFieldType.String },
          createdAt: { type: ShadowFieldType.Datetime },
          updatedAt: { type: ShadowFieldType.Datetime },
        },
      },
    },
  },
};
```

### 3. Generate Shadow Config

```bash
npx @exabugs/dynamodb-client generate-shadow-config schema.ts -o shadow.config.json
```

This generates `shadow.config.json` with:

- Shadow field definitions for efficient sorting
- Default sort configuration (automatically set to `updatedAt DESC`)
- Database metadata

### 4. Use the Configuration

The generated `shadow.config.json` is used by:

- **Lambda Server**: Deploy with the configuration as an environment variable
- **Client SDK**: Automatically handles shadow records for sorting

## Understanding Shadow Records

Shadow records enable efficient sorting in DynamoDB Single-Table design without GSIs:

1. **Sortable Fields**: Fields marked as sortable (e.g., `title`, `status`) automatically generate shadow records
2. **Shadow Keys**: Each shadow record has a composite sort key: `field#value#id#ULID`
3. **Efficient Queries**: Query by field value and sort without scanning the entire table

### Example Query

```typescript
// Sort articles by title (ascending)
const articles = await collection.find({ status: 'published' }).sort({ title: 1 }).toArray();

// Sort articles by updatedAt (descending) - uses default sort
const recentArticles = await collection.find({}).sort({ updatedAt: -1 }).limit(10).toArray();
```

## Deploying to Lambda

The library provides a complete Lambda handler at `@exabugs/dynamodb-client/server/handler`. You don't need to write custom handler code!

### Using Terraform

See the [Terraform Basic Example](../terraform/basic/) for a complete deployment example.

Quick example:

```hcl
module "dynamodb_client" {
  source = "github.com/exabugs/dynamodb-client//terraform"

  function_name = "myapp-records"
  table_name    = "myapp-records"

  # Base64-encoded shadow.config.json
  shadow_config = filebase64("${path.module}/shadow.config.json")

  # Cognito configuration
  cognito_user_pool_id = "us-east-1_XXXXXXXXX"
}
```

The Terraform module handles:

- Lambda function creation
- IAM roles and permissions
- Function URL configuration
- Environment variables
- DynamoDB table setup

## Next Steps

- Check out the [Client Example](../client/) for how to use the DynamoDB Client SDK
- Check out the [Terraform Examples](../terraform/) for Lambda deployment
- Check out the [React Admin Example](../react-admin/) for building admin interfaces
- Read the [Shadow Config Documentation](../../docs/SHADOW_CONFIG.md) for detailed field type explanations
- See [API Reference](../../docs/API.md) for all available operations

## Field Types

- **`string`**: Text fields (case-sensitive sorting)
- **`number`**: Numeric fields (numeric sorting)
- **`datetime`**: ISO 8601 datetime strings (chronological sorting)

## Default Sort Configuration

If your schema includes an `updatedAt` field, the default sort is automatically set to:

```json
{
  "sortDefaults": {
    "field": "updatedAt",
    "order": "DESC"
  }
}
```

Otherwise, the first sortable field is used with `ASC` order.
