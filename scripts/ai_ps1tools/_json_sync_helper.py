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
import os
import stat
import sys
import tempfile


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

# Reload + re-merge attempts when the config changes between load and write.
MAX_WRITE_ATTEMPTS = 3


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


def load_existing(config_path):
    """Return (settings, stat) for a mergeable config, ({}, None) if missing, None if unsafe to overwrite."""
    if not os.path.exists(config_path):
        return {}, None

    st = os.stat(config_path)
    if st.st_size == 0:
        return {}, st

    try:
        with open(config_path, "r", encoding="utf-8-sig") as f:
            settings = json.load(f)
    except (ValueError, OSError) as err:
        print("[ERROR] Cannot parse {}: {}; refusing to overwrite. Fix or remove the file, then rerun.".format(config_path, err))
        return None

    if not isinstance(settings, dict):
        print("[ERROR] Cannot parse {}: top-level value is not an object; refusing to overwrite. Fix or remove the file, then rerun.".format(config_path))
        return None

    return settings, st


def current_mtime_ns(config_path):
    if not os.path.exists(config_path):
        return None
    return os.stat(config_path).st_mtime_ns


def merge_entries(settings, entries, target, root_key):
    if root_key not in settings or not isinstance(settings.get(root_key), dict):
        settings[root_key] = {}

    count = 0
    for entry in entries:
        name = entry["name"]
        transport = entry.get("transport", "stdio")
        count += 1

        cfg = build_server_cfg(entry, target)
        settings[root_key][name] = cfg

        print("[{}] {} ({})".format(count, name, transport))
        print("    Keys: {}".format(sorted(cfg.keys())))
        headers = cfg.get("headers")
        if headers:
            print("    Headers: {}".format(sorted(headers.keys())))

    for dead in DEPRECATED_SERVERS:
        if dead in settings[root_key]:
            del settings[root_key][dead]
            print("[REMOVED] {} (deprecated, no longer installed)".format(dead))

    return settings


def write_json_atomic(config_path, data, st):
    """Atomically replace the symlink-resolved config_path; mode/owner set on the fd (new file: 0600, dir owner when root)."""
    real_path = os.path.realpath(config_path)
    directory = os.path.dirname(real_path)
    basename = os.path.basename(real_path)
    is_root = hasattr(os, "geteuid") and os.geteuid() == 0
    dir_st = None
    if st is None and is_root:
        try:
            dir_st = os.stat(directory)
        except OSError:
            dir_st = None
    fd, tmp_path = tempfile.mkstemp(dir=directory, prefix="." + basename + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=True)
            f.flush()
            os.fsync(f.fileno())
            if st is None:
                if hasattr(os, "fchmod"):
                    os.fchmod(f.fileno(), 0o600)
                else:
                    os.chmod(tmp_path, 0o600)
                if dir_st is not None and dir_st.st_uid != 0 and hasattr(os, "fchown"):
                    os.fchown(f.fileno(), dir_st.st_uid, dir_st.st_gid)
            else:
                mode = stat.S_IMODE(st.st_mode)
                if hasattr(os, "fchmod"):
                    os.fchmod(f.fileno(), mode)
                else:
                    os.chmod(tmp_path, mode)
                if is_root and hasattr(os, "fchown"):
                    os.fchown(f.fileno(), st.st_uid, st.st_gid)
        os.replace(tmp_path, real_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def main():
    config_path = sys.argv[1]
    entries_file = sys.argv[2]
    target = sys.argv[3] if len(sys.argv) > 3 else "generic"
    root_key = top_level_key(target)

    print("[INFO] Sync target schema: {} (top-level key: {})".format(target, root_key))

    # Read entries from temp file (utf-8-sig handles BOM from PowerShell 5.1)
    with open(entries_file, "r", encoding="utf-8-sig") as f:
        entries = json.load(f)

    loaded = load_existing(config_path)
    if loaded is None:
        sys.exit(1)
    settings, st = loaded
    settings = merge_entries(settings, entries, target, root_key)

    for attempt in range(1, MAX_WRITE_ATTEMPTS + 1):
        # A live Claude session may write the file (or create it) between load and write.
        if current_mtime_ns(config_path) != (st.st_mtime_ns if st else None):
            if attempt >= MAX_WRITE_ATTEMPTS:
                print("[ERROR] {} changed during sync (Claude session writing?); skipped. Rerun when sessions are idle.".format(config_path))
                sys.exit(1)
            reloaded = load_existing(config_path)
            if reloaded is None:
                sys.exit(1)
            settings, st = reloaded
            settings = merge_entries(settings, entries, target, root_key)
            continue
        write_json_atomic(config_path, settings, st)
        break

    print()
    print("[INFO] Settings written to: {}".format(config_path))

    with open(config_path, "r", encoding="utf-8") as f:
        reloaded_settings = json.load(f)
    keys = sorted(reloaded_settings.get(root_key, {}).keys())
    print("[VERIFY] {} keys in file: {}".format(root_key, keys))
    for k in keys:
        print("[VERIFY] {}: OK".format(k))
    print("[SUCCESS] MCP configuration updated: {}".format(config_path))


if __name__ == "__main__":
    main()
