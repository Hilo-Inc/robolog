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
        "ubuntu"|"debian"|"centos"|"rhel"|"fedora")
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

# Install Nginx
install_nginx() {
    echo -e "${YELLOW}📦 Installing Nginx...${NC}"

    case $DISTRO in
        "ubuntu"|"debian")
            apt-get install -y nginx
            ;;
        "centos"|"rhel"|"fedora")
            yum install -y nginx
            ;;
        "arch")
            pacman -S --noconfirm nginx
            ;;
        *)
            echo -e "${RED}❌ Unsupported distribution for Nginx: $DISTRO${NC}"
            exit 1
            ;;
    esac

    systemctl enable nginx
    echo -e "${GREEN}✅ Nginx installed${NC}"
}

# Install Certbot for Let's Encrypt SSL certificates
install_certbot() {
    echo -e "${YELLOW}📦 Installing Certbot...${NC}"

    case $DISTRO in
        "ubuntu"|"debian")
            apt-get update
            apt-get install -y snapd
            snap install core
            snap refresh core
            snap install --classic certbot
            ln -sf /snap/bin/certbot /usr/bin/certbot
            ;;
        "centos"|"rhel"|"fedora")
            yum install -y epel-release
            yum install -y certbot python3-certbot-nginx
            ;;
        "arch")
            pacman -S --noconfirm certbot certbot-nginx
            ;;
        *)
            echo -e "${RED}❌ Unsupported distribution for Certbot: $DISTRO${NC}"
            exit 1
            ;;
    esac

    echo -e "${GREEN}✅ Certbot installed${NC}"
}

