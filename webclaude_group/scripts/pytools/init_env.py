#!/usr/bin/env python3
"""
WebClaude Group - Environment Initializer

Ensures all sub-projects have complete .env files, config files, data
directories, and script permissions.

Key behavior for .env files:
  - If .env is missing: copy from .env.example, or auto-generate minimal version
  - If .env exists but is missing keys from .env.example (or built-in template):
    append only the missing keys (existing values are never overwritten)
  - DB_TYPE defaults to 'sqlite' (zero-dependency deployment)

Usage:
    python3 scripts/pytools/init_env.py
"""

import os
import re
import secrets
import shutil
import stat
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))  # scripts/pytools/
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)                # scripts/
GROUP_ROOT = os.path.dirname(SCRIPTS_DIR)                # webclaude_group/
CORE_NODE = os.path.dirname(GROUP_ROOT)                  # core_node/

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
GRAY = "\033[0;37m"
NC = "\033[0m"

def ok(msg):   print(f"  {GREEN}[OK]{NC}   {msg}", file=sys.stderr)
def warn(msg): print(f"  {YELLOW}[WARN]{NC} {msg}", file=sys.stderr)
def info(msg): print(f"  {GRAY}[INFO]{NC} {msg}", file=sys.stderr)


# ── .env parsing helpers ────────────────────────────────────

def parse_env_keys(filepath):
    """Parse a .env file and return dict of {KEY: VALUE} for non-comment lines."""
    result = {}
    if not os.path.isfile(filepath):
        return result
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            eq = line.find("=")
            if eq > 0:
                key = line[:eq].strip()
                val = line[eq + 1:].strip()
                result[key] = val
    return result


def parse_env_lines(text):
    """Parse env text (string) into list of (key, full_line) tuples. Comments are (None, line)."""
    entries = []
    for line in text.strip().split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            entries.append((None, line))
            continue
        eq = stripped.find("=")
        if eq > 0:
            key = stripped[:eq].strip()
            entries.append((key, line))
        else:
            entries.append((None, line))
    return entries


# ── DB_TYPE override map (force sqlite as default) ──────────

SQLITE_OVERRIDES = {
    "DB_TYPE": "sqlite",
}


# ── Minimal .env templates ──────────────────────────────────

RAND = secrets.token_hex(8)

CENTER_ENV_TEMPLATE = f"""# WebClaude Center Server - Auto-generated config
HOST=0.0.0.0
PORT=18100
NODE_ENV=production

# Database (sqlite = zero-dependency; change to mysql for production)
DB_TYPE=sqlite
DB_SQLITE_PATH=./data/webclaude.db

# MySQL (only used when DB_TYPE=mysql)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=claude_relay

# Redis (optional, runs in degraded mode if unavailable)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Security
JWT_SECRET=webclaude-jwt-{RAND}
ENCRYPTION_KEY=webclaude-enc-{RAND}
API_KEY_PREFIX=cr_

# Internal API auth
INTERNAL_API_TOKEN=webclaude-internal-{RAND}
HOST_API_TOKEN=webclaude-host-{RAND}
RELAY_INTERNAL_BASE_URL=http://127.0.0.1:18200

# User management
USER_MANAGEMENT_ENABLED=true
ALLOW_USER_REGISTRATION=true
ENABLE_CORS=true
"""

GATEWAY_ENV_TEMPLATE = f"""# WebClaude Go Gateway - Auto-generated config
HOST=0.0.0.0
PORT=18200
NODE_ENV=production
TRUST_PROXY=true

# Database (sqlite = zero-dependency)
DB_TYPE=sqlite
DB_SQLITE_PATH=./data/gateway.db

# MySQL (only used when DB_TYPE=mysql)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=claude_relay

# Redis (optional)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Center server connection
INTERNAL_API_TOKEN=webclaude-internal-{RAND}
CENTER_SERVER_URL=http://localhost:18100
CENTER_INTERNAL_API_TOKEN=webclaude-internal-{RAND}
HOST_API_TOKEN=webclaude-host-{RAND}

# Gateway identity
GATEWAY_PUBLIC_URL=
API_KEY_PREFIX=cr_
ENCRYPTION_KEY=webclaude-enc-{RAND}

# WebSocket
WS_SERVER_ENABLED=true
WS_SERVER_PATH=/ws/client
"""

ENV_TEMPLATES = {
    "center_server": CENTER_ENV_TEMPLATE,
    "go-gateway": GATEWAY_ENV_TEMPLATE,
}


