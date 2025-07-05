#!/bin/bash

# 🚀 Robolog - Quick Start Script
# For immediate testing without full system installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Robolog - Quick Start${NC}"
echo -e "${BLUE}========================${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️ Creating .env file...${NC}"
    cat > .env << 'EOF'
# Discord Webhook URL for notifications
# Get this from Discord: Server Settings > Integrations > Webhooks
DISCORD_WEBHOOK_URL=

# Ollama Model
MODEL_NAME=gemma3n:e2b

# Analyzer polling interval (60 seconds)
POLL_MS=60000
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}💡 Please edit .env and add your Discord webhook URL${NC}"
    echo -e "${YELLOW}💡 Run: nano .env or vim .env${NC}"
    echo ""
fi

# Start the services
echo -e "${YELLOW}🚀 Starting Robolog services...${NC}"
docker-compose up -d

# Wait for services to start
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# Pull the AI model
echo -e "${YELLOW}🤖 Pulling AI model (this may take a few minutes)...${NC}"
docker-compose exec ollama ollama pull gemma3n:e2b

# Show status
echo -e "${YELLOW}📊 Service Status:${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}🎉 Robolog is now running!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. ${YELLOW}Configure Discord webhook:${NC} nano .env"
echo -e "2. ${YELLOW}Test the system:${NC} curl http://localhost/generate-realistic-errors"
echo -e "3. ${YELLOW}View logs:${NC} docker-compose logs -f"
echo -e "4. ${YELLOW}Check Discord${NC} for AI-powered analysis within 60 seconds"
echo ""
echo -e "${BLUE}Available endpoints:${NC}"
echo -e "• ${YELLOW}http://localhost/${NC} - Main application"
echo -e "• ${YELLOW}http://localhost/test-error${NC} - Generate single test error"
echo -e "• ${YELLOW}http://localhost/generate-realistic-errors${NC} - Generate multiple realistic errors"
echo ""
echo -e "${BLUE}Management commands:${NC}"
echo -e "• ${YELLOW}docker-compose logs${NC} - View all logs"
echo -e "• ${YELLOW}docker-compose restart${NC} - Restart services"
echo -e "• ${YELLOW}docker-compose down${NC} - Stop services"
echo -e "• ${YELLOW}docker-compose down --volumes${NC} - Stop and remove data"
echo ""
echo -e "${GREEN}🔥 Ready to monitor your logs with AI!${NC}" 