# Obtain Let's Encrypt SSL certificate
setup_letsencrypt() {
    local domain="$1"
    
    echo -e "${YELLOW}🔒 Setting up Let's Encrypt SSL certificate for $domain...${NC}"
    
    # Validate domain format
    if [[ ! "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
        echo -e "${RED}❌ Invalid domain format: $domain${NC}"
        return 1
    fi
    
    # Check if domain resolves to this server
    local server_ip=$(curl -s ifconfig.me)
    local domain_ip=$(dig +short "$domain" | tail -n1)
    
    if [[ "$server_ip" != "$domain_ip" ]]; then
        echo -e "${YELLOW}⚠️ Warning: Domain $domain doesn't resolve to this server ($server_ip vs $domain_ip)${NC}"
        if [[ "$AUTO_YES" != "true" ]]; then
            read -p "Continue anyway? [y/N]: " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                return 1
            fi
        fi
    fi
    
    # Stop nginx temporarily for standalone authentication
    systemctl stop nginx 2>/dev/null || true
    
    # Obtain certificate using standalone method
    if certbot certonly --standalone --non-interactive --agree-tos \
        --email "admin@$domain" \
        -d "$domain"; then
        
        echo -e "${GREEN}✅ SSL certificate obtained for $domain${NC}"
        
        # Set up auto-renewal
        cat > /etc/systemd/system/certbot-renewal.service << EOF
[Unit]
Description=Certbot Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --nginx --quiet
ExecStartPost=/bin/systemctl reload nginx

[Install]
WantedBy=multi-user.target
EOF

        cat > /etc/systemd/system/certbot-renewal.timer << EOF
[Unit]
Description=Run certbot renewal twice daily
Requires=certbot-renewal.service

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

        systemctl daemon-reload
        systemctl enable certbot-renewal.timer
        systemctl start certbot-renewal.timer
        
        echo -e "${GREEN}✅ Auto-renewal configured${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to obtain SSL certificate${NC}"
        return 1
    fi
}

# Install Ollama
install_ollama() {
    echo -e "${YELLOW}📦 Installing Ollama...${NC}"

    curl -fsSL https://ollama.ai/install.sh | sh

    systemctl start ollama
    systemctl enable ollama

    echo -e "${GREEN}✅ Ollama installed and started${NC}"
}

# Create user and directories
setup_user() {
    echo -e "${YELLOW}👤 Setting up user and directories...${NC}"

    if ! id "$USER" &>/dev/null; then
        useradd -r -s /bin/bash -d $INSTALL_DIR $USER
        echo -e "${GREEN}✅ Created user: $USER${NC}"
    fi

    mkdir -p "$INSTALL_DIR/logs"
    mkdir -p /var/log/robolog
    mkdir -p /etc/fluent-bit

    chown -R "$USER:$USER" "$INSTALL_DIR"
    chown -R "$USER:$USER" /var/log/robolog

    echo -e "${GREEN}✅ Created directories and set permissions${NC}"
}

# Download and setup application files
setup_application() {
    echo -e "${YELLOW}📥 Setting up Robolog application...${NC}"

    local GITHUB_URL="https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz"
    local AUTH_HEADER=""
    if [[ -n "$GITHUB_TOKEN" ]]; then
        AUTH_HEADER="-H \"Authorization: Bearer $GITHUB_TOKEN\""
    fi

    local TMP_DIR="/tmp"
    local TARBALL="$TMP_DIR/robolog-main.tar.gz"
    local EXTRACT_DIR="$TMP_DIR/robolog-main"

    echo "Downloading source from GitHub..."
    if ! eval "curl -fsSL $AUTH_HEADER -o \"$TARBALL\" \"$GITHUB_URL\""; then
        echo -e "${RED}❌ Failed to download Robolog source from GitHub.${NC}"
        exit 1
    fi

    echo "Extracting application files..."
    mkdir -p "$EXTRACT_DIR"
    if ! tar -xzf "$TARBALL" -C "$EXTRACT_DIR" --strip-components=1; then
        echo -e "${RED}❌ Failed to extract the downloaded tarball.${NC}"
        exit 1
    fi

    echo "Setting up Analyzer..."
    cp "$EXTRACT_DIR/analyzer/analyzer.js" "$INSTALL_DIR/"
    cp "$EXTRACT_DIR/analyzer/package.json" "$INSTALL_DIR/"
    cd "$INSTALL_DIR"
    sudo -u "$USER" npm install --production

    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        echo "Setting up Web Dashboard..."
        mkdir -p "$INSTALL_DIR/app"
        cp -r "$EXTRACT_DIR/app/." "$INSTALL_DIR/app/"
        chown -R "$USER:$USER" "$INSTALL_DIR/app"

        cd "$INSTALL_DIR/app"

        # ✅ FIX: Implement the correct build lifecycle for a Node.js app.

        # 1. Install ALL dependencies (including devDependencies) needed for the build.
        echo "Installing dashboard dependencies..."
        sudo -u "$USER" npm install

        # 2. Run the production build.
        echo "Building the dashboard..."
        sudo -u "$USER" npm run build

        # 3. Prune the devDependencies to keep the final installation small.
        echo "Cleaning up development packages..."
        sudo -u "$USER" npm prune --production
    fi

    rm -rf "$TARBALL" "$EXTRACT_DIR"

    echo -e "${GREEN}✅ Application files installed${NC}"
}

# ✅ FIX: This is the single, unified setup_config function.
# It correctly handles both command-line flags and interactive prompts.
setup_config() {
    local cli_lang="$1"
    local cli_platform="$2"

    local final_language="English"
    local final_platform="discord"
    local webhook_instructions=""

    echo -e "${YELLOW}⚙️ Setting up configuration...${NC}"

    if [[ "$AUTO_YES" == "true" ]]; then
        final_language=${cli_lang:-"English"}
        final_platform=${cli_platform:-"discord"}
        echo -e "${BLUE}Running in non-interactive mode.${NC}"
        echo -e "${BLUE}Language set to: $final_language${NC}"
        echo -e "${BLUE}Platform set to: $final_platform${NC}"
    else
        echo -e "${BLUE}Select your preferred language for AI notifications:${NC}"
        echo -e "${YELLOW}1) English ${NC}[default], 2) Spanish, 3) French, 4) German, 5) Chinese, 6) Japanese, 7) Portuguese, 8) Russian, 9) Italian, 10) Other${NC}"
        read -p "Select language or press Enter for English [1]: " -n 2 -r
        echo
        case $REPLY in
            2) final_language="Spanish" ;;
            3) final_language="French" ;;
            4) final_language="German" ;;
            5) final_language="Chinese" ;;
            6) final_language="Japanese" ;;
            7) final_language="Portuguese" ;;
            8) final_language="Russian" ;;
            9) final_language="Italian" ;;
            10) read -p "Enter your preferred language: " final_language ;;
            *) final_language="English" ;;
        esac
        echo -e "${BLUE}Selected language: $final_language${NC}\n"

        echo -e "${BLUE}Select your webhook platform for notifications:${NC}"
        echo -e "${YELLOW}1) Discord ${NC}[default], 2) Slack, 3) Teams, 4) Telegram, 5) Mattermost, 6) Rocket.Chat, 7) Generic${NC}"
        read -p "Select platform or press Enter for Discord [1]: " -n 1 -r
        echo
        case $REPLY in
            2) final_platform="slack" ;;
            3) final_platform="teams" ;;
            4) final_platform="telegram" ;;
            5) final_platform="mattermost" ;;
            6) final_platform="rocketchat" ;;
            7) final_platform="generic" ;;
            *) final_platform="discord" ;;
        esac
        echo -e "${BLUE}Selected platform: $final_platform${NC}\n"
    fi

    case $final_platform in
        "slack") webhook_instructions="# Get webhook URL from Slack: Apps > Incoming Webhooks > Add New Webhook" ;;
        "teams") webhook_instructions="# Get webhook URL from Teams: Channel > Connectors > Incoming Webhook" ;;
        "telegram") webhook_instructions="# Create Telegram bot: @BotFather > /newbot, then use https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>" ;;
        "mattermost") webhook_instructions="# Get webhook URL from Mattermost: Integrations > Incoming Webhooks" ;;
        "rocketchat") webhook_instructions="# Get webhook URL from Rocket.Chat: Administration > Integrations > Incoming" ;;
        "generic") webhook_instructions="# Provide any HTTP endpoint that accepts JSON POST requests" ;;
        *) webhook_instructions="# Get webhook URL from Discord: Server Settings > Integrations > Webhooks" ;;
    esac

    cat > "$INSTALL_DIR/.env" << EOF
