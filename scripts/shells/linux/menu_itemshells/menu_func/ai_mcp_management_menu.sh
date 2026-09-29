#!/bin/bash

# "AI Tools & MCP" menu (Linux). Single entry point for:
# - Ensure ALL AI tools (one click) / per-tool install+upgrade
# - Status table (installed, version, /usr/local/bin link, login shared)
# - Shared-login setup (root <-> real desktop user config-dir sharing)
# - mcp-chrome (build+install service, status, restart, logs)
# - Sync chrome MCP config to every installed AI tool
# - API key / env-var setup for Claude, Codex, Droid (unchanged, separate
#   concern from install/link/login-share)
# Every AI-tool item below calls install_shells/99_install_ai_tools.sh or
# common/ai_shared_login.sh (single source of truth; no duplicated logic here).

AIMCP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# core_node root: menu_func -> menu_itemshells -> linux -> shells -> scripts -> root
AIMCP_CORE_NODE_DIR="$(cd "$AIMCP_DIR/../../../../.." && pwd)"
AIMCP_SHTOOLS_DIR="$AIMCP_CORE_NODE_DIR/scripts/ai_shtools"
AIMCP_COMMON_DIR="$AIMCP_CORE_NODE_DIR/scripts/shells/linux/common"
AIMCP_INSTALL_SHELLS_DIR="$AIMCP_CORE_NODE_DIR/scripts/shells/linux/debian/install_shells"
AIMCP_INSTALLER="$AIMCP_INSTALL_SHELLS_DIR/99_install_ai_tools.sh"

# Canonical engine + status + catalog + shared-login libs (single source of truth).
# shellcheck source=/dev/null
. "$AIMCP_SHTOOLS_DIR/mcp_sync_engine.sh"
# shellcheck source=/dev/null
. "$AIMCP_SHTOOLS_DIR/mcp_status.sh"
# shellcheck source=/dev/null
. "$AIMCP_COMMON_DIR/ai_tools_catalog.sh"
# shellcheck source=/dev/null
. "$AIMCP_COMMON_DIR/ai_shared_login.sh"
# Optional: existing per-tool API key / env-var submenus (unrelated to install).
for _aimcp_f in ai_claude_menu.sh ai_droid_menu.sh ai_openai_menu.sh spacial_common_menu.sh; do
    [ -f "$AIMCP_DIR/$_aimcp_f" ] && . "$AIMCP_DIR/$_aimcp_f"
done

# Fallback print_color when run standalone (the main menu provides the real one).
if ! command -v print_color >/dev/null 2>&1; then
    print_color() { echo "$1"; }
fi

aimcp_pause() {
    echo ""
    read -n 1 -s -r -p "Press any key to return to menu..."
    echo ""
}

aimcp_run_submenu() {
    local fn="$1" label="$2"
    if command -v "$fn" >/dev/null 2>&1; then
        "$fn"
    else
        clear
        echo "[INFO] $label is not available on this system."
        aimcp_pause
    fi
}

aimcp_installer() {
    if [ -s "$AIMCP_INSTALLER" ]; then
        bash "$AIMCP_INSTALLER" "$@"
    else
        echo "[ERROR] 99_install_ai_tools.sh not found at: $AIMCP_INSTALLER"
    fi
}

# --- Per-tool install/upgrade submenu ---------------------------------------
aimcp_show_tool_submenu() {
    local -a keys=()
    local key selected=1 total k
    mapfile -t keys < <(ai_catalog_keys)
    total=${#keys[@]}

    while true; do
        clear
        print_color "== Per-tool AI CLI install / upgrade ======================" "Info"
        for k in "${!keys[@]}"; do
            key="${keys[$k]}"
            if [ "$k" -eq "$selected" ]; then
                echo -e "\033[33m> $key  ($(ai_catalog_get "$key" name))\033[0m"
            else
                echo "  $key  ($(ai_catalog_get "$key" name))"
            fi
        done
        echo "  back  Back"
        print_color "Use Up/Down arrows to navigate, Enter to select" "Info"

        local rkey=""
        read -rsn1 rkey
        case "$rkey" in
            $'\x1b')
                read -rsn2 rkey
                case "$rkey" in
                    '[A') ((selected--)); [ $selected -lt 0 ] && selected=$total ;;
                    '[B') ((selected++)); [ $selected -gt $total ] && selected=0 ;;
                esac
                ;;
            '')
                if [ "$selected" -eq "$total" ]; then
                    return 0
                fi
                clear
                aimcp_installer --only "${keys[$selected]}"
                aimcp_pause
                ;;
        esac
    done
}

