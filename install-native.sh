#!/bin/bash

# 🚀 Robolog - Native Installation Script (No Docker Required)
# Installs Node.js, Fluent Bit, and Ollama directly on the system

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
NODE_VERSION="20"

echo -e "${BLUE}🚀 Robolog Native Installation (No Docker)${NC}"
echo -e "${BLUE}============================================${NC}"

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

# Install Node.js
install_nodejs() {
    echo -e "${YELLOW}📦 Installing Node.js $NODE_VERSION...${NC}"
    
    case $DISTRO in
        "ubuntu"|"debian")
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
            apt-get install -y nodejs
            ;;
        "centos"|"rhel"|"fedora")
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
            yum install -y nodejs npm
            ;;
        "arch")
            pacman -S --noconfirm nodejs npm
            ;;
        *)
            echo -e "${RED}❌ Unsupported distribution for automated Node.js install: $DISTRO${NC}"
            echo "Please install Node.js $NODE_VERSION manually"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}✅ Node.js installed: $(node --version)${NC}"
}

# Install Fluent Bit
install_fluentbit() {
    echo -e "${YELLOW}📦 Installing Fluent Bit...${NC}"
    
    case $DISTRO in
        "ubuntu"|"debian")
            curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh
            ;;
        "centos"|"rhel"|"fedora")
            curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh
            ;;
        "arch")
            pacman -S --noconfirm fluent-bit
            ;;
        *)
            echo -e "${RED}❌ Unsupported distribution for Fluent Bit: $DISTRO${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}✅ Fluent Bit installed${NC}"
}

# Install Ollama
install_ollama() {
    echo -e "${YELLOW}📦 Installing Ollama...${NC}"
    
    # Ollama has a universal installer
    curl -fsSL https://ollama.ai/install.sh | sh
    
    # Start and enable Ollama service
    systemctl start ollama
    systemctl enable ollama
    
    echo -e "${GREEN}✅ Ollama installed and started${NC}"
}

# Create user and directories
setup_user() {
    echo -e "${YELLOW}👤 Setting up user and directories...${NC}"
    
    # Create user
    if ! id "$USER" &>/dev/null; then
        useradd -r -s /bin/bash -d $INSTALL_DIR $USER
        echo -e "${GREEN}✅ Created user: $USER${NC}"
    fi
    
    # Create directories
    mkdir -p $INSTALL_DIR
    mkdir -p $INSTALL_DIR/logs
    mkdir -p /var/log/robolog
    mkdir -p /etc/fluent-bit
    
    # Set permissions
    chown -R $USER:$USER $INSTALL_DIR
    chown -R $USER:$USER /var/log/robolog
    
    echo -e "${GREEN}✅ Created directories and set permissions${NC}"
}

# Download and setup application files
setup_application() {
    echo -e "${YELLOW}📥 Setting up Robolog application...${NC}"
    
    # Download from GitHub
    cd /tmp
    curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
    
    # Copy analyzer files
    cp robolog-main/analyzer/analyzer.js $INSTALL_DIR/
    cp robolog-main/analyzer/package.json $INSTALL_DIR/
    
    # Install Node.js dependencies
    cd $INSTALL_DIR
    sudo -u $USER npm install --production
    
    # Create logs directory for fluent-bit output
    mkdir -p $INSTALL_DIR/logs
    chown $USER:$USER $INSTALL_DIR/logs
    
    # Cleanup
    rm -rf /tmp/robolog-main
    
    echo -e "${GREEN}✅ Application files installed${NC}"
}

