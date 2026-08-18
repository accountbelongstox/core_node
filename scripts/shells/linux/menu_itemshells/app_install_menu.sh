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
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# APP Install Menu - Packages from linux_applications_list (120 --exact-app) plus install_shells scripts.
# Paths resolved only from this script location (no reliance on exported env from parent).

SCRIPT_DIR=""
LINUX_DIR=""
COMMON_DIR=""
INSTALL_SHELLS_DIR=""
STEP120_SCRIPT=""

_resolve_app_install_paths() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    LINUX_DIR="$(dirname "$SCRIPT_DIR")"
    COMMON_DIR="$LINUX_DIR/common"
    INSTALL_SHELLS_DIR="$LINUX_DIR/debian/install_shells"
    STEP120_SCRIPT="$INSTALL_SHELLS_DIR/121_install_desktop_applications.sh"
}

_resolve_app_install_paths

# Script-based installs: "script:filename|Display Name"
# Infra/DB: 46 Redis, 47 PostgreSQL, 48 Docker, 51 MySQL
# Desktop/App: 36 Chrome, 122 Cursor, 123 VSCode, 127 Antigravity, 128 WeChat, 31 Edge
# Runtime/Toolchain: 13 Python, 15 faster-whisper, 16 Node 24, 20 UV, 43 Rust, 54 Go, 55 Java, 35 Composer, 39 Flutter, 42 Ruby, 38 .NET
# Server/Service: 26 Nginx, 27 Certbot, 53 Tailscale, 86 Code Server, 124 Gitea, 125 RustDesk Client, 129 RustDesk Server
# AI: 96 DeepSeek, 97 DeepSeek OCR (Cline/Ark/Kimi/Cursor Agent via linux_applications_list AI group)
# Setup: 126 GNOME RDP
SCRIPT_INSTALL_ENTRIES=(
    "script:48_install_docker.sh|Docker"
    "script:51_install_mysql.sh|MySQL"
    "script:46_install_redis.sh|Redis"
    "script:47_install_postgresql.sh|PostgreSQL"
    "script:122_install_cursor.sh|Cursor"
    "script:123_install_vscode.sh|VSCode"
    "script:127_install_antigravity.sh|Antigravity"
    "script:128_install_wechat.sh|WeChat"
    "script:36_install_chrome.sh|Chrome (script)"
    "script:31_install_edge.sh|Edge"
    "script:16_install_node_24.sh|Node.js 24"
    "script:55_install_java.sh|Java"
    "script:54_install_golang22.sh|Go 1.22"
    "script:43_install_rust.sh|Rust"
    "script:20_install_uv.sh|UV"
    "script:13_ensure_python.sh|Python (ensure)"
    "script:120_install_faster_whisper.sh|faster-whisper (STT)"
    "script:35_install_composer.sh|Composer"
    "script:39_install_flutter.sh|Flutter"
    "script:42_install_ruby.sh|Ruby"
    "script:38_install_dotnet.sh|.NET"
    "script:26_install_nginx.sh|Nginx"
    "script:27_install_certbot.sh|Certbot"
    "script:28_install_frankenphp.sh|FrankenPHP"
    "script:53_install_tailscale.sh|Tailscale (VPN)"
    "script:86_install_code_server.sh|Code Server"
    "script:124_install_gitea.sh|Gitea"
    "script:125_install_rustdesk_client_1.4.4.sh|RustDesk Client"
    "script:129_install_rustdesk_server_1.1.14.sh|RustDesk Server"
    "script:96_install_deepseek.sh|DeepSeek"
    "script:97_install_deepseek_ocr.sh|DeepSeek OCR"
    "script:126_setup_gnome_rdp.sh|GNOME RDP (setup)"
)

if [ ! -s "$COMMON_DIR/linux_applications_list.sh" ]; then
    echo "Error: linux_applications_list.sh not found at $COMMON_DIR/linux_applications_list.sh"
    read -r -p "Press Enter to go back..."
    exit 1
fi
source "$COMMON_DIR/linux_applications_list.sh"

