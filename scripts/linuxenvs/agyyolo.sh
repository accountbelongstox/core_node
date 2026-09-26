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

script_dir_path=""
script_source_path=""
scripts_dir_path=""
core_node_path=""
mcp_chrome_path=""
mcp_chrome_node_modules_path=""
mcp_chrome_shared_artifact_path=""
mcp_chrome_native_artifact_path=""
mcp_chrome_extension_manifest_path=""
mcp_chrome_register_script_path=""
mcp_chrome_supervisor_script_path=""
mcp_chrome_dev_log_path=""
mcp_chrome_linux_common_dir=""
mcp_chrome_gvar_common_path=""
mcp_chrome_venv_python_common_path=""
mcp_chrome_service_contract_common_path=""
mcp_chrome_python_path=""
mcp_chrome_url=""
mcp_chrome_port=""
mcp_chrome_port_ready=0
mcp_chrome_port_wait_count=0
mcp_chrome_needs_build=0
mcp_chrome_installed=0
mcp_chrome_just_installed=0
mcp_chrome_enabled=0
agy_bin=""
agy_candidate=""
agy_installer_url="https://antigravity.google/cli/install.sh"
agy_shared_bin_path="/usr/local/bin/agy"
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

mcp_chrome_path="$core_node_path/apps/mcp-chrome"
mcp_chrome_node_modules_path="$mcp_chrome_path/node_modules"
mcp_chrome_shared_artifact_path="$mcp_chrome_path/packages/shared/dist/index.js"
mcp_chrome_native_artifact_path="$mcp_chrome_path/app/native-server/dist/index.js"
mcp_chrome_register_script_path="$mcp_chrome_path/scripts/register-local-dev.cjs"
mcp_chrome_supervisor_script_path="$mcp_chrome_path/scripts/service_supervisor.py"
mcp_chrome_dev_log_path="/tmp/mcp-chrome-agyyolo.log"
mcp_chrome_linux_common_dir="$core_node_path/scripts/shells/linux/common"
mcp_chrome_gvar_common_path="$mcp_chrome_linux_common_dir/gvar_common.sh"
mcp_chrome_venv_python_common_path="$mcp_chrome_linux_common_dir/venv_python_common.sh"
mcp_chrome_service_contract_common_path="$mcp_chrome_linux_common_dir/service_contract_common.sh"

source "$mcp_chrome_gvar_common_path"
source "$mcp_chrome_venv_python_common_path"
source "$mcp_chrome_service_contract_common_path"
mcp_chrome_extension_manifest_path="$mcp_chrome_path/$(sc_require mcp_chrome.build_output_dir)/$(sc_require mcp_chrome.extension_dir)/manifest.json"

mcp_chrome_port="$(sc_require ports.mcp_chrome)"
mcp_chrome_url="http://$(sc_require hosts.loopback):${mcp_chrome_port}/mcp"
mcp_chrome_python_path="$VENV_PYTHON3"
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

# Idempotent agy installation and path discovery
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

if [ -z "$agy_bin" ]; then
    echo "[INFO] agy is not available on PATH; installing via official fast-path installer..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$agy_installer_url" | bash
        hash -r 2>/dev/null || true
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$agy_installer_url" | bash
        hash -r 2>/dev/null || true
    else
        echo "[ERROR] agy is not available on PATH and curl/wget is missing."
        exit 1
    fi

    export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
    hash -r 2>/dev/null || true

    if command -v agy >/dev/null 2>&1; then
        agy_bin="$(command -v agy)"
    elif [ -x "$HOME/.local/bin/agy" ]; then
        agy_bin="$HOME/.local/bin/agy"
    elif [ -x "/usr/local/bin/agy" ]; then
        agy_bin="/usr/local/bin/agy"
    fi
fi

if [ -z "$agy_bin" ] || [ ! -x "$agy_bin" ]; then
    echo "[ERROR] agy installation did not succeed; agy is still not executable."
    exit 1
fi

