# Step-by-step AWS App Runner deployment for troubleshooting
# Run each section individually to identify issues

Write-Host "🔍 AWS App Runner Manual Deployment Steps" -ForegroundColor Cyan
Write-Host "Run each section individually to troubleshoot issues" -ForegroundColor Yellow
Write-Host ""

# Configuration
$Region = "us-east-1"
$RepoName = "robolog-demo"
$ServiceName = "robolog-demo-service"

Write-Host "=== STEP 1: Check AWS Configuration ===" -ForegroundColor Green
Write-Host "Running: aws sts get-caller-identity"
aws sts get-caller-identity
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ AWS CLI not configured. Run 'aws configure' first"
    Write-Host "You need to set up:" -ForegroundColor Yellow
    Write-Host "- AWS Access Key ID"
    Write-Host "- AWS Secret Access Key"
    Write-Host "- Default region (e.g., us-east-1)"
    exit 1
}

$AccountId = (aws sts get-caller-identity --query Account --output text)
Write-Host "✅ AWS Account ID: $AccountId" -ForegroundColor Green
Write-Host ""

Write-Host "=== STEP 2: Check Docker ===" -ForegroundColor Green
Write-Host "Running: docker --version"
docker --version
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Docker not found. Install Docker Desktop for Windows"
    exit 1
}
Write-Host "✅ Docker is available" -ForegroundColor Green
Write-Host ""

Write-Host "=== STEP 3: Create ECR Repository ===" -ForegroundColor Green
Write-Host "Running: aws ecr create-repository..."
aws ecr create-repository `
    --repository-name $RepoName `
    --region $Region `
    --image-scanning-configuration scanOnPush=true

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ECR repository created successfully" -ForegroundColor Green
} elseif ($LASTEXITCODE -eq 254) {
    Write-Host "⚠️ Repository already exists, continuing..." -ForegroundColor Yellow
} else {
    Write-Error "❌ Failed to create ECR repository"
    exit 1
}
Write-Host ""

Write-Host "=== STEP 4: Test ECR Authentication ===" -ForegroundColor Green
$EcrEndpoint = "$AccountId.dkr.ecr.$Region.amazonaws.com"
Write-Host "ECR Endpoint: $EcrEndpoint"

Write-Host "Getting ECR login token..."
$LoginCommand = aws ecr get-login-password --region $Region
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to get ECR login token"
    exit 1
}

Write-Host "Authenticating Docker with ECR..."
$LoginCommand | docker login --username AWS --password-stdin $EcrEndpoint
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Docker login to ECR failed"
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Check if Docker Desktop is running"
    Write-Host "2. Try: docker info"
    Write-Host "3. Restart Docker Desktop"
    Write-Host "4. Check AWS permissions for ECR"
    exit 1
}
Write-Host "✅ Successfully authenticated with ECR" -ForegroundColor Green
Write-Host ""

Write-Host "=== STEP 5: Build Docker Image ===" -ForegroundColor Green
Write-Host "Building robolog demo image..."
docker build -f Dockerfile.apprunner -t $RepoName .
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to build Docker image"
    Write-Host "Check if Dockerfile.apprunner exists in current directory" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Docker image built successfully" -ForegroundColor Green
Write-Host ""

Write-Host "=== STEP 6: Tag and Push Image ===" -ForegroundColor Green
$EcrUri = "$EcrEndpoint/$RepoName"
Write-Host "Tagging image for ECR: $EcrUri:latest"
docker tag "${RepoName}:latest" "${EcrUri}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to tag image"
    exit 1
}

Write-Host "Pushing image to ECR..."
docker push "${EcrUri}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to push image to ECR"
    exit 1
}
Write-Host "✅ Image pushed to ECR successfully" -ForegroundColor Green
Write-Host ""

Write-Host "=== NEXT STEPS ===" -ForegroundColor Cyan
Write-Host "If all steps above completed successfully, you can now:"
Write-Host "1. Go to AWS App Runner console: https://console.aws.amazon.com/apprunner/"
Write-Host "2. Create a new service using the ECR image: $EcrUri:latest"
Write-Host "3. Or continue with the automated script creation..."
Write-Host ""
Write-Host "ECR Image URI: $EcrUri:latest" -ForegroundColor Green 