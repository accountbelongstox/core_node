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
- MCPUnifiedServer: Unified MCP server (stdio transport)
"""

import sys
from pathlib import Path
from typing import Dict, List, Optional

# Calculate paths relative to this script
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent

# Add project root to path so pycore can be imported
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def get_secret_value(key_name: str) -> Optional[str]:
    """Get secret value from secret manager"""
    try:
        from pycore.pyfoundations.secret_manager import get_secret_key
        value = get_secret_key(key_name)
        return value if value else None
    except Exception as e:
        print(f"[WARNING] Could not load secret {key_name}: {e}")
        return None


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
    def get_context7_config() -> Optional[MCPConfig]:
        """
        Get Context7 MCP configuration (HTTP transport)

        Returns:
            MCPConfig with API key (if found) or empty string
        """
        context7_api_key = get_secret_value("CONTEXT7_API_KEY_1")

        if not context7_api_key:
            print(f"[WARNING] CONTEXT7_API_KEY not found in secret manager")
            print(f"[INFO] Adding Context7 MCP with empty API key (can be configured later)")
            context7_api_key = ""
        else:
            print(f"[INFO] Context7 API key loaded successfully")

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
    def get_unified_server_config() -> MCPConfig:
        """
        Get MCPUnifiedServer configuration (stdio transport with relative path)

        Reference: _prompt/mcpUbuntoDesktopTemplate.json
        Command: python3 /www/programing/core_node/pymain.py app=mcp

        Returns:
            MCPConfig with relative path configuration
        """
        import sys

        # Use current Python interpreter path
        python_executable = sys.executable

        # Use relative path for pymain.py (will be resolved to absolute by claude_sync_mcp_servers.py)
        pymain_relative = "pymain.py"

        return MCPConfig(
            name="unified",
            transport_type="stdio",
            command=python_executable,
            args=[pymain_relative, "app=mcp"],
            env={"MCP_ALLOW_ALL_PATHS": "true"}
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

        # Context7 MCP (HTTP transport)
        context7_config = cls.get_context7_config()
        if context7_config:
            configs.append(context7_config)

        # MCPUnifiedServer (stdio transport)
        unified_config = cls.get_unified_server_config()
        configs.append(unified_config)

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
                'include': ['context7', 'unified'],
                'exclude': []
            },
            'codex': {
                'include': ['context7', 'unified'],
                'exclude': []
            },
            'droid': {
                'include': ['context7', 'unified'],
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
