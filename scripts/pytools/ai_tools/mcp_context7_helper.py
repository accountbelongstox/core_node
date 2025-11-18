#!/usr/bin/env python3
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

"""
Context7 MCP Server Helper

Provides utilities for handling Context7 API key replacement in MCP configurations.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent

sys.path.insert(0, str(PROJECT_ROOT / "pycore"))

try:
    from pyfoundations.secret_manager import get_secret_key
    SECRET_MANAGER_AVAILABLE = True
except ImportError:
    SECRET_MANAGER_AVAILABLE = False
    print("[WARNING] Secret manager not available")

CONTEXT7_API_KEY_NAME = "CONTEXT7_API_KEY"
CONTEXT7_PACKAGE_NAME = "@upstash/context7-mcp"
CONTEXT7_HTTP_URL = "https://mcp.context7.com/mcp"
CONTEXT7_KEY_PLACEHOLDER = "YOUR_API_KEY"
CONTEXT7_PLACEHOLDER_VALUES = {
    CONTEXT7_KEY_PLACEHOLDER,
    "",
    "your_key_here"
}


def _candidate_key_names(secret_key_name: str) -> Tuple[str, ...]:
    """
    Build a list of candidate secret key names to check in priority order.
    """
    base_name = secret_key_name or CONTEXT7_API_KEY_NAME
    variants = [
        base_name,
        f"{base_name}_1",
        "CONTEXT7_API_KEY_1",
        "CONTENT7_API_KEY_1",  # common typo used in some setups
    ]
    seen = set()
    ordered = []
    for name in variants:
        if name and name not in seen:
            seen.add(name)
            ordered.append(name)
    return tuple(ordered)


def _is_context7_server(server_name: str, server_config: Dict[str, Any]) -> bool:
    """
    Determine whether the given server configuration refers to Context7.
    """
    if not server_name:
        return False

    name_lower = server_name.lower()
    if name_lower in {"context7", "autocontext7mcp"}:
        return True

    if not isinstance(server_config, dict):
        return False

    command_value = str(server_config.get("command", "")).lower()
    package_keyword = CONTEXT7_PACKAGE_NAME.lower()

    if package_keyword in command_value or "context7" in command_value:
        return True

    args_value = server_config.get("args", [])
    if isinstance(args_value, list):
        for arg in args_value:
            if not isinstance(arg, str):
                continue
            lower_arg = arg.lower()
            if package_keyword in lower_arg or "context7" in lower_arg:
                return True

    url_value = server_config.get("url", "")
    if isinstance(url_value, str) and "context7" in url_value.lower():
        return True

    return False


def _is_http_context7_config(server_config: Dict[str, Any]) -> bool:
    """
    Check if the server configuration uses HTTP transport for Context7.
    """
    if not isinstance(server_config, dict):
        return False

    url_value = server_config.get("url", "")
    type_value = server_config.get("type", "")

    if isinstance(url_value, str) and "context7" in url_value.lower():
        return True

    if isinstance(type_value, str) and type_value.lower() in {"http", "streamable-http"}:
        return True

    return False


def _is_context7_command(server_config: Dict[str, Any]) -> bool:
    """
    Check if the server configuration launches the Context7 MCP via command.
    """
    if not isinstance(server_config, dict):
        return False

    command_value = str(server_config.get("command", "")).lower()
    args_value = server_config.get("args", [])
    package_keyword = CONTEXT7_PACKAGE_NAME.lower()

    if package_keyword in command_value or "context7" in command_value:
        return True

    if isinstance(args_value, list):
        for arg in args_value:
            if not isinstance(arg, str):
                continue
            lower_arg = arg.lower()
            if package_keyword in lower_arg or "context7" in lower_arg:
                return True

    return False


def _read_context7_api_key(secret_key_name: str) -> Optional[str]:
    """
    Read the Context7 API key from the secret manager.
    """
    if not SECRET_MANAGER_AVAILABLE:
        print(f"[WARNING] Secret manager not available, cannot retrieve {secret_key_name}")
        return None

    try:
        for candidate in _candidate_key_names(secret_key_name):
            api_key = get_secret_key(candidate)
            if api_key and api_key.strip():
                return api_key.strip()
        print(f"[WARNING] Context7 API key not found in secret manager (keys tried: {', '.join(_candidate_key_names(secret_key_name))})")
    except Exception as exc:
        print(f"[ERROR] Failed to read Context7 API key from secret manager: {exc}")

    return None


def _write_api_key_to_mapping(
    mapping: Any,
    api_key_value: str,
    api_key_from_secret: bool
) -> Tuple[Dict[str, Any], bool]:
    """
    Ensure the API key is present in a mapping (headers or env).

    Returns the updated mapping and whether a secret value was applied.
    """
    if not isinstance(mapping, dict):
        return {}, False

    current_value = mapping.get(CONTEXT7_API_KEY_NAME, "")
    if current_value and current_value not in CONTEXT7_PLACEHOLDER_VALUES:
        return mapping, False

    updated_mapping = mapping.copy()
    updated_mapping[CONTEXT7_API_KEY_NAME] = api_key_value
    return updated_mapping, api_key_from_secret


def _ensure_api_key_argument(
    args_value: Any,
    api_key_value: str,
    api_key_from_secret: bool
) -> Tuple[list, bool]:
    """
    Add or replace the --api-key argument for Context7 commands.

    Returns the updated args list and whether a secret value was applied.
    """
    if isinstance(args_value, list):
        updated_args = [str(arg) for arg in args_value]
    elif args_value is None:
        updated_args = []
    else:
        updated_args = [str(args_value)]

    for idx, arg in enumerate(updated_args):
        if arg == "--api-key":
            if idx + 1 < len(updated_args):
                if updated_args[idx + 1] in CONTEXT7_PLACEHOLDER_VALUES:
                    updated_args[idx + 1] = api_key_value
                    return updated_args, api_key_from_secret
                return updated_args, False
            updated_args.append(api_key_value)
            return updated_args, api_key_from_secret

        if arg.startswith("--api-key="):
            key_value = arg.split("=", 1)[1]
            if key_value in CONTEXT7_PLACEHOLDER_VALUES:
                updated_args[idx] = f"--api-key={api_key_value}"
                return updated_args, api_key_from_secret
            return updated_args, False

    updated_args.extend(["--api-key", api_key_value])
    return updated_args, api_key_from_secret


def _normalize_context7_to_http_config(server_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize any Context7 server config to HTTP transport with MCP URL and headers.
    """
    if not isinstance(server_config, dict):
        return {
            "type": "http",
            "url": CONTEXT7_HTTP_URL,
            "headers": {}
        }

    headers = server_config.get("headers", {}) if isinstance(server_config.get("headers"), dict) else {}

    preserved_fields = {
        key: value for key, value in server_config.items()
        if key not in {"command", "args", "env", "type", "url", "headers"}
    }

    normalized = preserved_fields
    normalized["type"] = "http"
    normalized["url"] = CONTEXT7_HTTP_URL
    normalized["headers"] = headers

    return normalized


