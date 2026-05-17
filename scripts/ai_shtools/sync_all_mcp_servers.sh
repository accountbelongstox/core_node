#!/usr/bin/env bash
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

# Sync All MCP Servers - Orchestrator (Bash version)
# Runs all MCP sync scripts in sequence.
# Supports both desktop and non-desktop Linux environments.
# All output is real-time. No exit codes.

#region Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CONTEXT7_AUTO_FIX_SH="${PROJECT_ROOT}/ncore/mcp_server/auto-context7-mcp/auto_fix_context7.sh"
IS_DESKTOP=false
#endregion

#region Desktop Detection
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ] || [ -n "$XDG_SESSION_TYPE" ]; then
    IS_DESKTOP=true
fi
#endregion

#region Step Runner
run_step() {
    local step_num="$1"
    local total="$2"
    local title="$3"
    local script_path="$4"
    echo "========================================"
    echo "[*] Step ${step_num}/${total}: ${title}"
    echo "========================================"
    if [ ! -f "$script_path" ]; then
        echo "[WARNING] Script not found: ${script_path}, skipping."
        echo ""
        return
    fi
    bash "$script_path"
    echo ""
}
#endregion

#region Main
echo "========================================"
echo "[*]   Sync All MCP Services (Linux)"
echo "========================================"
echo ""

if [ "$IS_DESKTOP" = true ]; then
    echo "[INFO] Desktop environment detected. Chrome MCP will be included."
else
    echo "[INFO] Non-desktop environment. Chrome MCP may not be available."
fi
echo ""

TOTAL_STEPS=5
CURRENT_STEP=0

# Step 1: Context7 MCP (ensure npx package)
CURRENT_STEP=$((CURRENT_STEP + 1))
echo "========================================"
echo "[*] Step ${CURRENT_STEP}/${TOTAL_STEPS}: Context7 MCP (npx @upstash/context7-mcp)"
echo "========================================"
if command -v npx >/dev/null 2>&1; then
    echo "[INFO] Checking Context7 package..."
    npx -y @upstash/context7-mcp --version
    echo "[INFO] Context7 package check done (see output above)."
else
    echo "[WARNING] npx not found; skipping Context7 package check."
fi
echo ""

# Step 2-6: Sync to each tool
CURRENT_STEP=$((CURRENT_STEP + 1))
run_step "$CURRENT_STEP" "$TOTAL_STEPS" "Sync MCP to Cursor" "${SCRIPT_DIR}/cursor_sync_mcp_servers.sh"

CURRENT_STEP=$((CURRENT_STEP + 1))
run_step "$CURRENT_STEP" "$TOTAL_STEPS" "Sync MCP to Claude" "${SCRIPT_DIR}/claude_sync_mcp_servers.sh"

CURRENT_STEP=$((CURRENT_STEP + 1))
run_step "$CURRENT_STEP" "$TOTAL_STEPS" "Sync MCP to Codex" "${SCRIPT_DIR}/codex_sync_mcp_servers.sh"

CURRENT_STEP=$((CURRENT_STEP + 1))
run_step "$CURRENT_STEP" "$TOTAL_STEPS" "Sync MCP to Gemini" "${SCRIPT_DIR}/gemini_sync_mcp_servers.sh"

# Optional: Droid (uncomment if needed)
# CURRENT_STEP=$((CURRENT_STEP + 1))
# run_step "$CURRENT_STEP" "$TOTAL_STEPS" "Sync MCP to Droid" "${SCRIPT_DIR}/droid_sync_mcp_servers.sh"

echo "========================================"
echo "[+] Sync All MCP Services finished."
echo "========================================"
#endregion