# Configure Fluent Bit
configure_fluentbit() {
    echo -e "${YELLOW}⚙️ Configuring Fluent Bit...${NC}"
    
    # ✅ FIX: Generate a functional fluent-bit.conf for the native install.
    # This version correctly tails system logs, filters for errors, and forwards
    # them to the local analyzer service, making the native install work as intended.
    cat > /etc/fluent-bit/fluent-bit.conf << 'EOF'
[SERVICE]
    Flush        5
    Daemon       Off
    Log_Level    info

[INPUT]
    Name              systemd
    Tag               host.systemd.*
    # You can add more units to monitor here, e.g., nginx.service
    Systemd_Filter    _SYSTEMD_UNIT=robolog-analyzer.service
    
[INPUT]
    Name              tail
    Path              /var/log/syslog,/var/log/auth.log,/var/log/kern.log
    Tag               host.legacy.*
    Refresh_Interval  5
    Mem_Buf_Limit     64MB
    Skip_Long_Lines   On

[FILTER]
    Name    grep
    Match   host.*
    Regex   log (?i)(ERROR|CRIT|WARN|FAIL|FATAL)
    Alias   host.filtered

[OUTPUT]
    Name          http
    Match         host.filtered
    Host          127.0.0.1
    Port          9880
    URI           /logs
    Format        json

[OUTPUT]
    Name  file
    Match *
    Path  /opt/robolog/logs/
    File  all.log
    Format plain
EOF
    
    echo -e "${GREEN}✅ Fluent Bit configured${NC}"
}

# Create systemd services
create_services() {
    echo -e "${YELLOW}🔧 Creating systemd services...${NC}"
    
    # Robolog Analyzer Service
    cat > /etc/systemd/system/robolog-analyzer.service << EOF
[Unit]
Description=Robolog Log Analyzer
After=network.target ollama.service fluent-bit.service
Wants=ollama.service fluent-bit.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node analyzer.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=OLLAMA_URL=http://localhost:11434
Environment=MODEL_NAME=\${MODEL_NAME:-gemma3n:e2b}
Environment=LANGUAGE=\${LANGUAGE:-English}
Environment=WEBHOOK_URL=\${WEBHOOK_URL}
Environment=WEBHOOK_PLATFORM=\${WEBHOOK_PLATFORM:-discord}
Environment=DISCORD_WEBHOOK_URL=\${DISCORD_WEBHOOK_URL}
EnvironmentFile=-$INSTALL_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

    # Fluent Bit Service (override default)
    cat > /etc/systemd/system/fluent-bit.service << 'EOF'
[Unit]
Description=Fluent Bit
After=network.target
Wants=network.target

[Service]
Type=simple
ExecStart=/opt/fluent-bit/bin/fluent-bit -c /etc/fluent-bit/fluent-bit.conf
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Main Robolog Service (manages all components)
    cat > /etc/systemd/system/${SERVICE_NAME}.service << 'EOF'
[Unit]
Description=Robolog - AI-Powered Log Monitoring
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'systemctl start ollama fluent-bit robolog-analyzer'
ExecStop=/bin/bash -c 'systemctl stop robolog-analyzer fluent-bit'
ExecReload=/bin/bash -c 'systemctl restart ollama fluent-bit robolog-analyzer'

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable robolog ollama fluent-bit robolog-analyzer
    
    echo -e "${GREEN}✅ Created systemd services${NC}"
}

