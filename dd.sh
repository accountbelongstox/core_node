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
#
# Linux one-click install: download dd.sh anywhere, then run. Single-file mode shows menu, downloads bootstrap, hands off.
#   Gitee (wget):   wget -O dd.sh https://gitee.com/accountbelongstox/core_node/raw/main/dd.sh && chmod +x dd.sh && bash dd.sh
#   Gitee (curl):   curl -fL https://gitee.com/accountbelongstox/core_node/raw/main/dd.sh -o dd.sh && chmod +x dd.sh && bash dd.sh
#   GitHub (wget):  wget -O dd.sh https://raw.githubusercontent.com/accountbelongstox/core_node/main/dd.sh && chmod +x dd.sh && bash dd.sh
#   GitHub (curl):  curl -fL https://raw.githubusercontent.com/accountbelongstox/core_node/main/dd.sh -o dd.sh && chmod +x dd.sh && bash dd.sh

# =============================================================================
# Variable Declarations
# =============================================================================

DD_START_US="${EPOCHREALTIME/./}"

# Real script location (dd.sh is usually reached through the /usr/local/bin/dd.sh link).
SCRIPT_ACTUAL_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_ACTUAL_DIR="$(dirname "$SCRIPT_ACTUAL_PATH")"

# Installation mode: the resolved location is not a project checkout (scripts/, package.json, main.js).
IS_INSTALLATION_MODE=false
if [ ! -d "$SCRIPT_ACTUAL_DIR/scripts" ] || [ ! -f "$SCRIPT_ACTUAL_DIR/package.json" ] || [ ! -f "$SCRIPT_ACTUAL_DIR/main.js" ]; then
    IS_INSTALLATION_MODE=true
fi

CORE_NODE_ROOT_DIR="$SCRIPT_ACTUAL_DIR"
SCRIPT_DIR="$CORE_NODE_ROOT_DIR/scripts"
SHELLS_DIR="$SCRIPT_DIR/shells"
COMMON_SHELLS_DIR="$SHELLS_DIR/linux/common"
COMMON_SCRIPTS_DIR="$SHELLS_DIR/scripts"
DD_HELPER_DIR="$SHELLS_DIR/linux/dd_helper"

# Installation mode is self-contained (dd_helper/constants.sh may not exist yet).
GITHUB_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/refs/heads/main"
GITEE_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"
BOOTSTRAP_RELATIVE="scripts/shells/linux/install_bootstrap.sh"
BOOTSTRAP_SELECTED_INDEX=0
DOWNLOAD_READY=false

GVAR_COMMON_FILE="$COMMON_SHELLS_DIR/gvar_common.sh"
SETTING_BASE_FILE="$SHELLS_DIR/linux/debian/install_shells/3_setting_base.sh"
PROJECT_VALIDATOR_FILE="$SHELLS_DIR/linux/debian/install_shells/7_project_validator.sh"
DD_SYMLINK_PATH="/usr/local/bin/dd.sh"
DD_TTY_SETTINGS=""

# Loaded first: env hub (USE_SUDO, var store, prompt queue), constants, menu UI, system helpers.
DD_CORE_FILES=(
    "$GVAR_COMMON_FILE"
    "$DD_HELPER_DIR/constants.sh"
    "$COMMON_SHELLS_DIR/arrow_menu.sh"
    "$DD_HELPER_DIR/system_functions.sh"
)
# Loaded after privileges, dos2unix and git are ready (dependency order).
DD_HELPER_FILES=(
    "$DD_HELPER_DIR/cache_functions.sh"
    "$DD_HELPER_DIR/file_download.sh"
    "$DD_HELPER_DIR/file_processing.sh"
    "$DD_HELPER_DIR/secret_functions.sh"
    "$DD_HELPER_DIR/smart_permissions.sh"
    "$DD_HELPER_DIR/dev_cache_cleanup.sh"
    "$DD_HELPER_DIR/linuxenvs_sync.sh"
    "$DD_HELPER_DIR/git_functions.sh"
    "$DD_HELPER_DIR/menu_functions.sh"
    "$DD_HELPER_DIR/management_and_backup.sh"
    "$DD_HELPER_DIR/linux_management.sh"
    "$DD_HELPER_DIR/main_execution.sh"
)

