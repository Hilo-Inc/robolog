#!/bin/bash

# Enhanced Robolog Management Script
# This replaces the robolog command created in install-native.sh with extended update functionality

INSTALL_DIR="/opt/robolog"
SERVICE_NAME="robolog"
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if dashboard is installed
check_dashboard_installed() {
    [[ -d "$INSTALL_DIR/app" ]] && systemctl list-unit-files robolog-dashboard.service &>/dev/null
}

# Function to find update scripts
find_update_script() {
    local script_name="$1"
    
    # Check in the same directory as this script
    if [[ -f "$SCRIPT_DIR/$script_name" ]]; then
        echo "$SCRIPT_DIR/$script_name"
        return 0
    fi
    
    # Check in current directory
    if [[ -f "./$script_name" ]]; then
        echo "./$script_name"
        return 0
    fi
    
    # Check in common locations
    for dir in "/usr/local/share/robolog" "/opt/robolog" "/tmp"; do
        if [[ -f "$dir/$script_name" ]]; then
            echo "$dir/$script_name"
            return 0
        fi
    done
    
    return 1
}

# Root privilege check for certain commands
if [[ "$1" =~ ^(start|stop|restart|uninstall|update)$ && $EUID -ne 0 ]]; then
    echo -e "${RED}❌ Error: This command requires root privileges.${NC}"
    echo -e "Please run it again with sudo:\n${YELLOW}sudo robolog $1${NC}"
    exit 1
fi

