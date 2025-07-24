# AWS App Runner + ECR Deployment Script for Windows PowerShell
# Prerequisites: AWS CLI and Docker Desktop installed and configured

param(
    [string]$Region = "us-east-1",
    [string]$RepoName = "robolog-demo",
    [string]$ServiceName = "robolog-demo-service"
)

Write-Host "🚀 Setting up Robolog Demo on AWS App Runner + ECR..." -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Green

# Get AWS Account ID
try {
    $AccountId = (aws sts get-caller-identity --query Account --output text)
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get AWS account ID. Is AWS CLI configured?"
    }
    Write-Host "Account ID: $AccountId" -ForegroundColor Green
} catch {
    Write-Error "❌ AWS CLI not configured properly. Run 'aws configure' first."
    exit 1
}

$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/$RepoName"
Write-Host "ECR Repository: $EcrUri" -ForegroundColor Green

# 1. Create ECR repository
Write-Host "📦 Creating ECR repository..." -ForegroundColor Yellow
aws ecr create-repository --repository-name $RepoName --region $Region --image-scanning-configuration scanOnPush=true
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 254) {
    Write-Warning "Repository might already exist, continuing..."
}

# 2. Get ECR login token and authenticate Docker
Write-Host "🔐 Authenticating with ECR..." -ForegroundColor Yellow

# Use the AWS ECR get-login-password command with proper PowerShell syntax
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to authenticate with ECR"
    exit 1
}

# 3. Build the demo image
Write-Host "🔨 Building robolog demo image..." -ForegroundColor Yellow
docker build -f Dockerfile.apprunner -t $RepoName .
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to build Docker image"
    exit 1
}

# Tag for ECR
docker tag "${RepoName}:latest" "${EcrUri}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to tag image"
    exit 1
}

# 4. Push to ECR
Write-Host "📤 Pushing image to ECR..." -ForegroundColor Yellow
docker push "${EcrUri}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to push image to ECR"
    exit 1
}

# 5. Create App Runner service configuration
Write-Host "⚙️ Creating App Runner service configuration..." -ForegroundColor Yellow
$ServiceConfig = @{
    ServiceName = $ServiceName
    SourceConfiguration = @{
        ImageRepository = @{
            ImageIdentifier = "${EcrUri}:latest"
            ImageConfiguration = @{
                Port = "3000"
                RuntimeEnvironmentVariables = @{
                    DEMO_MODE = "true"
                    MODEL_NAME = "llama3.2:1b"
                    LANGUAGE = "English"
                    WEBHOOK_PLATFORM = "discord"
                    WEBHOOK_URL = ""
                }
                StartCommand = "/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf"
            }
            ImageRepositoryType = "ECR"
        }
        AutoDeploymentsEnabled = $false
    }
    InstanceConfiguration = @{
        Cpu = "2 vCPU"
        Memory = "4 GB"
    }
    HealthCheckConfiguration = @{
        Protocol = "HTTP"
        Path = "/api/health"
        Interval = 10
        Timeout = 5
        HealthyThreshold = 1
        UnhealthyThreshold = 5
    }
} | ConvertTo-Json -Depth 10

$ConfigFile = "apprunner-service.json"
$ServiceConfig | Out-File -FilePath $ConfigFile -Encoding UTF8

# 6. Create the App Runner service
Write-Host "🚀 Creating App Runner service..." -ForegroundColor Yellow
$ServiceArn = aws apprunner create-service --cli-input-json "file://$ConfigFile" --region $Region --query 'Service.ServiceArn' --output text
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to create App Runner service"
    exit 1
}

Write-Host "📊 Service created with ARN: $ServiceArn" -ForegroundColor Green

# 7. Wait for service to be running
Write-Host "⏳ Waiting for service to be running (this may take 5-10 minutes)..." -ForegroundColor Yellow
aws apprunner wait service-running --service-arn $ServiceArn --region $Region
if ($LASTEXITCODE -ne 0) {
    Write-Warning "⚠️ Wait command failed, but service might still be starting. Check AWS console."
}

# 8. Get the service URL
Write-Host "🔍 Getting service URL..." -ForegroundColor Yellow
$ServiceUrl = aws apprunner describe-service --service-arn $ServiceArn --region $Region --query 'Service.ServiceUrl' --output text
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to get service URL"
    exit 1
}

# Cleanup temporary files
Remove-Item -Path $ConfigFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Robolog Demo deployed successfully!" -ForegroundColor Green
Write-Host "🌐 Demo URL: https://$ServiceUrl" -ForegroundColor Cyan
Write-Host "📊 Dashboard: https://$ServiceUrl/" -ForegroundColor Cyan
Write-Host "🛠️ Testing Tools: https://$ServiceUrl/testing" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Demo Instructions:" -ForegroundColor Yellow
Write-Host "1. Visit the Testing Tools page to configure webhooks"
Write-Host "2. Generate test errors to see AI analysis in action"
Write-Host "3. Check the Dashboard for real-time AI reports"
Write-Host ""
Write-Host "💰 Cost: ~$0.064/hour (~$46/month) for 2vCPU, 4GB RAM" -ForegroundColor Magenta
Write-Host "🗑️  To delete: aws apprunner delete-service --service-arn $ServiceArn --region $Region" -ForegroundColor Red 