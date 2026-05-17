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

# Droid MCP Servers Configuration (Bash version)
# All commands execute directly with real-time output. No wrapping. No exit codes.

#region Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PROVIDER_SH="${SCRIPT_DIR}/mcp_config_provider.sh"
#endregion

# shellcheck source=mcp_config_provider.sh
. "$CONFIG_PROVIDER_SH"

echo "================================================================================"
echo "[DROID] Configuring MCP servers using 'droid mcp add' commands"
echo "================================================================================"
echo ""

echo "[INFO] Checking Droid CLI availability..."
droid --version
echo ""

load_all_mcp_configs "droid"

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

    if [ "$transport" = "http" ]; then
        IFS='|' read -ra h_keys <<< "${MCP_HEADER_KEYS[$i]}"
        IFS='|' read -ra h_vals <<< "${MCP_HEADER_VALS[$i]}"
        header_args=()
        for ((j = 0; j < ${#h_keys[@]}; j++)); do
            header_args+=(--header "${h_keys[$j]}: ${h_vals[$j]}")
        done
        echo "[CMD] droid mcp add $name --transport http --url ${MCP_URLS[$i]} ${header_args[*]}"
        droid mcp add "$name" --transport http --url "${MCP_URLS[$i]}" "${header_args[@]}"
    else
        IFS='|' read -ra e_keys <<< "${MCP_ENV_KEYS[$i]}"
        IFS='|' read -ra e_vals <<< "${MCP_ENV_VALS[$i]}"
        IFS='|' read -ra args <<< "${MCP_ARGS[$i]}"
        env_args=()
        for ((j = 0; j < ${#e_keys[@]}; j++)); do
            [ -z "${e_keys[$j]}" ] && continue
            env_args+=(--env "${e_keys[$j]}=${e_vals[$j]}")
        done
        echo "[CMD] droid mcp add --transport stdio ${env_args[*]} $name -- ${MCP_COMMANDS[$i]} ${args[*]}"
        droid mcp add --transport stdio "${env_args[@]}" "$name" -- "${MCP_COMMANDS[$i]}" "${args[@]}"
    fi
    echo ""

    echo "[VERIFY] droid mcp list"
    droid mcp list
    echo ""
done

echo "================================================================================"
echo "[SUMMARY] Droid MCP Configuration Complete"
echo "================================================================================"
