# Shadow Records Documentation

This document explains how shadow records work and how they enable efficient sorting and querying in DynamoDB Single-Table design.

## Overview

Shadow records are automatically generated for all fields in your records, enabling efficient sorting without Global Secondary Indexes (GSIs). Since v0.3.0, shadow generation is fully automatic and requires no configuration files.

## How Shadow Records Work

### Main Record

Every record has a main record with `SK = id#{ULID}`:

```
PK: articles
SK: id#01HQXYZ123456789ABCDEFGH
data: { id: '01HQXYZ...', title: 'Article', viewCount: 123, ... }
```

### Shadow Records

For each field (except `id`), a shadow record is automatically created:

```
PK: articles
SK: title#Article#id#01HQXYZ123456789ABCDEFGH

PK: articles
SK: viewCount#1000000000000123#id#01HQXYZ123456789ABCDEFGH
```

### Important: `id` Field Exclusion

**The `id` field does NOT generate a shadow record.** The main record (`SK = id#{ULID}`) is used for id-based sorting.

This design:
- ✅ Reduces redundant shadow records
- ✅ Improves write performance
- ✅ Lowers storage costs
- ✅ Main record already provides id-based sorting

### Environment Variables

Configure shadow generation behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `SHADOW_CREATED_AT_FIELD` | `createdAt` | Field name for creation timestamp |
| `SHADOW_UPDATED_AT_FIELD` | `updatedAt` | Field name for update timestamp |
| `SHADOW_STRING_MAX_BYTES` | `100` | Max bytes for primitive types |
| `SHADOW_NUMBER_PADDING` | `15` | Padding digits for numbers |

## Supported Field Types

Shadow records are automatically generated for all field types:

### String

Text fields with case-sensitive sorting.

**Examples**: `title`, `status`, `author`, `category`

**Sorting**: Lexicographic order (A-Z)

**Truncation**: 100 bytes max

```typescript
// Sort by title (A-Z)
const articles = await collection.find({}).sort({ title: 1 }).toArray();
```

### Number

Numeric fields with numeric sorting.

**Examples**: `viewCount`, `price`, `rating`, `score`

**Sorting**: Numeric order (2 < 10 < 100)

**Range**: -10^15 to +10^15

```typescript
// Sort by view count (highest first)
const popular = await collection.find({}).sort({ viewCount: -1 }).limit(10).toArray();
```

### Boolean

Boolean fields.

**Examples**: `published`, `featured`, `archived`

**Sorting**: false (0) < true (1)

```typescript
// Sort by published status
const articles = await collection.find({}).sort({ published: -1 }).toArray();
```

### Datetime

ISO 8601 datetime strings with chronological sorting.

**Examples**: `createdAt`, `updatedAt`, `publishedAt`, `expiresAt`

**Format**: ISO 8601 (e.g., `"2024-01-15T10:30:00.000Z"`)

**Sorting**: Chronological order

```typescript
// Sort by creation date (newest first)
const recent = await collection.find({}).sort({ createdAt: -1 }).toArray();
```

### Array

Arrays (JSON stringified).

**Examples**: `tags`, `categories`, `authors`

**Truncation**: 200 bytes max

**Sorting**: Lexicographic order of JSON string

```typescript
const record = {
  id: '01HQXYZ123',
  tags: ['tech', 'aws'],
};
// Shadow: tags#["aws","tech"]#id#01HQXYZ123
```

### Object

Objects (JSON stringified).

**Examples**: `metadata`, `settings`, `config`

**Truncation**: 200 bytes max

**Sorting**: Lexicographic order of JSON string

```typescript
const record = {
  id: '01HQXYZ123',
  metadata: { category: 'tech', priority: 'high' },
};
// Shadow: metadata#{"category":"tech","priority":"high"}#id#01HQXYZ123
```

## Exclusion Rules

The following fields are automatically excluded from shadow generation:

### 1. `id` Field (v0.3.6+)

**The `id` field does NOT generate a shadow record.**

**Reason**: The main record (`SK = id#{ULID}`) already provides id-based sorting.

**Benefits**:
- Reduces redundant shadow records
- Improves write performance
- Lowers storage costs

```typescript
const record = {
  id: '01HQXYZ123',
  title: 'Article',
};

// Generated records:
// Main:   PK=articles, SK=id#01HQXYZ123
// Shadow: PK=articles, SK=title#Article#id#01HQXYZ123
// (No shadow for 'id' field)
```

### 2. Internal Metadata Fields

Fields starting with `__` are excluded (internal metadata).

```typescript
const record = {
  id: '01HQXYZ123',
  title: 'Article',
  __internal: 'metadata', // Excluded
};
```

