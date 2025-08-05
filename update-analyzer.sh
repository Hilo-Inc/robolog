#!/bin/bash

# 🔄 Robolog Analyzer Update Script
# Updates only the analyzer service without changing other components

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
SERVICE_NAME="robolog-analyzer"

echo -e "${BLUE}🔄 Robolog Analyzer Update${NC}"
echo -e "${BLUE}============================${NC}"

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

# Check if analyzer directory exists
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo -e "${RED}❌ Analyzer directory not found at $INSTALL_DIR${NC}"
    echo -e "${RED}   Please run the full installation first.${NC}"
    exit 1
fi

# Check if analyzer service exists
if ! systemctl list-unit-files ${SERVICE_NAME}.service &>/dev/null; then
    echo -e "${RED}❌ Analyzer service not found. Please run the full installation first.${NC}"
    exit 1
fi

# Function to backup current analyzer
backup_current_analyzer() {
    echo -e "${YELLOW}📦 Creating backup of current analyzer...${NC}"
    local backup_dir="$INSTALL_DIR/analyzer-backup-$(date +%Y%m%d-%H%M%S)"
    
    if [[ -f "$INSTALL_DIR/analyzer.js" ]]; then
        mkdir -p "$backup_dir"
        cp "$INSTALL_DIR/analyzer.js" "$backup_dir/"
        cp "$INSTALL_DIR/package.json" "$backup_dir/"
        if [[ -d "$INSTALL_DIR/node_modules" ]]; then
            echo -e "${BLUE}ℹ️ Backing up node_modules (this may take a moment)...${NC}"
            cp -r "$INSTALL_DIR/node_modules" "$backup_dir/"
        fi
        echo -e "${GREEN}✅ Backup created at: $backup_dir${NC}"
        echo -e "${BLUE}💡 You can restore with: sudo cp $backup_dir/analyzer.js $INSTALL_DIR/ && sudo cp $backup_dir/package.json $INSTALL_DIR/${NC}"
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
    local TARBALL="$TMP_DIR/robolog-main-analyzer-update.tar.gz"
    local EXTRACT_DIR="$TMP_DIR/robolog-main-analyzer-update"

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

# Function to stop analyzer service
stop_analyzer_service() {
    echo -e "${YELLOW}⏹️ Stopping analyzer service...${NC}"
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        systemctl stop ${SERVICE_NAME}
        echo -e "${GREEN}✅ Analyzer service stopped${NC}"
    else
        echo -e "${BLUE}ℹ️ Analyzer service was not running${NC}"
    fi
}

# Function to start analyzer service
start_analyzer_service() {
    echo -e "${YELLOW}▶️ Starting analyzer service...${NC}"
    systemctl start ${SERVICE_NAME}
    
    # Wait a moment and check if it started successfully
    sleep 3
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✅ Analyzer service started successfully${NC}"
    else
        echo -e "${RED}❌ Analyzer service failed to start${NC}"
        echo -e "${YELLOW}💡 Check logs with: journalctl -u ${SERVICE_NAME} -n 50${NC}"
        return 1
    fi
}

# Function to update analyzer files
update_analyzer_files() {
    local source_dir="$1"
    
    echo -e "${YELLOW}🔄 Updating analyzer files...${NC}"
    
    # Stop the analyzer service before updating
    stop_analyzer_service
    
    # Copy new analyzer files
    echo -e "${YELLOW}📁 Copying new analyzer files...${NC}"
    cp "$source_dir/analyzer/analyzer.js" "$INSTALL_DIR/"
    cp "$source_dir/analyzer/package.json" "$INSTALL_DIR/"
    
    # Set proper ownership
    chown "$USER:$USER" "$INSTALL_DIR/analyzer.js" "$INSTALL_DIR/package.json"
    
    # Change to install directory for npm operations
    cd "$INSTALL_DIR"
    
    echo -e "${YELLOW}📦 Installing analyzer dependencies...${NC}"
    sudo -u "$USER" npm install --production
    
    echo -e "${GREEN}✅ Analyzer files updated successfully${NC}"
}

# Function to cleanup temporary files
cleanup_temp_files() {
    local extract_dir="$1"
    echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
    rm -rf "$(dirname "$extract_dir")/robolog-main-analyzer-update.tar.gz" "$extract_dir"
    echo -e "${GREEN}✅ Temporary files cleaned up${NC}"
}

# Function to show update status
show_update_status() {
    echo -e "${BLUE}📊 Update Status:${NC}"
    echo -e "${GREEN}✅ Analyzer files updated${NC}"
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✅ Analyzer service running${NC}"
    else
        echo -e "${RED}❌ Analyzer service not running${NC}"
    fi
    
    echo -e "${BLUE}💡 Service management commands:${NC}"
    echo -e "   Status: ${YELLOW}robolog status${NC}"
    echo -e "   Logs:   ${YELLOW}robolog logs analyzer${NC}"
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
                echo "  --skip-backup      Skip creating backup of current analyzer"
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
        echo -e "${YELLOW}⚠️ This will update the analyzer files and restart the analyzer service.${NC}"
        echo -e "${YELLOW}   Dashboard and nginx configuration will NOT be changed.${NC}"
        echo ""
        read -p "Continue with analyzer update? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}ℹ️ Update cancelled.${NC}"
            exit 0
        fi
    fi
    
    # Create backup unless skipped
    if [[ "$SKIP_BACKUP" != "true" ]]; then
        backup_current_analyzer
    fi
    
    # Download latest source
    EXTRACT_DIR=$(download_latest_source)
    
    # Update analyzer files
    update_analyzer_files "$EXTRACT_DIR"
    
    # Start analyzer service
    start_analyzer_service
    
    # Cleanup
    cleanup_temp_files "$EXTRACT_DIR"
    
    # Show final status
    echo ""
    echo -e "${GREEN}🎉 Analyzer update completed successfully!${NC}"
    echo ""
    show_update_status
}

# Run main function
main "$@"