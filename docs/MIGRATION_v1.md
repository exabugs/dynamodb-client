# Migration Guide: v0.x to v1.0.0

## Overview

Version 1.0.0 introduces **MongoDB-compatible operator syntax** with `$`-prefixed operators. This is a **breaking change** that requires updates to existing code.

**Migration Effort**: Low to Medium

- TypeScript compiler will catch most issues automatically
- Simple find-and-replace for operator names
- No runtime behavior changes

## Breaking Changes

### 1. Filter Operators

All filter operators now require the `$` prefix for MongoDB compatibility.

#### Before (v0.x)

```typescript
// Comparison operators
const products = await collection.find({
  price: { gte: 1000, lte: 5000 },
  status: { in: ['active', 'pending'] },
  name: { regex: /^Product/ }
}).toArray();

// Logical operators
const products = await collection.find({
  or: [
    { status: 'active' },
    { priority: { gte: 5 } }
  ]
}).toArray();
```

#### After (v1.0.0)

```typescript
// Comparison operators
const products = await collection.find({
  price: { $gte: 1000, $lte: 5000 },
  status: { $in: ['active', 'pending'] },
  name: { $regex: /^Product/ }
}).toArray();

// Logical operators
const products = await collection.find({
  $or: [
    { status: 'active' },
    { priority: { $gte: 5 } }
  ]
}).toArray();
```

### 2. Update Operators

All update operators now require the `$` prefix.

#### Before (v0.x)

```typescript
await collection.updateOne(
  { id: 'product-123' },
  {
    set: { price: 1500, updatedAt: new Date().toISOString() },
    inc: { viewCount: 1 },
    unset: ['oldField'],
  }
);
```

#### After (v1.0.0)

```typescript
await collection.updateOne(
  { id: 'product-123' },
  {
    $set: { price: 1500, updatedAt: new Date().toISOString() },
    $inc: { viewCount: 1 },
    $unset: ['oldField'],
  }
);
```

## Complete Operator Mapping

### Filter Operators

| v0.x (Old) | v1.0.0 (New) | Description           |
| ---------- | ------------ | --------------------- |
| `eq`       | `$eq`        | Equal                 |
| `ne`       | `$ne`        | Not equal             |
| `gt`       | `$gt`        | Greater than          |
| `gte`      | `$gte`       | Greater than or equal |
| `lt`       | `$lt`        | Less than             |
| `lte`      | `$lte`       | Less than or equal    |
| `in`       | `$in`        | In array              |
| `nin`      | `$nin`       | Not in array          |
| `exists`   | `$exists`    | Field exists          |
| `regex`    | `$regex`     | Regular expression    |
| `and`      | `$and`       | Logical AND           |
| `or`       | `$or`        | Logical OR            |

### Update Operators

| v0.x (Old) | v1.0.0 (New) | Description      |
| ---------- | ------------ | ---------------- |
| `set`      | `$set`       | Set field value  |
| `unset`    | `$unset`     | Remove field     |
| `inc`      | `$inc`       | Increment number |

## Migration Strategies

### Strategy 1: Automated Find-and-Replace (Recommended)

Use your IDE's find-and-replace feature with regex:

#### Filter Operators

```regex
# Find
\b(eq|ne|gt|gte|lt|lte|in|nin|exists|regex|and|or):\s

# Replace with
$\1:
```

#### Update Operators

```regex
# Find
\b(set|unset|inc):\s

# Replace with
$\1:
```

**Note**: Be careful with `in` operator - make sure you're only replacing filter operators, not JavaScript keywords.

### Strategy 2: Manual Migration

For smaller codebases or when you want more control:

1. **Run TypeScript compiler**: `npm run build` or `tsc --noEmit`
2. **Fix type errors**: TypeScript will show all locations that need updates
3. **Update each occurrence**: Add `$` prefix to operators
4. **Test thoroughly**: Run your test suite after each change

### Strategy 3: Gradual Migration

For large codebases, migrate incrementally:

1. **Create a new branch**: `git checkout -b migrate-to-v1`
2. **Migrate by module**: Update one module at a time
3. **Test each module**: Ensure tests pass before moving to the next
4. **Merge when complete**: Merge the branch when all modules are updated

## Step-by-Step Migration Guide

### Step 1: Update Dependencies

```bash
# Update to v1.0.0
npm install @exabugs/dynamodb-client@^1.0.0

# Or with pnpm
pnpm add @exabugs/dynamodb-client@^1.0.0

# Or with yarn
yarn add @exabugs/dynamodb-client@^1.0.0
```