### 3. Null/Undefined Values

Fields with `null` or `undefined` values are excluded.

```typescript
const record = {
  id: '01HQXYZ123',
  title: 'Article',
  description: null, // Excluded
};
```

## Automatic Shadow Generation Example

```typescript
const record = {
  id: '01HQXYZ123',
  title: 'Article Title',
  status: 'published',
  viewCount: 123,
  published: true,
  tags: ['tech', 'aws'],
  metadata: { category: 'tech' },
  createdAt: '2024-12-02T00:00:00Z',
  updatedAt: '2024-12-02T12:00:00Z',
};

// Automatically generates:
// Main record:
//   PK: articles
//   SK: id#01HQXYZ123
//
// Shadow records:
//   PK: articles, SK: title#Article#Title#id#01HQXYZ123
//   PK: articles, SK: status#published#id#01HQXYZ123
//   PK: articles, SK: viewCount#1000000000000123#id#01HQXYZ123
//   PK: articles, SK: published#1#id#01HQXYZ123
//   PK: articles, SK: tags#["aws","tech"]#id#01HQXYZ123
//   PK: articles, SK: metadata#{"category":"tech"}#id#01HQXYZ123
//   PK: articles, SK: createdAt#2024-12-02T00:00:00.000Z#id#01HQXYZ123
//   PK: articles, SK: updatedAt#2024-12-02T12:00:00.000Z#id#01HQXYZ123
//
// Note: No shadow for 'id' field (main record is used)
```

## Performance Considerations

### Storage Calculation

- 1 record = 1 main record + N shadow records
- N = number of fields (excluding `id`, `__*`, null/undefined)
- Example: 1000 articles with 8 fields = 9000 DynamoDB items

### Write Cost

- Each write creates/updates main record + all shadow records
- Example: Insert 1 article with 8 fields = 9 write operations

### Read Cost

- Queries only read relevant shadow records
- No additional cost compared to GSI-based sorting

### Optimization Tips

1. **Minimize fields**: Only include fields you need
2. **Use appropriate types**: Number for numeric sorting, not string
3. **Consider query patterns**: Design records based on how you'll query them
4. **Monitor costs**: Use AWS Cost Explorer to track DynamoDB costs

## Usage Examples

### Basic Sorting

```typescript
// Sort by title (A-Z)
const articles = await collection.find({}).sort({ title: 1 }).toArray();

// Sort by view count (highest first)
const popular = await collection.find({}).sort({ viewCount: -1 }).limit(10).toArray();

// Sort by creation date (newest first)
const recent = await collection.find({}).sort({ createdAt: -1 }).toArray();
```

### Filtering and Sorting

```typescript
// Published articles, sorted by date
const published = await collection
  .find({ status: 'published' })
  .sort({ publishedAt: -1 })
  .toArray();

// High-priority tasks, sorted by due date
const urgent = await collection
  .find({ priority: 'high' })
  .sort({ dueDate: 1 })
  .toArray();
```

### Pagination

```typescript
// First page
const page1 = await collection
  .find({})
  .sort({ createdAt: -1 })
  .limit(10)
  .toArray();

// Second page
const page2 = await collection
  .find({})
  .sort({ createdAt: -1 })
  .skip(10)
  .limit(10)
  .toArray();
```

## Troubleshooting

### Shadow Records Not Created

**Problem**: Records are created but shadow records are missing.

**Solutions**:

1. Check Lambda logs for errors
2. Verify field values are not null/undefined
3. Verify field names don't start with `__`
4. Check DynamoDB table for shadow records

### Sorting Not Working

**Problem**: Query results are not sorted correctly.

**Solutions**:

1. Verify sort field exists in all records
2. Check field type matches data type (number vs string)
3. Verify records have non-null values for the sort field
4. Check Lambda logs for query errors

### Missing Records in Sort Results

**Problem**: Some records don't appear in sorted results.

**Reason**: Records without the sort field don't have shadow records for that field.

**Solution**: Ensure all records have the field you're sorting by, or filter for records with that field.

## Version History

### v0.3.6 (2024-12-02)

- **Excluded `id` field from shadow generation**
- Main record (`SK = id#{ULID}`) is used for id-based sorting
- Reduces redundant shadow records and improves performance

### v0.3.0 (2024-12-01)

- **Automatic shadow generation** for all fields
- No configuration files required
- Environment variable-based configuration
- Support for 6 field types: string, number, boolean, datetime, array, object

## See Also

- [Architecture Documentation](./ARCHITECTURE.md) - System architecture
- [Client Usage Guide](./CLIENT_USAGE.md) - Client SDK documentation
- [Example Project](https://github.com/exabugs/dynamodb-client-example) - Complete working example
