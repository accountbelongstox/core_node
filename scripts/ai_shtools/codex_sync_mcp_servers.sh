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

# Codex MCP Servers Configuration (Bash version)
# HTTP uses --url. All commands execute directly with real-time output.

#region Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PROVIDER_SH="${SCRIPT_DIR}/mcp_config_provider.sh"
#endregion

# shellcheck source=mcp_config_provider.sh
. "$CONFIG_PROVIDER_SH"

# 'codex mcp add --url' has no flag for custom HTTP headers, so context7's
# CONTEXT7_API_KEY header cannot be set via the CLI. This appends an
# [mcp_servers.<name>.http_headers] table to ~/.codex/config.toml. Any existing
# header table for the server is replaced. Args: <name> then key=value pairs.
set_codex_http_headers() {
    local name="$1"; shift
    local codex_config="${CODEX_HOME:-$HOME/.codex}/config.toml"
    if [ ! -f "$codex_config" ]; then
        echo "[WARNING] codex config.toml not found at $codex_config; cannot set headers for $name"
        return
    fi
    local section="[mcp_servers.${name}.http_headers]"
    local tmp
    tmp="$(mktemp)"
    awk -v sec="$section" '
        $0 == sec { skip=1; next }
        skip==1 { if ($0 ~ /^\[/) { skip=0 } else { next } }
        { print }
    ' "$codex_config" > "$tmp"
    {
        echo ""
        echo "$section"
        local kv k v
        for kv in "$@"; do
            k="${kv%%=*}"
            v="${kv#*=}"
            v="${v//\\/\\\\}"
            v="${v//\"/\\\"}"
            echo "$k = \"$v\""
        done
    } >> "$tmp"
    mv "$tmp" "$codex_config"
    echo "[OK] Wrote http_headers for $name to codex config.toml"
}

echo "================================================================================"
echo "[CODEX] Configuring MCP servers using 'codex mcp add' commands"
echo "================================================================================"
echo ""

echo "[INFO] Checking Codex CLI availability..."
codex --version
echo ""

load_all_mcp_configs "codex"

if [ "$MCP_CONFIGS_COUNT" -eq 0 ]; then
    echo "[WARNING] No MCP servers to configure"
    exit 0
fi

echo "================================================================================"
echo ""

for ((i = 0; i < MCP_CONFIGS_COUNT; i++)); do
    idx=$((i + 1))
    name="${MCP_NAMES[$i]}"
    transport="${MCP_TRANSPORT_TYPES[$i]}"
    echo "[$idx/$MCP_CONFIGS_COUNT] Executing: $name ($transport)"

    # Remove any existing entry first so re-runs always apply the latest config.
    echo "[CLEAN] codex mcp remove $name"
    codex mcp remove "$name" 2>/dev/null || true
    if [ "$transport" = "http" ]; then
        echo "[CMD] codex mcp add $name --url ${MCP_URLS[$i]}"
        codex mcp add "$name" --url "${MCP_URLS[$i]}"
        IFS='|' read -ra h_keys <<< "${MCP_HEADER_KEYS[$i]}"
        IFS='|' read -ra h_vals <<< "${MCP_HEADER_VALS[$i]}"
        if [ "${#h_keys[@]}" -gt 0 ] && [ -n "${h_keys[0]}" ]; then
            kv_pairs=()
            for ((j = 0; j < ${#h_keys[@]}; j++)); do
                kv_pairs+=("${h_keys[$j]}=${h_vals[$j]}")
            done
            set_codex_http_headers "$name" "${kv_pairs[@]}"
        fi
    else
        IFS='|' read -ra e_keys <<< "${MCP_ENV_KEYS[$i]}"
        IFS='|' read -ra e_vals <<< "${MCP_ENV_VALS[$i]}"
        IFS='|' read -ra args <<< "${MCP_ARGS[$i]}"
        env_args=()
        for ((j = 0; j < ${#e_keys[@]}; j++)); do
            [ -z "${e_keys[$j]}" ] && continue
            env_args+=(--env "${e_keys[$j]}=${e_vals[$j]}")
        done
        echo "[CMD] codex mcp add $name ${env_args[*]} -- ${MCP_COMMANDS[$i]} ${args[*]}"
        codex mcp add "$name" "${env_args[@]}" -- "${MCP_COMMANDS[$i]}" "${args[@]}"
    fi
    echo ""

    echo "[VERIFY] codex mcp list"
    codex mcp list
    echo ""
done

echo "================================================================================"
echo "[SUMMARY] Codex MCP Configuration Complete"
echo "================================================================================"
