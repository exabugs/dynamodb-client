---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug Description
A clear and concise description of what the bug is.

## To Reproduce
Steps to reproduce the behavior:
1. Install package '...'
2. Create client with '...'
3. Call method '...'
4. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Actual Behavior
What actually happened.

## Code Sample
```typescript
// Minimal code sample that reproduces the issue
import { DynamoClient } from '@exabugs/dynamodb-client/client/iam';

const client = new DynamoClient(FUNCTION_URL);
// ...
```

## Environment
- Package version: [e.g. 1.0.0]
- Node.js version: [e.g. 18.0.0]
- Operating System: [e.g. macOS 13.0]
- AWS SDK version: [e.g. 3.929.0]

## Error Messages
```
Paste any error messages here
```

## Additional Context
Add any other context about the problem here.

## Possible Solution
If you have suggestions on how to fix the bug, please describe them here.