get_all_packages_flat_list() {
    local list=()
    local group
    local app_key
    local display
    for group in BASE DEV APP AI MCP; do
        while IFS= read -r app_key; do
            [ -z "$app_key" ] && continue
            display=$(get_app_property "$app_key" "name")
            [ -z "$display" ] && display="$app_key"
            list+=("${app_key}|${display}")
        done < <(get_apps_by_package_group "$group")
    done
    local e
    for e in "${SCRIPT_INSTALL_ENTRIES[@]}"; do
        list+=("$e")
    done
    # Sort by display name (field after '|'), case-insensitive (GNU sort)
    printf '%s\n' "${list[@]}" | sort -t '|' -k2,2 -f
}

# Install a single "key|Display" entry: a script: entry runs its install_shells
# script; a package entry goes through the 120 single-package runner. Returns the
# install command's exit status.
_run_install_entry() {
    local entry="$1"
    local package_key="${entry%%|*}"
    local display_name="${entry#*|}"

    if [[ "$package_key" == script:* ]]; then
        local script_name="${package_key#script:}"
        local script_path="$INSTALL_SHELLS_DIR/$script_name"
        if [ ! -s "$script_path" ]; then
            echo "Script not found: $script_path"
            return 1
        fi
        echo ""
        echo "Running script: $display_name ($script_name)..."
        echo ""
        bash "$script_path"
    else
        if [ ! -s "$STEP120_SCRIPT" ]; then
            echo "120 script not found: $STEP120_SCRIPT"
            return 1
        fi
        echo ""
        echo "Running 120 for package: $display_name ($package_key)..."
        echo ""
        bash "$STEP120_SCRIPT" --exact-app "$package_key"
    fi
}

# Install EVERY listed entry in order. Heavy + long; continues past failures and
# prints a summary. Confirmation required.
install_all_entries() {
    local entries=("$@")
    echo ""
    echo "This installs ALL ${#entries[@]} listed packages. This is heavy and can take a long time."
    local confirm
    read -r -p "Type 'yes' to proceed (anything else cancels): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        return 0
    fi
    local entry ok=0 fail=0
    for entry in "${entries[@]}"; do
        if _run_install_entry "$entry"; then
            ok=$((ok + 1))
        else
            fail=$((fail + 1))
        fi
    done
    echo ""
    echo "Install ALL complete: $ok succeeded, $fail failed/skipped."
}

show_app_install_menu() {
    local flat_list
    mapfile -t flat_list < <(get_all_packages_flat_list)
    local count=${#flat_list[@]}

    while true; do
        clear
        echo "================================================================================"
        echo "Linux Management APP Install Menu - Select a package to install (120 single-package run)"
        echo "================================================================================"
        echo ""

        if [ "$count" -eq 0 ]; then
            echo "No packages defined in linux_applications_list.sh."
            read -r -p "Press Enter to go back..."
            return 0
        fi

        local i
        for i in "${!flat_list[@]}"; do
            local num=$((i + 1))
            local entry="${flat_list[$i]}"
            local key="${entry%%|*}"
            local disp="${entry#*|}"
            printf "  %3d. %s\n" "$num" "$disp"
        done
        echo ""
        echo "  A. Install ALL listed packages (heavy; confirmation required)"
        echo "  0. Back"
        echo ""

        read -r -p "Enter number, A = install all (0 = Back): " input_line
        input_trim="${input_line:-}"
        input_trim="${input_trim#"${input_trim%%[![:space:]]*}"}"
        input_trim="${input_trim%"${input_trim##*[![:space:]]}"}"
        if [ -z "$input_trim" ] || [ "$input_trim" = "0" ] || [ "$input_trim" = "q" ] || [ "$input_trim" = "Q" ]; then
            return 0
        fi

        if [ "$input_trim" = "a" ] || [ "$input_trim" = "A" ] || [ "$input_trim" = "all" ] || [ "$input_trim" = "ALL" ]; then
            install_all_entries "${flat_list[@]}"
            echo ""
            read -r -p "Press Enter to return to APP Install Menu..."
            continue
        fi

        if ! [[ "$input_trim" =~ ^[0-9]+$ ]] || [ "$input_trim" -lt 1 ] || [ "$input_trim" -gt "$count" ]; then
            echo "Invalid input. Enter a number between 1 and $count, A to install all, or 0 to go back."
            read -r -p "Press Enter to continue..."
            continue
        fi

        local idx=$((input_trim - 1))
        _run_install_entry "${flat_list[$idx]}"

        echo ""
        read -r -p "Press Enter to return to APP Install Menu..."
    done
}

show_app_install_menu