# Webhook configuration for notifications
$webhook_instructions
WEBHOOK_URL=
WEBHOOK_PLATFORM=$final_platform
DISCORD_WEBHOOK_URL=
MODEL_NAME=gemma3n:e2b
LANGUAGE=$final_language
POLL_MS=60000
OLLAMA_URL=http://localhost:11434
EOF

    chown "$USER:$USER" "$INSTALL_DIR/.env"
    echo -e "${GREEN}✅ Configuration file created at $INSTALL_DIR/.env${NC}"
}

# ✅ FIX: This is the single, unified setup_model function.
# It correctly handles command-line flags and interactive prompts.
setup_model() {
    local cli_model="$1"
    local final_model_name=""
    local model_desc=""
    local model_size=""

    echo -e "${YELLOW}🤖 Setting up AI model...${NC}"

    if [[ "$SKIP_MODEL" == "true" ]]; then
        echo -e "${YELLOW}⏭️ Model download skipped due to --skip-model flag.${NC}"
        sed -i "s/MODEL_NAME=.*/MODEL_NAME=gemma3n:e2b/" "$INSTALL_DIR/.env"
        return
    fi

    if [[ "$AUTO_YES" == "true" ]]; then
        final_model_name=${cli_model:-"gemma3n:e2b"}
        echo -e "${BLUE}Running in non-interactive mode. Model set to: $final_model_name${NC}"
    else
        echo -e "${BLUE}Choose an AI model for log analysis:${NC}"
        echo -e "${YELLOW}1) gemma3n:e2b (5.6GB) - Google's Gemma 3n model [default]${NC}"
        echo -e "${YELLOW}2) qwen3:8b (5.2GB) - Alibaba's Qwen 3 model with thinking mode${NC}"
        echo -e "${YELLOW}3) llama3.2:1b (1.3GB) - Meta's smaller LLaMA model${NC}"
        echo -e "${YELLOW}4) phi3:mini (2.3GB) - Microsoft's Phi-3 mini model${NC}"
        read -p "Select model (1-4) or press Enter for default [1]: " -n 1 -r
        echo
        case $REPLY in
            2) final_model_name="qwen3:8b"; model_desc="Qwen 3 8B"; model_size="5.2GB" ;;
            3) final_model_name="llama3.2:1b"; model_desc="LLaMA 3.2 1B"; model_size="1.3GB" ;;
            4) final_model_name="phi3:mini"; model_desc="Phi-3 Mini"; model_size="2.3GB" ;;
            *) final_model_name="gemma3n:e2b"; model_desc="Gemma 3n"; model_size="5.6GB" ;;
        esac
        echo -e "${BLUE}Selected: $model_desc ($model_size)${NC}\n"
    fi

    # Update the .env file with the final selected model
    sed -i "s/MODEL_NAME=.*/MODEL_NAME=$final_model_name/" "$INSTALL_DIR/.env"

    # Ask user if they want to download now, unless in auto-yes mode
    if [[ "$AUTO_YES" == "true" ]] || { read -p "Download ${model_desc:-$final_model_name} now? [Y/n]: " -n 1 -r; echo; [[ $REPLY =~ ^[Yy]$ || -z "$REPLY" ]]; }; then
        echo -e "${YELLOW}⏳ Waiting for Ollama to be ready...${NC}"
        # ✅ BEST PRACTICE: Poll the Ollama service instead of using a fixed sleep.
        until sudo -u ollama ollama list > /dev/null 2>&1; do
            printf '.'
            sleep 2
        done
        echo -e "\n${YELLOW}📥 Downloading ${model_desc:-$final_model_name}...${NC}"
        sudo -u ollama ollama pull "$final_model_name"
        echo -e "${GREEN}✅ AI model ready${NC}"
    else
        echo -e "${YELLOW}⏭️ Model download skipped. You can download it later with: robolog model pull $final_model_name${NC}"
    fi
}