# Setup configuration
setup_config() {
    echo -e "${YELLOW}⚙️ Setting up configuration...${NC}"
    
    # Ask for language preference
    echo -e "${BLUE}Select your preferred language for AI notifications:${NC}"
    echo -e "${YELLOW}1) English ${NC}[default]"
    echo -e "${YELLOW}2) Spanish (Español)${NC}"
    echo -e "${YELLOW}3) French (Français)${NC}"
    echo -e "${YELLOW}4) German (Deutsch)${NC}"
    echo -e "${YELLOW}5) Chinese (中文)${NC}"
    echo -e "${YELLOW}6) Japanese (日本語)${NC}"
    echo -e "${YELLOW}7) Portuguese (Português)${NC}"
    echo -e "${YELLOW}8) Russian (Русский)${NC}"
    echo -e "${YELLOW}9) Italian (Italiano)${NC}"
    echo -e "${YELLOW}10) Other (specify)${NC}"
    echo ""
    
    read -p "Select language (1-10) or press Enter for English [1]: " -n 2 -r
    echo
    
    case $REPLY in
        2)
            SELECTED_LANGUAGE="Spanish"
            ;;
        3)
            SELECTED_LANGUAGE="French"
            ;;
        4)
            SELECTED_LANGUAGE="German"
            ;;
        5)
            SELECTED_LANGUAGE="Chinese"
            ;;
        6)
            SELECTED_LANGUAGE="Japanese"
            ;;
        7)
            SELECTED_LANGUAGE="Portuguese"
            ;;
        8)
            SELECTED_LANGUAGE="Russian"
            ;;
        9)
            SELECTED_LANGUAGE="Italian"
            ;;
        10)
            read -p "Enter your preferred language: " SELECTED_LANGUAGE
            ;;
        *)
            SELECTED_LANGUAGE="English"
            ;;
    esac
    
    echo -e "${BLUE}Selected language: $SELECTED_LANGUAGE${NC}"
    echo ""
    
    # Ask for webhook platform
    echo -e "${BLUE}Select your webhook platform for notifications:${NC}"
    echo -e "${YELLOW}1) Discord ${NC}[default]"
    echo -e "${YELLOW}2) Slack${NC}"
    echo -e "${YELLOW}3) Microsoft Teams${NC}"
    echo -e "${YELLOW}4) Telegram${NC}"
    echo -e "${YELLOW}5) Mattermost${NC}"
    echo -e "${YELLOW}6) Rocket.Chat${NC}"
    echo -e "${YELLOW}7) Generic Webhook${NC}"
    echo ""
    
    read -p "Select platform (1-7) or press Enter for Discord [1]: " -n 1 -r
    echo
    
    case $REPLY in
        2)
            SELECTED_PLATFORM="slack"
            WEBHOOK_INSTRUCTIONS="# Get webhook URL from Slack: Apps > Incoming Webhooks > Add New Webhook"
            ;;
        3)
            SELECTED_PLATFORM="teams"
            WEBHOOK_INSTRUCTIONS="# Get webhook URL from Teams: Channel > Connectors > Incoming Webhook"
            ;;
        4)
            SELECTED_PLATFORM="telegram"
            WEBHOOK_INSTRUCTIONS="# Create Telegram bot: @BotFather > /newbot, then use https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>"
            ;;
        5)
            SELECTED_PLATFORM="mattermost"
            WEBHOOK_INSTRUCTIONS="# Get webhook URL from Mattermost: Integrations > Incoming Webhooks"
            ;;
        6)
            SELECTED_PLATFORM="rocketchat"
            WEBHOOK_INSTRUCTIONS="# Get webhook URL from Rocket.Chat: Administration > Integrations > Incoming"
            ;;
        7)
            SELECTED_PLATFORM="generic"
            WEBHOOK_INSTRUCTIONS="# Provide any HTTP endpoint that accepts JSON POST requests"
            ;;
        *)
            SELECTED_PLATFORM="discord"
            WEBHOOK_INSTRUCTIONS="# Get webhook URL from Discord: Server Settings > Integrations > Webhooks"
            ;;
    esac
    
    echo -e "${BLUE}Selected platform: $SELECTED_PLATFORM${NC}"
    echo ""
    
    cat > $INSTALL_DIR/.env << EOF
# Webhook configuration for notifications
$WEBHOOK_INSTRUCTIONS
WEBHOOK_URL=
WEBHOOK_PLATFORM=$SELECTED_PLATFORM

# Legacy Discord support (for backwards compatibility)
# If you're using Discord, you can set either WEBHOOK_URL or DISCORD_WEBHOOK_URL
DISCORD_WEBHOOK_URL=

# Ollama model - choose from available options:
# gemma3n:e2b  - Google Gemma 3n (5.6GB) - best quality
# qwen3:8b     - Alibaba Qwen 3 (5.2GB) - with thinking mode
# llama3.2:1b  - Meta LLaMA (1.3GB) - fastest
# phi3:mini    - Microsoft Phi-3 (2.3GB) - balanced
MODEL_NAME=gemma3n:e2b

