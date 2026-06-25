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

# MCP sync engine (Linux, canonical). Single source of truth for Linux MCP sync.
# REUSES the cross-platform scripts/ai_ps1tools/_json_sync_helper.py so the per-tool
# JSON schemas (claude/cursor/gemini/droid/windsurf/devin/vscode) stay identical to
# Windows. Codex uses TOML (config.toml) for http + the codex CLI for stdio.
# cunzhi/wait_please is intentionally NOT installed. All output is real-time.
# Source this file, then call mcp_sync_tool <name> / mcp_sync_all / mcp_install_all.

# scripts/ai_shtools/mcp_sync_engine.sh -> core_node root is two levels up.
MCP_ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CORE_NODE_DIR="$(cd "$MCP_ENGINE_DIR/../.." && pwd)"
MCP_JSON_HELPER="$MCP_CORE_NODE_DIR/scripts/ai_ps1tools/_json_sync_helper.py"
MCP_SECRET_RAW_DIR="$MCP_CORE_NODE_DIR/.secret_keys/.secret_ignore"
MCP_CODEX_CONFIG="$HOME/.codex/config.toml"
MCP_CHROME_START_SH="$MCP_CORE_NODE_DIR/apps/mcp-chrome/scripts/start.sh"
MCP_CONTEXT7_SH="$MCP_CORE_NODE_DIR/ncore/mcp_server/auto-context7-mcp/auto_fix_context7.sh"
MCP_JSON_TOOLS="claude cursor gemini droid windsurf devin vscode"

mcp_python() {
    # Prefer python3, then python; skip the Windows Store stub (errors when run).
    local c p
    for c in python3 python; do
        if command -v "$c" >/dev/null 2>&1; then
            p="$(command -v "$c")"
            case "$p" in
                *WindowsApps*) continue ;;
            esac
            printf '%s' "$p"
            return 0
        fi
    done
    return 1
}

mcp_get_secret() {
    local key_name="$1"
    local raw_file="$MCP_SECRET_RAW_DIR/$key_name"
    [ -s "$raw_file" ] || return 1
    local line
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line#$'\xef\xbb\xbf'}"
        line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        if [ -n "$line" ]; then printf '%s' "$line"; return 0; fi
    done < "$raw_file"
    return 1
}

# Build the tool-agnostic entries JSON (helper transforms it per target). Uses
# python json.dumps so secret values / paths are escaped safely. Echoes a temp path.
mcp_build_entries() {
    local py="$1" key tmp
    key="$(mcp_get_secret CONTEXT7_API_KEY_1 || true)"
    if [ -n "$key" ]; then
        echo "[INFO] Context7 API key loaded successfully" >&2
    else
        echo "[WARNING] CONTEXT7_API_KEY_1 not found in $MCP_SECRET_RAW_DIR (context7 skipped)" >&2
    fi
    tmp="$(mktemp "${TMPDIR:-/tmp}/mcp_entries.XXXXXX.json")"
    MCP_CTX_KEY="$key" "$py" - "$tmp" <<'PYEOF'
import json, os, sys
out_path = sys.argv[1]
key = os.environ.get("MCP_CTX_KEY", "")
entries = []
if key:
    entries.append({
        "name": "context7", "transport": "http",
        "url": "https://mcp.context7.com/mcp",
        "headers": {"CONTEXT7_API_KEY": key, "Accept": "application/json, text/event-stream"},
    })
entries.append({"name": "chrome", "transport": "http", "url": "http://127.0.0.1:12306/mcp"})
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(entries, f)
PYEOF
    printf '%s' "$tmp"
}

mcp_config_path_for() {
    local tool="$1"
    case "$tool" in
        claude)   printf '%s' "$HOME/.claude.json" ;;
        cursor)   printf '%s' "$HOME/.cursor/mcp.json" ;;
        gemini)   printf '%s' "$HOME/.gemini/settings.json" ;;
        droid)    printf '%s' "$HOME/.factory/mcp.json" ;;
        windsurf) printf '%s' "$HOME/.codeium/windsurf/mcp_config.json" ;;
        devin)    printf '%s' "${XDG_CONFIG_HOME:-$HOME/.config}/devin/config.json" ;;
        vscode)   printf '%s' "${XDG_CONFIG_HOME:-$HOME/.config}/Code/User/mcp.json" ;;
        *)        return 1 ;;
    esac
}

mcp_sync_json_tool() {
    local tool="$1" py="$2" entries="$3" cfg
    cfg="$(mcp_config_path_for "$tool")" || { echo "[ERROR] Unknown tool: $tool"; return 0; }
    mkdir -p "$(dirname "$cfg")"
    echo "================================================================================"
    echo "[${tool^^}] Configuring MCP servers -> $cfg"
    echo "================================================================================"
    "$py" -u "$MCP_JSON_HELPER" "$cfg" "$entries" "$tool"
    echo ""
}

