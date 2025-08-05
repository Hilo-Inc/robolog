#!/bin/bash

# 🔄 Robolog Full System Update Script
# Updates all components: analyzer, dashboard (if installed), and system dependencies

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
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

echo -e "${BLUE}🔄 Robolog Full System Update${NC}"
echo -e "${BLUE}==============================${NC}"

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

# Check if robolog is installed
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo -e "${RED}❌ Robolog directory not found at $INSTALL_DIR${NC}"
    echo -e "${RED}   Please run the full installation first.${NC}"
    exit 1
fi

# Function to check if dashboard is installed
check_dashboard_installed() {
    [[ -d "$INSTALL_DIR/app" ]] && systemctl list-unit-files robolog-dashboard.service &>/dev/null
}

# Function to update system packages
update_system_packages() {
    echo -e "${YELLOW}📦 Updating system packages...${NC}"
    
    # Detect OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        DISTRO=$ID
    else
        echo -e "${YELLOW}⚠️ Cannot detect OS. Skipping system package updates.${NC}"
        return
    fi
    
    case $DISTRO in
        "ubuntu"|"debian")
            apt-get update && apt-get upgrade -y nodejs npm nginx
            ;;
        "centos"|"rhel"|"fedora")
            yum update -y nodejs npm nginx
            ;;
        "arch")
            pacman -Syu --noconfirm nodejs npm nginx
            ;;
        *)
            echo -e "${YELLOW}⚠️ Unsupported distribution for package updates: $DISTRO${NC}"
            ;;
    esac
    
    echo -e "${GREEN}✅ System packages updated${NC}"
}

# Function to update Ollama
update_ollama() {
    echo -e "${YELLOW}🤖 Updating Ollama...${NC}"
    
    # Download and run the latest Ollama installer
    if curl -fsSL https://ollama.ai/install.sh | sh; then
        echo -e "${GREEN}✅ Ollama updated${NC}"
        
        # Restart Ollama service
        systemctl restart ollama
        echo -e "${GREEN}✅ Ollama service restarted${NC}"
    else
        echo -e "${YELLOW}⚠️ Failed to update Ollama, continuing with other updates...${NC}"
    fi
}

# Function to update Fluent Bit
update_fluentbit() {
    echo -e "${YELLOW}📊 Updating Fluent Bit...${NC}"
    
    # Detect OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        DISTRO=$ID
    else
        echo -e "${YELLOW}⚠️ Cannot detect OS. Skipping Fluent Bit update.${NC}"
        return
    fi
    
    case $DISTRO in
        "ubuntu"|"debian"|"centos"|"rhel"|"fedora")
            # Re-run the Fluent Bit installer
            if curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh; then
                echo -e "${GREEN}✅ Fluent Bit updated${NC}"
                systemctl restart fluent-bit
                echo -e "${GREEN}✅ Fluent Bit service restarted${NC}"
            else
                echo -e "${YELLOW}⚠️ Failed to update Fluent Bit, continuing with other updates...${NC}"
            fi
            ;;
        "arch")
            if pacman -Syu --noconfirm fluent-bit; then
                echo -e "${GREEN}✅ Fluent Bit updated${NC}"
                systemctl restart fluent-bit
                echo -e "${GREEN}✅ Fluent Bit service restarted${NC}"
            else
                echo -e "${YELLOW}⚠️ Failed to update Fluent Bit, continuing with other updates...${NC}"
            fi
            ;;
        *)
            echo -e "${YELLOW}⚠️ Unsupported distribution for Fluent Bit update: $DISTRO${NC}"
            ;;
    esac
}