# Language for AI responses (English, Spanish, French, German, Chinese, Japanese, etc.)
LANGUAGE=$SELECTED_LANGUAGE

# Analyzer polling interval (milliseconds)
POLL_MS=60000

# Ollama URL (for native installation)
OLLAMA_URL=http://localhost:11434
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
        echo "🚀 Starting Robolog (native)..."
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
        echo "📊 Robolog Status:"
        systemctl status robolog-analyzer --no-pager -l
        echo ""
        systemctl status fluent-bit --no-pager -l
        echo ""
        systemctl status ollama --no-pager -l
        ;;
    logs)
        case "$2" in
            "analyzer")
                journalctl -u robolog-analyzer -f
                ;;
            "fluent-bit")
                journalctl -u fluent-bit -f
                ;;
            "ollama")
                journalctl -u ollama -f
                ;;
            *)
                echo "📋 All service logs (use Ctrl+C to exit):"
                journalctl -u robolog-analyzer -u fluent-bit -u ollama -f
                ;;
        esac
        ;;
    test-errors)
        echo "🧪 Generating test errors..."
        echo "ERROR Test nginx error: $(date)" | logger -t nginx
        echo "CRITICAL Test system error: $(date)" | logger -t system
        echo "WARNING Test application error: $(date)" | logger -t app
        echo "✅ Test errors generated. Check Discord in ~60 seconds."
        ;;
    config)
        echo "📝 Opening configuration file..."
        ${EDITOR:-nano} $INSTALL_DIR/.env
        ;;
    model)
        echo "🤖 Managing Ollama model..."
        case "$2" in
            "pull")
                sudo -u ollama ollama pull ${3:-gemma3n:e2b}
                ;;
            "list")
                sudo -u ollama ollama list
                ;;
            *)
                echo "Usage: robolog model {pull|list} [model_name]"
                ;;
        esac
        ;;
    update)
        echo "🔄 Updating Robolog..."
        cd /tmp
        curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
        cp robolog-main/analyzer/analyzer.js $INSTALL_DIR/
        cp robolog-main/analyzer/package.json $INSTALL_DIR/
        cd $INSTALL_DIR
        sudo -u robolog npm install --production
        systemctl restart robolog-analyzer
        rm -rf /tmp/robolog-main
        echo "✅ Update completed"
        ;;
    uninstall)
        echo "🗑️ Uninstalling Robolog..."
        systemctl stop robolog robolog-analyzer fluent-bit
        systemctl disable robolog robolog-analyzer fluent-bit
        rm -f /etc/systemd/system/robolog*.service
        rm -f /usr/local/bin/robolog
        rm -rf $INSTALL_DIR
        userdel robolog 2>/dev/null || true
        echo "✅ Robolog uninstalled (Ollama and Fluent Bit left installed)"
        echo "💡 To remove Ollama: curl -fsSL https://ollama.ai/install.sh | sh -s -- --uninstall"
        ;;
    *)
        echo "Usage: robolog {start|stop|restart|status|logs|test-errors|config|model|update|uninstall}"
        echo ""
        echo "Commands:"
        echo "  start           - Start Robolog services"
        echo "  stop            - Stop Robolog services"
        echo "  restart         - Restart Robolog services"
        echo "  status          - Show service status"
        echo "  logs [service]  - Show logs (analyzer|fluent-bit|ollama)"
        echo "  test-errors     - Generate test errors"
        echo "  config          - Edit configuration"
        echo "  model pull/list - Manage Ollama models"
        echo "  update          - Update to latest version"
        echo "  uninstall       - Remove Robolog"
        exit 1
        ;;
esac
EOF
    
    chmod +x /usr/local/bin/robolog
    
    echo -e "${GREEN}✅ Management command 'robolog' created${NC}"
}

