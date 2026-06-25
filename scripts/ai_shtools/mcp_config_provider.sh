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

# Common MCP Configuration Provider (Bash version)
# Provides unified MCP server configurations and secret reading for all AI tools.
# Source this file to use: . /path/to/mcp_config_provider.sh

#region Variable Declarations
MCP_PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_PROVIDER_SCRIPTS_DIR="$(dirname "$MCP_PROVIDER_DIR")"
MCP_PROJECT_ROOT="$(dirname "$MCP_PROVIDER_SCRIPTS_DIR")"
MCP_SECRET_KEYS_DIR="${MCP_PROJECT_ROOT}/.secret_keys"
MCP_SECRET_RAW_DIR="${MCP_SECRET_KEYS_DIR}/.secret_ignore"

# MCP config arrays (indexed by position)
MCP_CONFIGS_COUNT=0
MCP_NAMES=()
MCP_TRANSPORT_TYPES=()
MCP_COMMANDS=()
MCP_ARGS=()
MCP_URLS=()
MCP_HEADER_KEYS=()
MCP_HEADER_VALS=()
MCP_ENV_KEYS=()
MCP_ENV_VALS=()
#endregion

#region Secret Manager
get_secret_key() {
    local key_name="$1"
    local raw_file="${MCP_SECRET_RAW_DIR}/${key_name}"
    if [ ! -f "$raw_file" ]; then
        echo ""
        return
    fi
    local line
    while IFS= read -r line || [ -n "$line" ]; do
        # Remove BOM if present
        line="${line#$'\xef\xbb\xbf'}"
        line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        if [ -n "$line" ]; then
            echo "$line"
            return
        fi
    done < "$raw_file"
    echo ""
}
#endregion

#region Config Builder
_mcp_add_config() {
    local name="$1"
    local transport="$2"
    local command="$3"
    local args="$4"
    local url="$5"
    local header_keys="$6"
    local header_vals="$7"
    local env_keys="$8"
    local env_vals="$9"

    MCP_NAMES+=("$name")
    MCP_TRANSPORT_TYPES+=("$transport")
    MCP_COMMANDS+=("$command")
    MCP_ARGS+=("$args")
    MCP_URLS+=("$url")
    MCP_HEADER_KEYS+=("$header_keys")
    MCP_HEADER_VALS+=("$header_vals")
    MCP_ENV_KEYS+=("$env_keys")
    MCP_ENV_VALS+=("$env_vals")
    MCP_CONFIGS_COUNT=$((MCP_CONFIGS_COUNT + 1))
}

load_all_mcp_configs() {
    local target="${1:-claude}"

    # Reset arrays
    MCP_CONFIGS_COUNT=0
    MCP_NAMES=()
    MCP_TRANSPORT_TYPES=()
    MCP_COMMANDS=()
    MCP_ARGS=()
    MCP_URLS=()
    MCP_HEADER_KEYS=()
    MCP_HEADER_VALS=()
    MCP_ENV_KEYS=()
    MCP_ENV_VALS=()

    echo "[INFO] Loading MCP configurations for ${target}..."
    echo ""

    # Context7 MCP (HTTP)
    local context7_api_key
    context7_api_key="$(get_secret_key "CONTEXT7_API_KEY_1")"
    if [ -z "$context7_api_key" ]; then
        echo "[ERROR] CONTEXT7_API_KEY not found in secret manager."
        echo "[HINT] Please add CONTEXT7_API_KEY_1 to: ${MCP_SECRET_RAW_DIR}"
    else
        echo "[INFO] Context7 API key loaded successfully"
        _mcp_add_config \
            "context7" \
            "http" \
            "" \
            "" \
            "https://mcp.context7.com/mcp" \
            "CONTEXT7_API_KEY|Accept" \
            "${context7_api_key}|application/json, text/event-stream" \
            "" \
            ""
    fi

    # Chrome MCP Server (HTTP) - only for desktop environments
    _mcp_add_config \
        "chrome" \
        "http" \
        "" \
        "" \
        "http://127.0.0.1:12306/mcp" \
        "" \
        "" \
        "" \
        ""

    echo ""
    echo "[INFO] Loaded ${MCP_CONFIGS_COUNT} MCP configuration(s):"
    local i
    for ((i = 0; i < MCP_CONFIGS_COUNT; i++)); do
        echo "  - ${MCP_NAMES[$i]} (${MCP_TRANSPORT_TYPES[$i]})"
    done
    echo ""
}

get_mcp_project_root() {
    echo "$MCP_PROJECT_ROOT"
}
#endregion
