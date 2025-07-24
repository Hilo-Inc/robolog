#!/bin/bash
# AWS EC2 Demo Setup for Robolog
# Instance requirements: t3.large or bigger (8GB RAM minimum for Ollama models)

set -e

echo "🚀 Setting up Robolog Demo on AWS EC2..."

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone the repository
git clone https://github.com/Hilo-Inc/robolog.git
cd robolog

# Create demo environment file
cat > .env << EOF
# Demo Environment Configuration
WEBHOOK_URL=
MODEL_NAME=gemma3n:e2b
LANGUAGE=English
WEBHOOK_PLATFORM=discord
DEMO_MODE=true
EOF

# Build and start all services
docker-compose build
docker-compose up -d

# Wait for services to initialize
echo "⏳ Waiting for services to initialize..."
sleep 30

# Test the setup
echo "🧪 Testing the demo setup..."
docker-compose exec analyzer node /app/test-errors.js

echo "✅ Demo setup complete!"
echo "🌐 Access your demo at: http://$(curl -s checkip.amazonaws.com)"
echo "📊 Dashboard: http://$(curl -s checkip.amazonaws.com)"
echo "🛠️ Testing Tools: http://$(curl -s checkip.amazonaws.com)/testing"

echo ""
echo "🔧 Next steps:"
echo "1. Configure your Discord/Slack webhook in the Testing Tools page"
echo "2. Generate test errors to see AI analysis in action"
echo "3. Share the public URL with your audience!" 