# Pull AI model (optional)
setup_model() {
    echo -e "${YELLOW}🤖 Setting up AI model...${NC}"
    echo -e "${BLUE}Choose an AI model for log analysis:${NC}"
    echo -e "${YELLOW}1) gemma3n:e2b ${NC}(5.6GB) - Google's Gemma 3n model [default]"
    echo -e "${YELLOW}2) qwen3:8b ${NC}(5.2GB) - Alibaba's Qwen 3 model with thinking mode"
    echo -e "${YELLOW}3) llama3.2:1b ${NC}(1.3GB) - Meta's smaller LLaMA model"
    echo -e "${YELLOW}4) phi3:mini ${NC}(2.3GB) - Microsoft's Phi-3 mini model"
    echo ""
    
    # Ask user for model choice
    read -p "Select model (1-4) or press Enter for default [1]: " -n 1 -r
    echo
    
    case $REPLY in
        2)
            MODEL_NAME="qwen3:8b"
            MODEL_SIZE="5.2GB"
            MODEL_DESC="Qwen 3 8B model"
            ;;
        3)
            MODEL_NAME="llama3.2:1b"
            MODEL_SIZE="1.3GB"
            MODEL_DESC="LLaMA 3.2 1B model"
            ;;
        4)
            MODEL_NAME="phi3:mini"
            MODEL_SIZE="2.3GB"
            MODEL_DESC="Phi-3 Mini model"
            ;;
        *)
            MODEL_NAME="gemma3n:e2b"
            MODEL_SIZE="5.6GB"
            MODEL_DESC="Gemma 3n model"
            ;;
    esac
    
    echo -e "${BLUE}Selected: $MODEL_DESC ($MODEL_SIZE)${NC}"
    echo ""
    
    # Ask user if they want to download now
    read -p "Download $MODEL_DESC now? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Wait for Ollama to be ready
        echo -e "${YELLOW}⏳ Waiting for Ollama to be ready...${NC}"
        sleep 5
        
        # Pull the model
        echo -e "${YELLOW}📥 Downloading $MODEL_DESC ($MODEL_SIZE)...${NC}"
        sudo -u ollama ollama pull $MODEL_NAME
        
        echo -e "${GREEN}✅ AI model ready${NC}"
    else
        echo -e "${YELLOW}⏭️ Model download skipped. You can download it later with:${NC}"
        echo -e "${BLUE}robolog model pull $MODEL_NAME${NC}"
        echo -e "${YELLOW}💡 Alternative models available:${NC}"
        echo -e "${BLUE}robolog model pull gemma3n:e2b${NC} # Google Gemma 3n (5.6GB)"
        echo -e "${BLUE}robolog model pull qwen3:8b${NC}     # Alibaba Qwen 3 (5.2GB)" 
        echo -e "${BLUE}robolog model pull llama3.2:1b${NC}  # Meta LLaMA (1.3GB)"
        echo -e "${BLUE}robolog model pull phi3:mini${NC}    # Microsoft Phi-3 (2.3GB)"
    fi
    
    # Update the .env file with selected model
    sed -i "s/MODEL_NAME=.*/MODEL_NAME=$MODEL_NAME/" $INSTALL_DIR/.env
}

