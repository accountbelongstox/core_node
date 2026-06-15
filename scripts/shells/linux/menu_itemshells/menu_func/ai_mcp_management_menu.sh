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

# Unified "AI & MCP Management" menu (Linux). Mirrors the Windows merged menu:
# - status panel (detected AI tools + existing MCP + key status)
# - MCP install (chrome recompiles once per run) + sync to all 8 tools
# - links to the existing per-tool AI env-var submenus
# Source this file and call show_ai_mcp_management_menu. cunzhi/wait_please excluded.

AIMCP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# core_node root: menu_func -> menu_itemshells -> linux -> shells -> scripts -> root
AIMCP_CORE_NODE_DIR="$(cd "$AIMCP_DIR/../../../../.." && pwd)"
AIMCP_SHTOOLS_DIR="$AIMCP_CORE_NODE_DIR/scripts/ai_shtools"
# Canonical engine + status live in scripts/ai_shtools (shared with the main-menu
# "Sync All MCP" action), so there is a single source of truth.
# shellcheck source=/dev/null
. "$AIMCP_SHTOOLS_DIR/mcp_sync_engine.sh"
# shellcheck source=/dev/null
. "$AIMCP_SHTOOLS_DIR/mcp_status.sh"
# Optional: existing per-tool AI env-var submenus for the AI Management section.
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

show_ai_mcp_management_menu() {
    local -a menu_items=(
        "header:== AI Management (per-tool env/command setup) =========="
        "claude_env:  Claude AI env/command setup"
        "droid_env:  Droid env/command setup"
        "openai_env:  OpenAI env/command setup"
        "header:== MCP: Inspect ========================================"
        "dryrun:  Show planned servers (dry-run)"
        "header:== MCP: Install (auto-syncs all tools) ================="
        "install_all:  Install All MCP + Sync to All AI Tools"
        "install_chrome:  Install Chrome MCP + Sync All"
        "install_context7:  Install Context7 MCP + Sync All"
        "header:== MCP: Sync config only (no install) =================="
        "sync_all:  Sync to All AI Tools"
        "sync_claude:  Sync to Claude"
        "sync_cursor:  Sync to Cursor (+ Cursor Agent)"
        "sync_codex:  Sync to Codex"
        "sync_gemini:  Sync to Gemini"
        "sync_droid:  Sync to Droid"
        "sync_windsurf:  Sync to Windsurf"
        "sync_devin:  Sync to Devin"
        "sync_vscode:  Sync to VS Code"
        "back:Back to Main Menu"
    )

    local selected_index=1
    local i action text key

    while true; do
        clear
        print_color "========================================================" "Info"
        print_color "       AI & MCP Management" "Info"
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
                    claude_env)       aimcp_run_submenu show_claude_submenu "Claude env setup" ;;
                    droid_env)        aimcp_run_submenu show_droid_submenu "Droid env setup" ;;
                    openai_env)       aimcp_run_submenu show_openai_submenu "OpenAI env setup" ;;
                    dryrun)           clear; mcp_show_planned; aimcp_pause ;;
                    install_all)      clear; mcp_install_all; aimcp_pause ;;
                    install_chrome)   clear; export MCP_CHROME_BUILD_DONE=0; mcp_install_chrome; mcp_sync_all; aimcp_pause ;;
                    install_context7) clear; mcp_install_context7; mcp_sync_all; aimcp_pause ;;
                    sync_all)         clear; mcp_sync_all; aimcp_pause ;;
                    sync_claude)      clear; mcp_sync_tool claude; aimcp_pause ;;
                    sync_cursor)      clear; mcp_sync_tool cursor; aimcp_pause ;;
                    sync_codex)       clear; mcp_sync_tool codex; aimcp_pause ;;
                    sync_gemini)      clear; mcp_sync_tool gemini; aimcp_pause ;;
                    sync_droid)       clear; mcp_sync_tool droid; aimcp_pause ;;
                    sync_windsurf)    clear; mcp_sync_tool windsurf; aimcp_pause ;;
                    sync_devin)       clear; mcp_sync_tool devin; aimcp_pause ;;
                    sync_vscode)      clear; mcp_sync_tool vscode; aimcp_pause ;;
                    back)             return 0 ;;
                esac
                ;;
        esac
    done
}

# Allow standalone execution for quick checks.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    show_ai_mcp_management_menu
fi
