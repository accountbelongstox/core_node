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

# =============================================================================
# Main Execution Functions for dd.sh
# =============================================================================

print_color() {
    local color="$1"
    local message="$2"
    local code=""
    case "$color" in
        yellow) code='\033[33m' ;;
        red)    code='\033[31m' ;;
        green)  code='\033[32m' ;;
        *)      code='' ;;
    esac
    echo -e "${code}${message}\033[0m"
}

handle_arguments() {
    if [ $# -eq 0 ]; then
        main
        return
    fi

    echo "[INFO] DD.sh Command Line Mode"
    echo "[INFO] Arguments: $*"
    echo ""

    local has_resource_limiter=false
    if [ -s "$RESOURCE_LIMITER_SCRIPT" ]; then
        echo "[INFO] Resource limiter available: $RESOURCE_LIMITER_SCRIPT"
        source_file_with_dos2unix "$RESOURCE_LIMITER_SCRIPT"
        if [ $? -eq 0 ]; then
            has_resource_limiter=true
            local detected_method=$(detect_resource_method)
            echo "[INFO] Resource limiting method: $detected_method"
        else
            echo "[WARNING] Failed to load resource limiter, running without limits"
        fi
    else
        echo "[ERROR] Resource limiter not found: $RESOURCE_LIMITER_SCRIPT"
        echo "[INFO] Running commands without resource limits"
    fi

    local command_count=0
    for arg in "$@"; do
        command_count=$((command_count + 1))
        echo ""
        echo "=========================================="
        echo "[INFO] Executing command $command_count: $arg"
        echo "=========================================="

        if [ "$has_resource_limiter" = true ]; then
            echo "[INFO] Running with resource limits (CPU: 20%, Memory: calculated based on system)"
            run_with_limits "20" "" "$arg"
            local exit_code=$?
        else
            echo "[WARNING] Running without resource limits"
            eval "$arg"
            local exit_code=$?
        fi

        if [ $exit_code -eq 0 ]; then
            echo "[SUCCESS] Command $command_count completed successfully"
        else
            echo "[ERROR] Command $command_count failed with exit code: $exit_code"
        fi
    done

    echo ""
    echo "=========================================="
    echo "[INFO] All commands processed"
    echo "=========================================="
}

show_cli_help() {
    cat << 'EOF'
DD.sh - Core Node Development Environment Manager

Usage:
  dd.sh                    # Interactive menu mode
  dd.sh COMMAND [ARGS...]  # Command line mode with resource limits
  dd.sh --help            # Show this help

Command Line Mode:
  - Each argument is treated as a separate command
  - Commands are executed sequentially with resource limits
  - Resource limits: CPU 20%, Memory calculated (200M-1G based on system RAM)
  - Uses systemd-run for resource control

Examples:
  dd.sh "node app.js"
  dd.sh "python script.py" "node server.js"
  dd.sh "bash /path/to/script.sh arg1 arg2"

Interactive Mode:
  - Run without arguments to access the full menu system
  - Provides access to all DD.sh features and tools

Resource Management:
  - Commands are automatically limited to 20% CPU and calculated memory
  - Memory limits: 200M (GB RAM), 300M (2-4GB), 500M (4-8GB), 1G (>8GB)
  - Auto-detects best resource limiting method available
  - Supported methods: systemd-run, cgroup, cpulimit, ulimit
  - Generates temporary scripts in /var/_core_node/_tmp/dd_scripts/
  - Automatic dependency installation and cleanup

EOF
}