# --- Codex (TOML for http, CLI for stdio) ---
mcp_codex_remove_section() {
    local name="$1"
    [ -f "$MCP_CODEX_CONFIG" ] || return 0
    local base="[mcp_servers.$name]" sub="[mcp_servers.$name." tmp skipping line trimmed
    tmp="$(mktemp)"
    skipping=0
    while IFS= read -r line || [ -n "$line" ]; do
        trimmed="$(printf '%s' "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        if [ "$trimmed" = "$base" ] || [ "${trimmed#"$sub"}" != "$trimmed" ]; then
            skipping=1; continue
        fi
        if [ "$skipping" -eq 1 ]; then
            case "$trimmed" in
                "["*) skipping=0 ;;
                *) continue ;;
            esac
        fi
        printf '%s\n' "$line" >> "$tmp"
    done < "$MCP_CODEX_CONFIG"
    mv "$tmp" "$MCP_CODEX_CONFIG"
}

mcp_codex_write_http() {
    local name="$1" url="$2" key="$3"
    mkdir -p "$(dirname "$MCP_CODEX_CONFIG")"
    [ -f "$MCP_CODEX_CONFIG" ] || : > "$MCP_CODEX_CONFIG"
    mcp_codex_remove_section "$name"
    {
        printf '\n[mcp_servers.%s]\n' "$name"
        printf 'url = "%s"\n' "$url"
        if [ -n "$key" ]; then
            printf '\n[mcp_servers.%s.http_headers]\n' "$name"
            printf 'CONTEXT7_API_KEY = "%s"\n' "$key"
            printf 'Accept = "application/json, text/event-stream"\n'
        fi
    } >> "$MCP_CODEX_CONFIG"
    echo "[OK] Wrote [mcp_servers.$name] to codex config.toml"
}

mcp_sync_codex() {
    local py="$1" key
    key="$(mcp_get_secret CONTEXT7_API_KEY_1 || true)"
    echo "================================================================================"
    echo "[CODEX] Configuring MCP servers (stdio via CLI, http via config.toml)"
    echo "================================================================================"
    if [ -n "$key" ]; then
        mcp_codex_write_http "context7" "https://mcp.context7.com/mcp" "$key"
    fi
    mcp_codex_write_http "chrome" "http://127.0.0.1:12306/mcp" ""
    # 'unified' (stdio) is retired: purge any stale entry and never re-register it.
    mcp_codex_remove_section "unified"
    if command -v codex >/dev/null 2>&1; then
        codex mcp remove unified 2>/dev/null || true
    fi
    echo ""
}

# --- Public entrypoints ---
mcp_sync_tool() {
    local tool="$1" py entries
    py="$(mcp_python)" || { echo "[ERROR] python not found; required for MCP sync."; return 0; }
    if [ "$tool" = "codex" ]; then mcp_sync_codex "$py"; return 0; fi
    entries="$(mcp_build_entries "$py")"
    mcp_sync_json_tool "$tool" "$py" "$entries"
    rm -f "$entries"
}

mcp_sync_all() {
    local py entries tool
    py="$(mcp_python)" || { echo "[ERROR] python not found; required for MCP sync."; return 0; }
    entries="$(mcp_build_entries "$py")"
    for tool in $MCP_JSON_TOOLS; do
        mcp_sync_json_tool "$tool" "$py" "$entries"
    done
    rm -f "$entries"
    mcp_sync_codex "$py"
    echo "================================================================================"
    echo "[SUMMARY] MCP config synced to all AI tools."
    echo "================================================================================"
}

# --- Install (chrome recompiles once per run) ---
mcp_install_chrome() {
    if [ ! -f "$MCP_CHROME_START_SH" ]; then
        echo "[WARNING] Chrome MCP start.sh not found; skipping."
        return 0
    fi
    if [ "${MCP_CHROME_BUILD_DONE:-0}" = "1" ]; then
        echo "[INFO] Chrome extension already rebuilt in this install run; skipping duplicate compile."
        return 0
    fi
    unset MCP_SKIP_BUILD 2>/dev/null || true
    echo "================================================================================"
    echo "[CHROME] Building + registering Chrome MCP (live output)"
    echo "================================================================================"
    bash "$MCP_CHROME_START_SH" || true
    export MCP_CHROME_BUILD_DONE=1
}

mcp_install_context7() {
    if [ ! -f "$MCP_CONTEXT7_SH" ]; then
        echo "[WARNING] context7 script not found; skipping."
        return 0
    fi
    echo "================================================================================"
    echo "[CONTEXT7] Running context7 setup (live output)"
    echo "================================================================================"
    bash "$MCP_CONTEXT7_SH" || true
}

mcp_install_all() {
    export MCP_CHROME_BUILD_DONE=0
    mcp_install_chrome
    mcp_install_context7
    mcp_sync_all
}
