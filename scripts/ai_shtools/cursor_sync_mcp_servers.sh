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

# Cursor MCP Servers Configuration (Bash version)
# Updates mcp.json file using inline python3 (stdlib json only).
# All output is real-time. No exit codes.

#region Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PROVIDER_SH="${SCRIPT_DIR}/mcp_config_provider.sh"
CURSOR_CONFIG_PATH=""
PYTHON_CMD=""
#endregion

#region Load Config Provider
# shellcheck source=mcp_config_provider.sh
. "$CONFIG_PROVIDER_SH"
#endregion

#region Find Python
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "[ERROR] python3/python not found. Required for JSON file operations."
    exit 0
fi
#endregion

#region Find Cursor Config Path
find_cursor_config() {
    local home_dir="$HOME"
    local paths=(
        "${home_dir}/.cursor/mcp.json"
        "${home_dir}/.config/cursor/mcp.json"
    )
    for p in "${paths[@]}"; do
        local parent_dir
        parent_dir="$(dirname "$p")"
        if [ -d "$parent_dir" ]; then
            echo "$p"
            return
        fi
    done
    # Default: create ~/.cursor/
    local default_path="${paths[0]}"
    local default_parent
    default_parent="$(dirname "$default_path")"
    mkdir -p "$default_parent"
    echo "$default_path"
}

CURSOR_CONFIG_PATH="$(find_cursor_config)"
#endregion

#region Main Logic
echo "================================================================================"
echo "[CURSOR] Configuring MCP servers via mcp.json"
echo "================================================================================"
echo ""

load_all_mcp_configs "cursor"

if [ "$MCP_CONFIGS_COUNT" -eq 0 ]; then
    echo "[WARNING] No MCP servers to configure"
    exit 0
fi

echo "[INFO] Cursor MCP file: ${CURSOR_CONFIG_PATH}"
echo ""

# Build JSON update payload using python3 inline (stdlib only)
# Collect all configs as JSON arguments
CONFIG_JSON_ARGS=""
for ((i = 0; i < MCP_CONFIGS_COUNT; i++)); do
    name="${MCP_NAMES[$i]}"
    transport="${MCP_TRANSPORT_TYPES[$i]}"

    if [ "$transport" = "http" ]; then
        # Build headers JSON
        headers_json="{}"
        if [ -n "${MCP_HEADER_KEYS[$i]}" ]; then
            IFS='|' read -ra h_keys <<< "${MCP_HEADER_KEYS[$i]}"
            IFS='|' read -ra h_vals <<< "${MCP_HEADER_VALS[$i]}"
            headers_parts=""
            for ((j = 0; j < ${#h_keys[@]}; j++)); do
                [ -n "$headers_parts" ] && headers_parts="${headers_parts},"
                headers_parts="${headers_parts}\"${h_keys[$j]}\":\"${h_vals[$j]}\""
            done
            headers_json="{${headers_parts}}"
        fi
        CONFIG_JSON_ARGS="${CONFIG_JSON_ARGS}|http|${name}|${MCP_URLS[$i]}|${headers_json}"
    else
        # Build env JSON
        env_json="{}"
        if [ -n "${MCP_ENV_KEYS[$i]}" ]; then
            IFS='|' read -ra e_keys <<< "${MCP_ENV_KEYS[$i]}"
            IFS='|' read -ra e_vals <<< "${MCP_ENV_VALS[$i]}"
            env_parts=""
            for ((j = 0; j < ${#e_keys[@]}; j++)); do
                [ -z "${e_keys[$j]}" ] && continue
                [ -n "$env_parts" ] && env_parts="${env_parts},"
                env_parts="${env_parts}\"${e_keys[$j]}\":\"${e_vals[$j]}\""
            done
            env_json="{${env_parts}}"
        fi
        # Join args with space
        IFS='|' read -ra args <<< "${MCP_ARGS[$i]}"
        args_joined="${args[*]}"
        CONFIG_JSON_ARGS="${CONFIG_JSON_ARGS}|stdio|${name}|${MCP_COMMANDS[$i]}|${args_joined}|${env_json}"
    fi
done

$PYTHON_CMD -u -c "
import json, sys, os

config_path = sys.argv[1]
raw_args = sys.argv[2]

# Load existing
settings = {}
if os.path.exists(config_path):
    with open(config_path, 'r', encoding='utf-8') as f:
        try:
            settings = json.load(f)
        except Exception:
            settings = {}

if 'mcpServers' not in settings or not isinstance(settings.get('mcpServers'), dict):
    settings['mcpServers'] = {}

# Parse configs from pipe-separated args
parts = raw_args.split('|')
idx = 0
count = 0
while idx < len(parts):
    if not parts[idx]:
        idx += 1
        continue
    transport = parts[idx]
    if transport == 'http':
        name = parts[idx + 1]
        url = parts[idx + 2]
        headers = json.loads(parts[idx + 3])
        entry = {'url': url}
        if headers:
            entry['headers'] = headers
        settings['mcpServers'][name] = entry
        count += 1
        print(f'[{count}] {name} (http)')
        print(f'    Config: {json.dumps(entry)}')
        idx += 4
    elif transport == 'stdio':
        name = parts[idx + 1]
        command = parts[idx + 2]
        args_str = parts[idx + 3]
        env = json.loads(parts[idx + 4])
        args_list = args_str.split() if args_str else []
        entry = {'command': command, 'args': args_list}
        if env:
            entry['env'] = env
        settings['mcpServers'][name] = entry
        count += 1
        print(f'[{count}] {name} (stdio)')
        print(f'    Config: {json.dumps(entry)}')
        idx += 5
    else:
        idx += 1

# Save
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(settings, f, indent=2, ensure_ascii=True)

print()
print(f'[INFO] Settings written to: {config_path}')

# Verify by re-reading
with open(config_path, 'r', encoding='utf-8') as f:
    reloaded = json.load(f)
keys = sorted(reloaded.get('mcpServers', {}).keys())
print(f'[VERIFY] mcpServers keys in file: {keys}')
for k in keys:
    print(f'[VERIFY] {k}: OK')
print(f'[SUCCESS] Cursor MCP configuration updated: {config_path}')
" "$CURSOR_CONFIG_PATH" "$CONFIG_JSON_ARGS"

echo ""
echo "================================================================================"
echo "[SUMMARY] Cursor MCP Configuration Complete"
echo "================================================================================"
#endregion