# Configure Fluent Bit
configure_fluentbit() {
    echo -e "${YELLOW}⚙️ Configuring Fluent Bit...${NC}"
    cat > /etc/fluent-bit/fluent-bit.conf << 'EOF'
[SERVICE]
    Flush        5
    Daemon       Off
    Log_Level    info
    HTTP_Server  On
    HTTP_Listen  0.0.0.0
    HTTP_Port    2020

[INPUT]
    Name              tail
    Path              /var/log/syslog,/var/log/auth.log,/var/log/kern.log
    Tag               host.log.*
    Refresh_Interval  5
    Mem_Buf_Limit     64MB
    Skip_Long_Lines   On
    DB                /opt/robolog/logs/fluent-bit.db
    DB.Sync           Normal

[FILTER]
    Name          rewrite_tag
    Match         host.log.*
    Rule          log (?i)(ERROR|CRIT|WARN|FAIL|FATAL) host.filtered true
    Emitter_Name  re_emitter

[FILTER]
    Name          grep
    Match         host.filtered
    Exclude       log (?i)(node\[[0-9]+\]:.*queue|robolog.*queue|Queued batch|Processing instance|analysis.*queue|ollama.*queue)
    Exclude       log (?i)(robolog-analyzer|robolog-dashboard|analyzer\.js)

[OUTPUT]
    Name          http
    Match         host.filtered
    Host          127.0.0.1
    Port          9880
    URI           /logs
    Format        json
    Retry_Limit   5

[OUTPUT]
    Name  file
    Match *
    Path  /opt/robolog/logs/
    File  all.log
    Format plain
EOF
    echo -e "${GREEN}✅ Fluent Bit configured${NC}"
}

# In C:/dev/robolog/install-native.sh