# Common download with progress (used in installation mode and can be reused by bootstrap)
download_with_progress() {
    local url="$1"
    local dest="$2"
    local dir_dest
    dir_dest="$(dirname "$dest")"
    mkdir -p "$dir_dest"
    if command -v curl >/dev/null 2>&1; then
        curl -# -f -L -o "$dest" "$url" || true
    elif command -v wget >/dev/null 2>&1; then
        wget --progress=bar:force -O "$dest" "$url" || true
    fi
    DOWNLOAD_READY=false
    [ -s "$dest" ] && DOWNLOAD_READY=true
}

# Installation mode launcher: show menu, download bootstrap file, hand off to it. dd.sh does nothing else.
select_bootstrap_option() {
    local title="$1"
    local options_name="$2"
    local back_index="$3"
    local -n bootstrap_options="$options_name"
    local option_count="${#bootstrap_options[@]}"
    local selected_index=0
    local old_settings=""
    local char=""
    local sequence=""
    local index=0
    local menu_width=0
    local option_length=0

    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        BOOTSTRAP_SELECTED_INDEX="$back_index"
        return
    fi
    old_settings="$(stty -g < /dev/tty 2>/dev/null)"
    if [ -z "$old_settings" ]; then
        BOOTSTRAP_SELECTED_INDEX="$back_index"
        return
    fi
    for index in "${!bootstrap_options[@]}"; do
        option_length="${#bootstrap_options[$index]}"
        if [ "$option_length" -gt "$menu_width" ]; then
            menu_width="$option_length"
        fi
    done

    while true; do
        {
            printf "\033c"
            echo "=========================================="
            echo "$title"
            echo "=========================================="
            echo "Select an option (Up/Down to move, Enter to select):"
            echo "Press Ctrl+C to go back"
            for index in "${!bootstrap_options[@]}"; do
                if [ "$index" -eq "$selected_index" ]; then
                    printf "\033[47m\033[30m> %-${menu_width}s\033[0m" "${bootstrap_options[$index]}"
                else
                    printf "  %-${menu_width}s" "${bootstrap_options[$index]}"
                fi
                if [ "$index" -lt "$((option_count - 1))" ]; then
                    printf "\n"
                fi
            done
        } > /dev/tty

        stty -icanon -echo -isig < /dev/tty 2>/dev/null
        char="$(dd bs=1 count=1 < /dev/tty 2>/dev/null)"
        sequence=""
        if [ "$char" = $'\x1B' ]; then
            read -r -t 0.1 -d '' sequence < /dev/tty
        fi
        stty "$old_settings" < /dev/tty 2>/dev/null
        case "$char" in
            $'\x1B')
                case "$sequence" in
                    '[A') selected_index=$(((selected_index - 1 + option_count) % option_count)) ;;
                    '[B') selected_index=$(((selected_index + 1) % option_count)) ;;
                esac
                ;;
            '') BOOTSTRAP_SELECTED_INDEX="$selected_index"; printf "\n" > /dev/tty; return 0 ;;
            $'\x03'|q|Q) BOOTSTRAP_SELECTED_INDEX="$back_index"; printf "\n" > /dev/tty; return 0 ;;
        esac
    done
}

run_installation_mode() {
    local install_options=(
        "Install and repair project (download bootstrap, then hand off)"
        "Exit"
    )
    local region_options=(
        "Global (GitHub)"
        "China (Gitee)"
        "Exit"
    )
    local base_url="$GITHUB_BASE_URL"
    local bootstrap_dest="$SCRIPT_ACTUAL_DIR/install_bootstrap.sh"
    local bootstrap_url=""

    select_bootstrap_option "Install and Repair Project" install_options 1
    if [ "$BOOTSTRAP_SELECTED_INDEX" -eq 1 ]; then
        echo "Exit."
        exit 0
    fi

    select_bootstrap_option "Select Download Region" region_options 2
    if [ "$BOOTSTRAP_SELECTED_INDEX" -eq 2 ]; then
        echo "Exit."
        exit 0
    fi
    [ "$BOOTSTRAP_SELECTED_INDEX" -eq 1 ] && base_url="$GITEE_BASE_URL"
    bootstrap_url="$base_url/$BOOTSTRAP_RELATIVE"
    echo "Downloading bootstrap file..."
    echo "  URL: $bootstrap_url"
    download_with_progress "$bootstrap_url" "$bootstrap_dest"
    if [ "$DOWNLOAD_READY" != true ]; then
        echo "[ERROR] Failed to download bootstrap file. Exiting."
        exit
    fi
    chmod +x "$bootstrap_dest"
    echo "Handing off to bootstrap; dd.sh is no longer responsible for the rest."
    REPO_BASE_URL="$base_url"
    exec bash "$bootstrap_dest"
}

