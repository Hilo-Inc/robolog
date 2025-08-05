#!/bin/bash

# 🔄 Robolog Dashboard Update Script
# Updates only the dashboard files without changing nginx or system configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/robolog"
USER="robolog"
SERVICE_NAME="robolog-dashboard"

echo -e "${BLUE}🔄 Robolog Dashboard Update${NC}"
echo -e "${BLUE}=============================${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Check if robolog user exists
if ! id "$USER" &>/dev/null; then
    echo -e "${RED}❌ Robolog user '$USER' not found. Please run the full installation first.${NC}"
    exit 1
fi

# Check if dashboard directory exists
if [[ ! -d "$INSTALL_DIR/app" ]]; then
    echo -e "${RED}❌ Dashboard directory not found at $INSTALL_DIR/app${NC}"
    echo -e "${RED}   Please run the full installation with --with-dashboard first.${NC}"
    exit 1
fi

# Check if dashboard service exists
if ! systemctl list-unit-files ${SERVICE_NAME}.service &>/dev/null; then
    echo -e "${RED}❌ Dashboard service not found. Please run the full installation with --with-dashboard first.${NC}"
    exit 1
fi

# Function to backup current dashboard
backup_current_dashboard() {
    echo -e "${YELLOW}📦 Creating backup of current dashboard...${NC}"
    local backup_dir="$INSTALL_DIR/app-backup-$(date +%Y%m%d-%H%M%S)"
    
    if [[ -d "$INSTALL_DIR/app" ]]; then
        cp -r "$INSTALL_DIR/app" "$backup_dir"
        echo -e "${GREEN}✅ Backup created at: $backup_dir${NC}"
        echo -e "${BLUE}💡 You can restore with: sudo rm -rf $INSTALL_DIR/app && sudo mv $backup_dir $INSTALL_DIR/app${NC}"
    fi
}

# Function to download and extract latest source
download_latest_source() {
    echo -e "${YELLOW}📥 Downloading latest Robolog source from GitHub...${NC}"
    
    local GITHUB_URL="https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz"
    local AUTH_HEADER=""
    if [[ -n "$GITHUB_TOKEN" ]]; then
        AUTH_HEADER="-H \"Authorization: Bearer $GITHUB_TOKEN\""
    fi

    local TMP_DIR="/tmp"
    local TARBALL="$TMP_DIR/robolog-main-dashboard-update.tar.gz"
    local EXTRACT_DIR="$TMP_DIR/robolog-main-dashboard-update"

    # Clean up any previous downloads
    rm -rf "$TARBALL" "$EXTRACT_DIR"

    if ! eval "curl -fsSL $AUTH_HEADER -o \"$TARBALL\" \"$GITHUB_URL\""; then
        echo -e "${RED}❌ Failed to download Robolog source from GitHub.${NC}"
        exit 1
    fi

    mkdir -p "$EXTRACT_DIR"
    if ! tar -xzf "$TARBALL" -C "$EXTRACT_DIR" --strip-components=1; then
        echo -e "${RED}❌ Failed to extract the downloaded tarball.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Latest source downloaded and extracted${NC}"
    echo "$EXTRACT_DIR"
}

# Function to stop dashboard service
stop_dashboard_service() {
    echo -e "${YELLOW}⏹️ Stopping dashboard service...${NC}"
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        systemctl stop ${SERVICE_NAME}
        echo -e "${GREEN}✅ Dashboard service stopped${NC}"
    else
        echo -e "${BLUE}ℹ️ Dashboard service was not running${NC}"
    fi
}

# Function to start dashboard service
start_dashboard_service() {
    echo -e "${YELLOW}▶️ Starting dashboard service...${NC}"
    systemctl start ${SERVICE_NAME}
    
    # Wait a moment and check if it started successfully
    sleep 2
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✅ Dashboard service started successfully${NC}"
    else
        echo -e "${RED}❌ Dashboard service failed to start${NC}"
        echo -e "${YELLOW}💡 Check logs with: journalctl -u ${SERVICE_NAME} -n 50${NC}"
        return 1
    fi
}

