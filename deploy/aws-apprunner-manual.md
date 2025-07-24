# AWS App Runner + ECR Manual Deployment Guide

## Prerequisites
- AWS CLI installed and configured
- Docker installed locally
- AWS account with App Runner and ECR permissions

## Step-by-Step Deployment

### 1. Create ECR Repository
```bash
# Set your preferred region
export AWS_REGION=us-east-1
export REPO_NAME=robolog-demo
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create the repository
aws ecr create-repository \
    --repository-name $REPO_NAME \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true
```

### 2. Build and Push Docker Image
```bash
# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin \
    $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build the image using the App Runner optimized Dockerfile
docker build -f Dockerfile.apprunner -t $REPO_NAME .

# Tag for ECR
docker tag $REPO_NAME:latest \
    $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:latest

# Push to ECR
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:latest
```

### 3. Create App Runner Service via AWS Console

1. **Go to AWS App Runner Console**
   - Navigate to https://console.aws.amazon.com/apprunner/

2. **Create Service**
   - Click "Create service"
   - Source: "Container registry"
   - Provider: "Amazon ECR"

3. **Configure Image**
   - Container image URI: `$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:latest`
   - Deployment trigger: "Manual"

4. **Service Settings**
   - Service name: `robolog-demo-service`
   - CPU: 2 vCPU
   - Memory: 4 GB
   - Port: 3000

5. **Environment Variables**
   ```
   DEMO_MODE=true
   MODEL_NAME=llama3.2:1b
   LANGUAGE=English
   WEBHOOK_PLATFORM=discord
   WEBHOOK_URL=(leave empty or add your webhook)
   ```

6. **Health Check**
   - Protocol: HTTP
   - Path: `/api/health`
   - Interval: 10 seconds
   - Timeout: 5 seconds

7. **Create Service**
   - Review settings and click "Create & deploy"

### 4. Access Your Demo
- Wait 5-10 minutes for deployment
- Get your service URL from the App Runner console
- Visit `https://YOUR-SERVICE-URL.region.awsapprunner.com`

## Using AWS CLI Instead

If you prefer CLI over console:

```bash
# Create service configuration file
cat > apprunner-config.json << EOF
{
  "ServiceName": "robolog-demo-service",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:latest",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "DEMO_MODE": "true",
          "MODEL_NAME": "llama3.2:1b",
          "LANGUAGE": "English",
          "WEBHOOK_PLATFORM": "discord",
          "WEBHOOK_URL": ""
        }
      },
      "ImageRepositoryType": "ECR"
    }
  },
  "InstanceConfiguration": {
    "Cpu": "2 vCPU",
    "Memory": "4 GB"
  }
}
EOF

# Create the service
aws apprunner create-service \
    --cli-input-json file://apprunner-config.json \
    --region $AWS_REGION
```

## Cost Management

- **Running costs:** ~$0.064/hour (~$46/month) for 2vCPU, 4GB
- **Pausing:** App Runner can scale to zero when not in use
- **Deleting:** Remove service when demo is complete

## Cleanup

```bash
# Get service ARN
SERVICE_ARN=$(aws apprunner list-services --query 'ServiceSummaryList[?ServiceName==`robolog-demo-service`].ServiceArn' --output text)

# Delete the service
aws apprunner delete-service --service-arn $SERVICE_ARN

# Delete ECR repository
aws ecr delete-repository --repository-name $REPO_NAME --force
``` 