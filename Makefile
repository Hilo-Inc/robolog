# 🚀 Robolog - AI-Powered Log Monitoring
# Makefile for easy development and management

.PHONY: help install start stop restart logs status test-errors config update clean build

# Default target
help:
	@echo "🚀 Robolog - AI-Powered Log Monitoring"
	@echo "======================================"
	@echo ""
	@echo "Available commands:"
	@echo "  make install      - Install Robolog (requires sudo)"
	@echo "  make start        - Start all services"
	@echo "  make stop         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make logs         - Show logs from all services"
	@echo "  make logs-app     - Show logs from app service"
	@echo "  make logs-analyzer - Show logs from analyzer service"
	@echo "  make logs-ollama  - Show logs from ollama service"
	@echo "  make status       - Show service status"
	@echo "  make test-errors  - Generate realistic test errors"
	@echo "  make config       - Edit configuration"
	@echo "  make update       - Update to latest images"
	@echo "  make build        - Build all containers"
	@echo "  make clean        - Clean up containers and volumes"
	@echo "  make uninstall    - Completely remove Robolog"
	@echo ""
	@echo "Development commands:"
	@echo "  make dev-start    - Start in development mode"
	@echo "  make dev-logs     - Follow logs in development"
	@echo "  make dev-rebuild  - Rebuild and restart services"

# Installation (requires sudo)
install:
	@echo "🚀 Installing Robolog..."
	@if [ "$${EUID}" -ne 0 ]; then \
		echo "❌ Installation requires sudo privileges"; \
		echo "Run: sudo make install"; \
		exit 1; \
	fi
	@chmod +x install.sh
	@./install.sh

# Service management
start:
	@echo "🚀 Starting Robolog services..."
	@docker-compose up -d

stop:
	@echo "⏹️ Stopping Robolog services..."
	@docker-compose down

restart:
	@echo "🔄 Restarting Robolog services..."
	@docker-compose restart

# Logs
logs:
	@echo "📋 Showing logs from all services (Ctrl+C to exit)..."
	@docker-compose logs -f

logs-app:
	@echo "📋 Showing app service logs..."
	@docker-compose logs -f app

logs-analyzer:
	@echo "📋 Showing analyzer service logs..."
	@docker-compose logs -f analyzer

logs-ollama:
	@echo "📋 Showing ollama service logs..."
	@docker-compose logs -f ollama

logs-fluent:
	@echo "📋 Showing fluent-bit service logs..."
	@docker-compose logs -f fluent-bit

# Status and testing
status:
	@echo "📊 Service status:"
	@docker-compose ps

test-errors:
	@echo "🧪 Generating realistic test errors..."
	@curl -s http://localhost/generate-realistic-errors | jq . || curl -s http://localhost/generate-realistic-errors

# Configuration
config:
	@echo "📝 Opening configuration file..."
	@$${EDITOR:-nano} .env

# Updates and builds
update:
	@echo "🔄 Updating Robolog..."
	@docker-compose pull
	@docker-compose up -d

build:
	@echo "🔨 Building all containers..."
	@docker-compose build

dev-rebuild:
	@echo "🔨 Rebuilding and restarting for development..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Development mode
dev-start:
	@echo "🚀 Starting in development mode with live file mounting..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-logs:
	@echo "📋 Following development logs..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Cleanup
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	@docker-compose down --volumes --remove-orphans
	@docker system prune -f

# Uninstall
uninstall:
	@echo "🗑️ Uninstalling Robolog..."
	@docker-compose down --volumes --remove-orphans
	@docker system prune -f
	@echo "✅ Robolog removed (local development)"
	@echo "💡 To remove system installation: sudo robolog uninstall"

# Setup development environment
dev-setup:
	@echo "🛠️ Setting up development environment..."
	@if [ ! -f .env ]; then \
		cp .env.example .env 2>/dev/null || echo "DISCORD_WEBHOOK_URL=" > .env; \
		echo "📝 Created .env file - please configure your Discord webhook"; \
	fi
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
	@echo "✅ Development environment ready!"
	@echo "💡 Next steps:"
	@echo "  1. Edit .env file: make config"
	@echo "  2. Start services: make dev-start"
	@echo "  3. Test errors: make test-errors"

# Health check
health:
	@echo "🏥 Health check..."
	@echo "Docker: $$(docker --version)"
	@echo "Docker Compose: $$(docker-compose --version)"
	@echo "Services:"
	@docker-compose ps
	@echo ""
	@echo "🌐 Testing endpoints..."
	@curl -s http://localhost/ > /dev/null && echo "✅ App endpoint working" || echo "❌ App endpoint failed"
	@curl -s http://localhost:11434/api/tags > /dev/null && echo "✅ Ollama endpoint working" || echo "❌ Ollama endpoint failed" 