# Ensure agy is accessible to all users via /usr/local/bin
if [ "$agy_bin" != "$agy_shared_bin_path" ] && [ ! -x "$agy_shared_bin_path" ]; then
    if [ "$EUID" -eq 0 ]; then
        if [[ "$agy_bin" == /root/* ]]; then
            cp -f "$agy_bin" "$agy_shared_bin_path" 2>/dev/null || true
            chmod 0755 "$agy_shared_bin_path" 2>/dev/null || true
        else
            ln -sf "$agy_bin" "$agy_shared_bin_path" 2>/dev/null || true
        fi
    elif command -v sudo >/dev/null 2>&1; then
        if [[ "$agy_bin" == /root/* ]]; then
            sudo cp -f "$agy_bin" "$agy_shared_bin_path" 2>/dev/null || true
            sudo chmod 0755 "$agy_shared_bin_path" 2>/dev/null || true
        else
            sudo ln -sf "$agy_bin" "$agy_shared_bin_path" 2>/dev/null || true
        fi
    fi
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

    if [ ! -f "$mcp_chrome_shared_artifact_path" ] ||
       [ ! -f "$mcp_chrome_native_artifact_path" ] ||
       [ ! -f "$mcp_chrome_extension_manifest_path" ]; then
        mcp_chrome_needs_build=1
    fi

    if [ -f "$agy_mcp_config_path" ] && [ "$mcp_chrome_needs_build" -eq 0 ] &&
        grep -q '"chrome"' "$agy_mcp_config_path" 2>/dev/null; then
        mcp_chrome_installed=1
    fi

    if [ "$mcp_chrome_installed" -eq 1 ]; then
        echo "[INFO] Chrome MCP already installed and configured."
    else
        mcp_chrome_just_installed=1
        if ! command -v node >/dev/null 2>&1; then
            echo "[ERROR] node is required for Chrome MCP."
            exit 1
        fi

        if [ ! -d "$mcp_chrome_node_modules_path" ] || [ "$mcp_chrome_needs_build" -eq 1 ]; then
            echo "[INFO] Ensuring Chrome MCP dependencies and artifacts..."
            if command -v bun >/dev/null 2>&1; then
                (cd "$mcp_chrome_path" && bun install && [ "$mcp_chrome_needs_build" -eq 1 ] && bun run build:all)
            elif command -v pnpm >/dev/null 2>&1; then
                (cd "$mcp_chrome_path" && pnpm install && [ "$mcp_chrome_needs_build" -eq 1 ] && pnpm run build:all)
            elif command -v npm >/dev/null 2>&1; then
                (cd "$mcp_chrome_path" && npm install && [ "$mcp_chrome_needs_build" -eq 1 ] && npm run build:all)
            fi
        fi

        (cd "$mcp_chrome_path" && node "$mcp_chrome_register_script_path")

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
    fi

    # Ensure the singleton Chrome MCP supervisor is running
    if (echo >"/dev/tcp/127.0.0.1/$mcp_chrome_port") >/dev/null 2>&1; then
        mcp_chrome_port_ready=1
    fi
    if [ "$mcp_chrome_port_ready" -eq 0 ]; then
        echo "[INFO] Starting the singleton Chrome MCP supervisor..."
        if [ "$mcp_chrome_needs_build" -eq 1 ]; then
            "$mcp_chrome_python_path" "$mcp_chrome_supervisor_script_path" --project-root "$mcp_chrome_path" --watch-mode dev --recover-on-start >"$mcp_chrome_dev_log_path" 2>&1 &
        else
            "$mcp_chrome_python_path" "$mcp_chrome_supervisor_script_path" --project-root "$mcp_chrome_path" --watch-mode dev >"$mcp_chrome_dev_log_path" 2>&1 &
        fi
        if [ "$mcp_chrome_just_installed" -eq 1 ]; then
            while [ "$mcp_chrome_port_ready" -eq 0 ] && [ "$mcp_chrome_port_wait_count" -lt 20 ]; do
                sleep 0.5
                if (echo >"/dev/tcp/127.0.0.1/$mcp_chrome_port") >/dev/null 2>&1; then
                    mcp_chrome_port_ready=1
                fi
                mcp_chrome_port_wait_count=$((mcp_chrome_port_wait_count + 1))
            done
        fi
    fi
    if [ "$mcp_chrome_port_ready" -eq 1 ]; then
        echo "[INFO] Chrome MCP is listening on 127.0.0.1:$mcp_chrome_port."
    else
        echo "[INFO] Chrome MCP supervisor initialized ($mcp_chrome_url)."
    fi
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
