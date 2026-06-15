#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Configuration

All environment-driven configuration constants for the claude_host application.
Loaded once at import time. Modify via environment variables.
"""

import getpass
import json
import os
import socket
from pathlib import Path

from pycore.pyfoundations.pybasecommon.commander import get_command_output
from pyapps.claude_host.service.host_config import load_config, save_config

# --- Load webclaude.json if exists (env vars override JSON values) ---
_json_config = {}
_config_paths = [
    Path(__file__).parent.parent / "config" / "webclaude.json",
    Path(__file__).parent.parent / "webclaude.json",
]
for _p in _config_paths:
    if _p.is_file():
        with open(_p, "r", encoding="utf-8") as _f:
            _json_config = json.load(_f)
        break


def _cfg(section: str, key: str, default: str = "") -> str:
    """Get config: env var > json > default."""
    # Navigate nested JSON using dotted section path
    parts = section.split(".")
    obj = _json_config
    for p in parts:
        obj = obj.get(p, {}) if isinstance(obj, dict) else {}
    val = obj.get(key, "")
    return str(val) if val else default


# --- Central server connection ---
# The host connects to the gateway (webclaude_go-gateway).
# webclaude_center_server is the management server; the gateway is the relay hub.
CENTRAL_SERVER_URL = os.environ.get("CENTRAL_SERVER_URL", "") or os.environ.get("GATEWAY_URL", "") or _cfg("gateway", "url")
HOST_TOKEN = os.environ.get("HOST_TOKEN", "") or _cfg("gateway", "host_api_token")
# Resolve HOST_ID: env var > webclaude.json > host-config.json > generate & persist
_host_id = os.environ.get("HOST_ID", "") or _cfg("node", "node_id", "")
if not _host_id:
    _hcfg = load_config()
    _host_id = _hcfg.get("host_id", "")
    if not _host_id:
        _host_id = f"host-{socket.gethostname().lower()}"
        _hcfg["host_id"] = _host_id
        save_config(_hcfg)
HOST_ID = _host_id
HEARTBEAT_INTERVAL = int(os.environ.get("HEARTBEAT_INTERVAL", "") or _cfg("node", "heartbeat_interval", "30"))

# --- Claude CLI ---
# Use native 'where' (Windows) or 'which' (Linux) to find claude binary
_claude_output = get_command_output("where claude" if os.name == "nt" else "which claude")
CLAUDE_BIN = _claude_output.strip().split("\n")[0].strip() if _claude_output.strip() else "claude"

# --- Project directories ---
DEFAULT_PROJECT_DIR = os.environ.get(
    "CLAUDE_PROJECT_DIR",
    str(Path(__file__).resolve().parent.parent.parent.parent / "project"),
)

# --- Current user ---
CURRENT_USER = (
    os.environ.get("USER")
    or os.environ.get("USERNAME")
    or getpass.getuser()
)

# --- Multi-user ---
AUTO_CREATE_USERS = os.environ.get("AUTO_CREATE_USERS", "true").lower() in (
    "true", "1", "yes",
)

_user_list = os.environ.get("CLAUDE_USERS", "")
CLAUDE_USERS: list[str] = (
    [u.strip() for u in _user_list.split(",") if u.strip()]
    if _user_list
    else [CURRENT_USER]
)

# --- Path whitelist ---
if os.name == "nt":
    _home_root = Path.home().resolve()
    ALLOWED_PATH_PREFIXES = [
        str(_home_root),
        str(Path(DEFAULT_PROJECT_DIR).resolve()),
        str((_home_root / "project").resolve()),
        str((_home_root / "Projects").resolve()),
    ]
else:
    ALLOWED_PATH_PREFIXES = [
        "/home/",
        str(Path(DEFAULT_PROJECT_DIR).resolve()),
    ]


# --- Center Server registration ---
# HTTP URL for registering this host (separate from gateway WebSocket)
CENTER_SERVER_URL = os.environ.get("CENTER_SERVER_URL", "") or _cfg("center_server", "url")


def credentials_json_path(username: str) -> str:
    """
    Return the path to a user's Claude credentials file.

    - Linux:  each system user's ``~/.claude/.credentials.json``.
    - Windows: for the current OS user, the default ``~/.claude/`` location;
               for virtual users, inside the per-user ``CLAUDE_CONFIG_DIR``
               at ``~/.claude-users/<username>/.credentials.json``.
    """
    if os.name == "nt":
        if username.lower() == CURRENT_USER.lower():
            return str(Path.home() / ".claude" / ".credentials.json")
        # Virtual user — credentials live in the isolated config directory
        return str(
            Path.home() / ".claude-users" / username / ".credentials.json"
        )
    return f"/home/{username}/.claude/.credentials.json"


def default_project_dir_for_user(username: str) -> str:
    """
    Return the default project directory for a given user.

    - Linux:  ``/home/<username>/project``
    - Windows: ``~/project`` (shared location; isolation is via CLAUDE_CONFIG_DIR,
               not filesystem separation).
    """
    if os.name == "nt":
        return str(Path.home() / "project")
    return f"/home/{username}/project"
