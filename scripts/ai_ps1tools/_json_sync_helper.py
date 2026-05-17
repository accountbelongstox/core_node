#!/usr/bin/env python3
"""
JSON MCP Config Sync Helper (stdlib only, no pip)
Usage: python _json_sync_helper.py <config_path> <entries_file>

entries_file: a temp JSON file containing the MCP server entries to write.
Format: [{"name": "...", "transport": "http", "url": "...", "headers": {...}}, ...]
"""
import json
import sys
import os


def main():
    config_path = sys.argv[1]
    entries_file = sys.argv[2]

    # Read entries from temp file (utf-8-sig handles BOM from PowerShell 5.1)
    with open(entries_file, "r", encoding="utf-8-sig") as f:
        entries = json.load(f)

    # Read existing config
    settings = {}
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8-sig") as f:
            try:
                settings = json.load(f)
            except Exception:
                settings = {}

    if "mcpServers" not in settings or not isinstance(settings.get("mcpServers"), dict):
        settings["mcpServers"] = {}

    count = 0
    for entry in entries:
        name = entry["name"]
        transport = entry["transport"]
        count += 1

        if transport == "http":
            cfg = {"url": entry["url"]}
            headers = entry.get("headers", {})
            if headers:
                cfg["headers"] = headers
            settings["mcpServers"][name] = cfg
        elif transport == "stdio":
            cfg = {"command": entry["command"], "args": entry.get("args", [])}
            env = entry.get("env", {})
            if env:
                cfg["env"] = env
            settings["mcpServers"][name] = cfg

        print("[{}] {} ({})".format(count, name, transport))
        print("    Config: {}".format(json.dumps(settings["mcpServers"][name])))

    print()
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=True)

    print("[INFO] Settings written to: {}".format(config_path))

    with open(config_path, "r", encoding="utf-8") as f:
        reloaded = json.load(f)
    keys = sorted(reloaded.get("mcpServers", {}).keys())
    print("[VERIFY] mcpServers keys in file: {}".format(keys))
    for k in keys:
        print("[VERIFY] {}: OK".format(k))
    print("[SUCCESS] MCP configuration updated: {}".format(config_path))


if __name__ == "__main__":
    main()