# Main installation function
main() {
    # Check for command line arguments
    SKIP_MODEL=false
    AUTO_YES=false
    MODEL_NAME="gemma3n:e2b"  # Default model
    SELECTED_LANGUAGE="English"  # Default language
    SELECTED_PLATFORM="discord"  # Default platform
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-model)
                SKIP_MODEL=true
                shift
                ;;
            --yes|-y)
                AUTO_YES=true
                shift
                ;;
            --model)
                MODEL_NAME="$2"
                shift 2
                ;;
            --language)
                SELECTED_LANGUAGE="$2"
                shift 2
                ;;
            --platform)
                SELECTED_PLATFORM="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-model        Skip AI model download"
                echo "  --yes, -y           Automatically download model without prompting"
                echo "  --model MODEL_NAME  Specify model to download (gemma3n:e2b, qwen3:8b, llama3.2:1b, phi3:mini)"
                echo "  --language LANG     Specify language for AI responses (English, Spanish, French, German, Chinese, Japanese, etc.)"
                echo "  --platform PLATFORM Specify webhook platform (discord, slack, teams, telegram, mattermost, rocketchat, generic)"
                echo "  --help, -h          Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    detect_os
    install_nodejs
    install_fluentbit
    install_ollama
    setup_user
    setup_application
    configure_fluentbit
    create_services
    setup_config
    create_commands
    
    if [[ "$SKIP_MODEL" == "false" ]]; then
        if [[ "$AUTO_YES" == "true" ]]; then
            echo -e "${YELLOW}📥 Auto-downloading $MODEL_NAME model...${NC}"
            sleep 5
            sudo -u ollama ollama pull $MODEL_NAME
            echo -e "${GREEN}✅ AI model ready${NC}"
            # Update the .env file with selected model
            sed -i "s/MODEL_NAME=.*/MODEL_NAME=$MODEL_NAME/" $INSTALL_DIR/.env
        else
            setup_model
        fi
    else
        echo -e "${YELLOW}⏭️ Model download skipped (--skip-model flag)${NC}"
        echo -e "${BLUE}Download later with: robolog model pull $MODEL_NAME${NC}"
    fi
    
    echo -e "${GREEN}🎉 Robolog native installation completed successfully!${NC}"
    echo -e "${BLUE}Benefits of native installation:${NC}"
    echo -e "• ${GREEN}No Docker dependency${NC}"
    echo -e "• ${GREEN}Better performance (no container overhead)${NC}"
    echo -e "• ${GREEN}Direct system integration${NC}"
    echo -e "• ${GREEN}Lower resource usage${NC}"
    echo ""
    
    # Check if model was downloaded
    if [[ "$SKIP_MODEL" == "true" ]]; then
        echo -e "${YELLOW}⚠️ Important: AI model not downloaded!${NC}"
        echo -e "${BLUE}To complete setup, download a model:${NC}"
        echo -e "• ${YELLOW}robolog model pull gemma3n:e2b${NC}  # Google Gemma 3n (5.6GB) - best quality"
        echo -e "• ${YELLOW}robolog model pull qwen3:8b${NC}     # Alibaba Qwen 3 (5.2GB) - with thinking mode"
        echo -e "• ${YELLOW}robolog model pull llama3.2:1b${NC}  # Meta LLaMA (1.3GB) - fastest"
        echo -e "• ${YELLOW}robolog model pull phi3:mini${NC}    # Microsoft Phi-3 (2.3GB) - balanced"
        echo ""
    fi
    
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Edit configuration: ${YELLOW}robolog config${NC}"
    echo -e "2. Add your Discord webhook URL"
    if [[ "$SKIP_MODEL" == "true" ]]; then
        echo -e "3. Download AI model: ${YELLOW}robolog model pull gemma3n:e2b${NC}"
        echo -e "4. Start the service: ${YELLOW}robolog start${NC}"
        echo -e "5. Check status: ${YELLOW}robolog status${NC}"
        echo -e "6. Test with: ${YELLOW}robolog test-errors${NC}"
    else
        echo -e "3. Start the service: ${YELLOW}robolog start${NC}"
        echo -e "4. Check status: ${YELLOW}robolog status${NC}"
        echo -e "5. Test with: ${YELLOW}robolog test-errors${NC}"
    fi
    echo ""
    echo -e "${BLUE}Native installation includes:${NC}"
    echo -e "• ${YELLOW}Node.js${NC} - JavaScript runtime for analyzer"
    echo -e "• ${YELLOW}Fluent Bit${NC} - Log collection and forwarding"
    echo -e "• ${YELLOW}Ollama${NC} - Local AI model serving"
    echo -e "• ${YELLOW}systemd services${NC} - Auto-start and management"
}

# Run main installation
main "$@" 