# Configure Nginx for the dashboard
configure_nginx() {
    local ssl_domain="$1"
    echo -e "${YELLOW}⚙️  Configuring Nginx...${NC}"
    # ✅ BEST PRACTICE: Define a clear, unique name for our config file.
    local NGINX_CONF_NAME="robolog-dashboard.conf"
    local NGINX_AVAILABLE_DIR="/etc/nginx/sites-available"
    local NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
    local FINAL_CONF_PATH="$NGINX_AVAILABLE_DIR/$NGINX_CONF_NAME"

    # Use the Docker config as the single source of truth.
    local SOURCE_NGINX_CONF="$INSTALL_DIR/app/nginx.conf"

    if [[ ! -f "$SOURCE_NGINX_CONF" ]]; then
        echo -e "${RED}❌ Nginx source config not found at $SOURCE_NGINX_CONF. Aborting.${NC}"
        exit 1
    fi

    # Create the sites-available directory if it doesn't exist (common on some systems)
    mkdir -p "$NGINX_AVAILABLE_DIR"
    mkdir -p "$NGINX_ENABLED_DIR"

    # Copy the base config file.
    cp "$SOURCE_NGINX_CONF" "$FINAL_CONF_PATH"

    # ✅ FIX: Reliably modify the config for a native environment.
    # This replaces the Docker service name 'analyzer' with 'localhost'
    # and updates the log paths for a standard Linux system.
    sed -i 's|http://analyzer:9880|http://localhost:9880|g' "$FINAL_CONF_PATH"
    sed -i 's|access_log /dev/stdout;|access_log /var/log/nginx/robolog-access.log;|g' "$FINAL_CONF_PATH"
    sed -i 's|error_log /dev/stderr;|error_log /var/log/nginx/robolog-error.log;|g' "$FINAL_CONF_PATH"
    # Remove default_server directive to avoid conflicts with existing nginx installations
    sed -i 's| default_server||g' "$FINAL_CONF_PATH"

    # ✅ FIX: Auto-detect server IP and set appropriate server_name to prevent nginx warnings
    local server_name="_"
    if [[ -n "$ssl_domain" ]]; then
        server_name="$ssl_domain"
        echo -e "${YELLOW}🌐 Using SSL domain as server name: $ssl_domain${NC}"
    else
        # Try to get the server's public IP address
        local server_ip=""
        for ip_service in "ifconfig.me" "ipinfo.io/ip" "icanhazip.com" "ipecho.net/plain"; do
            server_ip=$(curl -s --connect-timeout 5 "$ip_service" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
            if [[ -n "$server_ip" ]]; then
                echo -e "${YELLOW}🌐 Auto-detected server IP: $server_ip${NC}"
                server_name="$server_ip"
                break
            fi
        done
        
        # Fallback to local hostname if IP detection fails
        if [[ "$server_name" == "_" ]]; then
            local hostname=$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo "robolog.local")
            if [[ "$hostname" != "localhost" && "$hostname" != "127.0.0.1" ]]; then
                server_name="$hostname"
                echo -e "${YELLOW}🌐 Using server hostname: $hostname${NC}"
            else
                echo -e "${YELLOW}⚠️ Could not detect server IP/hostname, using default${NC}"
            fi
        fi
    fi

    # Update server_name in nginx config to prevent conflicts
    sed -i "s|server_name _;|server_name $server_name;|g" "$FINAL_CONF_PATH"

    # Configure SSL certificates
    local ssl_configured=false
    if [[ -n "$ssl_domain" ]] && [[ -f "/etc/letsencrypt/live/$ssl_domain/fullchain.pem" ]]; then
        # Use Let's Encrypt certificates
        echo -e "${YELLOW}🔒 Configuring Let's Encrypt SSL certificates...${NC}"
        sed -i "s|ssl_certificate /etc/nginx/certs/nginx-selfsigned.crt;|ssl_certificate /etc/letsencrypt/live/$ssl_domain/fullchain.pem;|g" "$FINAL_CONF_PATH"
        sed -i "s|ssl_certificate_key /etc/nginx/certs/nginx-selfsigned.key;|ssl_certificate_key /etc/letsencrypt/live/$ssl_domain/privkey.pem;|g" "$FINAL_CONF_PATH"
        
        # Add additional Let's Encrypt recommended SSL settings
        sed -i '/ssl_protocols/a\    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;\n    ssl_prefer_server_ciphers off;\n    ssl_session_timeout 10m;\n    ssl_session_cache shared:SSL:10m;\n    ssl_session_tickets off;\n    ssl_stapling on;\n    ssl_stapling_verify on;' "$FINAL_CONF_PATH"
        
        ssl_configured=true
        echo -e "${GREEN}✅ Let's Encrypt SSL configured for $ssl_domain${NC}"
    else
        # Use self-signed SSL certs (fallback)
        echo -e "${YELLOW}🔒 Using self-signed SSL certificates...${NC}"
        local DASHBOARD_CERT_DIR="$INSTALL_DIR/app/certs"
        mkdir -p /etc/nginx/certs
        cp "$DASHBOARD_CERT_DIR/nginx-selfsigned.crt" /etc/nginx/certs/
        cp "$DASHBOARD_CERT_DIR/nginx-selfsigned.key" /etc/nginx/certs/
        echo -e "${GREEN}✅ Self-signed SSL certificates configured${NC}"
    fi

    echo -e "${GREEN}✅ Nginx configuration for Robolog has been created at:${NC}"
    echo -e "${YELLOW}$FINAL_CONF_PATH${NC}"

    # Automatically enable the site since the user explicitly chose to install the dashboard
    echo -e "${YELLOW}⚙️ Enabling the Robolog dashboard site...${NC}"
    ln -sf "$FINAL_CONF_PATH" "$NGINX_ENABLED_DIR/$NGINX_CONF_NAME"
    
    # Test nginx configuration
    if nginx -t; then
        echo -e "${GREEN}✅ Nginx configuration test passed${NC}"
        echo -e "${YELLOW}🔄 Reloading Nginx to apply new configuration...${NC}"
        systemctl reload nginx
        echo -e "${GREEN}✅ Nginx reloaded successfully${NC}"
        if [[ "$ssl_configured" == "true" ]]; then
            NGINX_POST_INSTALL_MESSAGE=$(cat <<EOF

${BLUE}-------------------------------------------------------------------${NC}
${GREEN}✅ Robolog Dashboard Successfully Configured${NC}
${BLUE}-------------------------------------------------------------------${NC}
The Robolog dashboard has been automatically enabled and configured in Nginx.

${GREEN}Dashboard Status:${NC}
• Configuration: ${YELLOW}$FINAL_CONF_PATH${NC}
• Enabled at: ${YELLOW}$NGINX_ENABLED_DIR/$NGINX_CONF_NAME${NC}
• Access URL: ${YELLOW}https://$ssl_domain${NC}
• SSL Certificate: ${YELLOW}Let's Encrypt (Valid)${NC}

${GREEN}✅ Your dashboard is secured with a valid SSL certificate!${NC}

${GREEN}Optional: Manual Integration${NC}
If you prefer to integrate with an existing Nginx configuration instead,
add this location block to your existing server configuration:

    ${YELLOW}location /analyzer/ {
        proxy_pass http://localhost:9880/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }${NC}
EOF
)
        else
            NGINX_POST_INSTALL_MESSAGE=$(cat <<EOF

${BLUE}-------------------------------------------------------------------${NC}
${GREEN}✅ Robolog Dashboard Successfully Configured${NC}
${BLUE}-------------------------------------------------------------------${NC}
The Robolog dashboard has been automatically enabled and configured in Nginx.

${GREEN}Dashboard Status:${NC}
• Configuration: ${YELLOW}$FINAL_CONF_PATH${NC}
• Enabled at: ${YELLOW}$NGINX_ENABLED_DIR/$NGINX_CONF_NAME${NC}
• Access URL: ${YELLOW}https://<your-server-ip>${NC}
• SSL Certificate: ${YELLOW}Self-signed${NC}

${YELLOW}Note:${NC} The dashboard uses a self-signed SSL certificate. Your browser will 
show a security warning - this is safe to accept for local/demo use.

${GREEN}Optional: Manual Integration${NC}
If you prefer to integrate with an existing Nginx configuration instead,
add this location block to your existing server configuration:

    ${YELLOW}location /analyzer/ {
        proxy_pass http://localhost:9880/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }${NC}
EOF
)
        fi
    else
        echo -e "${RED}❌ Nginx configuration test failed${NC}"
        NGINX_POST_INSTALL_MESSAGE=$(cat <<EOF

${BLUE}-------------------------------------------------------------------${NC}
${RED}⚠️ Nginx Configuration Issue Detected${NC}
${BLUE}-------------------------------------------------------------------${NC}
The Robolog dashboard configuration was created but there may be an issue
with your Nginx setup. Please check your Nginx configuration manually.

${GREEN}To troubleshoot:${NC}
1. Test configuration: ${YELLOW}sudo nginx -t${NC}
2. Check enabled site: ${YELLOW}ls -la $NGINX_ENABLED_DIR/$NGINX_CONF_NAME${NC}
3. Review config file: ${YELLOW}sudo cat $FINAL_CONF_PATH${NC}
EOF
)
    fi
}


# Create systemd services
create_services() {
    echo -e "${YELLOW}🔧 Creating systemd services...${NC}"

    cat > /etc/systemd/system/robolog-analyzer.service << EOF
[Unit]
Description=Robolog Log Analyzer
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node analyzer.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=OLLAMA_URL=http://localhost:11434
EnvironmentFile=-$INSTALL_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        echo "Creating dashboard service..."
        cat > /etc/systemd/system/robolog-dashboard.service << EOF
[Unit]
Description=Robolog Web Dashboard
After=network.target
Wants=robolog-analyzer.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/app
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=ANALYZER_INTERNAL_URL=http://localhost:9880

[Install]
WantedBy=multi-user.target
EOF
    fi

    local start_cmd="systemctl start ollama fluent-bit robolog-analyzer"
    local stop_cmd="systemctl stop robolog-analyzer fluent-bit"
    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        start_cmd+=" nginx robolog-dashboard"
        stop_cmd+=" robolog-dashboard nginx"
    fi

    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Robolog - AI-Powered Log Monitoring
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c '$start_cmd'
ExecStop=/bin/bash -c '$stop_cmd'
ExecReload=/bin/bash -c 'systemctl restart $start_cmd'

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable robolog ollama fluent-bit robolog-analyzer
    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        systemctl enable robolog-dashboard
    fi

    echo -e "${GREEN}✅ Created and enabled systemd services${NC}"
}

# Create management commands
create_commands() {
    echo -e "${YELLOW}🛠️ Creating management commands...${NC}"
    cat > /usr/local/bin/robolog << 'EOF'
#!/bin/bash
INSTALL_DIR="/opt/robolog"
SERVICE_NAME="robolog"
if [[ "$1" =~ ^(start|stop|restart|uninstall|update)$ && $EUID -ne 0 ]]; then
    echo -e "\033[0;31m❌ Error: This command requires root privileges.\033[0m"
    echo -e "Please run it again with sudo:\n\033[1;33msudo robolog $1\033[0m"
    exit 1
fi
case "$1" in
    start) systemctl start $SERVICE_NAME ;;
    stop) systemctl stop $SERVICE_NAME ;;
    restart) systemctl restart $SERVICE_NAME ;;
    status)
        echo "📊 Robolog Status:"
        systemctl status robolog-analyzer --no-pager -l
        systemctl status fluent-bit --no-pager -l
        systemctl status ollama --no-pager -l
        # Check if dashboard service exists and show its status
        if systemctl list-unit-files robolog-dashboard.service &>/dev/null; then
            systemctl status robolog-dashboard --no-pager -l
            systemctl status nginx --no-pager -l
        fi
        ;;
    logs)
        case "$2" in
            "analyzer") journalctl -u robolog-analyzer -f ;;
            "dashboard") journalctl -u robolog-dashboard -f ;;
            "fluent-bit") journalctl -u fluent-bit -f ;;
            "ollama") journalctl -u ollama -f ;;
            "nginx") journalctl -u nginx -f ;;
            *) 
                # Include dashboard logs if the service exists
                if systemctl list-unit-files robolog-dashboard.service &>/dev/null; then
                    journalctl -u robolog-analyzer -u robolog-dashboard -u fluent-bit -u ollama -u nginx -f
                else
                    journalctl -u robolog-analyzer -u fluent-bit -u ollama -f
                fi
                ;;
        esac
        ;;
    test-errors)
        echo "🧪 Generating test errors..."
        logger -t nginx "ERROR Test nginx error: $(date)"
        logger -t system "CRITICAL Test system error: $(date)"
        logger -t app "WARNING Test application error: $(date)"
        echo "✅ Test errors generated. Check your webhook in ~60 seconds."
        ;;
    config)
        echo "📝 Opening configuration file (requires root)..."
        sudo ${EDITOR:-nano} $INSTALL_DIR/.env
        ;;
    model)
        case "$2" in
            "pull") sudo -u ollama ollama pull ${3:-gemma3n:e2b} ;;
            "list") sudo -u ollama ollama list ;;
            *) echo "Usage: robolog model {pull|list} [model_name]" ;;
        esac
        ;;
    ssl)
        case "$2" in
            "renew") 
                echo "🔄 Renewing SSL certificates..."
                certbot renew --nginx
                systemctl reload nginx
                echo "✅ SSL certificates renewed"
                ;;
            "status")
                echo "📋 SSL Certificate Status:"
                certbot certificates
                ;;
            "setup")
                if [[ -z "$3" ]]; then
                    echo "Usage: robolog ssl setup <domain>"
                    exit 1
                fi
                echo "🔒 Setting up SSL certificate for $3..."
                certbot --nginx -d "$3"
                echo "✅ SSL certificate setup completed"
                ;;
            *) 
                echo "Usage: robolog ssl {renew|status|setup} [domain]"
                echo "  renew  - Renew all certificates"
                echo "  status - Show certificate information"
                echo "  setup  - Setup certificate for new domain"
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
        echo "Usage: robolog {start|stop|restart|status|logs|test-errors|config|model|ssl|update|uninstall}"
        echo ""
        echo "Log options:"
        echo "  robolog logs              - View all service logs"
        echo "  robolog logs analyzer     - View analyzer logs only"
        echo "  robolog logs dashboard    - View dashboard logs only (if installed)"
        echo "  robolog logs fluent-bit   - View Fluent Bit logs only"
        echo "  robolog logs nginx        - View Nginx logs only"
        echo "  robolog logs ollama       - View Ollama logs only"
        echo ""
        echo "SSL options:"
        echo "  robolog ssl renew         - Renew all SSL certificates"
        echo "  robolog ssl status        - Show certificate information"
        echo "  robolog ssl setup DOMAIN  - Setup certificate for new domain"
        exit 1
        ;;
