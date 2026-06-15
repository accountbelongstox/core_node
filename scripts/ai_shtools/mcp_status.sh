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

# MCP status / detection (Linux). Mirrors scripts/ai_ps1tools/mcp_status.ps1:
# detects installed AI tools, reads each tool's already-configured MCP servers,
# and reports key availability for key-gated servers. Display only.

MCP_STATUS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${MCP_JSON_HELPER:-}" ]; then
    # shellcheck source=mcp_sync_engine.sh
    . "$MCP_STATUS_DIR/mcp_sync_engine.sh"
fi

# Registry rows: key|display|detect_cmds(comma)|extra_cmds(comma)|kind|topkey
mcp_registry() {
    cat <<'EOF'
claude|Claude Code|claude||json|mcpServers
cursor|Cursor|cursor|cursor-agent|json|mcpServers
codex|Codex|codex||toml|
gemini|Gemini CLI|gemini||json|mcpServers
droid|Droid (Factory)|droid||json|mcpServers
windsurf|Windsurf|windsurf||json|mcpServers
devin|Devin CLI|devin||json|mcpServers
vscode|VS Code|code|code-insiders|json|servers
EOF
}

mcp_cmd_avail() { command -v "$1" >/dev/null 2>&1; }

mcp_existing_servers() {
    # args: kind topkey configpath -> echoes space-separated server names
    local kind="$1" topkey="$2" path="$3" py
    [ -f "$path" ] || return 0
    if [ "$kind" = "toml" ]; then
        grep -oE '^\[mcp_servers\.[^.]+\]' "$path" 2>/dev/null \
            | sed -E 's/^\[mcp_servers\.(.+)\]$/\1/' | tr '\n' ' '
        return 0
    fi
    py="$(mcp_python)" || return 0
    MCP_TOPKEY="$topkey" "$py" - "$path" <<'PYEOF'
import json, os, sys
try:
    with open(sys.argv[1], encoding="utf-8-sig") as f:
        d = json.load(f)
except Exception:
    sys.exit(0)
k = os.environ["MCP_TOPKEY"]
node = d.get(k) if isinstance(d, dict) else None
if isinstance(node, dict):
    print(" ".join(node.keys()))
PYEOF
}

mcp_show_status_panel() {
    local tool disp detect extra kind topkey avail cfg existing mark extratag c
    local -a dc ec
    echo "-- Detected AI tools / existing MCP ----------------------"
    while IFS='|' read -r tool disp detect extra kind topkey; do
        [ -n "$tool" ] || continue
        avail=0
        IFS=',' read -ra dc <<< "$detect"
        for c in "${dc[@]}"; do
            [ -n "$c" ] && mcp_cmd_avail "$c" && avail=1
        done
        if [ "$tool" = "codex" ]; then
            cfg="$MCP_CODEX_CONFIG"
        else
            cfg="$(mcp_config_path_for "$tool" 2>/dev/null)"
        fi
        [ -n "$cfg" ] && [ -f "$cfg" ] && avail=1
        existing="$(mcp_existing_servers "$kind" "$topkey" "$cfg")"
        existing="$(printf '%s' "$existing" | sed 's/[[:space:]]\+$//')"
        extratag=""
        if [ -n "$extra" ]; then
            IFS=',' read -ra ec <<< "$extra"
            for c in "${ec[@]}"; do
                [ -n "$c" ] && mcp_cmd_avail "$c" && extratag="$extratag +$c"
            done
        fi
        if [ "$avail" -eq 1 ]; then
            mark="[OK]"
            printf '  \033[32m%s %-16s mcp: %s%s\033[0m\n' "$mark" "$disp" "${existing:-(none)}" "$extratag"
        else
            mark="[--]"
            printf '  \033[90m%s %-16s not detected\033[0m\n' "$mark" "$disp"
        fi
    done < <(mcp_registry)

    echo "-- Keys (for key-gated servers) --------------------------"
    local key masked
    key="$(mcp_get_secret CONTEXT7_API_KEY_1 || true)"
    if [ -n "$key" ]; then
        masked="****${key: -4}"
        printf '  \033[32m[OK] CONTEXT7_API_KEY -> loaded (%s)  [server: context7]\033[0m\n' "$masked"
    else
        printf '  \033[33m[--] CONTEXT7_API_KEY -> MISSING  [server: context7]\033[0m\n'
    fi
}

mcp_show_planned() {
    local py key
    py="$(mcp_python)" || { echo "[ERROR] python not found"; return 0; }
    echo "Planned MCP servers (dry-run, no changes written):"
    key="$(mcp_get_secret CONTEXT7_API_KEY_1 || true)"
    if [ -n "$key" ]; then
        echo "  [1] context7 (http)  url=https://mcp.context7.com/mcp  header CONTEXT7_API_KEY=****${key: -4}"
    else
        echo "  [1] context7 (http)  SKIPPED (CONTEXT7_API_KEY_1 missing)"
    fi
    echo "  [2] unified  (stdio) command=$py  args=[$MCP_PYMAIN app=mcp]  env MCP_ALLOW_ALL_PATHS=true"
    echo "  [3] chrome   (http)  url=http://127.0.0.1:12306/mcp"
}