# ── Helpers ─────────────────────────────────────────────────

def _check_tcp(host, port, timeout=2):
    """Check if a TCP port is reachable."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    result = s.connect_ex((host, port))
    s.close()
    return result == 0


def _replace_env_value(filepath, key, new_value):
    """Replace the value of a key in a .env file in-place."""
    if not os.path.isfile(filepath):
        return
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    with open(filepath, "w", encoding="utf-8") as f:
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                eq = stripped.find("=")
                if eq > 0 and stripped[:eq].strip() == key:
                    f.write(f"{key}={new_value}\n")
                    continue
            f.write(line)


# ── Core merge logic ────────────────────────────────────────

def merge_env(example_path, env_path, label=""):
    """Ensure env_path has all keys from example or built-in template.

    - If env_path missing: create from example or template
    - If env_path exists: append missing keys only (never overwrite existing)
    - DB_TYPE forced to 'sqlite' if not already set
    """
    # Determine which template to use
    template_key = None
    for k in ENV_TEMPLATES:
        if k in env_path:
            template_key = k
            break

    # Get the reference keys (from .env.example or built-in template)
    if os.path.isfile(example_path):
        with open(example_path, "r", encoding="utf-8", errors="replace") as f:
            ref_text = f.read()
    elif template_key:
        ref_text = ENV_TEMPLATES[template_key]
    else:
        warn(f"No reference for: {env_path}")
        return False

    ref_entries = parse_env_lines(ref_text)
    ref_keys = {k: line for k, line in ref_entries if k is not None}

    # If .env does not exist, create it entirely
    if not os.path.isfile(env_path):
        os.makedirs(os.path.dirname(env_path), exist_ok=True)
        content = ref_text.strip()
        # Apply sqlite overrides
        for ovr_key, ovr_val in SQLITE_OVERRIDES.items():
            content = re.sub(
                rf"^{ovr_key}\s*=\s*.*$",
                f"{ovr_key}={ovr_val}",
                content,
                flags=re.MULTILINE,
            )
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(content + "\n")
        ok(f"{label or env_path} created (DB_TYPE=sqlite)")
        return True

    # .env exists — find missing keys and append them
    existing_keys = parse_env_keys(env_path)
    missing = []
    for key in ref_keys:
        if key not in existing_keys:
            missing.append((key, ref_keys[key]))

    # Ensure DB_TYPE is present; default to sqlite
    if "DB_TYPE" not in existing_keys:
        if "DB_TYPE" not in [m[0] for m in missing]:
            missing.append(("DB_TYPE", "DB_TYPE=sqlite"))
        if "DB_SQLITE_PATH" not in existing_keys and "DB_SQLITE_PATH" not in [m[0] for m in missing]:
            missing.append(("DB_SQLITE_PATH", "DB_SQLITE_PATH=./data/webclaude.db"))

    # Ensure DB_TYPE defaults to sqlite when MySQL is not available
    db_type = existing_keys.get("DB_TYPE", "").strip().strip("'\"").lower()
    if db_type != "sqlite":
        # Check if MySQL is reachable; if not, force sqlite
        mysql_host = existing_keys.get("DB_HOST", "127.0.0.1").strip().strip("'\"")
        mysql_port_str = existing_keys.get("DB_PORT", "3306").strip().strip("'\"")
        mysql_port = int(mysql_port_str) if mysql_port_str.isdigit() else 3306
        if not _check_tcp(mysql_host, mysql_port):
            _replace_env_value(env_path, "DB_TYPE", "sqlite")
            if "DB_TYPE" not in existing_keys:
                # Key was missing entirely, add it
                with open(env_path, "a", encoding="utf-8") as f:
                    f.write("\nDB_TYPE=sqlite\n")
            ok(f"{label}: DB_TYPE -> sqlite (MySQL not reachable at {mysql_host}:{mysql_port})")
        else:
            info(f"{label}: DB_TYPE={db_type} (MySQL reachable)")

    if not missing:
        ok(f"{label or env_path} complete ({len(existing_keys)} keys)")
        return False

    # Append missing keys
    with open(env_path, "a", encoding="utf-8") as f:
        f.write(f"\n# --- Auto-appended missing keys ({len(missing)}) ---\n")
        for key, line in missing:
            # For DB_TYPE, force sqlite
            if key in SQLITE_OVERRIDES:
                f.write(f"{key}={SQLITE_OVERRIDES[key]}\n")
            else:
                f.write(line.rstrip() + "\n")
    ok(f"{label or env_path} updated (+{len(missing)} keys: {', '.join(m[0] for m in missing)})")
    return True


# ── Config file copy ────────────────────────────────────────

def copy_config_if_missing(src, dst, label=""):
    """Copy config file from example if missing."""
    if os.path.isfile(dst):
        ok(f"{label or dst} already exists")
        return False
    if not os.path.isfile(src):
        # Not critical — config files are optional
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    ok(f"{label or dst} created from example")
    return True


# ── Script permissions ──────────────────────────────────────

def chmod_scripts(directory):
    """Recursively set +x on all .sh files."""
    if not os.path.isdir(directory):
        return 0
    count = 0
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "vendor", "tmp", "__pycache__")]
        for f in files:
            if f.endswith(".sh"):
                path = os.path.join(root, f)
                st = os.stat(path)
                if not (st.st_mode & stat.S_IXUSR):
                    os.chmod(path, st.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
                    count += 1
    return count


# ── Main ────────────────────────────────────────────────────

def main():
    print("", file=sys.stderr)
    print("  WebClaude Group - Environment Initializer", file=sys.stderr)
    print("", file=sys.stderr)

    # ── .env files (merge missing keys) ─────────────────────
    print("=== Initializing .env files ===", file=sys.stderr)

    env_pairs = [
        (
            os.path.join(GROUP_ROOT, "webclaude_center_server", ".env.example"),
            os.path.join(GROUP_ROOT, "webclaude_center_server", ".env"),
            "center_server .env",
        ),
        (
            os.path.join(GROUP_ROOT, "webclaude_go-gateway", ".env.example"),
            os.path.join(GROUP_ROOT, "webclaude_go-gateway", ".env"),
            "go-gateway .env",
        ),
    ]
    for src, dst, label in env_pairs:
        merge_env(src, dst, label)

    # ── Config files ────────────────────────────────────────
    print("\n=== Initializing config files ===", file=sys.stderr)

    config_pairs = [
        (
            os.path.join(GROUP_ROOT, "webclaude_center_server", "config", "config.example.js"),
            os.path.join(GROUP_ROOT, "webclaude_center_server", "config", "config.js"),
            "center_server config.js",
        ),
        (
            os.path.join(GROUP_ROOT, "webclaude_center_server", "config", "webclaude.example.json"),
            os.path.join(GROUP_ROOT, "webclaude_center_server", "config", "webclaude.json"),
            "center_server webclaude.json",
        ),
        (
            os.path.join(GROUP_ROOT, "webclaude_go-gateway", "config", "webclaude.example.json"),
            os.path.join(GROUP_ROOT, "webclaude_go-gateway", "config", "webclaude.json"),
            "go-gateway webclaude.json",
        ),
        (
            os.path.join(GROUP_ROOT, "webclaude_website", "config", "webclaude.example.json"),
            os.path.join(GROUP_ROOT, "webclaude_website", "config", "webclaude.json"),
            "website webclaude.json",
        ),
        (
            os.path.join(CORE_NODE, "pyapps", "claude_host", "config", "webclaude.example.json"),
            os.path.join(CORE_NODE, "pyapps", "claude_host", "config", "webclaude.json"),
            "claude_host webclaude.json",
        ),
    ]
    for src, dst, label in config_pairs:
        copy_config_if_missing(src, dst, label)

    # ── Data directories ────────────────────────────────────
    print("\n=== Ensuring data directories ===", file=sys.stderr)

    data_dirs = [
        os.path.join(GROUP_ROOT, ".data"),
        os.path.join(GROUP_ROOT, ".data", "cache"),
        os.path.join(GROUP_ROOT, "webclaude_center_server", "data"),
        os.path.join(GROUP_ROOT, "webclaude_go-gateway", "data"),
        os.path.join(CORE_NODE, "pyapps", "claude_host", "data"),
    ]
    for d in data_dirs:
        os.makedirs(d, exist_ok=True)
        ok(d)

    # ── Script permissions (+x) ─────────────────────────────
    print("\n=== Setting script permissions (+x) ===", file=sys.stderr)

    total_fixed = 0
    for search_dir in [GROUP_ROOT, os.path.join(CORE_NODE, "pyapps", "claude_host")]:
        total_fixed += chmod_scripts(search_dir)
    ok(f"Set +x on {total_fixed} script(s)" if total_fixed else "All scripts already executable")

    print("", file=sys.stderr)
    ok("Environment initialization complete!")
    print("", file=sys.stderr)


if __name__ == "__main__":
    main()
