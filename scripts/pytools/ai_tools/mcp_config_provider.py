#!/usr/bin/env python3

"""
Common MCP Configuration Provider

This module provides a unified MCP server configuration for all AI tools
(Claude, Codex, DroidAI). It centralizes the configuration logic and ensures
consistency across all tools.

Supported MCP Servers:
- Chrome: Chrome MCP server (HTTP transport)
"""

import importlib.util
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.service_contract import build_url, host, path_value, port

CHROME_MCP_URL = build_url("http", host("loopback"), port("mcp_chrome"), "mcp")
PYCORE_DEV_MCP_URL = build_url("http", host("loopback"), port("pycore_backend"), path_value("pycore_dev_mcp"))
SECRET_MANAGER_PATH = SCRIPT_DIR / "secret_manager.py"
SECRET_SPEC = importlib.util.spec_from_file_location(
    "ai_tools_secret_manager",
    SECRET_MANAGER_PATH
)
SECRET_MODULE = importlib.util.module_from_spec(SECRET_SPEC)
assert SECRET_SPEC.loader is not None
SECRET_SPEC.loader.exec_module(SECRET_MODULE)
get_secret_key = SECRET_MODULE.get_secret_key


def get_secret_value(key_name: str) -> Optional[str]:
    value = get_secret_key(key_name)
    return value if value else None


class MCPConfig:
    """MCP Server configuration"""
    def __init__(self, name: str, transport_type: str = "stdio",
                 command: Optional[str] = None, args: Optional[List[str]] = None,
                 url: Optional[str] = None, headers: Optional[Dict[str, str]] = None,
                 env: Optional[Dict[str, str]] = None):
        self.name = name
        self.transport_type = transport_type  # "stdio" or "http"
        self.command = command
        self.args = args or []
        self.url = url
        self.headers = headers or {}
        self.env = env or {}

    def __repr__(self):
        if self.transport_type == "http":
            return f"MCPConfig(name='{self.name}', type='http', url='{self.url}')"
        else:
            return f"MCPConfig(name='{self.name}', type='stdio', command='{self.command}', args={self.args})"


class MCPConfigProvider:
    """Provides MCP configurations for AI tools"""

    @staticmethod
    def get_project_root() -> Path:
        """Get project root directory"""
        return PROJECT_ROOT

    @staticmethod
    def get_chrome_mcp_config() -> MCPConfig:
        """
        Get Chrome MCP Server configuration (HTTP transport)

        Reference: _prompt/mcpWindowsTemplate.json
        URL: resolved from the central service contract

        Returns:
            MCPConfig with HTTP transport configuration
        """
        return MCPConfig(
            name="chrome",
            transport_type="http",
            url=CHROME_MCP_URL
        )

    @staticmethod
    def get_pycore_dev_mcp_config() -> MCPConfig:
        """Get the read-only pycore-dev MCP Server configuration (HTTP transport)."""
        return MCPConfig(
            name="pycore-dev",
            transport_type="http",
            url=PYCORE_DEV_MCP_URL
        )

    @classmethod
    def get_all_configs(cls, target: str = "claude") -> List[MCPConfig]:
        """
        Get all MCP configurations for the specified target

        Args:
            target: Target AI tool (claude, codex, droid)

        Returns:
            List of MCPConfig objects
        """
        configs = []

        print(f"[INFO] Loading MCP configurations for {target}...")
        print()

        # Chrome MCP Server (HTTP transport)
        chrome_config = cls.get_chrome_mcp_config()
        configs.append(chrome_config)
        configs.append(cls.get_pycore_dev_mcp_config())

        print()
        print(f"[INFO] Loaded {len(configs)} MCP configuration(s):")
        for config in configs:
            print(f"  - {config.name} ({config.transport_type})")
        print()

        return configs

    @staticmethod
    def get_tool_specific_filters(target: str) -> Dict[str, List[str]]:
        """
        Get tool-specific MCP server filters

        Args:
            target: Target AI tool (claude, codex, droid)

        Returns:
            Dictionary with 'include' and 'exclude' lists
        """
        # Currently all tools use the same MCP servers
        # Can be extended in the future for tool-specific configurations
        filters = {
            'claude': {
                'include': ['chrome', 'pycore-dev'],
                'exclude': []
            },
            'codex': {
                'include': ['chrome', 'pycore-dev'],
                'exclude': []
            },
            'droid': {
                'include': ['chrome', 'pycore-dev'],
                'exclude': []
            }
        }

        return filters.get(target.lower(), {'include': [], 'exclude': []})


# Convenience functions for backward compatibility
def get_mcp_configs(target: str = "claude") -> List[MCPConfig]:
    """
    Get MCP configurations for the specified target

    Args:
        target: Target AI tool (claude, codex, droid)

    Returns:
        List of MCPConfig objects
    """
    provider = MCPConfigProvider()
    return provider.get_all_configs(target)


def get_project_root() -> Path:
    """Get project root directory"""
    return MCPConfigProvider.get_project_root()


__all__ = [
    'MCPConfig',
    'MCPConfigProvider',
    'get_mcp_configs',
    'get_project_root',
    'get_secret_value'
]