# Function to run component updates
run_component_updates() {
    local update_analyzer="$1"
    local update_dashboard="$2"
    local force_flag="$3"
    
    echo -e "${BLUE}🔄 Updating Robolog components...${NC}"
    
    # Update analyzer
    if [[ "$update_analyzer" == "true" ]]; then
        echo -e "${YELLOW}📊 Updating analyzer...${NC}"
        if [[ -f "$SCRIPT_DIR/update-analyzer.sh" ]]; then
            bash "$SCRIPT_DIR/update-analyzer.sh" $force_flag --skip-backup
        elif [[ -f "./update-analyzer.sh" ]]; then
            bash "./update-analyzer.sh" $force_flag --skip-backup
        else
            echo -e "${YELLOW}⚠️ Analyzer update script not found, using fallback method...${NC}"
            # Fallback to inline analyzer update with git pull support
            update_source_fallback() {
                local SOURCE_DIR=""
                local current_dir="$(pwd)"
                local robolog_dirs=("/opt/robolog" "$current_dir" "$(dirname "$current_dir")" "$HOME/robolog" "/home/*/robolog")
                
                for dir in "${robolog_dirs[@]}"; do
                    if [[ "$dir" == *"*"* ]]; then
                        for expanded_dir in $dir; do
                            if [[ -d "$expanded_dir/.git" ]]; then
                                SOURCE_DIR="$expanded_dir"
                                break 2
                            fi
                        done
                    elif [[ -d "$dir/.git" ]]; then
                        SOURCE_DIR="$dir"
                        break
                    fi
                done
                
                if [[ -n "$SOURCE_DIR" ]]; then
                    echo -e "${BLUE}📁 Found git repository at: $SOURCE_DIR${NC}" >&2
                    cd "$SOURCE_DIR" || exit 1
                    if git rev-parse --git-dir > /dev/null 2>&1; then
                        local git_output
                        if git_output=$(git pull origin main 2>&1) || git_output=$(git pull origin master 2>&1); then
                            echo -e "${GREEN}✅ Git repository updated${NC}" >&2
                            echo "$SOURCE_DIR"
                            return 0
                        fi
                    fi
                fi
                
                # Download fallback
                cd /tmp
                curl -fsSL https://github.com/Hilo-Inc/robolog/archive/refs/heads/main.tar.gz | tar -xz
                echo "/tmp/robolog-main"
            }
            
            source_dir=$(update_source_fallback)
            systemctl stop robolog-analyzer
            cp "$source_dir/analyzer/analyzer.js" "$INSTALL_DIR/"
            cp "$source_dir/analyzer/package.json" "$INSTALL_DIR/"
            cd "$INSTALL_DIR"
            sudo -u "$USER" npm install --production
            systemctl start robolog-analyzer
            
            # Clean up only if we downloaded
            if [[ "$source_dir" == "/tmp/"* ]]; then
                rm -rf /tmp/robolog-main
            fi
        fi
        echo -e "${GREEN}✅ Analyzer updated${NC}"
    fi
    
    # Update dashboard if installed
    if [[ "$update_dashboard" == "true" ]] && check_dashboard_installed; then
        echo -e "${YELLOW}🖥️ Updating dashboard...${NC}"
        if [[ -f "$SCRIPT_DIR/update-dashboard.sh" ]]; then
            bash "$SCRIPT_DIR/update-dashboard.sh" $force_flag --skip-backup
        elif [[ -f "./update-dashboard.sh" ]]; then
            bash "./update-dashboard.sh" $force_flag --skip-backup
        else
            echo -e "${YELLOW}⚠️ Dashboard update script not found, skipping dashboard update...${NC}"
        fi
        echo -e "${GREEN}✅ Dashboard updated${NC}"
    elif [[ "$update_dashboard" == "true" ]]; then
        echo -e "${BLUE}ℹ️ Dashboard not installed, skipping dashboard update${NC}"
    fi
}

# Function to create full system backup
create_full_backup() {
    echo -e "${YELLOW}📦 Creating full system backup...${NC}"
    local backup_dir="$INSTALL_DIR/full-backup-$(date +%Y%m%d-%H%M%S)"
    
    mkdir -p "$backup_dir"
    
    # Backup analyzer
    if [[ -f "$INSTALL_DIR/analyzer.js" ]]; then
        cp "$INSTALL_DIR/analyzer.js" "$backup_dir/"
        cp "$INSTALL_DIR/package.json" "$backup_dir/"
    fi
    
    # Backup dashboard if installed
    if check_dashboard_installed; then
        cp -r "$INSTALL_DIR/app" "$backup_dir/"
    fi
    
    # Backup configuration
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        cp "$INSTALL_DIR/.env" "$backup_dir/"
    fi
    
    echo -e "${GREEN}✅ Full backup created at: $backup_dir${NC}"
    echo -e "${BLUE}💡 You can restore with: sudo cp -r $backup_dir/* $INSTALL_DIR/${NC}"
}

