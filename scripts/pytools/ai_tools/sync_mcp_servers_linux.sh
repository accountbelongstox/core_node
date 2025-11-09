#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# MCP Servers Configuration Sync Wrapper Script for Linux/WSL
# This script provides a convenient wrapper around the Python sync script

# Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/sync_mcp_servers_linux.py"
TARGET="claude"
TEMPLATE_PATH=""
CONFIG_BASE=""

# Color output functions
print_color() {
    local color="$1"
    local message="$2"
    local code=""
    case "$color" in
        yellow) code='\033[33m' ;;
        red)    code='\033[31m' ;;
        green)  code='\033[32m' ;;
        cyan)   code='\033[36m' ;;
        *)      code='' ;;
    esac
    echo -e "${code}${message}\033[0m"
}

# Show help
show_help() {
    cat << 'EOF'
MCP Servers Configuration Sync Tool for Linux/WSL

Usage:
  ./sync_mcp_servers_linux.sh [OPTIONS]

Options:
  -t, --target TARGET        Target configuration (claude or droid, default: claude)
  --template PATH           Override template file path
  --config-base PATH        Override config base directory
  -h, --help                Show this help message

Examples:
  # Sync Claude configuration (default)
  ./sync_mcp_servers_linux.sh

  # Sync Factory AI Droid configuration
  ./sync_mcp_servers_linux.sh --target droid

  # Use custom template path
  ./sync_mcp_servers_linux.sh --template /path/to/template.json

Environment Detection:
  - Automatically detects WSL vs native Linux
  - WSL: Uses /mnt/c/Users/{USERNAME}/ for configs
  - Linux: Uses ~/.config/ for configs

Templates:
  - WSL: Uses mcpWSLTemplate.json (Windows paths with /mnt/d/)
  - Linux: Uses mcpLinuxTemplate.json (Linux paths)

EOF
}

# Check if Python script exists
check_python_script() {
    if [ ! -f "$PYTHON_SCRIPT" ]; then
        print_color red "[ERROR] Python script not found: $PYTHON_SCRIPT"
        print_color yellow "[INFO] Please ensure sync_mcp_servers_linux.py is in the same directory"
        exit 1
    fi
}

# Check Python version
check_python() {
    if command -v python3 &>/dev/null; then
        local python_cmd="python3"
    elif command -v python &>/dev/null; then
        local python_cmd="python"
    else
        print_color red "[ERROR] Python 3 is required but not found"
        print_color yellow "[INFO] Please install Python 3: sudo apt install python3"
        exit 1
    fi
    
    # Check Python version
    local python_version=$($python_cmd --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
    local major_version=$(echo "$python_version" | cut -d. -f1)
    local minor_version=$(echo "$python_version" | cut -d. -f2)
    
    if [ "$major_version" -lt 3 ] || ([ "$major_version" -eq 3 ] && [ "$minor_version" -lt 6 ]); then
        print_color red "[ERROR] Python 3.6+ is required, found: $python_version"
        exit 1
    fi
    
    echo "$python_cmd"
}

# Parse command line arguments
parse_arguments() {
    while [ $# -gt 0 ]; do
        case "$1" in
            -t|--target)
                TARGET="$2"
                shift 2
                ;;
            --template)
                TEMPLATE_PATH="$2"
                shift 2
                ;;
            --config-base)
                CONFIG_BASE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_color red "[ERROR] Unknown option: $1"
                echo ""
                show_help
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    print_color cyan "==================================================================="
    print_color cyan "MCP Servers Configuration Sync Tool for Linux/WSL"
    print_color cyan "==================================================================="
    echo ""
    
    # Check requirements
    check_python_script
    local python_cmd=$(check_python)
    
    print_color green "[INFO] Using Python: $python_cmd"
    print_color green "[INFO] Python script: $PYTHON_SCRIPT"
    echo ""
    
    # Build command
    local cmd_args=()
    cmd_args+=("--target" "$TARGET")
    
    if [ -n "$TEMPLATE_PATH" ]; then
        cmd_args+=("--template" "$TEMPLATE_PATH")
    fi
    
    if [ -n "$CONFIG_BASE" ]; then
        cmd_args+=("--config-base" "$CONFIG_BASE")
    fi
    
    # Execute Python script
    print_color cyan "[INFO] Starting synchronization..."
    echo ""
    
    $python_cmd "$PYTHON_SCRIPT" "${cmd_args[@]}"
    local exit_code=$?
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        print_color green "[SUCCESS] MCP configuration sync completed"
    else
        print_color red "[ERROR] MCP configuration sync failed with exit code: $exit_code"
    fi
    
    return $exit_code
}

# Parse arguments and run main function
parse_arguments "$@"
main