# Function to update dashboard files
update_dashboard_files() {
    local source_dir="$1"
    
    echo -e "${YELLOW}🔄 Updating dashboard files...${NC}"
    
    # Stop the dashboard service before updating
    stop_dashboard_service
    
    # Remove old app directory (backup was already created)
    rm -rf "$INSTALL_DIR/app"
    
    # Copy new dashboard files
    echo -e "${YELLOW}📁 Copying new dashboard files...${NC}"
    mkdir -p "$INSTALL_DIR/app"
    cp -r "$source_dir/app/." "$INSTALL_DIR/app/"
    
    # Set proper ownership
    chown -R "$USER:$USER" "$INSTALL_DIR/app"
    
    # Change to app directory for npm operations
    cd "$INSTALL_DIR/app"
    
    echo -e "${YELLOW}📦 Installing dashboard dependencies...${NC}"
    sudo -u "$USER" npm install
    
    echo -e "${YELLOW}🔨 Building the dashboard...${NC}"
    sudo -u "$USER" npm run build
    
    echo -e "${YELLOW}🧹 Cleaning up development packages...${NC}"
    sudo -u "$USER" npm prune --production
    
    echo -e "${GREEN}✅ Dashboard files updated successfully${NC}"
}

# Function to cleanup temporary files
cleanup_temp_files() {
    local extract_dir="$1"
    echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
    rm -rf "$(dirname "$extract_dir")/robolog-main-dashboard-update.tar.gz" "$extract_dir"
    echo -e "${GREEN}✅ Temporary files cleaned up${NC}"
}

# Function to show update status
show_update_status() {
    echo -e "${BLUE}📊 Update Status:${NC}"
    echo -e "${GREEN}✅ Dashboard files updated${NC}"
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo -e "${GREEN}✅ Dashboard built${NC}"
    
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✅ Dashboard service running${NC}"
    else
        echo -e "${RED}❌ Dashboard service not running${NC}"
    fi
    
    echo -e "${BLUE}💡 Service management commands:${NC}"
    echo -e "   Status: ${YELLOW}robolog status${NC}"
    echo -e "   Logs:   ${YELLOW}robolog logs dashboard${NC}"
    echo -e "   Restart:${YELLOW}robolog restart${NC}"
}

# Main update function
main() {
    local FORCE_UPDATE=false
    local SKIP_BACKUP=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                FORCE_UPDATE=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --force, -f        Force update without confirmation"
                echo "  --skip-backup      Skip creating backup of current dashboard"
                echo "  --help, -h         Show this help message"
                echo ""
                echo "Environment variables:"
                echo "  GITHUB_TOKEN       GitHub token for private repository access"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Confirmation prompt (unless force mode)
    if [[ "$FORCE_UPDATE" != "true" ]]; then
        echo -e "${YELLOW}⚠️ This will update the dashboard files and restart the dashboard service.${NC}"
        echo -e "${YELLOW}   Nginx configuration will NOT be changed.${NC}"
        echo ""
        read -p "Continue with dashboard update? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}ℹ️ Update cancelled.${NC}"
            exit 0
        fi
    fi
    
    # Create backup unless skipped
    if [[ "$SKIP_BACKUP" != "true" ]]; then
        backup_current_dashboard
    fi
    
    # Download latest source
    EXTRACT_DIR=$(download_latest_source)
    
    # Update dashboard files
    update_dashboard_files "$EXTRACT_DIR"
    
    # Start dashboard service
    start_dashboard_service
    
    # Cleanup
    cleanup_temp_files "$EXTRACT_DIR"
    
    # Show final status
    echo ""
    echo -e "${GREEN}🎉 Dashboard update completed successfully!${NC}"
    echo ""
    show_update_status
    
    # Check if nginx is running
    if systemctl is-active --quiet nginx; then
        echo ""
        echo -e "${GREEN}✅ Nginx is running - dashboard should be accessible${NC}"
        
        # Try to determine the dashboard URL
        local server_ip=""
        server_ip=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
        if [[ -n "$server_ip" ]]; then
            echo -e "${BLUE}🌐 Dashboard URL: ${YELLOW}https://$server_ip${NC}"
        else
            echo -e "${BLUE}🌐 Dashboard should be accessible at your server's IP address${NC}"
        fi
    else
        echo ""
        echo -e "${YELLOW}⚠️ Nginx is not running. Start it with: ${NC}sudo systemctl start nginx${NC}"
    fi
}

# Run main function
main "$@"