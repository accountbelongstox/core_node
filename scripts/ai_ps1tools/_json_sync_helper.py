#!/usr/bin/env python3
"""
JSON MCP Config Sync Helper (stdlib only, no pip)
Usage: python _json_sync_helper.py <config_path> <entries_file> [target]

entries_file: a temp JSON file containing the MCP server entries to write.
Format: [{"name": "...", "transport": "http", "url": "...", "headers": {...}}, ...]

target: cursor | gemini | droid | windsurf | devin | vscode | generic
    Each tool nests servers differently AND uses a different remote-server shape.
    This helper emits the correct per-tool schema:

      top-level key:
        vscode -> "servers"           (every other tool -> "mcpServers")

      http server shape:
        cursor  : {"url", "headers"}
        gemini  : {"httpUrl", "headers"}            ("url" is SSE-only in gemini)
        droid   : {"type":"http", "url", "headers"}
        windsurf: {"serverUrl", "headers"}
        devin   : {"url", "transport":"http", "headers"}
        vscode  : {"type":"http", "url", "headers"}
        generic : {"url", "headers"}

      stdio server shape (same everywhere except vscode adds "type"):
        {"command", "args", "env"}  (+ "type":"stdio" for vscode)
"""
import json
import sys
import os


def top_level_key(target):
    if target == "vscode":
        return "servers"
    return "mcpServers"


# Targets whose server entries require an explicit "type" discriminator.
TYPE_TARGETS = ("claude", "droid", "vscode")

# Servers this system used to manage but no longer installs. They are actively
# removed from a tool's config on every sync so a stale entry cannot linger (this
# helper otherwise preserves keys it does not manage). Only these exact names are
# pruned; user-added servers are never touched.
DEPRECATED_SERVERS = ("unified",)


def build_server_cfg(entry, target):
    transport = entry.get("transport", "stdio")

    if transport == "http":
        url = entry["url"]
        headers = entry.get("headers", {})
        if target == "gemini":
            cfg = {"httpUrl": url}
        elif target == "windsurf":
            cfg = {"serverUrl": url}
        elif target in TYPE_TARGETS:
            cfg = {"type": "http", "url": url}
        elif target == "devin":
            cfg = {"url": url, "transport": "http"}
        else:
            cfg = {"url": url}
        if headers:
            cfg["headers"] = headers
        return cfg

    if transport == "sse":
        url = entry["url"]
        headers = entry.get("headers", {})
        if target == "windsurf":
            cfg = {"serverUrl": url}
        elif target in TYPE_TARGETS:
            cfg = {"type": "sse", "url": url}
        elif target == "devin":
            cfg = {"url": url, "transport": "sse"}
        else:
            cfg = {"url": url}
        if headers:
            cfg["headers"] = headers
        return cfg

    # stdio (default)
    cfg = {}
    if target in TYPE_TARGETS:
        cfg["type"] = "stdio"
    cfg["command"] = entry["command"]
    cfg["args"] = entry.get("args", [])
    env = entry.get("env", {})
    if env:
        cfg["env"] = env
    return cfg


def main():
    config_path = sys.argv[1]
    entries_file = sys.argv[2]
    target = sys.argv[3] if len(sys.argv) > 3 else "generic"
    root_key = top_level_key(target)

    print("[INFO] Sync target schema: {} (top-level key: {})".format(target, root_key))

    # Read entries from temp file (utf-8-sig handles BOM from PowerShell 5.1)
    with open(entries_file, "r", encoding="utf-8-sig") as f:
        entries = json.load(f)

    # Read existing config (preserve unrelated keys)
    settings = {}
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8-sig") as f:
            try:
                settings = json.load(f)
            except Exception:
                settings = {}

    if root_key not in settings or not isinstance(settings.get(root_key), dict):
        settings[root_key] = {}

    count = 0
    for entry in entries:
        name = entry["name"]
        transport = entry.get("transport", "stdio")
        count += 1

        settings[root_key][name] = build_server_cfg(entry, target)

        print("[{}] {} ({})".format(count, name, transport))
        print("    Config: {}".format(json.dumps(settings[root_key][name])))

    for dead in DEPRECATED_SERVERS:
        if dead in settings[root_key]:
            del settings[root_key][dead]
            print("[REMOVED] {} (deprecated, no longer installed)".format(dead))

    print()
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=True)

    print("[INFO] Settings written to: {}".format(config_path))

    with open(config_path, "r", encoding="utf-8") as f:
        reloaded = json.load(f)
    keys = sorted(reloaded.get(root_key, {}).keys())
    print("[VERIFY] {} keys in file: {}".format(root_key, keys))
    for k in keys:
        print("[VERIFY] {}: OK".format(k))
    print("[SUCCESS] MCP configuration updated: {}".format(config_path))


if __name__ == "__main__":
    main()
