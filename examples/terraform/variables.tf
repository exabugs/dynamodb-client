variable "project_name" {
  description = "Project name"
  type        = string
  default     = "my-project"
}

variable "environment" {
  description = "Environment (dev/stg/prd)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "stg", "prd"], var.environment)
    error_message = "Environment must be dev, stg, or prd."
  }
}

variable "region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "sns_topic_arn" {
  description = "SNS Topic ARN for CloudWatch Alarms (optional)"
  type        = string
  default     = ""
}