if [ "$IS_INSTALLATION_MODE" = true ]; then
    run_installation_mode
    exit
fi

# Ctrl+C: restore the terminal and exit; the startup log stays on screen.
cleanup_and_exit() {
    if [ -n "$DD_TTY_SETTINGS" ]; then
        stty "$DD_TTY_SETTINGS" < /dev/tty 2>/dev/null
    fi
    echo ""
    echo "Script terminated by user (Ctrl+C)"
    exit
}

trap cleanup_and_exit SIGINT

source_file_with_dos2unix() {
    local file_path="$1"

    if LC_ALL=C grep -q $'\r' "$file_path" 2>/dev/null; then
        if ! { command -v dos2unix >/dev/null 2>&1 && $USE_SUDO dos2unix "$file_path" >/dev/null 2>&1; }; then
            $USE_SUDO sed -i 's/\r$//' "$file_path" 2>/dev/null
        fi
    fi
    source "$file_path"
}

load_dd_helpers() {
    local index=0

    for index in "${!DD_CORE_FILES[@]}"; do
        source_file_with_dos2unix "${DD_CORE_FILES[$index]}"
        echo "[$((index + 1))/${#DD_CORE_FILES[@]}] ${DD_CORE_FILES[$index]##*/} - [OK]"
    done
    dd_prepare_privileges
    check_and_install_dos2unix
    check_and_install_git
    for index in "${!DD_HELPER_FILES[@]}"; do
        source_file_with_dos2unix "${DD_HELPER_FILES[$index]}"
        echo "[$((index + 1))/${#DD_HELPER_FILES[@]}] ${DD_HELPER_FILES[$index]##*/} - [OK]"
    done
}

# Script paths in the var store (per-OS keys, same names as dd.ps1).
dd_store_script_paths() {
    echo -e "\033[36m[GLOBAL VARS] Storing script paths...\033[0m"
    set_global_var "SCRIPT_ROOT_DIR" "$CORE_NODE_ROOT_DIR" "false"
    set_global_var "COMMON_SHELLS_DIR" "$COMMON_SHELLS_DIR" "false"
    if [ -d "$COMMON_SCRIPTS_DIR" ]; then
        set_global_var "COMMON_SCRIPTS_DIR" "$COMMON_SCRIPTS_DIR" "false"
    else
        echo "Warning: Common scripts directory not found at $COMMON_SCRIPTS_DIR"
    fi
    echo "Stored SCRIPT_ROOT_DIR, COMMON_SHELLS_DIR, COMMON_SCRIPTS_DIR in $GLOBAL_VAR_DIR"
}

dd_project_restore_accept() {
    SKIP_PROJECT_PERMISSION_REPAIR=true PROJECT_VALIDATOR_MODE=restore bash "$PROJECT_VALIDATOR_FILE"
}

# Validator runs in defer mode: a needed restore is queued, not asked here.
dd_run_project_validation() {
    local restore_root=""

    echo -e "\033[36m[PROJECT VALIDATION] Running project validation...\033[0m"
    if [ ! -s "$PROJECT_VALIDATOR_FILE" ]; then
        echo -e "\033[31m[PROJECT VALIDATION] 7_project_validator.sh not found at: $PROJECT_VALIDATOR_FILE\033[0m"
        return
    fi
    SKIP_PROJECT_PERMISSION_REPAIR=true PROJECT_VALIDATOR_MODE=defer bash "$PROJECT_VALIDATOR_FILE"
    restore_root="$(get_global_var "PROJECT_RESTORE_PENDING" "none")"
    if [ -n "$restore_root" ] && [ "$restore_root" != "none" ]; then
        prompt_queue_add "project_restore" "n" "Restore the project into $restore_root from the repository" dd_project_restore_accept
    fi
    echo -e "\033[32m[PROJECT VALIDATION] Project validation completed\033[0m"
}

