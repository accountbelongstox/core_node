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

upgrade_choice=""
script_dir_path=""
scripts_dir_path=""
core_node_path=""
mcp_chrome_path=""
mcp_chrome_node_modules_path=""
mcp_chrome_shared_artifact_path=""
mcp_chrome_native_artifact_path=""
mcp_chrome_extension_manifest_path=""
mcp_chrome_register_script_path=""
mcp_chrome_url="http://127.0.0.1:12306/mcp"
mcp_chrome_needs_build=0
model="gpt-5.6-sol"
reasoning_effort="high"
codex_args=()

script_dir_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scripts_dir_path="$(dirname "$script_dir_path")"
core_node_path="$(dirname "$scripts_dir_path")"
mcp_chrome_path="$core_node_path/apps/mcp-chrome"
mcp_chrome_node_modules_path="$mcp_chrome_path/node_modules"
mcp_chrome_shared_artifact_path="$mcp_chrome_path/packages/shared/dist/index.js"
mcp_chrome_native_artifact_path="$mcp_chrome_path/app/native-server/dist/index.js"
mcp_chrome_extension_manifest_path="$mcp_chrome_path/.output/build_extension/manifest.json"
mcp_chrome_register_script_path="$mcp_chrome_path/scripts/register-local-dev.cjs"

codex_args=(
    --yolo
    --dangerously-bypass-hook-trust
    --search
    --model "$model"
    --config "model_reasoning_effort=\"$reasoning_effort\""
    --config "plan_mode_reasoning_effort=\"$reasoning_effort\""
    --config "agents.default_subagent_model=\"$model\""
    --config "agents.default_subagent_reasoning_effort=\"$reasoning_effort\""
)

echo ""
echo "============================================================"
echo "codexyolo.sh"
echo "============================================================"

read -r -p "Upgrade Codex CLI via 'pnpm add --global @openai/codex@latest'? [N/y]: " upgrade_choice || upgrade_choice=""
if [ "$upgrade_choice" = "y" ] || [ "$upgrade_choice" = "Y" ]; then
    if ! command -v pnpm >/dev/null 2>&1; then
        echo "[WARN] pnpm is unavailable; keeping the installed Codex CLI."
    else
        echo "[INFO] Upgrading Codex CLI with pnpm..."
        pnpm add --global @openai/codex@latest
        hash -r
        echo "[INFO] Codex CLI upgrade command completed."
    fi
else
    echo "[INFO] Codex CLI upgrade skipped."
fi

if ! command -v codex >/dev/null 2>&1; then
    echo "[ERROR] codex is not available on PATH."
    exit 1
fi

if [ ! -f "$mcp_chrome_shared_artifact_path" ] ||
    [ ! -f "$mcp_chrome_native_artifact_path" ] ||
    [ ! -f "$mcp_chrome_extension_manifest_path" ]; then
    mcp_chrome_needs_build=1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] node is required to install Chrome MCP."
    exit 1
fi
if { [ ! -d "$mcp_chrome_node_modules_path" ] || [ "$mcp_chrome_needs_build" -eq 1 ]; } &&
    ! command -v pnpm >/dev/null 2>&1; then
    echo "[ERROR] pnpm is required to install Chrome MCP."
    exit 1
fi

echo "[INFO] Ensuring Chrome MCP is installed..."
if [ ! -d "$mcp_chrome_node_modules_path" ]; then
    echo "[INFO] Installing Chrome MCP dependencies..."
    (
        cd "$mcp_chrome_path"
        pnpm install
    )
fi
if [ "$mcp_chrome_needs_build" -eq 1 ]; then
    echo "[INFO] Building missing Chrome MCP artifacts..."
    (
        cd "$mcp_chrome_path"
        pnpm run build:all
    )
fi
(
    cd "$mcp_chrome_path"
    node "$mcp_chrome_register_script_path"
)

codex mcp add chrome --url "$mcp_chrome_url"
echo "[INFO] Chrome MCP registered in Codex."

echo "[INFO] Model: $model ($reasoning_effort)"
echo "[INFO] YOLO: ON; live search: ON; hook trust bypass: ON"
echo "[INFO] Codex feature defaults preserved; extra args: $#"
echo "============================================================"
echo ""

exec codex "${codex_args[@]}" "$@"