### Step 2: Run TypeScript Compiler

```bash
# Check for type errors
npm run build
# or
tsc --noEmit
```

TypeScript will report all locations where operators need to be updated.

### Step 3: Update Filter Operators

Find all occurrences of filter operators and add `$` prefix:

```typescript
// Before
collection.find({ price: { gte: 1000 } });
collection.find({ status: { in: ['active'] } });
collection.find({ or: [{ status: 'active' }] });

// After
collection.find({ price: { $gte: 1000 } });
collection.find({ status: { $in: ['active'] } });
collection.find({ $or: [{ status: 'active' }] });
```

### Step 4: Update Update Operators

Find all occurrences of update operators and add `$` prefix:

```typescript
// Before
collection.updateOne(filter, { set: { name: 'New' } });
collection.updateMany(filter, { inc: { count: 1 } });

// After
collection.updateOne(filter, { $set: { name: 'New' } });
collection.updateMany(filter, { $inc: { count: 1 } });
```

### Step 5: Run Tests

```bash
# Run your test suite
npm test

# Run with coverage
npm run test:coverage
```

### Step 6: Manual Testing

Test critical paths manually:

1. **Create operations**: Verify insertOne/insertMany work correctly
2. **Read operations**: Verify find/findOne with filters work correctly
3. **Update operations**: Verify updateOne/updateMany with operators work correctly
4. **Delete operations**: Verify deleteOne/deleteMany work correctly

## Common Migration Patterns

### Pattern 1: Simple Filters

```typescript
// Before (v0.x)
const products = await collection.find({
  status: 'active',
  price: { gte: 1000 }
}).toArray();

// After (v1.0.0)
const products = await collection.find({
  status: 'active',
  price: { $gte: 1000 }
}).toArray();
```

### Pattern 2: Complex Filters with Logical Operators

```typescript
// Before (v0.x)
const products = await collection.find({
  or: [
    { status: 'active' },
    { and: [
      { priority: { gte: 5 } },
      { category: { in: ['electronics', 'books'] } }
    ]}
  ]
}).toArray();

// After (v1.0.0)
const products = await collection.find({
  $or: [
    { status: 'active' },
    { $and: [
      { priority: { $gte: 5 } },
      { category: { $in: ['electronics', 'books'] } }
    ]}
  ]
}).toArray();
```

### Pattern 3: Update with Multiple Operators

```typescript
// Before (v0.x)
await collection.updateOne(
  { id: 'product-123' },
  {
    set: { status: 'published', updatedAt: new Date().toISOString() },
    inc: { viewCount: 1 },
    unset: ['draft'],
  }
);

// After (v1.0.0)
await collection.updateOne(
  { id: 'product-123' },
  {
    $set: { status: 'published', updatedAt: new Date().toISOString() },
    $inc: { viewCount: 1 },
    $unset: ['draft'],
  }
);
```

### Pattern 4: Upsert Operations

```typescript
// Before (v0.x)
await collection.updateOne(
  { id: 'product-123' },
  { set: { name: 'Product', price: 1000 } },
  { upsert: true }
);

// After (v1.0.0)
await collection.updateOne(
  { id: 'product-123' },
  { $set: { name: 'Product', price: 1000 } },
  { upsert: true }
);
```

## TypeScript Type Checking

TypeScript will help catch migration issues:

```typescript
// ❌ Type error in v1.0.0
const filter: Filter<Product> = {
  price: { gte: 1000 }  // Error: Property 'gte' does not exist
};

// ✅ Correct in v1.0.0
const filter: Filter<Product> = {
  price: { $gte: 1000 }  // OK
};
```

## Testing Your Migration

### Unit Tests

Update your unit tests to use new operator syntax:

```typescript
// Before (v0.x)
describe('Product queries', () => {
  it('should find products by price range', async () => {
    const products = await collection
      .find({
        price: { gte: 1000, lte: 5000 },
      })
      .toArray();
    expect(products.length).toBeGreaterThan(0);
  });
});

// After (v1.0.0)
describe('Product queries', () => {
  it('should find products by price range', async () => {
    const products = await collection
      .find({
        price: { $gte: 1000, $lte: 5000 },
      })
      .toArray();
    expect(products.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

Verify end-to-end workflows:

```typescript
it('should create, update, and delete a product', async () => {
  // Create
  const result = await collection.insertOne({
    name: 'Test Product',
    price: 1000,
    status: 'active',
  });

  // Update with new syntax
  await collection.updateOne(
    { id: result.insertedId },
    { $set: { price: 1500 }, $inc: { viewCount: 1 } }
  );

  // Verify
  const product = await collection.findOne({ id: result.insertedId });
  expect(product?.price).toBe(1500);
  expect(product?.viewCount).toBe(1);

  // Delete
  await collection.deleteOne({ id: result.insertedId });
});
```

## Troubleshooting

### Issue 1: TypeScript Errors After Update

**Problem**: TypeScript shows errors like "Property 'gte' does not exist"

**Solution**: Add `$` prefix to all operators

```typescript
// ❌ Error
{
  price: {
    gte: 1000;
  }
}

