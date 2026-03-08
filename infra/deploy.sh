#!/bin/bash
set -euo pipefail

# Deploy keanu portal to AWS
# Usage: ./deploy.sh [--init]

REGION="${AWS_REGION:-us-east-1}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== keanu deploy ==="
echo "Region: $REGION"
echo ""

# Get ECR repo URL from terraform
ECR_REPO=$(cd "$REPO_ROOT/infra" && terraform output -raw ecr_repository 2>/dev/null || echo "")

if [ -z "$ECR_REPO" ]; then
  echo "ECR repo not found. Run terraform first:"
  echo "  cd infra && terraform init && terraform apply"
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Build
echo "Building container..."
docker build -f "$REPO_ROOT/portal/Dockerfile" -t keanu-portal "$REPO_ROOT"

# Tag + push
echo "Pushing to ECR..."
docker tag keanu-portal:latest "$ECR_REPO:latest"
docker push "$ECR_REPO:latest"

# Force new deployment
echo "Deploying to ECS..."
CLUSTER=$(cd "$REPO_ROOT/infra" && terraform output -raw 2>/dev/null | grep -oP 'keanu-\w+' | head -1 || echo "keanu-production")
aws ecs update-service \
  --cluster "keanu-production" \
  --service "keanu-portal" \
  --force-new-deployment \
  --region "$REGION" \
  > /dev/null

echo ""
PORTAL_URL=$(cd "$REPO_ROOT/infra" && terraform output -raw portal_url 2>/dev/null || echo "check terraform output")
echo "=== deployed ==="
echo "Portal: $PORTAL_URL"
echo ""