# Disk detection and mounts (wsl/server/desktop); runs once per machine.
dd_run_base_setup() {
    local disk_setup_flag="$GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED"

    echo -e "\033[36m[BASE SETUP] Checking if base system setup is needed...\033[0m"
    if [ "$IS_WSL" = true ]; then
        echo -e "\033[33m[BASE SETUP] WSL environment detected - skipping disk setup (WSL mounts /mnt/c, /mnt/d, ...)\033[0m"
        return
    fi
    if [ -s "$disk_setup_flag" ]; then
        echo -e "\033[33m[BASE SETUP] Disk setup already completed at: $(< "$disk_setup_flag")\033[0m"
        return
    fi
    if [ ! -s "$SETTING_BASE_FILE" ]; then
        echo -e "\033[31m[BASE SETUP] 3_setting_base.sh not found at: $SETTING_BASE_FILE\033[0m"
        return
    fi
    echo -e "\033[36m[BASE SETUP] Running base system setup...\033[0m"
    bash "$SETTING_BASE_FILE"
    echo -e "\033[32m[BASE SETUP] Base system setup completed\033[0m"
    if [ -n "$CORE_NODE_PROJECT_ROOT" ]; then
        echo -e "\033[32m[BASE SETUP] CORE_NODE_PROJECT_ROOT: $CORE_NODE_PROJECT_ROOT\033[0m"
    fi
}

# /usr/local/bin/dd.sh -> this script, then scripts/linuxenvs -> /usr/local/bin.
dd_link_entry_points() {
    if [ -L "$DD_SYMLINK_PATH" ] && [ "$(readlink -f "$DD_SYMLINK_PATH")" = "$SCRIPT_ACTUAL_PATH" ]; then
        echo "Symlink already correct: $DD_SYMLINK_PATH -> $SCRIPT_ACTUAL_PATH"
    else
        $USE_SUDO ln -sfn "$SCRIPT_ACTUAL_PATH" "$DD_SYMLINK_PATH"
        if [ -L "$DD_SYMLINK_PATH" ] && [ "$(readlink -f "$DD_SYMLINK_PATH")" = "$SCRIPT_ACTUAL_PATH" ]; then
            echo "Symlink updated: $DD_SYMLINK_PATH -> $SCRIPT_ACTUAL_PATH"
        else
            echo "Warning: Failed to create symlink $DD_SYMLINK_PATH (may need sudo privileges)"
        fi
    fi
    echo ""
    sync_linuxenvs_to_bin
}

# Startup prints every step and never stops; confirmations are queued and shown
# once, stacked into the countdown right before the menu.
main() {
    local menu_pause=""

    DD_TTY_SETTINGS="$(stty -g < /dev/tty 2>/dev/null)"
    PROMPT_QUEUE_DEFERRED=true
    echo "CORE_NODE_ROOT_DIR: $CORE_NODE_ROOT_DIR"
    echo "SHELLS_DIR:         $SHELLS_DIR"

    echo ""
    echo -e "\033[36m[FILE CHECK] Checking for required files...\033[0m"
    if [ ! -s "$GVAR_COMMON_FILE" ] || [ ! -s "$SETTING_BASE_FILE" ] || [ ! -s "$PROJECT_VALIDATOR_FILE" ]; then
        show_region_selection_menu
    fi
    check_and_download_files

    echo ""
    echo -e "\033[36m[SMART SETUP] Configuring environment and permissions...\033[0m"
    smart_permissions_fix "$CORE_NODE_ROOT_DIR"

    echo ""
    echo -e "\033[36m[SECRETS] Checking secret files...\033[0m"
    ensure_secret_keys_ready

    echo ""
    cleanup_directory_processing_cache
    system_unwanted_paths_cleanup

    echo ""
    echo -e "\033[36m[FILE PROCESSING] CRLF -> LF and +x for .sh files\033[0m"
    process_project_sh_files "$CORE_NODE_ROOT_DIR" "${DD_SH_TARGET_DIRS[@]}"

    echo ""
    dd_store_script_paths

    echo ""
    dd_run_project_validation

    echo ""
    dd_run_base_setup

    echo ""
    dd_link_entry_points

    echo ""
    detect_system_version
    smart_permissions_report
    echo -e "\033[32m[STARTUP] Ready in $(sh_process_elapsed "$DD_START_US")s\033[0m"

    prompt_queue_flush "$DD_MENU_COUNTDOWN_SECONDS" "Press Enter to show the menu"
    PROMPT_QUEUE_DEFERRED=false
    if [ "$PROMPT_QUEUE_ACTIONS_RUN" -gt 0 ]; then
        prompt_countdown_read menu_pause "" "$DD_MENU_COUNTDOWN_SECONDS" "Press Enter to show the menu"
    fi
    show_linux_management_submenu
}

load_dd_helpers

if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
    show_cli_help
    exit 0
fi

if [ $# -eq 0 ]; then
    main
else
    handle_arguments "$@"
fi
# sudo apt update && sudo apt install dos2unix && sudo dos2unix ./dd.sh && sudo chmod +x ./dd.sh