def replace_context7_api_key_in_mcp_server(
    server_name: str,
    server_config: Dict[str, Any],
    secret_key_name: str = "CONTEXT7_API_KEY"
) -> Dict[str, Any]:
    """
    Replace Context7 API key placeholder with actual key from secret manager.

    Args:
        server_name: Name of the MCP server
        server_config: Server configuration dictionary
        secret_key_name: Name of the secret key to read (default: CONTEXT7_API_KEY)

    Returns:
        Updated server configuration with API key replaced
    """
    if not _is_context7_server(server_name, server_config):
        return server_config

    if not isinstance(server_config, dict):
        return server_config

    normalized_config = _normalize_context7_to_http_config(server_config)
    api_key = _read_context7_api_key(secret_key_name)
    api_key_value = api_key if api_key else CONTEXT7_KEY_PLACEHOLDER
    api_key_from_secret = api_key_value != CONTEXT7_KEY_PLACEHOLDER

    updated_config = normalized_config.copy()
    secret_applied = False

    if _is_http_context7_config(updated_config):
        headers, applied_secret = _write_api_key_to_mapping(
            updated_config.get("headers", {}),
            api_key_value,
            api_key_from_secret
        )
        if headers:
            updated_config["headers"] = headers
        secret_applied = secret_applied or applied_secret

        if updated_config.get("url") in {None, ""}:
            updated_config["url"] = CONTEXT7_HTTP_URL

    env_mapping, applied_env_secret = _write_api_key_to_mapping(
        updated_config.get("env", {}),
        api_key_value,
        api_key_from_secret
    )
    if env_mapping:
        updated_config["env"] = env_mapping
    secret_applied = secret_applied or applied_env_secret

    if updated_config.get("type") is None and updated_config.get("url"):
        updated_config["type"] = "http"

    if secret_applied:
        print(f"[SUCCESS] Replaced Context7 API key for {server_name}")
    elif api_key_from_secret:
        print(f"[INFO] Context7 API key already set for {server_name}")

    return updated_config


def process_all_mcp_servers_for_context7(
    mcp_servers: Dict[str, Any],
    secret_key_name: str = "CONTEXT7_API_KEY"
) -> Dict[str, Any]:
    """
    Process all MCP servers and replace Context7 API keys.

    Args:
        mcp_servers: Dictionary of MCP server configurations
        secret_key_name: Name of the secret key to read (default: CONTEXT7_API_KEY)

    Returns:
        Updated MCP servers dictionary with API keys replaced
    """
    if not isinstance(mcp_servers, dict):
        return mcp_servers

    updated_servers = {}

    for server_name, server_config in mcp_servers.items():
        updated_config = replace_context7_api_key_in_mcp_server(
            server_name,
            server_config,
            secret_key_name
        )
        updated_servers[server_name] = updated_config

    return updated_servers
