#!/bin/bash
# Claude Code Installation Script
#
# Usage:
#   ./171_install_claude_code.sh   # Install Claude Code (official native method)
#
# Thin delegate to install_shells/99_install_ai_tools.sh --only claude, the
# single source of truth for every AI CLI (see common/ai_tools_catalog.sh).
# That script runs the SAME canonical workflow this step used to call directly
# (scripts/ai_shtools/claude_code_install.sh: native install + all-users
# /usr/local/bin + claudeteam) and then syncs MCP to every installed AI tool.
# Kept as a numbered step so the install_test_menu.sh chain and the AI Tools &
# MCP menu can still target Claude Code specifically.

SCRIPT_INDEX="171"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Claude Code -> delegating to 99_install_ai_tools.sh --only claude"
echo "[$SCRIPT_INDEX] ============================================================"

# Includes mcp_chrome so this step keeps its historical behavior: native
# install + all-users bin + claudeteam, THEN install/sync MCP to every tool.
bash "$SCRIPT_CURRENT_DIR/99_install_ai_tools.sh" --only claude,mcp_chrome
exit $?
