# Shadow Config Documentation

This document explains the Shadow Config format and how to use it effectively.

## Overview

Shadow Config defines how shadow records are generated for efficient sorting and querying in DynamoDB Single-Table design.

## Configuration Format

```json
{
  "$schemaVersion": "2.0",
  "database": {
    "name": "myapp",
    "timestamps": {
      "createdAt": "createdAt",
      "updatedAt": "updatedAt"
    }
  },
  "resources": {
    "articles": {
      "shadows": {
        "title": { "type": "string" },
        "status": { "type": "string" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      },
      "sortDefaults": {
        "field": "updatedAt",
        "order": "DESC"
      }
    }
  }
}
```

## Field Types

### String

**Type**: `"string"`

**Description**: Text fields with case-sensitive sorting.

**Use cases**:

- Names, titles, descriptions
- Status values (draft, published, archived)
- Categories, tags
- User identifiers

**Sorting behavior**:

- Lexicographic (dictionary) order
- Case-sensitive: "Apple" < "apple"
- Numbers sorted as strings: "10" < "2"

**Example**:

```json
{
  "title": { "type": "string" },
  "status": { "type": "string" },
  "author": { "type": "string" }
}
```

**Query example**:

```typescript
// Sort by title (A-Z)
const articles = await collection.find({}).sort({ title: 1 }).toArray();

// Filter by status
const published = await collection.find({ status: 'published' }).toArray();
```

### Number

**Type**: `"number"`

**Description**: Numeric fields with numeric sorting.

**Use cases**:

- Counts (view count, like count)
- Scores, ratings
- Prices, amounts
- Durations (in seconds)

**Sorting behavior**:

- Numeric order: 2 < 10 < 100
- Supports negative numbers
- Supports decimals

**Example**:

```json
{
  "viewCount": { "type": "number" },
  "price": { "type": "number" },
  "rating": { "type": "number" }
}
```

**Query example**:

```typescript
// Sort by view count (highest first)
const popular = await collection.find({}).sort({ viewCount: -1 }).limit(10).toArray();

// Filter by price range
const affordable = await collection.find({ price: { $lte: 100 } }).toArray();
```

### Datetime

**Type**: `"datetime"`

**Description**: ISO 8601 datetime strings with chronological sorting.

**Use cases**:

- Created/updated timestamps
- Published dates
- Due dates, expiration dates
- Event timestamps

**Format**: ISO 8601 string (e.g., `"2024-01-15T10:30:00.000Z"`)

**Sorting behavior**:

- Chronological order
- Timezone-aware (UTC recommended)
- Millisecond precision

**Example**:

```json
{
  "createdAt": { "type": "datetime" },
  "updatedAt": { "type": "datetime" },
  "publishedAt": { "type": "datetime" },
  "expiresAt": { "type": "datetime" }
}
```

**Query example**:

```typescript
// Sort by creation date (newest first)
const recent = await collection.find({}).sort({ createdAt: -1 }).toArray();

// Filter by date range
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const recentArticles = await collection.find({ createdAt: { $gte: lastWeek } }).toArray();
```

## Default Sort Configuration

### Automatic Defaults

If not specified, default sort is automatically determined:

1. **If `updatedAt` field exists**: Sort by `updatedAt DESC` (most recent first)
2. **Otherwise**: Sort by first sortable field `ASC`

### Custom Defaults

Specify custom default sort per resource:

```json
{
  "resources": {
    "articles": {
      "sortDefaults": {
        "field": "publishedAt",
        "order": "DESC"
      }
    },
    "tasks": {
      "sortDefaults": {
        "field": "dueDate",
        "order": "ASC"
      }
    }
  }
}
```

**Sort orders**:

- `"ASC"`: Ascending (A-Z, 0-9, oldest-newest)
- `"DESC"`: Descending (Z-A, 9-0, newest-oldest)

## TTL (Time-To-Live) Configuration

### Overview

TTL automatically deletes records after a specified time period.

### Configuration

```json
{
  "resources": {
    "videos": {
      "shadows": {
        "expiresAt": { "type": "datetime" }
      },
      "ttl": {
        "days": 30
      }
    }
  }
}
```

### Requirements

1. **TTL field**: Must be a datetime field (typically `expiresAt`)
2. **DynamoDB TTL**: Must be enabled on the table
3. **Field value**: Must be a Unix timestamp (seconds since epoch)

### DynamoDB Configuration

Enable TTL in Terraform:

```hcl
resource "aws_dynamodb_table" "records" {
  name = "myapp-records"

  ttl {
    enabled        = true
    attribute_name = "expiresAt"
  }
}
```

### Usage

```typescript
// Create record with expiration
const video = await videos.insertOne({
  title: 'Tutorial Video',
  url: 'https://example.com/video.mp4',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// DynamoDB will automatically delete this record after expiresAt
```

