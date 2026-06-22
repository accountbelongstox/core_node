#!/bin/bash
# Claude Code Installation Script
#
# Usage:
#   ./129_install_claude_code.sh   # Install Claude Code (official native method)
#
# All-in-one Claude Code provisioning (single source of truth, callable anywhere
# -- full install run, dd.sh, or the AI & MCP Management menu). It runs ALL of:
#   1. Official NATIVE install of Claude Code.
#   2. Make claude usable by EVERY user (regular users + root): when the native
#      per-user binary sits under a mode-700 home, the self-contained binary is
#      COPIED into /usr/local/bin (0755) so all users can run it (permission fix
#      for the root -> regular-users case); otherwise it is symlinked.
#   3. Sync the claudeteam launcher into /usr/local/bin for all users.
#   4. Install MCP servers and sync MCP config to all AI tools.
# Steps 1-3 are delegated to the canonical scripts/ai_shtools/claude_code_install.sh;
# step 4 is delegated to scripts/ai_shtools/mcp_sync_engine.sh. The dd.sh AI & MCP
# Management menu calls this same script, so both do the same thing.
#
# Idempotent: the native install is skipped when claude already works, the shared
# copy is skipped when already identical, symlinks are only (re)created when
# missing/wrong, and MCP install/sync re-asserts existing config.
#
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

# Script identification and path setup
SCRIPT_INDEX="129"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# install_shells -> debian -> linux -> shells -> scripts -> core_node root
CORE_NODE_ROOT="$(cd "$PARENT_DIR_LEVEL_2/../../.." && pwd)"
CLAUDE_CODE_INSTALL_LIB="$CORE_NODE_ROOT/scripts/ai_shtools/claude_code_install.sh"
MCP_SYNC_ENGINE_LIB="$CORE_NODE_ROOT/scripts/ai_shtools/mcp_sync_engine.sh"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install Claude Code (official native) -> all users + claudeteam"
echo "[$SCRIPT_INDEX] ============================================================"

# --- Steps 1-3: native install + all-users binary + claudeteam ---------------
# Delegate to the canonical native workflow (single source of truth).
if [ -s "$CLAUDE_CODE_INSTALL_LIB" ]; then
    # shellcheck source=/dev/null
    source "$CLAUDE_CODE_INSTALL_LIB"
    if command -v claude_code_install >/dev/null 2>&1; then
        claude_code_install
    else
        echo "[$SCRIPT_INDEX] ERROR: claude_code_install function not found after sourcing the workflow."
        exit 1
    fi
else
    echo "[$SCRIPT_INDEX] ERROR: Claude Code install workflow not found at: $CLAUDE_CODE_INSTALL_LIB"
    exit 1
fi

echo "[$SCRIPT_INDEX] Claude Code installation step completed."

# --- Step 4: install MCP servers + sync MCP config to all AI tools -----------
# Best-effort: MCP problems must not fail the Claude Code install step.
echo ""
echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install MCP servers + sync to all AI tools"
echo "[$SCRIPT_INDEX] ============================================================"
if [ -s "$MCP_SYNC_ENGINE_LIB" ]; then
    # shellcheck source=/dev/null
    source "$MCP_SYNC_ENGINE_LIB"
    if command -v mcp_install_all >/dev/null 2>&1; then
        # mcp_install_all installs Chrome + Context7 MCP then syncs all tools.
        mcp_install_all || echo "[$SCRIPT_INDEX] WARNING: MCP install/sync reported errors (continuing)."
    elif command -v mcp_sync_all >/dev/null 2>&1; then
        mcp_sync_all || echo "[$SCRIPT_INDEX] WARNING: MCP sync reported errors (continuing)."
    else
        echo "[$SCRIPT_INDEX] WARNING: MCP engine functions not found; skipping MCP step."
    fi
else
    echo "[$SCRIPT_INDEX] WARNING: MCP sync engine not found at: $MCP_SYNC_ENGINE_LIB; skipping MCP step."
fi

echo ""
echo "[$SCRIPT_INDEX] Claude Code provisioning completed (native install + all-users bin + claudeteam + MCP)."