case "$1" in
    start) 
        echo -e "${YELLOW}🚀 Starting Robolog services...${NC}"
        systemctl start $SERVICE_NAME 
        echo -e "${GREEN}✅ Robolog services started${NC}"
        ;;
    stop) 
        echo -e "${YELLOW}⏹️ Stopping Robolog services...${NC}"
        systemctl stop $SERVICE_NAME 
        echo -e "${GREEN}✅ Robolog services stopped${NC}"
        ;;
    restart) 
        echo -e "${YELLOW}🔄 Restarting Robolog services...${NC}"
        systemctl restart $SERVICE_NAME 
        echo -e "${GREEN}✅ Robolog services restarted${NC}"
        ;;
    status)
        echo -e "${BLUE}📊 Robolog Status:${NC}"
        echo ""
        echo -e "${YELLOW}Core Services:${NC}"
        systemctl status robolog-analyzer --no-pager -l
        echo ""
        systemctl status fluent-bit --no-pager -l
        echo ""
        systemctl status ollama --no-pager -l
        echo ""
        
        # Check if dashboard service exists and show its status
        if check_dashboard_installed; then
            echo -e "${YELLOW}Dashboard Services:${NC}"
            systemctl status robolog-dashboard --no-pager -l
            echo ""
            systemctl status nginx --no-pager -l
            echo ""
        fi
        ;;
    logs)
        case "$2" in
            "analyzer") 
                echo -e "${BLUE}📋 Analyzer Logs:${NC}"
                journalctl -u robolog-analyzer -f 
                ;;
            "dashboard") 
                if check_dashboard_installed; then
                    echo -e "${BLUE}📋 Dashboard Logs:${NC}"
                    journalctl -u robolog-dashboard -f 
                else
                    echo -e "${YELLOW}⚠️ Dashboard not installed${NC}"
                fi
                ;;
            "fluent-bit") 
                echo -e "${BLUE}📋 Fluent Bit Logs:${NC}"
                journalctl -u fluent-bit -f 
                ;;
            "ollama") 
                echo -e "${BLUE}📋 Ollama Logs:${NC}"
                journalctl -u ollama -f 
                ;;
            "nginx") 
                echo -e "${BLUE}📋 Nginx Logs:${NC}"
                journalctl -u nginx -f 
                ;;
            *) 
                echo -e "${BLUE}📋 All Service Logs:${NC}"
                # Include dashboard logs if the service exists
                if check_dashboard_installed; then
                    journalctl -u robolog-analyzer -u robolog-dashboard -u fluent-bit -u ollama -u nginx -f
                else
                    journalctl -u robolog-analyzer -u fluent-bit -u ollama -f
                fi
                ;;
        esac
        ;;
    test-errors)
        echo -e "${BLUE}🧪 Generating test errors...${NC}"
        logger -t nginx "ERROR Test nginx error: $(date)"
        logger -t system "CRITICAL Test system error: $(date)"
        logger -t app "WARNING Test application error: $(date)"
        echo -e "${GREEN}✅ Test errors generated. Check your webhook in ~60 seconds.${NC}"
        ;;
    config)
        echo -e "${BLUE}📝 Opening configuration file...${NC}"
        ${EDITOR:-nano} $INSTALL_DIR/.env
        ;;
    model)
        case "$2" in
            "pull") 
                echo -e "${BLUE}📥 Pulling model: ${3:-gemma3n:e2b}${NC}"
                sudo -u ollama ollama pull ${3:-gemma3n:e2b} 
                ;;
            "list") 
                echo -e "${BLUE}📋 Available models:${NC}"
                sudo -u ollama ollama list 
                ;;
            *) 
                echo "Usage: robolog model {pull|list} [model_name]" 
                echo "Examples:"
                echo "  robolog model pull gemma3n:e2b"
                echo "  robolog model pull llama3.2:1b"
                echo "  robolog model list"
                ;;
        esac
        ;;
    ssl)
        case "$2" in
            "renew") 
                echo -e "${BLUE}🔄 Renewing SSL certificates...${NC}"
                certbot renew --nginx
                systemctl reload nginx
                echo -e "${GREEN}✅ SSL certificates renewed${NC}"
                ;;
            "status")
                echo -e "${BLUE}📋 SSL Certificate Status:${NC}"
                certbot certificates
                ;;
            "setup")
                if [[ -z "$3" ]]; then
                    echo "Usage: robolog ssl setup <domain>"
                    exit 1
                fi
                echo -e "${BLUE}🔒 Setting up SSL certificate for $3...${NC}"
                certbot --nginx -d "$3"
                echo -e "${GREEN}✅ SSL certificate setup completed${NC}"
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
        case "$2" in
            "analyzer")
                echo -e "${BLUE}🔄 Updating Analyzer...${NC}"
                update_script=$(find_update_script "update-analyzer.sh")
                if [[ $? -eq 0 ]]; then
                    bash "$update_script" "${@:3}"
                else
                    echo -e "${YELLOW}⚠️ Analyzer update script not found, using fallback method...${NC}"
                    # Fallback to original update logic for analyzer only
                    cd /tmp
                    curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
                    systemctl stop robolog-analyzer
                    cp robolog-main/analyzer/analyzer.js $INSTALL_DIR/
                    cp robolog-main/analyzer/package.json $INSTALL_DIR/
                    cd $INSTALL_DIR
                    sudo -u robolog npm install --production
                    systemctl start robolog-analyzer
                    rm -rf /tmp/robolog-main
                    echo -e "${GREEN}✅ Analyzer update completed${NC}"
                fi
                ;;
            "dashboard")
                if check_dashboard_installed; then
                    echo -e "${BLUE}🔄 Updating Dashboard...${NC}"
                    update_script=$(find_update_script "update-dashboard.sh")
                    if [[ $? -eq 0 ]]; then
                        bash "$update_script" "${@:3}"
                    else
                        echo -e "${RED}❌ Dashboard update script not found${NC}"
                        echo -e "${YELLOW}💡 Please ensure update-dashboard.sh is available${NC}"
                        exit 1
                    fi
                else
                    echo -e "${YELLOW}⚠️ Dashboard not installed. Use 'robolog update analyzer' or reinstall with --with-dashboard${NC}"
                fi
                ;;
            "all")
                echo -e "${BLUE}🔄 Updating All Components...${NC}"
                update_script=$(find_update_script "update-all.sh")
                if [[ $? -eq 0 ]]; then
                    bash "$update_script" "${@:3}"
                else
                    echo -e "${YELLOW}⚠️ Full update script not found, performing individual updates...${NC}"
                    
                    # Update analyzer
                    echo -e "${YELLOW}📊 Updating analyzer...${NC}"
                    cd /tmp
                    curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
                    systemctl stop robolog-analyzer
                    cp robolog-main/analyzer/analyzer.js $INSTALL_DIR/
                    cp robolog-main/analyzer/package.json $INSTALL_DIR/
                    cd $INSTALL_DIR
                    sudo -u robolog npm install --production
                    systemctl start robolog-analyzer
                    
                    # Update dashboard if installed
                    if check_dashboard_installed; then
                        echo -e "${YELLOW}🖥️ Updating dashboard...${NC}"
                        dashboard_script=$(find_update_script "update-dashboard.sh")
                        if [[ $? -eq 0 ]]; then
                            bash "$dashboard_script" --force --skip-backup
                        else
                            echo -e "${YELLOW}⚠️ Dashboard update script not found, skipping dashboard update${NC}"
                        fi
                    fi
                    
                    rm -rf /tmp/robolog-main
                    echo -e "${GREEN}✅ Updates completed${NC}"
                fi
                ;;
            *)
                # Original update behavior (analyzer only) for backward compatibility
                echo -e "${BLUE}🔄 Updating Robolog (Analyzer)...${NC}"
                cd /tmp
                curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
                systemctl stop robolog-analyzer
                cp robolog-main/analyzer/analyzer.js $INSTALL_DIR/
                cp robolog-main/analyzer/package.json $INSTALL_DIR/
                cd $INSTALL_DIR
                sudo -u robolog npm install --production
                systemctl start robolog-analyzer
                rm -rf /tmp/robolog-main
                echo -e "${GREEN}✅ Update completed${NC}"
                ;;
        esac
        ;;
    uninstall)
        echo -e "${BLUE}🗑️ Uninstalling Robolog...${NC}"
        systemctl stop robolog robolog-analyzer fluent-bit
        systemctl disable robolog robolog-analyzer fluent-bit
        if check_dashboard_installed; then
            systemctl stop robolog-dashboard nginx
            systemctl disable robolog-dashboard
        fi
        rm -f /etc/systemd/system/robolog*.service
        rm -f /usr/local/bin/robolog
        rm -rf $INSTALL_DIR
        userdel robolog 2>/dev/null || true
        echo -e "${GREEN}✅ Robolog uninstalled (Ollama and Fluent Bit left installed)${NC}"
        echo -e "${BLUE}💡 To remove Ollama: curl -fsSL https://ollama.ai/install.sh | sh -s -- --uninstall${NC}"
        ;;
    *)
        echo -e "${BLUE}Robolog Management Tool${NC}"
        echo ""
        echo -e "${YELLOW}Usage: robolog {start|stop|restart|status|logs|test-errors|config|model|ssl|update|uninstall}${NC}"
        echo ""
        echo -e "${GREEN}Service Management:${NC}"
        echo "  robolog start                 - Start all services"
        echo "  robolog stop                  - Stop all services"
        echo "  robolog restart               - Restart all services"
        echo "  robolog status                - Show service status"
        echo ""
        echo -e "${GREEN}Log Management:${NC}"
        echo "  robolog logs                  - View all service logs"
        echo "  robolog logs analyzer         - View analyzer logs only"
        echo "  robolog logs dashboard        - View dashboard logs only (if installed)"
        echo "  robolog logs fluent-bit       - View Fluent Bit logs only"
        echo "  robolog logs nginx            - View Nginx logs only"
        echo "  robolog logs ollama           - View Ollama logs only"
        echo ""
        echo -e "${GREEN}Update Management:${NC}"
        echo "  robolog update                - Update analyzer (backward compatibility)"
        echo "  robolog update analyzer       - Update only the analyzer component"
        echo "  robolog update dashboard      - Update only the dashboard component"
        echo "  robolog update all            - Update all components and system packages"
        echo ""
        echo -e "${GREEN}Model Management:${NC}"
        echo "  robolog model pull [name]     - Download AI model (default: gemma3n:e2b)"
        echo "  robolog model list            - List available models"
        echo ""
        echo -e "${GREEN}SSL Management:${NC}"
        echo "  robolog ssl renew             - Renew all SSL certificates"
        echo "  robolog ssl status            - Show certificate information"
        echo "  robolog ssl setup DOMAIN      - Setup certificate for new domain"
        echo ""
        echo -e "${GREEN}Other:${NC}"
        echo "  robolog test-errors           - Generate test errors for webhook testing"
        echo "  robolog config                - Edit configuration file"
        echo "  robolog uninstall             - Remove Robolog completely"
        echo ""
        echo -e "${BLUE}Examples:${NC}"
        echo "  sudo robolog start"
        echo "  robolog logs analyzer"
        echo "  sudo robolog update all"
        echo "  sudo robolog model pull llama3.2:1b"
        echo "  robolog test-errors"
        exit 1
        ;;
esac