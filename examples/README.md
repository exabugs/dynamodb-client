# Examples

Complete working examples for `@exabugs/dynamodb-client` - from schema definition to production deployment.

## 🎯 Quick Start Guide

Follow these examples in order to learn the complete workflow:

```
1. Schema Definition → 2. Deploy Infrastructure → 3. Use Client/UI
```

## 📚 Available Examples

### 1. 📝 [Schema Example](./schema/)

**Learn**: How to define TypeScript schemas and generate shadow configuration

- Define TypeScript schemas for your resources
- Generate `shadow.config.json` from schemas
- Configure field types (string, number, datetime)
- Understand shadow records for efficient sorting

**Files**:

- `schema.ts` - TypeScript schema definition
- `shadow.config.json` - Generated configuration example

**Start here** if you're new to the library.

---

### 2. 🔧 [Terraform Example](./terraform/)

**Learn**: How to deploy Lambda function and infrastructure to AWS

- Multi-environment support (dev/stg/prd)
- DynamoDB table with TTL and Point-in-Time Recovery
- Cognito User Pool with advanced security settings
- Lambda function with Function URL
- CloudWatch Alarms for monitoring
- Environment-specific configurations

**Files**:

- `main.tf` - Terraform configuration
- `variables.tf` - Variable definitions
- `shadow.config.json` - Shadow configuration

**Deploy this** to get your Lambda Function URL and Cognito configuration.

---

### 3. 💻 [Client Example](./client/)

**Learn**: How to use the DynamoDB Client SDK for CRUD operations

- Connect to Lambda Function URL (from Terraform output)
- Perform CRUD operations (Create, Read, Update, Delete)
- Query with sorting and filtering
- Use batch operations
- Authentication methods (IAM, Cognito, Custom Token)

**Files**:

- `index.ts` - Complete CRUD example
- `package.json` - Dependencies
- `README.md` - Usage instructions

**Run this** after deploying with Terraform.

---

### 4. ⚛️ [React Admin Example](./react-admin/)

**Learn**: How to build admin interfaces with React Admin

- Complete React Admin setup with DynamoDB Client
- Data provider implementation
- Cognito authentication with PKCE
- CRUD operations with UI
- List, Create, Edit, Show views

**Files**:

- `src/` - React Admin application
- `.env.example` - Environment variables template
- `package.json` - Dependencies

**Build this** for a complete admin dashboard.

---

## 🚀 Complete Workflow

### Step 1: Define Your Schema

```bash
cd schema/
# Review schema.ts and shadow.config.json
```

Learn how to define your data model and generate shadow configuration.

### Step 2: Deploy Infrastructure

```bash
cd ../terraform/
terraform init
terraform apply

# Get outputs
terraform output function_url
terraform output cognito_user_pool_id
terraform output cognito_client_id
```

Deploy Lambda function, DynamoDB table, and Cognito to AWS.

### Step 3: Use the Client

**Option A: Node.js Client**

```bash
cd ../client/

# Set Function URL from Terraform output
export FUNCTION_URL=$(cd ../terraform && terraform output -raw function_url)

npm install
npm start
```

**Option B: React Admin UI**

```bash
cd ../react-admin/

# Create .env file with Terraform outputs
cat > .env << EOF
VITE_FUNCTION_URL=$(cd ../terraform && terraform output -raw function_url)
VITE_COGNITO_USER_POOL_ID=$(cd ../terraform && terraform output -raw cognito_user_pool_id)
VITE_COGNITO_CLIENT_ID=$(cd ../terraform && terraform output -raw cognito_client_id)
VITE_AWS_REGION=us-east-1
VITE_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
EOF

npm install
npm run dev
```

---

## 📖 Example Structure

```
examples/
├── README.md              # This file
│
├── schema/                # 1️⃣ Schema Definition
│   ├── schema.ts
│   ├── shadow.config.json
│   └── README.md
│
├── terraform/             # 2️⃣ Infrastructure Deployment
│   ├── main.tf
│   ├── variables.tf
│   ├── shadow.config.json
│   └── README.md
│
├── client/                # 3️⃣ Node.js Client Usage
│   ├── index.ts
│   ├── package.json
│   └── README.md
│
└── react-admin/           # 3️⃣ React Admin UI
    ├── src/
    ├── .env.example
    ├── package.json
    └── README.md
```

---

## 🎓 Learning Path

### Beginner

1. Start with [Schema Example](./schema/) to understand data modeling
2. Deploy with [Terraform Example](./terraform/) to get infrastructure
3. Try [Client Example](./client/) to learn CRUD operations

### Intermediate

1. Explore advanced Terraform configurations (multi-environment)
2. Implement custom authentication methods
3. Add more resources to your schema

### Advanced

1. Build a complete admin interface with [React Admin Example](./react-admin/)
2. Customize data provider for specific use cases
3. Implement complex queries and filtering

---

## 🔑 Key Concepts

### Shadow Records

Shadow records enable efficient sorting in DynamoDB Single-Table design without GSIs:

- Automatically created for sortable fields
- Composite sort key: `field#value#id#ULID`
- Transparent to the application

### Terraform Integration

All examples use Terraform outputs for configuration:

```bash
# Get Function URL
terraform output function_url

# Use in your application
export FUNCTION_URL=$(terraform output -raw function_url)
```

### Authentication Methods

- **IAM**: For server-to-server communication
- **Cognito**: For user authentication with JWT tokens
- **Custom Token**: For custom authentication schemes

---

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **Terraform** >= 1.5.0
- **AWS Account** with appropriate permissions
- **AWS CLI** configured with credentials
- Basic understanding of:
  - DynamoDB
  - TypeScript
  - AWS Lambda
  - Terraform (for deployment)

---

## 🆘 Troubleshooting

### "FUNCTION_URL is required" Error

Make sure you've deployed with Terraform and set the environment variable:

```bash
cd terraform/
terraform output function_url
export FUNCTION_URL="<your-function-url>"
```

### Authentication Errors

- **IAM**: Verify AWS credentials are configured (`aws sts get-caller-identity`)
- **Cognito**: Check JWT token is valid and not expired
- **Lambda**: Verify authorizer configuration in Terraform

### Terraform Errors

- Run `terraform init` first
- Check AWS credentials
- Verify region is correct
- Review CloudWatch Logs for Lambda errors

---

## 📚 Additional Resources

- 📖 [Main Documentation](../README.md)
- 🏗️ [Architecture Guide](../docs/ARCHITECTURE.md)
- 📚 [API Reference](../docs/API.md)
- ⚙️ [Shadow Config Documentation](../docs/SHADOW_CONFIG.md)
- 🔧 [Migration Guide](../docs/MIGRATION.md)

---

## 🤝 Contributing

Found an issue or want to add an example? See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 💡 Tips

- **Start Simple**: Begin with the schema example, then gradually add complexity
- **Use Terraform Outputs**: Always get configuration from `terraform output`
- **Check Logs**: Use CloudWatch Logs to debug Lambda issues
- **Test Locally**: Use the client example to test before building UI
- **Read READMEs**: Each example has detailed instructions in its README
