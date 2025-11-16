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

import sys
from pathlib import Path
from typing import Dict, Any, Optional

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent

sys.path.insert(0, str(PROJECT_ROOT / "pycore"))

try:
    from pyfoundations.secret_manager import get_secret_key
    SECRET_MANAGER_AVAILABLE = True
except ImportError:
    SECRET_MANAGER_AVAILABLE = False
    print("[WARNING] Secret manager not available")


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
    if not server_name or server_name.lower() != "autocontext7mcp":
        return server_config

    if not isinstance(server_config, dict):
        return server_config

    if "headers" not in server_config:
        return server_config

    headers = server_config.get("headers", {})
    if not isinstance(headers, dict):
        return server_config

    if "CONTEXT7_API_KEY" not in headers:
        return server_config

    current_value = headers.get("CONTEXT7_API_KEY", "")

    if current_value and current_value != "YOUR_API_KEY":
        print(f"[INFO] Context7 API key already set for {server_name}")
        return server_config

    if not SECRET_MANAGER_AVAILABLE:
        print(f"[WARNING] Secret manager not available, cannot replace Context7 API key")
        return server_config

    try:
        api_key = get_secret_key(secret_key_name)

        if not api_key or api_key.strip() == "":
            print(f"[WARNING] Context7 API key not found in secret manager (key: {secret_key_name})")
            return server_config

        updated_config = server_config.copy()
        updated_headers = headers.copy()
        updated_headers["CONTEXT7_API_KEY"] = api_key.strip()
        updated_config["headers"] = updated_headers

        print(f"[SUCCESS] Replaced Context7 API key for {server_name}")
        return updated_config

    except Exception as e:
        print(f"[ERROR] Failed to replace Context7 API key: {e}")
        return server_config


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
