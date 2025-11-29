# Basic Example

This example demonstrates a basic deployment of the DynamoDB Client Lambda function with minimal configuration.

## What This Example Creates

- DynamoDB table (Single-Table design)
- Cognito User Pool (for authentication)
- Records Lambda function with Function URL
- IAM roles and policies
- CloudWatch Logs

## Usage

1. Initialize Terraform:

```bash
terraform init
```

2. Review the plan:

```bash
terraform plan
```

3. Apply the configuration:

```bash
terraform apply
```

4. Get the Function URL:

```bash
terraform output function_url
```

## Clean Up

To destroy all resources:

```bash
terraform destroy
```

## Customization

You can customize the deployment by modifying `variables.tf` or passing variables:

```bash
terraform apply -var="project_name=my-app" -var="environment=prod"
```
