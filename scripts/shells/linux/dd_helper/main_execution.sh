#!/bin/bash

# =============================================================================
# Main Execution Functions for dd.sh
# =============================================================================

RESOURCE_LIMITER_SCRIPT="$CORE_NODE_ROOT_DIR/$RESOURCE_LIMITER_SCRIPT_RELATIVE"

# =============================================================================
# Named Parameter Dispatch Table (D20)
# =============================================================================
# One table drives both `dd.sh help` and argument routing. A first argument
# that matches a registered name calls its handler and dd.sh exits; anything
# else keeps the existing free-form "each argument is a resource-limited
# shell command" mode (handle_arguments below), unchanged.
declare -A DD_PARAM_HANDLERS=()
declare -A DD_PARAM_SUMMARIES=()
declare -A DD_PARAM_EXAMPLES=()
declare -a DD_PARAM_ORDER=()

dd_register_param() {
    local name="$1"
    local handler="$2"
    local summary="$3"
    local example="$4"

    DD_PARAM_ORDER+=("$name")
    DD_PARAM_HANDLERS["$name"]="$handler"
    DD_PARAM_SUMMARIES["$name"]="$summary"
    DD_PARAM_EXAMPLES["$name"]="$example"
}

dd_handle_help() {
    show_cli_help
    exit 0
}

# syncgit [--dry-run]: ensure origin is GitHub SSH, then add/commit/pull/push.
# Shared with the `syncgit` quick command (scripts/linuxenvs/syncgit.sh) via
# scripts/shells/linux/common/git_sync_common.sh.
dd_handle_syncgit() {
    local dry_run=false
    local arg=""

    for arg in "$@"; do
        case "$arg" in
            --dry-run)
                dry_run=true
                ;;
            *)
                echo "[syncgit] Unknown option ignored: $arg" >&2
                ;;
        esac
    done

    git_sync_run "$CORE_NODE_ROOT_DIR" "$dry_run"
}

dd_register_param "help" "dd_handle_help" "Show this help and exit (no other action runs)" "dd.sh help"
dd_register_param "-h" "dd_handle_help" "Same as 'help'" "dd.sh -h"
dd_register_param "--help" "dd_handle_help" "Same as 'help'" "dd.sh --help"
dd_register_param "syncgit" "dd_handle_syncgit" "cd repo root, ensure origin is GitHub SSH, add/commit/pull/push main" "dd.sh syncgit --dry-run"

# Dispatch a recognized first argument to its handler and return/exit;
# anything not registered above falls through to the existing generic
# per-argument command mode.
dd_dispatch_arguments() {
    local first_arg="$1"
    local handler="${DD_PARAM_HANDLERS[$first_arg]:-}"

    if [ -n "$handler" ]; then
        shift
        "$handler" "$@"
        return
    fi

    handle_arguments "$@"
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
        has_resource_limiter=true
        local detected_method=$(detect_resource_method_from_common_functions)
        echo "[INFO] Resource limiting method: $detected_method"
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
            run_with_limits_from_common_functions "20" "" "$arg"
        else
            echo "[WARNING] Running without resource limits"
            eval "$arg"
        fi
        echo "[INFO] Command $command_count completed"
    done

    echo ""
    echo "=========================================="
    echo "[INFO] All commands processed"
    echo "=========================================="
}

show_cli_help() {
    local name=""

    echo "DD.sh - Core Node Development Environment Manager"
    echo ""
    echo "Usage:"
    echo "  dd.sh                    # Interactive menu mode"
    echo "  dd.sh PARAM [ARGS...]    # Named parameter (see table below); exits after running it"
    echo "  dd.sh COMMAND [ARGS...]  # Command line mode: each argument is a resource-limited shell command"
    echo ""
    echo "Named Parameters:"
    for name in "${DD_PARAM_ORDER[@]}"; do
        printf "  %-10s %s\n" "$name" "${DD_PARAM_SUMMARIES[$name]}"
        printf "             Example: %s\n" "${DD_PARAM_EXAMPLES[$name]}"
    done
    echo ""
    echo "Command Line Mode (any argument not listed above):"
    echo "  - Each argument is treated as a separate command"
    echo "  - Commands are executed sequentially with resource limits"
    echo "  - Resource limits: CPU 20%, Memory calculated (200M-1G based on system RAM)"
    echo "  - Uses systemd-run for resource control"
    echo ""
    echo "Examples:"
    echo "  dd.sh \"node app.js\""
    echo "  dd.sh \"python script.py\" \"node server.js\""
    echo "  dd.sh \"bash /path/to/script.sh arg1 arg2\""
    echo ""
    echo "Interactive Mode:"
    echo "  - Run without arguments to access the full menu system"
    echo "  - Provides access to all DD.sh features and tools"
    echo ""
    echo "Resource Management:"
    echo "  - Commands are automatically limited to 20% CPU and calculated memory"
    echo "  - Memory limits: 200M (GB RAM), 300M (2-4GB), 500M (4-8GB), 1G (>8GB)"
    echo "  - Auto-detects best resource limiting method available"
    echo "  - Supported methods: systemd-run, cgroup, cpulimit, ulimit"
    echo "  - Generates temporary scripts in \$CORE_NODE_DATA_DIR/dd_scripts/"
    echo "  - Automatic dependency installation and cleanup"
    echo ""
}