// ✅ Fixed
{
  price: {
    $gte: 1000;
  }
}
```

### Issue 2: Runtime Errors

**Problem**: Queries return unexpected results or errors

**Solution**: Check that all operators have `$` prefix, including nested operators

```typescript
// ❌ Missing $ in nested operator
{
  $or: [
    { status: 'active' },
    { priority: { gte: 5 } }, // Missing $
  ];
}

// ✅ All operators have $
{
  $or: [{ status: 'active' }, { priority: { $gte: 5 } }];
}
```

### Issue 3: Tests Failing After Migration

**Problem**: Tests fail after updating to v1.0.0

**Solution**:

1. Update test code to use new operator syntax
2. Update mock data if needed
3. Verify test assertions are still valid

### Issue 4: Mixed Old and New Syntax

**Problem**: Some code uses old syntax, some uses new syntax

**Solution**: Use find-and-replace to ensure consistency:

```bash
# Search for old syntax in your codebase
grep -r "{ gte:" src/
grep -r "{ in:" src/
grep -r "{ set:" src/

# Update all occurrences
```

## Benefits of Migration

### 1. MongoDB Compatibility

Full compatibility with MongoDB query syntax makes it easier to:

- Reference MongoDB documentation
- Use MongoDB tools and libraries
- Onboard developers familiar with MongoDB

### 2. Ecosystem Integration

Better integration with MongoDB-compatible tools:

- Query builders
- ORMs and ODMs
- Database management tools

### 3. Clear Intent

The `$` prefix makes it clear that these are operators, not field names:

```typescript
// Ambiguous (v0.x)
{ or: [...] }  // Is this a field or operator?

// Clear (v1.0.0)
{ $or: [...] }  // Clearly an operator
```

### 4. Future-Proof

Aligns with MongoDB standards, making it easier to add new operators in the future.

## FAQ

### Q1: Can I use both old and new syntax during migration?

**A**: No. Version 1.0.0 only supports the new `$`-prefixed syntax. You must update all code before upgrading.

### Q2: Will my data in DynamoDB be affected?

**A**: No. This is a client-side change only. Your data in DynamoDB remains unchanged.

### Q3: How long does migration typically take?

**A**: For most projects:

- Small projects (< 10 files): 15-30 minutes
- Medium projects (10-50 files): 1-2 hours
- Large projects (> 50 files): 2-4 hours

### Q4: Can I automate the migration?

**A**: Yes. Use find-and-replace with regex (see Strategy 1 above). However, always review changes and test thoroughly.

### Q5: What if I find a bug after migration?

**A**:

1. Check that all operators have `$` prefix
2. Verify TypeScript compilation succeeds
3. Run your test suite
4. If issues persist, report on GitHub: https://github.com/exabugs/dynamodb-client/issues

### Q6: Is there a codemod or automated migration tool?

**A**: Not currently. The migration is straightforward enough that find-and-replace is sufficient. If you need help, please open an issue on GitHub.

## Support

If you encounter issues during migration:

1. **Check this guide**: Review the troubleshooting section
2. **Search existing issues**: https://github.com/exabugs/dynamodb-client/issues
3. **Open a new issue**: Provide details about your migration problem
4. **Community support**: Ask in GitHub Discussions

## Rollback Plan

If you need to rollback to v0.x:

```bash
# Rollback to latest v0.x version
npm install @exabugs/dynamodb-client@^0.9.2

# Or with pnpm
pnpm add @exabugs/dynamodb-client@^0.9.2

# Revert your code changes
git revert <commit-hash>
```

**Note**: v0.x will continue to receive critical bug fixes for 6 months after v1.0.0 release.

## Conclusion

Migration to v1.0.0 is straightforward:

1. ✅ Update dependency to v1.0.0
2. ✅ Add `$` prefix to all operators
3. ✅ Run TypeScript compiler to catch issues
4. ✅ Test thoroughly
5. ✅ Deploy with confidence

The benefits of MongoDB compatibility and clearer syntax make this migration worthwhile.

**Happy migrating! 🚀**