esac
EOF
    chmod +x /usr/local/bin/robolog
    echo -e "${GREEN}✅ Management command 'robolog' created${NC}"
}

# Main installation function
main() {
    INSTALL_DASHBOARD=false
    SKIP_MODEL=false
    AUTO_YES=false
    CLI_MODEL_NAME=""
    CLI_LANGUAGE=""
    CLI_PLATFORM=""
    SSL_DOMAIN=""
    NGINX_POST_INSTALL_MESSAGE=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --with-dashboard) INSTALL_DASHBOARD=true; shift ;;
            --skip-model) SKIP_MODEL=true; shift ;;
            --yes|-y) AUTO_YES=true; shift ;;
            --model) CLI_MODEL_NAME="$2"; shift 2 ;;
            --language) CLI_LANGUAGE="$2"; shift 2 ;;
            --platform) CLI_PLATFORM="$2"; shift 2 ;;
            --ssl-domain) SSL_DOMAIN="$2"; INSTALL_DASHBOARD=true; shift 2 ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --with-dashboard    Install the optional Next.js web dashboard"
                echo "  --ssl-domain DOMAIN Get Let's Encrypt SSL certificate for domain (implies --with-dashboard)"
                echo "  --skip-model        Skip AI model download prompt"
                echo "  --yes, -y           Run in non-interactive mode with default settings"
                echo "  --model MODEL_NAME  Specify model to download (e.g., llama3.2:1b)"
                echo "  --language LANG     Specify language for AI responses (e.g., English)"
                echo "  --platform PLATFORM Specify webhook platform (e.g., discord)"
                echo "  --help, -h          Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"; echo "Use --help for usage information"; exit 1
                ;;
        esac
    done

    # Only prompt for dashboard if not already set by command line flags
    if [[ "$INSTALL_DASHBOARD" != "true" && "$AUTO_YES" != "true" ]]; then
        if [ -t 0 ]; then
            read -p "Install the Web Dashboard (requires Nginx)? [y/N]: " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                INSTALL_DASHBOARD=true
            fi
        else
            echo -e "${YELLOW}⚠️  No terminal detected. Skipping dashboard install prompt.${NC}"
            echo -e "${BLUE}💡 Use --with-dashboard flag to install dashboard in non-interactive mode.${NC}"
            INSTALL_DASHBOARD=false
        fi
    fi

    # Generate SSL certificates if dashboard is being installed
    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        # Before configuring Nginx
        DASHBOARD_CERT_DIR="$INSTALL_DIR/app/certs"
        mkdir -p "$DASHBOARD_CERT_DIR"
        if [[ ! -f "$DASHBOARD_CERT_DIR/nginx-selfsigned.crt" || ! -f "$DASHBOARD_CERT_DIR/nginx-selfsigned.key" ]]; then
            echo -e "${YELLOW}⚠️  No self-signed cert found. Generating one for demo use...${NC}"
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
              -keyout "$DASHBOARD_CERT_DIR/nginx-selfsigned.key" \
              -out "$DASHBOARD_CERT_DIR/nginx-selfsigned.crt" \
              -subj "/CN=localhost"
            echo -e "${GREEN}✅ Self-signed SSL cert generated at $DASHBOARD_CERT_DIR${NC}"
        fi
    fi

    detect_os
    install_nodejs
    install_fluentbit
    install_ollama
    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        install_nginx
        if [[ -n "$SSL_DOMAIN" ]]; then
            install_certbot
        fi
    fi
    setup_user
    setup_application
    setup_config "$CLI_LANGUAGE" "$CLI_PLATFORM"
    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        if [[ -n "$SSL_DOMAIN" ]]; then
            setup_letsencrypt "$SSL_DOMAIN"
        fi
        configure_nginx "$SSL_DOMAIN"
    fi
    configure_fluentbit
    create_services
    create_commands
    setup_model "$CLI_MODEL_NAME"

    echo -e "${GREEN}🎉 Robolog native installation completed successfully!${NC}"
    echo ""
    if [[ "$INSTALL_DASHBOARD" = true ]]; then
        echo -e "${BLUE}The Web Dashboard is installed! You can access it at:${NC}"
        echo -e "${YELLOW}https://<your-server-ip>${NC}"
        echo -e "${RED}(Note: It uses a self-signed SSL certificate, so your browser will show a warning. This is safe to accept for a demo.)${NC}"
        echo ""
    fi
    if [[ -n "$NGINX_POST_INSTALL_MESSAGE" ]]; then
        echo -e "$NGINX_POST_INSTALL_MESSAGE"
    fi
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Edit configuration: ${YELLOW}robolog config${NC}"
    echo -e "2. Add your Webhook URL to the .env file"
    echo -e "3. Start the service: ${YELLOW}robolog start${NC}"
    echo -e "4. Check status: ${YELLOW}robolog status${NC}"
    echo -e "5. Test with: ${YELLOW}robolog test-errors${NC}"
    echo ""
}

# Run main installation
main "$@"
