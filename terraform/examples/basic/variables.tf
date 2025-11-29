variable "project_name" {
  description = "Project name"
  type        = string
  default     = "my-project"
}

variable "environment" {
  description = "Environment (dev/stg/prd)"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}
