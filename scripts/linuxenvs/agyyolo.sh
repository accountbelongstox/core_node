#!/bin/bash

script_dir_path=""
script_source_path=""
scripts_dir_path=""
core_node_path=""
mcp_chrome_linux_common_dir=""
mcp_chrome_gvar_common_path=""
mcp_chrome_service_contract_common_path=""
ai_cli_provision_common_path=""
mcp_chrome_url=""
mcp_chrome_port=""
mcp_chrome_enabled=0
agy_bin=""
agy_candidate=""
agy_install_script_path=""
agy_config_dir=""
agy_mcp_config_path=""
agy_settings_path=""
agy_model="gemini-3.8-flash-high"
agy_model_label="Gemini 3.8 Flash (High)"
model_pick=""
agy_args=(--dangerously-skip-permissions --mode accept-edits)

script_source_path="${BASH_SOURCE[0]}"
if [ -L "$script_source_path" ]; then
    script_source_path="$(readlink -f "$script_source_path" 2>/dev/null || echo "$script_source_path")"
fi
script_dir_path="$(cd "$(dirname "$script_source_path")" && pwd)"
scripts_dir_path="$(dirname "$script_dir_path")"
core_node_path="$(dirname "$scripts_dir_path")"
agy_install_script_path="$scripts_dir_path/shells/linux/debian/install_shells/99_install_ai_tools.sh"

mcp_chrome_linux_common_dir="$core_node_path/scripts/shells/linux/common"
mcp_chrome_gvar_common_path="$mcp_chrome_linux_common_dir/gvar_common.sh"
mcp_chrome_service_contract_common_path="$mcp_chrome_linux_common_dir/service_contract_common.sh"
ai_cli_provision_common_path="$mcp_chrome_linux_common_dir/ai_cli_provision_common.sh"

source "$mcp_chrome_gvar_common_path"
source "$mcp_chrome_service_contract_common_path"
source "$ai_cli_provision_common_path"

mcp_chrome_port="$(sc_require ports.mcp_chrome)"
mcp_chrome_url="http://$(sc_require hosts.loopback):${mcp_chrome_port}/mcp"
if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ]; then
    mcp_chrome_enabled=1
fi

echo ""
echo "============================================================"
echo "agyyolo.sh - Antigravity CLI YOLO Auto Mode"
echo "============================================================"

# Ensure PATH contains standard bin directories
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
hash -r 2>/dev/null || true

# Idempotent agy installation (owned by 99_install_ai_tools.sh) and path discovery
if ! command -v agy >/dev/null 2>&1; then
    echo "[INFO] agy is not available on PATH; installing via 99_install_ai_tools.sh --only agy..."
    bash "$agy_install_script_path" --only agy
    export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
    hash -r 2>/dev/null || true
fi

if command -v agy >/dev/null 2>&1; then
    agy_bin="$(command -v agy)"
else
    for agy_candidate in "$HOME/.local/bin/agy" "/usr/local/bin/agy" "/root/.local/bin/agy"; do
        if [ -x "$agy_candidate" ]; then
            agy_bin="$agy_candidate"
            break
        fi
    done
fi

if [ -z "$agy_bin" ] || [ ! -x "$agy_bin" ]; then
    echo "[ERROR] agy installation did not succeed; agy is still not executable."
    exit 1
fi

echo "[INFO] Using agy executable: $agy_bin"

# Model selection (default 1 = Gemini 3.8 Flash High; auto-select in 5 seconds)
echo "Select model (default 1 = Gemini 3.8 Flash High; auto-select in 5 seconds):"
echo "  [1] Gemini 3.8 Flash High (gemini-3.8-flash-high)"
echo "  [2] Claude Sonnet 4.6 Thinking (claude-sonnet-4-6)"
echo "  [3] Gemini 3.1 Pro High (gemini-3.1-pro-high)"
echo "  [4] Claude Opus 4.6 Thinking (claude-opus-4-6-thinking)"
printf '\033[33mModel number [1-4] (Enter or timeout = 1): \033[0m'
read -r -t 5 model_pick || model_pick=""
if [ -z "$model_pick" ]; then
    model_pick="1"
    echo "1 (auto)"
fi
case "$model_pick" in
    2) agy_model="claude-sonnet-4-6"; agy_model_label="Claude Sonnet 4.6 Thinking" ;;
    3) agy_model="gemini-3.1-pro-high"; agy_model_label="Gemini 3.1 Pro High" ;;
    4) agy_model="claude-opus-4-6-thinking"; agy_model_label="Claude Opus 4.6 Thinking" ;;
    *) agy_model="gemini-3.8-flash-high"; agy_model_label="Gemini 3.8 Flash (High)" ;;
esac
echo "[INFO] Model: $agy_model_label ($agy_model)"
agy_args+=(--model "$agy_model")

# Chrome MCP (apps/mcp-chrome) setup & auto-load
if [ "$mcp_chrome_enabled" -eq 1 ]; then
    agy_config_dir="$HOME/.gemini/config"
    agy_mcp_config_path="$agy_config_dir/mcp_config.json"

    ai_cli_mcp_chrome_service_ensure

    # Register in agy via CLI and configuration file
    "$agy_bin" mcp add chrome "$mcp_chrome_url" >/dev/null 2>&1 || true

    mkdir -p "$agy_config_dir"
    node - "$agy_mcp_config_path" "$mcp_chrome_url" <<'NODE'
const fs = require("node:fs");
const configPath = process.argv[2];
const chromeUrl = process.argv[3];
let config = {};
try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
} catch {
    config = {};
}
config.mcpServers = config.mcpServers || {};
config.mcpServers.chrome = {
    disabled: false,
    serverUrl: chromeUrl
};
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
NODE
    echo "[INFO] Chrome MCP registered in Antigravity: $mcp_chrome_url"
else
    echo "[INFO] No desktop environment; skipping Chrome MCP setup."
fi

# Auto-configure workspace trust in settings.json
agy_settings_path="$HOME/.gemini/antigravity-cli/settings.json"
mkdir -p "$(dirname "$agy_settings_path")"
node - "$agy_settings_path" "$core_node_path" "$(pwd)" <<'NODE'
const fs = require("node:fs");
const settingsPath = process.argv[2];
const coreNode = process.argv[3];
const currentCwd = process.argv[4];
let settings = {};
try {
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    }
} catch {
    settings = {};
}
settings.trustedWorkspaces = settings.trustedWorkspaces || [];
if (!settings.trustedWorkspaces.includes(coreNode)) {
    settings.trustedWorkspaces.push(coreNode);
}
if (!settings.trustedWorkspaces.includes(currentCwd)) {
    settings.trustedWorkspaces.push(currentCwd);
}
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
NODE

echo "[INFO] YOLO auto mode: ON (--dangerously-skip-permissions)"
echo "[INFO] Execution mode: accept-edits (--mode accept-edits)"
echo "[INFO] Model: $agy_model_label ($agy_model)"
echo "[INFO] Extra args: $#"
echo "============================================================"
echo ""

exec "$agy_bin" "${agy_args[@]}" "$@"
