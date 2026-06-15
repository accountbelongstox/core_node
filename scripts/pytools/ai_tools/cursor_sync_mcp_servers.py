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
Cursor MCP Servers Configuration Tool

Cursor MCP servers are configured via mcp.json.
This script updates the JSON file using the common MCP configuration provider.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

from mcp_config_provider import MCPConfig, get_mcp_configs, get_project_root

IS_WINDOWS = sys.platform == "win32"


def get_cursor_settings_path() -> Path:
    home_dir = Path.home()
    possible_paths = [
        home_dir / ".cursor" / "mcp.json",
        home_dir / ".config" / "cursor" / "mcp.json",
    ]

    if IS_WINDOWS:
        user_profile = os.environ.get("USERPROFILE")
        if user_profile:
            possible_paths.insert(0, Path(user_profile) / ".cursor" / "mcp.json")

    for config_path in possible_paths:
        if config_path.parent.exists():
            return config_path

    default_path = possible_paths[0]
    default_path.parent.mkdir(parents=True, exist_ok=True)
    return default_path


def load_cursor_settings(settings_path: Path) -> Dict[str, Any]:
    if settings_path.exists():
        try:
            with open(settings_path, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except Exception as ex:
            print(f"[WARNING] Failed to read Cursor MCP file: {ex}")
            return {}
    return {}


def save_cursor_settings(settings_path: Path, settings: Dict[str, Any]) -> None:
    try:
        with open(settings_path, "w", encoding="utf-8") as handle:
            json.dump(settings, handle, indent=2, ensure_ascii=True)
    except Exception as ex:
        print(f"[ERROR] Failed to save Cursor MCP file: {ex}")


def convert_to_cursor_format(config: MCPConfig, project_root: Path) -> Dict[str, Any]:
    if config.transport_type == "http":
        payload = {
            "url": config.url,
        }
        if config.headers:
            payload["headers"] = config.headers
        return payload

    resolved_command = config.command
    if resolved_command and not Path(resolved_command).is_absolute():
        if resolved_command.endswith(".py"):
            resolved_command = str(project_root / resolved_command)

    resolved_args = []
    for arg in config.args:
        if arg.endswith(".py") and not Path(arg).is_absolute():
            resolved_args.append(str(project_root / arg))
        else:
            resolved_args.append(arg)

    payload = {
        "command": resolved_command,
        "args": resolved_args,
    }
    if config.env:
        payload["env"] = config.env
    return payload


def configure_cursor_mcp() -> None:
    print("=" * 80)
    print("[CURSOR] Configuring MCP servers via mcp.json")
    print("=" * 80)
    print()

    settings_path = get_cursor_settings_path()
    project_root = get_project_root()
    configs = get_mcp_configs(target="cursor")

    if not configs:
        print("[WARNING] No MCP servers to configure")
        return

    print(f"[INFO] Cursor MCP file: {settings_path}")
    print()

    settings = load_cursor_settings(settings_path)
    if "mcpServers" not in settings or not isinstance(settings["mcpServers"], dict):
        settings["mcpServers"] = {}

    for idx, config in enumerate(configs, 1):
        converted = convert_to_cursor_format(config, project_root)
        settings["mcpServers"][config.name] = converted
        print(f"[{idx}] {config.name} ({config.transport_type})")
        print(f"    Config: {json.dumps(converted, ensure_ascii=True)}")

    print()
    save_cursor_settings(settings_path, settings)
    reloaded = load_cursor_settings(settings_path)
    present_names = sorted(list(reloaded.get("mcpServers", {}).keys()))
    print(f"[VERIFY] mcpServers keys in file: {present_names}")
    for config in configs:
        if config.name in reloaded.get("mcpServers", {}):
            print(f"[VERIFY] {config.name}: OK")
        else:
            print(f"[VERIFY] {config.name}: NOT FOUND")
    print(f"[SUCCESS] Cursor MCP configuration updated: {settings_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Configure MCP servers for Cursor")
    parser.add_argument("--target", type=str, default="cursor")
    parser.add_argument("--working-dir", type=str, help="Compatibility flag")
    _args = parser.parse_args()
    configure_cursor_mcp()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        print("[INFO] Operation cancelled by user")
    except Exception as ex:
        print(f"[ERROR] Unexpected error: {ex}")
        import traceback
        traceback.print_exc()
