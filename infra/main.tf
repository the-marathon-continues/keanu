terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "keanu-terraform-state"
    key    = "portal/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "keanu"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ============================================================
# Variables
# ============================================================

variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

variable "domain_name" {
  description = "Domain for the portal (e.g. portal.keanu.ai). Leave empty to use ALB DNS."
  default     = ""
}

variable "anthropic_api_key" {
  sensitive = true
}

variable "openrouter_api_key" {
  sensitive = true
  default   = ""
}

# ============================================================
# VPC
# ============================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "keanu-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true  # save money, one NAT for both AZs

  enable_dns_hostnames = true
  enable_dns_support   = true
}

# ============================================================
# ECR — Container Registry
# ============================================================

resource "aws_ecr_repository" "portal" {
  name                 = "keanu-portal"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "portal" {
  repository = aws_ecr_repository.portal.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ============================================================
# DynamoDB — Persistence
# ============================================================

resource "aws_dynamodb_table" "sessions" {
  name         = "keanu-sessions-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

resource "aws_dynamodb_table" "conversations" {
  name         = "keanu-conversations-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

# ============================================================
# ECS Cluster + Service
# ============================================================

resource "aws_ecs_cluster" "main" {
  name = "keanu-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "portal" {
  name              = "/ecs/keanu-portal-${var.environment}"
  retention_in_days = 30
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "keanu-ecs-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "keanu-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_dynamo" {
  name = "dynamo-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem",
      ]
      Resource = [
        aws_dynamodb_table.sessions.arn,
        aws_dynamodb_table.conversations.arn,
      ]
    }]
  })
}

resource "aws_secretsmanager_secret" "api_keys" {
  name = "keanu-api-keys-${var.environment}"
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  secret_string = jsonencode({
    ANTHROPIC_API_KEY  = var.anthropic_api_key
    OPENROUTER_API_KEY = var.openrouter_api_key
  })
}

resource "aws_iam_role_policy" "ecs_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.api_keys.arn]
    }]
  })
}

resource "aws_ecs_task_definition" "portal" {
  family                   = "keanu-portal-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "portal"
    image = "${aws_ecr_repository.portal.repository_url}:latest"

    portMappings = [{
      containerPort = 3547
      protocol      = "tcp"
    }]

    environment = [
      { name = "PORT", value = "3547" },
      { name = "NODE_ENV", value = "production" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "DYNAMO_SESSIONS_TABLE", value = aws_dynamodb_table.sessions.name },
      { name = "DYNAMO_CONVERSATIONS_TABLE", value = aws_dynamodb_table.conversations.name },
    ]

    secrets = [
      {
        name      = "ANTHROPIC_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.api_keys.arn}:ANTHROPIC_API_KEY::"
      },
      {
        name      = "OPENROUTER_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.api_keys.arn}:OPENROUTER_API_KEY::"
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.portal.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "portal"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:3547/api/state || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
  }])
}

# ============================================================
# ALB — Load Balancer + HTTPS
# ============================================================

resource "aws_security_group" "alb" {
  name   = "keanu-alb-${var.environment}"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name   = "keanu-ecs-${var.environment}"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 3547
    to_port         = 3547
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "portal" {
  name               = "keanu-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
}

resource "aws_lb_target_group" "portal" {
  name        = "keanu-portal-${var.environment}"
  port        = 3547
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/state"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.portal.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.portal.arn
  }
}

resource "aws_ecs_service" "portal" {
  name            = "keanu-portal"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.portal.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.portal.arn
    container_name   = "portal"
    container_port   = 3547
  }

  depends_on = [aws_lb_listener.http]
}

# ============================================================
# Outputs
# ============================================================

output "portal_url" {
  value = "http://${aws_lb.portal.dns_name}"
}

output "ecr_repository" {
  value = aws_ecr_repository.portal.repository_url
}

output "sessions_table" {
  value = aws_dynamodb_table.sessions.name
}

output "conversations_table" {
  value = aws_dynamodb_table.conversations.name
}
