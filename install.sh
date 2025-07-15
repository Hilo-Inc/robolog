#!/bin/bash

# 🚀 Robolog - AI-Powered Log Monitoring Installation Script
# Supports Ubuntu, Debian, CentOS, RHEL, Fedora, Arch Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/robolog"
SERVICE_NAME="robolog"
USER="robolog"

echo -e "${BLUE}🚀 Robolog Installation Script${NC}"
echo -e "${BLUE}=================================${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VERSION=$VERSION_ID
        DISTRO=$ID
    else
        echo -e "${RED}❌ Cannot detect OS. Please install manually.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Detected OS: $OS $VERSION${NC}"
}

# Install Docker and Docker Compose
install_docker() {
    echo -e "${YELLOW}📦 Installing Docker and Docker Compose...${NC}"
    
    case $DISTRO in
        "ubuntu"|"debian")
            apt-get update
            apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
            curl -fsSL https://download.docker.com/linux/${DISTRO}/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/${DISTRO} $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        "centos"|"rhel"|"fedora")
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            systemctl start docker
            systemctl enable docker
            ;;
        "arch")
            pacman -S --noconfirm docker docker-compose
            systemctl start docker
            systemctl enable docker
            ;;
        *)
            echo -e "${RED}❌ Unsupported distribution: $DISTRO${NC}"
            exit 1
            ;;
    esac
}

# Check if Docker is installed
check_docker() {
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✅ Docker and Docker Compose are already installed${NC}"
        return 0
    else
        install_docker
    fi
}

# Create user and directories
setup_user() {
    echo -e "${YELLOW}👤 Setting up user and directories...${NC}"
    
    # Create user
    if ! id "$USER" &>/dev/null; then
        useradd -r -s /bin/false -d $INSTALL_DIR $USER
        echo -e "${GREEN}✅ Created user: $USER${NC}"
    fi
    
    # Create directories
    mkdir -p $INSTALL_DIR
    mkdir -p $INSTALL_DIR/app
    mkdir -p $INSTALL_DIR/analyzer
    mkdir -p $INSTALL_DIR/fluent-bit
    mkdir -p /var/log/robolog
    
    # Set permissions
    chown -R $USER:$USER $INSTALL_DIR
    chown -R $USER:$USER /var/log/robolog
    
    echo -e "${GREEN}✅ Created directories and set permissions${NC}"
}

