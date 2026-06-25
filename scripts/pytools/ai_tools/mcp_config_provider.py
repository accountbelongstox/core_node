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
Common MCP Configuration Provider

This module provides a unified MCP server configuration for all AI tools
(Claude, Codex, DroidAI). It centralizes the configuration logic and ensures
consistency across all tools.

Supported MCP Servers:
- Context7: Context-aware code completion (HTTP transport)
- Chrome: Chrome MCP server (HTTP transport)
"""

import importlib.util
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
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
    def get_context7_config(target: str = "claude") -> Optional[MCPConfig]:
        """
        Get Context7 MCP configuration (HTTP transport for all tools)

        Args:
            target: Target AI tool (claude, codex, droid, gemini)

        Returns:
            MCPConfig with API key (if found) or None
        """
        context7_api_key = get_secret_value("CONTEXT7_API_KEY_1")

        if not context7_api_key:
            print("[ERROR] CONTEXT7_API_KEY not found in secret manager.")
            print("[HINT] Please add CONTEXT7_API_KEY_1 via the secret manager.")
            return None

        print("[INFO] Context7 API key loaded successfully")

        # All tools use HTTP transport with headers
        return MCPConfig(
            name="context7",
            transport_type="http",
            url="https://mcp.context7.com/mcp",
            headers={
                "CONTEXT7_API_KEY": context7_api_key,
                "Accept": "application/json, text/event-stream"
            }
        )

    @staticmethod
    def get_chrome_mcp_config() -> MCPConfig:
        """
        Get Chrome MCP Server configuration (HTTP transport)

        Reference: _prompt/mcpWindowsTemplate.json
        URL: http://127.0.0.1:12306/mcp

        Returns:
            MCPConfig with HTTP transport configuration
        """
        return MCPConfig(
            name="chrome",
            transport_type="http",
            url="http://127.0.0.1:12306/mcp"
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

        # Context7 MCP (HTTP for Claude, stdio with npx for Codex)
        context7_config = cls.get_context7_config(target)
        if context7_config:
            configs.append(context7_config)

        # Chrome MCP Server (HTTP transport)
        chrome_config = cls.get_chrome_mcp_config()
        configs.append(chrome_config)

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
                'include': ['context7', 'chrome'],
                'exclude': []
            },
            'codex': {
                'include': ['context7', 'chrome'],
                'exclude': []
            },
            'droid': {
                'include': ['context7', 'chrome'],
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
