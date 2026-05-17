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

# Claude MCP Servers Configuration (Bash version)
# All commands execute directly with real-time output. No wrapping. No exit codes.

#region Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PROVIDER_SH="${SCRIPT_DIR}/mcp_config_provider.sh"
#endregion

# shellcheck source=mcp_config_provider.sh
. "$CONFIG_PROVIDER_SH"

echo "================================================================================"
echo "[CLAUDE] Configuring MCP servers using 'claude mcp add' commands"
echo "================================================================================"
echo ""

# Set CLAUDE_CODE_GIT_BASH_PATH if not set (Windows/MSYS2)
if [ -z "$CLAUDE_CODE_GIT_BASH_PATH" ]; then
    for bp in "/d/applications/Git/bin/bash.exe" "/c/Program Files/Git/bin/bash.exe" "/c/Git/bin/bash.exe"; do
        if [ -f "$bp" ]; then
            export CLAUDE_CODE_GIT_BASH_PATH="$bp"
            echo "[INFO] Set CLAUDE_CODE_GIT_BASH_PATH=$bp"
            break
        fi
    done
fi

echo "[INFO] Checking Claude CLI availability..."
claude --version
echo ""

load_all_mcp_configs "claude"

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
        # Variadic -H flags MUST come after positional name and url
        IFS='|' read -ra h_keys <<< "${MCP_HEADER_KEYS[$i]}"
        IFS='|' read -ra h_vals <<< "${MCP_HEADER_VALS[$i]}"
        header_args=()
        for ((j = 0; j < ${#h_keys[@]}; j++)); do
            header_args+=(-H "${h_keys[$j]}: ${h_vals[$j]}")
        done
        echo "[CMD] claude mcp add -t http -s user $name ${MCP_URLS[$i]} ${header_args[*]}"
        claude mcp add -t http -s user "$name" "${MCP_URLS[$i]}" "${header_args[@]}"
    else
        # Variadic -e flags MUST come after name, before --
        IFS='|' read -ra e_keys <<< "${MCP_ENV_KEYS[$i]}"
        IFS='|' read -ra e_vals <<< "${MCP_ENV_VALS[$i]}"
        IFS='|' read -ra args <<< "${MCP_ARGS[$i]}"
        env_args=()
        for ((j = 0; j < ${#e_keys[@]}; j++)); do
            [ -z "${e_keys[$j]}" ] && continue
            env_args+=(-e "${e_keys[$j]}=${e_vals[$j]}")
        done
        echo "[CMD] claude mcp add -t stdio -s user $name ${env_args[*]} -- ${MCP_COMMANDS[$i]} ${args[*]}"
        claude mcp add -t stdio -s user "$name" "${env_args[@]}" -- "${MCP_COMMANDS[$i]}" "${args[@]}"
    fi
    echo ""

    echo "[VERIFY] claude mcp list"
    claude mcp list
    echo ""
    echo "[VERIFY] claude mcp get $name"
    claude mcp get "$name"
    echo ""
done

echo "================================================================================"
echo "[SUMMARY] Claude MCP Configuration Complete"
echo "================================================================================"
