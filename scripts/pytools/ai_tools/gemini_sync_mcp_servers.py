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

r"""
Gemini MCP Servers Configuration Tool

This script configures MCP servers for Google Gemini by updating settings.json.
Unlike Claude/Codex which use CLI commands, Gemini uses JSON configuration files.

Uses the common MCP configuration provider (mcp_config_provider.py) for consistency.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from mcp_config_provider import MCPConfig, get_mcp_configs, get_project_root

IS_WINDOWS = sys.platform == "win32"


def get_gemini_settings_path() -> Optional[Path]:
    """Get Gemini CLI settings path"""
    home_dir = Path.home()
    possible_paths = [
        home_dir / ".gemini" / "settings.json",
        home_dir / ".config" / "gemini" / "settings.json",
    ]

    if IS_WINDOWS and "APPDATA" in os.environ:
        possible_paths.append(Path(os.environ["APPDATA"]) / "gemini" / "settings.json")

    for settings_path in possible_paths:
        if settings_path.parent.exists():
            return settings_path

    default_path = possible_paths[0]
    default_path.parent.mkdir(parents=True, exist_ok=True)
    return default_path


def load_gemini_settings(settings_path: Path) -> Dict[str, Any]:
    """Load existing Gemini settings or create default"""
    if settings_path.exists():
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARNING] Failed to load settings: {e}")
            return {}
    return {}


def save_gemini_settings(settings_path: Path, settings: Dict[str, Any]) -> bool:
    """Save Gemini settings to JSON file"""
    try:
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2, ensure_ascii=True)
        return True
    except Exception as e:
        print(f"[ERROR] Failed to save settings: {e}")
        return False


def convert_config_to_gemini_format(config: MCPConfig) -> Dict[str, Any]:
    """Convert MCPConfig to Gemini settings format"""
    if config.transport_type == "http":
        return {
            "type": "http",
            "url": config.url,
            "headers": config.headers
        }
    else:
        return {
            "type": "stdio",
            "command": config.command,
            "args": config.args,
            "env": config.env
        }


def configure_gemini_mcp() -> int:
    """Configure MCP servers for Gemini by updating settings.json"""
    print("=" * 80)
    print("[GEMINI] Configuring MCP servers via settings.json")
    print("=" * 80)
    print()

    settings_path = get_gemini_settings_path()
    if not settings_path:
        print("[ERROR] Could not determine Gemini settings path")
        return 1

    print(f"[INFO] Settings path: {settings_path}")
    print()

    configs = get_mcp_configs(target="gemini")

    if not configs:
        print("[WARNING] No MCP servers to configure")
        return 0

    settings = load_gemini_settings(settings_path)

    if "mcpServers" not in settings:
        settings["mcpServers"] = {}

    project_root = get_project_root()

    print("=" * 80)
    print("[PREVIEW] MCP servers to be added:")
    print("=" * 80)

    for idx, config in enumerate(configs, 1):
        if config.transport_type == "stdio" and config.args:
            resolved_args = []
            for arg in config.args:
                if arg.endswith('.py') and not Path(arg).is_absolute():
                    resolved_args.append(str(project_root / arg))
                else:
                    resolved_args.append(arg)
            config.args = resolved_args

        gemini_config = convert_config_to_gemini_format(config)
        settings["mcpServers"][config.name] = gemini_config

        print(f"[{idx}] {config.name} ({config.transport_type})")
        print(f"    Config: {json.dumps(gemini_config, indent=6)}")
        print()

    print("=" * 80)
    print()

    if save_gemini_settings(settings_path, settings):
        print(f"[SUCCESS] Settings saved to: {settings_path}")
        print()
        print("=" * 80)
        print(f"[SUMMARY] Gemini MCP Configuration Complete")
        print(f"  Total servers: {len(configs)}")
        print("=" * 80)
        return 0
    else:
        print("[ERROR] Failed to save settings")
        return 1


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Configure MCP servers for Google Gemini"
    )
    parser.add_argument(
        "--target",
        type=str,
        default="gemini",
        help="Target tool (always 'gemini' for this script)"
    )
    parser.add_argument(
        "--working-dir",
        type=str,
        help="Working directory (for compatibility, not used)"
    )

    args = parser.parse_args()

    if args.target != "gemini":
        print(f"[WARNING] This script only supports Gemini. Use appropriate script for {args.target}")

    print()
    print("=" * 80)
    print("Gemini MCP Configuration Tool")
    print("=" * 80)
    print()

    return configure_gemini_mcp()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print()
        print("[INFO] Operation cancelled by user")
        sys.exit(130)
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