# Function to show final status
show_final_status() {
    echo -e "${BLUE}📊 Final System Status:${NC}"
    
    # Check analyzer
    if systemctl is-active --quiet robolog-analyzer; then
        echo -e "${GREEN}✅ Analyzer service running${NC}"
    else
        echo -e "${RED}❌ Analyzer service not running${NC}"
    fi
    
    # Check dashboard if installed
    if check_dashboard_installed; then
        if systemctl is-active --quiet robolog-dashboard; then
            echo -e "${GREEN}✅ Dashboard service running${NC}"
        else
            echo -e "${RED}❌ Dashboard service not running${NC}"
        fi
        
        if systemctl is-active --quiet nginx; then
            echo -e "${GREEN}✅ Nginx service running${NC}"
        else
            echo -e "${RED}❌ Nginx service not running${NC}"
        fi
    fi
    
    # Check supporting services
    if systemctl is-active --quiet fluent-bit; then
        echo -e "${GREEN}✅ Fluent Bit service running${NC}"
    else
        echo -e "${RED}❌ Fluent Bit service not running${NC}"
    fi
    
    if systemctl is-active --quiet ollama; then
        echo -e "${GREEN}✅ Ollama service running${NC}"
    else
        echo -e "${RED}❌ Ollama service not running${NC}"
    fi
    
    echo -e "${BLUE}💡 Service management commands:${NC}"
    echo -e "   Status: ${YELLOW}robolog status${NC}"
    echo -e "   Logs:   ${YELLOW}robolog logs${NC}"
    echo -e "   Restart:${YELLOW}robolog restart${NC}"
}

# Main update function
main() {
    local FORCE_UPDATE=false
    local SKIP_BACKUP=false
    local SKIP_SYSTEM=false
    local ANALYZER_ONLY=false
    local DASHBOARD_ONLY=false
    
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
            --skip-system)
                SKIP_SYSTEM=true
                shift
                ;;
            --analyzer-only)
                ANALYZER_ONLY=true
                shift
                ;;
            --dashboard-only)
                DASHBOARD_ONLY=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --force, -f          Force update without confirmation"
                echo "  --skip-backup        Skip creating backup"
                echo "  --skip-system        Skip system package updates"
                echo "  --analyzer-only      Update only analyzer component"
                echo "  --dashboard-only     Update only dashboard component"
                echo "  --help, -h           Show this help message"
                echo ""
                echo "Update methods (automatic detection):"
                echo "  1. Git pull          If robolog git repository is found locally"
                echo "  2. Download          Fallback to downloading latest from GitHub"
                echo "  3. Individual scripts Uses update-analyzer.sh and update-dashboard.sh"
                echo ""
                echo "The script searches for git repositories and individual update scripts"
                echo "to provide the most efficient update method for your installation."
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Set component update flags
    local update_analyzer=true
    local update_dashboard=true
    
    if [[ "$ANALYZER_ONLY" == "true" ]]; then
        update_dashboard=false
    elif [[ "$DASHBOARD_ONLY" == "true" ]]; then
        update_analyzer=false
    fi
    
    # Confirmation prompt (unless force mode)
    if [[ "$FORCE_UPDATE" != "true" ]]; then
        echo -e "${YELLOW}⚠️ This will perform a full system update including:${NC}"
        if [[ "$SKIP_SYSTEM" != "true" ]]; then
            echo -e "${YELLOW}   • System packages (Node.js, npm, nginx)${NC}"
            echo -e "${YELLOW}   • Ollama AI engine${NC}"
            echo -e "${YELLOW}   • Fluent Bit log processor${NC}"
        fi
        if [[ "$update_analyzer" == "true" ]]; then
            echo -e "${YELLOW}   • Robolog analyzer service${NC}"
        fi
        if [[ "$update_dashboard" == "true" ]] && check_dashboard_installed; then
            echo -e "${YELLOW}   • Robolog dashboard service${NC}"
        fi
        echo ""
        read -p "Continue with full system update? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}ℹ️ Update cancelled.${NC}"
            exit 0
        fi
    fi
    
    # Create full backup unless skipped
    if [[ "$SKIP_BACKUP" != "true" ]]; then
        create_full_backup
    fi
    
    # Update system components unless skipped
    if [[ "$SKIP_SYSTEM" != "true" ]]; then
        update_system_packages
        update_ollama
        update_fluentbit
    fi
    
    # Force flag for component updates
    local force_flag=""
    if [[ "$FORCE_UPDATE" == "true" ]]; then
        force_flag="--force"
    fi
    
    # Update Robolog components
    run_component_updates "$update_analyzer" "$update_dashboard" "$force_flag"
    
    # Show final status
    echo ""
    echo -e "${GREEN}🎉 Full system update completed successfully!${NC}"
    echo ""
    show_final_status
    
    # Show dashboard URL if available
    if check_dashboard_installed && systemctl is-active --quiet nginx; then
        echo ""
        local server_ip=""
        server_ip=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
        if [[ -n "$server_ip" ]]; then
            echo -e "${GREEN}✅ Dashboard accessible at: ${YELLOW}https://$server_ip${NC}"
        else
            echo -e "${GREEN}✅ Dashboard should be accessible at your server's IP address${NC}"
        fi
    fi
}

# Run main function
main "$@"