#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Laravel Service Manager
# Unified script for managing Laravel services using poly app deployment method
# This script is used by Unified App Manager and installation scripts (131-134)
#
# IMPORTANT NOTES:
# - Laravel in this project has ONLY ONE instance: laravel_main
# - Laravel uses FIXED port 9000 (not auto-incremented like other apps)
# - Service name: octane-poly-9000
# - Port range for other poly apps: 9000-9999 (but laravel_main is fixed at 9000)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LARAVEL_MAIN_PATH="$ROOT_DIR/poly_apps/laravel_main"

# Detect sudo command (use existing USE_SUDO if available from gvar_common.sh, otherwise detect)
if [ -z "${USE_SUDO:-}" ]; then
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to ensure agent command is available
ensure_agent_command() {
    if command -v agent >/dev/null 2>&1; then
        local agent_path=$(command -v agent)
        echo -e "${GREEN}[AGENT] Agent command found: $agent_path${NC}" >&2
        echo "$agent_path"
        return 0
    fi

    echo -e "${YELLOW}[AGENT] Agent command not found, installing...${NC}" >&2

    # Ensure curl is installed
    if ! command -v curl >/dev/null 2>&1; then
        echo -e "${BLUE}[AGENT] Installing curl...${NC}" >&2
        $USE_SUDO apt-get update -qq >/dev/null 2>&1
        $USE_SUDO apt-get install -y curl >/dev/null 2>&1
    fi

    # Install agent using official installer
    echo -e "${BLUE}[AGENT] Running Cursor Agent installer...${NC}" >&2
    if curl https://cursor.com/install -fsS | bash >/dev/null 2>&1; then
        echo -e "${GREEN}[AGENT] Agent installed successfully${NC}" >&2
    else
        echo -e "${RED}[AGENT] Agent installation failed${NC}" >&2
        return 1
    fi

    # Ensure ~/.local/bin is in PATH for root user
    local agent_bin_dir="$HOME/.local/bin"
    if [[ "$USER" == "root" ]] && [[ -d "$agent_bin_dir" ]]; then
        if ! echo "$PATH" | grep -q "$agent_bin_dir"; then
            export PATH="$agent_bin_dir:$PATH"
            # Also add to /etc/environment for persistence
            if ! grep -q "PATH.*$agent_bin_dir" /etc/environment 2>/dev/null; then
                $USE_SUDO sed -i '/^PATH=/d' /etc/environment 2>/dev/null || true
                local current_path=$(grep "^PATH=" /etc/environment 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "/usr/local/bin:/usr/bin:/bin")
                echo "PATH=\"$agent_bin_dir:$current_path\"" | $USE_SUDO tee -a /etc/environment >/dev/null
            fi
        fi
    fi

    # Refresh environment variables
    set -a
    source /etc/environment 2>/dev/null || true
    set +a

    # Verify agent is now available
    if command -v agent >/dev/null 2>&1; then
        local agent_path=$(command -v agent)
        echo -e "${GREEN}[AGENT] Agent command available: $agent_path${NC}" >&2
        echo "$agent_path"
        return 0
    else
        # Try to find agent in common locations
        local possible_paths=(
            "$HOME/.local/bin/agent"
            "/root/.local/bin/agent"
            "/usr/local/bin/agent"
        )
        for path in "${possible_paths[@]}"; do
            if [[ -f "$path" ]] && [[ -x "$path" ]]; then
                echo -e "${GREEN}[AGENT] Agent found at: $path${NC}" >&2
                echo "$path"
                return 0
            fi
        done

        echo -e "${RED}[AGENT] Agent installation completed but command not found in PATH${NC}" >&2
        return 1
    fi
}

# Function to check if Laravel main exists
check_laravel_main() {
    if [[ ! -d "$LARAVEL_MAIN_PATH" ]]; then
        echo -e "${RED}Error: laravel_main not found at: $LARAVEL_MAIN_PATH${NC}" >&2
        return 1
    fi
    
    if [[ ! -f "$LARAVEL_MAIN_PATH/artisan" ]]; then
        echo -e "${RED}Error: Laravel artisan not found in $LARAVEL_MAIN_PATH${NC}" >&2
        return 1
    fi
    
    return 0
}