# Download application files
download_files() {
    echo -e "${YELLOW}📥 Downloading application files from GitHub...${NC}"
    
    # Download from GitHub repository
    cd /tmp
    curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
    cp -r robolog-main/* $INSTALL_DIR/
    rm -rf robolog-main
    
    # Ensure docker-compose.yml exists (fallback)
    if [ ! -f "$INSTALL_DIR/docker-compose.yml" ]; then
        cat > $INSTALL_DIR/docker-compose.yml << 'EOF'
volumes:
  logs:           # central log files collected by Fluent Bit
  ollama:         # model cache for Ollama

services:
  # 👉 Main application with Nginx, Node, PM2
  app:
    build: ./app
    container_name: app
    restart: unless-stopped
    depends_on:
      - fluent-bit
    volumes:
      - logs:/var/log
    ports:
      - "80:80"

  # 👉 Ollama serving Gemma 3n (e2b)
  ollama:
    image: ollama/ollama
    container_name: ollama
    restart: unless-stopped
    volumes:
      - ollama:/root/.ollama
    command: ["serve"]   # entrypoint is already `ollama`
    ports:
      - "11434:11434"

  # 👉 Fluent Bit – centralise all container logs into /logs/all.log
  fluent-bit:
    image: fluent/fluent-bit:3.0
    container_name: fluent-bit
    volumes:
      - logs:/logs
      - ./fluent-bit/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    ports:
      - "24224:24224"        # forwarder input
    restart: unless-stopped

  # 👉 Log Analyzer – Node script that calls Gemma & posts to Discord
  analyzer:
    build: ./analyzer
    container_name: analyzer
    depends_on:
      - ollama
      - fluent-bit
    volumes:
      - logs:/logs
    restart: unless-stopped
    environment:
      - OLLAMA_URL=http://ollama:11434
      - MODEL_NAME=gemma3n:e2b
      - DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}
EOF
    fi
    
    echo -e "${GREEN}✅ Downloaded application files${NC}"
}

# Create systemd service
create_service() {
    echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Robolog - AI-Powered Log Monitoring
After=docker.service
Requires=docker.service

[Service]
Type=forking
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    
    echo -e "${GREEN}✅ Created systemd service${NC}"
}

# Setup configuration
setup_config() {
    echo -e "${YELLOW}⚙️ Setting up configuration...${NC}"
    
    # Create .env file
    cat > $INSTALL_DIR/.env << 'EOF'
# Discord Webhook URL for notifications
# Get this from your Discord server settings > Integrations > Webhooks
DISCORD_WEBHOOK_URL=

# Ollama model (default: gemma3n:e2b)
MODEL_NAME=gemma3n:e2b

# Analyzer polling interval (milliseconds)
POLL_MS=60000
EOF
    
    chown $USER:$USER $INSTALL_DIR/.env
    
    echo -e "${GREEN}✅ Configuration file created at $INSTALL_DIR/.env${NC}"
}

# Create management commands
create_commands() {
    echo -e "${YELLOW}🛠️ Creating management commands...${NC}"
    
    cat > /usr/local/bin/robolog << 'EOF'
#!/bin/bash

INSTALL_DIR="/opt/robolog"
SERVICE_NAME="robolog"

case "$1" in
    start)
        echo "🚀 Starting Robolog..."
        systemctl start $SERVICE_NAME
        ;;
    stop)
        echo "⏹️ Stopping Robolog..."
        systemctl stop $SERVICE_NAME
        ;;
    restart)
        echo "🔄 Restarting Robolog..."
        systemctl restart $SERVICE_NAME
        ;;
    status)
        systemctl status $SERVICE_NAME
        ;;
    logs)
        cd $INSTALL_DIR && docker-compose logs -f ${2:-""}
        ;;
    test-errors)
        echo "🧪 Generating test errors..."
        curl -s http://localhost/generate-realistic-errors | jq .
        ;;
    config)
        echo "📝 Opening configuration file..."
        ${EDITOR:-nano} $INSTALL_DIR/.env
        ;;
    update)
        echo "🔄 Updating Robolog..."
        cd /tmp
        curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
        cp -r robolog-main/* $INSTALL_DIR/
        rm -rf /tmp/robolog-main
        cd $INSTALL_DIR && docker-compose build && docker-compose up -d
        echo "✅ Update completed"
        ;;
    uninstall)
        echo "🗑️ Uninstalling Robolog..."
        systemctl stop $SERVICE_NAME
        systemctl disable $SERVICE_NAME
        rm -f /etc/systemd/system/${SERVICE_NAME}.service
        rm -f /usr/local/bin/robolog
        rm -rf $INSTALL_DIR
        userdel robolog 2>/dev/null || true
        echo "✅ Robolog uninstalled"
        ;;
    *)
        echo "Usage: robolog {start|stop|restart|status|logs|test-errors|config|update|uninstall}"
        echo ""
        echo "Commands:"
        echo "  start        - Start Robolog services"
        echo "  stop         - Stop Robolog services"
        echo "  restart      - Restart Robolog services"
        echo "  status       - Show service status"
        echo "  logs [service] - Show logs (optionally for specific service)"
        echo "  test-errors  - Generate test errors"
        echo "  config       - Edit configuration"
        echo "  update       - Update to latest version"
        echo "  uninstall    - Completely remove Robolog"
        exit 1
        ;;
esac
EOF
    
    chmod +x /usr/local/bin/robolog
    
    echo -e "${GREEN}✅ Management command 'robolog' created${NC}"
}

# Main installation function
main() {
    detect_os
    check_docker
    setup_user
    download_files
    create_service
    setup_config
    create_commands
    
    echo -e "${GREEN}🎉 Robolog installation completed successfully!${NC}"
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Edit configuration: ${YELLOW}robolog config${NC}"
    echo -e "2. Add your Discord webhook URL to ${YELLOW}$INSTALL_DIR/.env${NC}"
    echo -e "3. Start the service: ${YELLOW}robolog start${NC}"
    echo -e "4. Check status: ${YELLOW}robolog status${NC}"
    echo -e "5. Test with: ${YELLOW}robolog test-errors${NC}"
    echo ""
    echo -e "${BLUE}Management commands:${NC}"
    echo -e "• ${YELLOW}robolog start/stop/restart${NC} - Control the service"
    echo -e "• ${YELLOW}robolog logs${NC} - View logs"
    echo -e "• ${YELLOW}robolog test-errors${NC} - Generate test errors"
    echo -e "• ${YELLOW}robolog config${NC} - Edit configuration"
    echo -e "• ${YELLOW}robolog update${NC} - Update to latest version"
    echo -e "• ${YELLOW}robolog uninstall${NC} - Remove completely"
}

# Run main installation
main "$@" 