# Advanced Example

This example demonstrates an advanced deployment with:

- Multi-environment support (dev/stg/prd)
- External shadow configuration file
- CloudWatch Alarms
- TTL configuration
- Point-in-time Recovery (production only)
- MFA configuration (production only)
- Environment-specific settings

## What This Example Creates

- DynamoDB table with TTL and PITR
- Cognito User Pool with advanced security settings
- Cognito App Client with token validity configuration
- Records Lambda function with Function URL
- CloudWatch Alarms for error monitoring
- IAM roles and policies
- CloudWatch Logs

## Usage

1. Review and customize `shadow.config.json`:

```bash
cat shadow.config.json
```

2. Initialize Terraform:

```bash
terraform init
```

3. Review the plan:

```bash
terraform plan -var="environment=dev"
```

4. Apply the configuration:

```bash
terraform apply -var="environment=dev"
```

5. Get the outputs:

```bash
terraform output
```

## Environment-Specific Settings

### Development (dev)
- Log retention: 7 days
- Log level: debug
- MFA: Optional
- PITR: Disabled

### Staging (stg)
- Log retention: 7 days
- Log level: info
- MFA: Optional
- PITR: Disabled

### Production (prd)
- Log retention: 30 days
- Log level: warn
- MFA: Required
- PITR: Enabled

## Shadow Configuration

The `shadow.config.json` file defines sortable fields for each resource:

```json
{
  "$schemaVersion": "1.0",
  "resources": {
    "articles": {
      "sortDefaults": {
        "field": "updatedAt",
        "order": "DESC"
      },
      "shadows": {
        "title": { "type": "string" },
        "status": { "type": "string" },
        "publishedAt": { "type": "datetime" },
        "createdAt": { "type": "datetime" },
        "updatedAt": { "type": "datetime" }
      }
    }
  }
}
```

## CloudWatch Alarms

The example includes a CloudWatch Alarm that triggers when:
- Lambda function errors exceed 10 in a 5-minute period

To receive notifications, provide an SNS topic ARN:

```bash
terraform apply -var="sns_topic_arn=arn:aws:sns:us-east-1:123456789012:alerts"
```

## Clean Up

To destroy all resources:

```bash
terraform destroy
```

## Customization

You can customize the deployment by modifying variables:

```bash
terraform apply \
  -var="project_name=my-app" \
  -var="environment=prd" \
  -var="region=ap-northeast-1" \
  -var="sns_topic_arn=arn:aws:sns:..."
```