# Function to install Laravel service (without domain binding)
# Uses: php artisan servermanager:poly_apps laravel_main
# NOTE: Laravel uses FIXED port 9000 (not auto-incremented)
install_laravel_service() {
    local app_name="${1:-laravel_main}"
    
    echo -e "${BLUE}[LARAVEL SERVICE] Installing Laravel service (poly app method)${NC}" >&2
    echo -e "${BLUE}[LARAVEL SERVICE] App: laravel_main (ONLY ONE Laravel instance in this project)${NC}" >&2
    echo -e "${BLUE}[LARAVEL SERVICE] Port: 9000 (FIXED, not auto-incremented)${NC}" >&2
    
    if ! check_laravel_main; then
        return 1
    fi
    
    local saved_dir="$(pwd)"
    cd "$LARAVEL_MAIN_PATH" || return 1
    
    echo -e "${BLUE}[LARAVEL SERVICE] Configuring Laravel service (service only, no domain binding)...${NC}" >&2
    echo -e "${YELLOW}[CMD]${NC} $USE_SUDO php artisan servermanager:poly_apps $app_name" >&2
    
    if $USE_SUDO php artisan servermanager:poly_apps "$app_name" 2>&1; then
        echo -e "${GREEN}[LARAVEL SERVICE] Service installed successfully${NC}" >&2
        echo -e "${GREEN}[LARAVEL SERVICE] Service name: octane-poly-9000${NC}" >&2
        cd "$saved_dir" || true
        return 0
    else
        echo -e "${RED}[LARAVEL SERVICE] Service installation failed${NC}" >&2
        cd "$saved_dir" || true
        return 1
    fi
}

# Function to add Laravel website with domain (poly type, swoole mode)
# Uses: php artisan servermanager:website add domain --type=poly --php-mode=swoole --ssl=auto
add_laravel_website() {
    local domain="$1"
    local ssl_mode="${2:-auto}"
    
    if [[ -z "$domain" ]]; then
        echo -e "${RED}Error: Domain is required${NC}" >&2
        return 1
    fi
    
    echo -e "${BLUE}[LARAVEL WEBSITE] Adding Laravel website: $domain${NC}" >&2
    echo -e "${BLUE}[LARAVEL WEBSITE] Type: poly (Laravel main project)${NC}" >&2
    echo -e "${BLUE}[LARAVEL WEBSITE] PHP Mode: swoole (Octane)${NC}" >&2
    
    if ! check_laravel_main; then
        return 1
    fi
    
    local saved_dir="$(pwd)"
    cd "$LARAVEL_MAIN_PATH" || return 1
    
    echo -e "${YELLOW}[CMD]${NC} $USE_SUDO php artisan servermanager:website add \"$domain\" --type=poly --php-mode=swoole --ssl=$ssl_mode" >&2
    
    if $USE_SUDO php artisan servermanager:website add "$domain" --type=poly --php-mode=swoole --ssl="$ssl_mode" 2>&1; then
        echo -e "${GREEN}[LARAVEL WEBSITE] Website added successfully: $domain${NC}" >&2
        cd "$saved_dir" || true
        return 0
    else
        echo -e "${RED}[LARAVEL WEBSITE] Website addition failed: $domain${NC}" >&2
        cd "$saved_dir" || true
        return 1
    fi
}

# Function to list Laravel services
# Uses: php artisan servermanager:swoole list
list_laravel_services() {
    if ! check_laravel_main; then
        return 1
    fi
    
    local saved_dir="$(pwd)"
    cd "$LARAVEL_MAIN_PATH" || return 1
    
    $USE_SUDO php artisan servermanager:swoole list 2>&1
    
    cd "$saved_dir" || true
    return 0
}

# Function to check Laravel service status
check_laravel_service_status() {
    local app_name="${1:-laravel_main}"
    
    if ! check_laravel_main; then
        return 1
    fi
    
    local saved_dir="$(pwd)"
    cd "$LARAVEL_MAIN_PATH" || return 1
    
    local output
    output=$($USE_SUDO php artisan servermanager:swoole list 2>&1 | grep -i "octane-poly\|$app_name" || true)
    
    cd "$saved_dir" || true
    
    if [[ -n "$output" ]]; then
        echo "$output"
        return 0
    else
        return 1
    fi
}

# Main function - route commands
main() {
    # Ensure agent command is available (pre-check, independent of other operations)
    local agent_path
    agent_path=$(ensure_agent_command 2>&1)
    if [[ -n "$agent_path" ]]; then
        echo -e "${CYAN}[AGENT] Agent absolute path: $agent_path${NC}" >&2
    fi

    local command="${1:-help}"
    
    case "$command" in
        "install"|"install-service")
            install_laravel_service "${2:-laravel_main}"
            ;;
        "add-website"|"add")
            add_laravel_website "$2" "${3:-auto}"
            ;;
        "list"|"list-services")
            list_laravel_services
            ;;
        "status"|"check")
            check_laravel_service_status "${2:-laravel_main}"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  install [app_name]     - Install Laravel service (poly app method)"
            echo "  add-website <domain> [ssl_mode] - Add Laravel website with domain"
            echo "  list                   - List Laravel services"
            echo "  status [app_name]      - Check Laravel service status"
            echo "  help                   - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 install laravel_main"
            echo "  $0 add-website api.example.com auto"
            echo "  $0 list"
            echo "  $0 status laravel_main"
            ;;
    esac
}

# If script is executed directly (not sourced), run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
