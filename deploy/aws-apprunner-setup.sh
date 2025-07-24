#!/bin/bash
# AWS App Runner + ECR Deployment Script for Robolog Demo
# Prerequisites: AWS CLI configured with appropriate permissions

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
REPO_NAME="robolog-demo"
SERVICE_NAME="robolog-demo-service"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

echo "🚀 Setting up Robolog Demo on AWS App Runner + ECR..."
echo "Region: $AWS_REGION"
echo "ECR Repository: $ECR_URI"

# 1. Create ECR repository
echo "📦 Creating ECR repository..."
aws ecr create-repository \
    --repository-name $REPO_NAME \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true || echo "Repository might already exist"

# 2. Get ECR login token
echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# 3. Build the demo image (simplified single container)
echo "🔨 Building robolog demo image..."
cat > Dockerfile.apprunner << 'EOF'
# Multi-stage build for App Runner demo
FROM node:20-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app

# Build the Next.js app
COPY app/package*.json ./
RUN npm ci --only=production

COPY app/ ./
RUN npm run build

# Create startup script
RUN cat > start-demo.sh << 'SCRIPT'
#!/bin/bash
# Start Ollama in background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to start
echo "Waiting for Ollama to start..."
sleep 10

# Pull the lightweight model
echo "Pulling AI model..."
ollama pull llama3.2:1b

# Start the Next.js app
echo "Starting Robolog demo..."
npm start
SCRIPT

RUN chmod +x start-demo.sh

EXPOSE 3000
CMD ["./start-demo.sh"]
EOF

docker build -f Dockerfile.apprunner -t $ECR_URI:latest .

# 4. Push to ECR
echo "📤 Pushing image to ECR..."
docker push $ECR_URI:latest

# 5. Create App Runner service configuration
echo "⚙️ Creating App Runner service configuration..."
cat > apprunner-service.json << EOF
{
  "ServiceName": "$SERVICE_NAME",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$ECR_URI:latest",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "DEMO_MODE": "true",
          "MODEL_NAME": "llama3.2:1b",
          "LANGUAGE": "English",
          "WEBHOOK_PLATFORM": "discord",
          "WEBHOOK_URL": ""
        },
        "StartCommand": "./start-demo.sh"
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false
  },
  "InstanceConfiguration": {
    "Cpu": "2 vCPU",
    "Memory": "4 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }
}
EOF

# 6. Create the App Runner service
echo "🚀 Creating App Runner service..."
SERVICE_ARN=$(aws apprunner create-service \
    --cli-input-json file://apprunner-service.json \
    --region $AWS_REGION \
    --query 'Service.ServiceArn' \
    --output text)

echo "📊 Service created with ARN: $SERVICE_ARN"

# 7. Wait for service to be running
echo "⏳ Waiting for service to be running..."
aws apprunner wait service-running \
    --service-arn $SERVICE_ARN \
    --region $AWS_REGION

# 8. Get the service URL
SERVICE_URL=$(aws apprunner describe-service \
    --service-arn $SERVICE_ARN \
    --region $AWS_REGION \
    --query 'Service.ServiceUrl' \
    --output text)

echo ""
echo "✅ Robolog Demo deployed successfully!"
echo "🌐 Demo URL: https://$SERVICE_URL"
echo "📊 Dashboard: https://$SERVICE_URL/"
echo "🛠️ Testing Tools: https://$SERVICE_URL/testing"
echo ""
echo "💡 Demo Instructions:"
echo "1. Visit the Testing Tools page to configure webhooks"
echo "2. Generate test errors to see AI analysis in action"
echo "3. Check the Dashboard for real-time AI reports"
echo ""
echo "💰 Cost: ~$0.064/hour (~$46/month) for 2vCPU, 4GB RAM"
echo "🗑️  To delete: aws apprunner delete-service --service-arn $SERVICE_ARN --region $AWS_REGION"

# Cleanup temporary files
rm -f Dockerfile.apprunner apprunner-service.json 