# --- mcp-chrome submenu ------------------------------------------------------
aimcp_mcp_chrome_menu() {
    local -a items=(
        "build:Build + install as the ncore-mcp-chrome service"
        "status:Service status (systemctl status)"
        "restart:Restart service"
        "logs:Tail logs (journalctl -f, Ctrl+C to stop)"
        "back:Back"
    )
    local selected=0 total=${#items[@]} i action text

    while true; do
        clear
        print_color "== mcp-chrome =============================================" "Info"
        for i in "${!items[@]}"; do
            IFS=':' read -r action text <<< "${items[$i]}"
            if [ "$i" -eq "$selected" ]; then echo -e "\033[33m> $text\033[0m"; else echo "  $text"; fi
        done
        print_color "Use Up/Down arrows to navigate, Enter to select" "Info"

        local rkey=""
        read -rsn1 rkey
        case "$rkey" in
            $'\x1b')
                read -rsn2 rkey
                case "$rkey" in
                    '[A') ((selected--)); [ $selected -lt 0 ] && selected=$((total - 1)) ;;
                    '[B') ((selected++)); [ $selected -ge $total ] && selected=0 ;;
                esac
                ;;
            '')
                IFS=':' read -r action text <<< "${items[$selected]}"
                case "$action" in
                    build)   clear; aimcp_installer --only mcp_chrome; aimcp_pause ;;
                    status)  clear; systemctl status ncore-mcp-chrome --no-pager 2>&1 | head -40; aimcp_pause ;;
                    restart) clear; ${USE_SUDO:-sudo} systemctl restart ncore-mcp-chrome && echo "[OK] Restarted."; aimcp_pause ;;
                    logs)    clear; echo "Press Ctrl+C to stop..."; journalctl -u ncore-mcp-chrome -f ;;
                    back)    return 0 ;;
                esac
                ;;
        esac
    done
}

show_ai_mcp_management_menu() {
    local -a menu_items=(
        "header:== AI Tools ============================================"
        "ensure_all:  Ensure ALL AI tools (one click)"
        "per_tool:  Install / upgrade one AI tool"
        "status:  Status table (installed, version, linked, login shared)"
        "shared_login:  Shared-login setup (root <-> real user config dirs)"
        "header:== mcp-chrome (only MCP server) ========================="
        "mcp_chrome:  Build + install service / status / restart / logs"
        "sync_chrome:  Sync chrome MCP to all installed AI tools"
        "header:== API keys / env setup (per tool) ===================="
        "claude_keys:  Claude API keys / env vars"
        "codex_keys:  Codex / OpenAI API keys / env vars"
        "droid_keys:  Droid API keys / env vars"
        "back:Back to Main Menu"
    )

    local selected_index=1
    local i action text key

    while true; do
        clear
        print_color "========================================================" "Info"
        print_color "       AI Tools & MCP" "Info"
        print_color "========================================================" "Info"
        mcp_show_status_panel

        for i in "${!menu_items[@]}"; do
            IFS=':' read -r action text <<< "${menu_items[$i]}"
            if [ "$action" = "header" ]; then
                echo -e "\033[90m$text\033[0m"
            elif [ "$i" -eq "$selected_index" ]; then
                echo -e "\033[33m> $text\033[0m"
            else
                echo "  $text"
            fi
        done
        print_color "Use Up/Down arrows to navigate, Enter to select" "Info"

        read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 key
                case "$key" in
                    '[A')
                        ((selected_index--))
                        [ $selected_index -lt 0 ] && selected_index=$((${#menu_items[@]} - 1))
                        while [[ "${menu_items[$selected_index]}" == header:* ]]; do
                            ((selected_index--))
                            [ $selected_index -lt 0 ] && selected_index=$((${#menu_items[@]} - 1))
                        done
                        ;;
                    '[B')
                        ((selected_index++))
                        [ $selected_index -ge ${#menu_items[@]} ] && selected_index=0
                        while [[ "${menu_items[$selected_index]}" == header:* ]]; do
                            ((selected_index++))
                            [ $selected_index -ge ${#menu_items[@]} ] && selected_index=0
                        done
                        ;;
                esac
                ;;
            '')
                IFS=':' read -r action text <<< "${menu_items[$selected_index]}"
                case "$action" in
                    header) ;;
                    ensure_all)   clear; aimcp_installer; aimcp_pause ;;
                    per_tool)     aimcp_show_tool_submenu ;;
                    status)       clear; aimcp_installer --status; aimcp_pause ;;
                    shared_login) clear; ai_shared_login_setup; aimcp_pause ;;
                    mcp_chrome)   aimcp_mcp_chrome_menu ;;
                    sync_chrome)  clear; mcp_sync_all; aimcp_pause ;;
                    claude_keys)  aimcp_run_submenu show_claude_submenu "Claude API keys / env setup" ;;
                    codex_keys)   aimcp_run_submenu show_codex_submenu "Codex/OpenAI API keys / env setup" ;;
                    droid_keys)   aimcp_run_submenu show_droid_submenu "Droid API keys / env setup" ;;
                    back)         return 0 ;;
                esac
                ;;
        esac
    done
}

# Allow standalone execution for quick checks.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    show_ai_mcp_management_menu
fi