### Behavior

- **Deletion timing**: Within 48 hours after expiration (not immediate)
- **No cost**: TTL deletion is free
- **No events**: Deletions don't trigger DynamoDB Streams
- **Shadow records**: Automatically deleted with main record

## Schema Version

### Current Version

`"$schemaVersion": "2.0"`

### Version History

- **2.0**: Current version with `shadows` object
- **1.0**: Legacy version with `fields` object (deprecated)

### Migration

If using version 1.0, update to 2.0:

```json
// Version 1.0 (deprecated)
{
  "$schemaVersion": "1.0",
  "resources": {
    "articles": {
      "fields": {
        "title": { "type": "string" }
      }
    }
  }
}

// Version 2.0 (current)
{
  "$schemaVersion": "2.0",
  "resources": {
    "articles": {
      "shadows": {
        "title": { "type": "string" }
      }
    }
  }
}
```

## Best Practices

### Field Selection

**Do**:

- Mark fields as sortable only if you need to sort by them
- Consider query patterns when choosing sortable fields
- Use appropriate field types (number for numeric sorting)

**Don't**:

- Mark every field as sortable (increases storage cost)
- Use string type for numeric values
- Use number type for text values

### Performance

**Storage calculation**:

- 1 record = 1 main record + N shadow records (N = number of sortable fields)
- Example: 1000 articles with 8 sortable fields = 9000 DynamoDB items

**Write cost**:

- Each write operation creates/updates main record + all shadow records
- Example: Insert 1 article with 8 sortable fields = 9 write operations

**Read cost**:

- Queries only read relevant shadow records
- No additional cost compared to GSI-based sorting

### Naming Conventions

**Field names**:

- Use camelCase: `createdAt`, `viewCount`, `publishedAt`
- Be consistent across resources
- Use descriptive names

**Resource names**:

- Use plural form: `articles`, `tasks`, `videos`
- Use lowercase
- Use hyphens for multi-word: `blog-posts`, `user-profiles`

## Examples

### Basic Configuration

```json
{
  "$schemaVersion": "2.0",
  "database": {
    "name": "myapp",
    "timestamps": {
      "createdAt": "createdAt",
      "updatedAt": "updatedAt"
    }
  },
  "resources": {
    "articles": {
      "shadows": {
        "title": { "type": "string" },
        "status": { "type": "string" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      }
    }
  }
}
```

### Advanced Configuration

```json
{
  "$schemaVersion": "2.0",
  "database": {
    "name": "myapp",
    "timestamps": {
      "createdAt": "createdAt",
      "updatedAt": "updatedAt"
    }
  },
  "resources": {
    "articles": {
      "shadows": {
        "title": { "type": "string" },
        "status": { "type": "string" },
        "author": { "type": "string" },
        "category": { "type": "string" },
        "viewCount": { "type": "number" },
        "publishedAt": { "type": "datetime" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      },
      "sortDefaults": {
        "field": "publishedAt",
        "order": "DESC"
      }
    },
    "tasks": {
      "shadows": {
        "title": { "type": "string" },
        "status": { "type": "string" },
        "priority": { "type": "string" },
        "assignee": { "type": "string" },
        "dueDate": { "type": "datetime" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      },
      "sortDefaults": {
        "field": "dueDate",
        "order": "ASC"
      }
    },
    "videos": {
      "shadows": {
        "title": { "type": "string" },
        "duration": { "type": "number" },
        "viewCount": { "type": "number" },
        "expiresAt": { "type": "datetime" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      },
      "sortDefaults": {
        "field": "createdAt",
        "order": "DESC"
      },
      "ttl": {
        "days": 30
      }
    }
  }
}
```

## Troubleshooting

### Shadow Records Not Created

**Problem**: Records are created but shadow records are missing.

**Solutions**:

1. Verify `SHADOW_CONFIG` environment variable is set
2. Check config is properly base64-encoded
3. Verify field names match schema definition
4. Check Lambda logs for errors

### Sorting Not Working

**Problem**: Query results are not sorted correctly.

**Solutions**:

1. Verify field is marked as sortable in config
2. Check field type matches data type
3. Verify sort field exists in all records
4. Check default sort configuration

### TTL Not Deleting Records

**Problem**: Records are not deleted after expiration.

**Solutions**:

1. Verify TTL is enabled on DynamoDB table
2. Check `expiresAt` field is Unix timestamp (seconds)
3. Wait up to 48 hours for deletion
4. Verify field name matches TTL attribute name

## See Also

- [Basic Example](../examples/basic/) - Getting started with Shadow Config
- [Advanced Example](../examples/advanced/) - Multiple resources and TTL
- [Terraform Examples](../examples/terraform/) - Infrastructure setup
- [API Reference](./API.md) - Client SDK documentation
