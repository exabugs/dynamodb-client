# React Admin Example

This example demonstrates how to integrate `@exabugs/dynamodb-client` with React Admin to build a complete admin interface.

## Overview

This example shows:

- React Admin setup with DynamoDB Client
- Data provider implementation
- Authentication with Cognito
- CRUD operations with UI
- List, Create, Edit, Show views

## Prerequisites

- Lambda function deployed (see [Terraform Examples](../terraform/))
- Cognito User Pool configured
- Node.js >= 18.0.0

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Configuration from Terraform

First, deploy the Lambda function using Terraform:

```bash
cd ../terraform
terraform apply
```

Then get the configuration from Terraform outputs:

```bash
# Get Function URL
terraform output function_url

# Get Cognito User Pool ID
terraform output cognito_user_pool_id

# Get Cognito Client ID
terraform output cognito_client_id
```

### 3. Configure Environment Variables

Create `.env` file with values from Terraform outputs:

```env
# From: terraform output function_url
VITE_FUNCTION_URL=https://your-function-url.lambda-url.us-east-1.on.aws/

VITE_AWS_REGION=us-east-1

# From: terraform output cognito_user_pool_id
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX

# From: terraform output cognito_client_id
VITE_COGNITO_CLIENT_ID=your-client-id

# Cognito Domain (format: <your-domain>.auth.<region>.amazoncognito.com)
VITE_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
```

Or use this command to automatically populate some values:

```bash
cat > .env << EOF
VITE_FUNCTION_URL=$(cd ../terraform && terraform output -raw function_url)
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=$(cd ../terraform && terraform output -raw cognito_user_pool_id)
VITE_COGNITO_CLIENT_ID=$(cd ../terraform && terraform output -raw cognito_client_id)
VITE_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
EOF
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Project Structure

```
react-admin/
├── src/
│   ├── App.tsx              # Main application
│   ├── authProvider.ts      # Cognito authentication
│   ├── dataProvider.ts      # DynamoDB Client data provider
│   ├── resources/           # Resource definitions
│   │   └── articles.tsx     # Articles resource
│   └── main.tsx            # Entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Data Provider

The data provider wraps the DynamoDB Client SDK:

```typescript
import { DynamoClient } from '@exabugs/dynamodb-client/client/cognito';
import { createDataProvider } from '@exabugs/dynamodb-client/integrations/react-admin';

const client = new DynamoClient(FUNCTION_URL, {
  region: AWS_REGION,
  getToken: async () => {
    // Get Cognito JWT token
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  },
});

export const dataProvider = createDataProvider(client);
```

## Authentication Provider

Uses Cognito Hosted UI with PKCE:

```typescript
import { cognitoAuthProvider } from '@exabugs/dynamodb-client/integrations/react-admin';

export const authProvider = cognitoAuthProvider({
  userPoolId: COGNITO_USER_POOL_ID,
  clientId: COGNITO_CLIENT_ID,
  domain: COGNITO_DOMAIN,
  region: AWS_REGION,
});
```

## Resource Definition

Define resources with React Admin components:

```typescript
import { List, Datagrid, TextField, DateField, Create, SimpleForm, TextInput } from 'react-admin';

export const ArticleList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="title" />
      <TextField source="status" />
      <DateField source="createdAt" />
    </Datagrid>
  </List>
);

export const ArticleCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="title" required />
      <TextInput source="content" multiline />
      <SelectInput source="status" choices={[
        { id: 'draft', name: 'Draft' },
        { id: 'published', name: 'Published' },
      ]} />
    </SimpleForm>
  </Create>
);
```

## Features

### CRUD Operations

- **List**: Display records with sorting and filtering
- **Create**: Add new records
- **Edit**: Update existing records
- **Show**: View record details
- **Delete**: Remove records

### Sorting

Shadow records enable efficient sorting:

```typescript
<List sort={{ field: 'updatedAt', order: 'DESC' }}>
  <Datagrid>
    <TextField source="title" sortable />
    <TextField source="status" sortable />
    <DateField source="updatedAt" sortable />
  </Datagrid>
</List>
```

### Filtering

Filter records by any field:

```typescript
<List filters={[
  <TextInput source="status" />,
  <TextInput source="author" />,
]}>
  <Datagrid>
    {/* ... */}
  </Datagrid>
</List>
```

### Pagination

Automatic pagination with DynamoDB:

```typescript
<List perPage={25}>
  <Datagrid>
    {/* ... */}
  </Datagrid>
</List>
```

## Authentication Flow

1. User clicks "Login"
2. Redirected to Cognito Hosted UI
3. User authenticates
4. Redirected back with authorization code
5. Exchange code for JWT tokens (PKCE)
6. Store tokens in localStorage
7. Use JWT token for API requests

## Deployment

### Build for Production

```bash
npm run build
```

This creates a `dist/` directory with optimized static files.

### Deploy to S3 + CloudFront

```bash
# Upload to S3
aws s3 sync dist/ s3://your-bucket/

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

### Environment Variables

For production, set environment variables in your CI/CD pipeline or hosting platform.

## Customization

### Add New Resources

1. Create resource file in `src/resources/`
2. Define List, Create, Edit, Show components
3. Register in `App.tsx`

```typescript
<Resource
  name="tasks"
  list={TaskList}
  create={TaskCreate}
  edit={TaskEdit}
  show={TaskShow}
/>
```

### Custom Theme

Customize Material-UI theme:

```typescript
import { defaultTheme } from 'react-admin';

const theme = {
  ...defaultTheme,
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
};

<Admin theme={theme}>
  {/* ... */}
</Admin>
```

## Troubleshooting

### Authentication Errors

If you see authentication errors:

1. Verify Cognito configuration in `.env`
2. Check Cognito App Client settings (enable Hosted UI)
3. Add callback URL to Cognito (http://localhost:5173 for dev)
4. Verify PKCE is enabled in App Client

### CORS Errors

If you see CORS errors:

1. Configure Lambda Function URL CORS settings
2. Add your domain to allowed origins
3. Allow required headers (Authorization, Content-Type)

### Data Not Loading

If data doesn't load:

1. Verify Function URL is correct
2. Check JWT token is valid (not expired)
3. Verify Lambda has DynamoDB permissions
4. Check CloudWatch Logs for errors

## Next Steps

- See [Basic Example](../basic/) for schema definition
- Check out [Advanced Example](../advanced/) for multiple resources
- Read [React Admin Documentation](https://marmelab.com/react-admin/) for more features
- See [Terraform Examples](../terraform/) for infrastructure setup

## Best Practices

### Security

- Use HTTPS in production
- Enable MFA in Cognito
- Rotate Cognito secrets regularly
- Use environment variables for sensitive data

### Performance

- Enable pagination for large datasets
- Use appropriate page sizes (25-50 records)
- Implement caching where appropriate
- Monitor Lambda cold starts

### User Experience

- Provide clear error messages
- Show loading states
- Implement optimistic updates
- Add confirmation dialogs for destructive actions
