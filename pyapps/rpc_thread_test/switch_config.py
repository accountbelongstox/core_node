#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Switcher

Utility to switch between different configuration profiles
"""

import sys
import shutil
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint


def list_configs():
    """List all available configuration files"""
    config_dir = Path(__file__).parent / "config"

    configs = []
    for config_file in config_dir.glob("*.json"):
        if config_file.stem != "launcher_config":
            configs.append(config_file)

    return configs


def show_current_config():
    """Show current active configuration"""
    config_path = Path(__file__).parent / "config" / "launcher_config.json"

    if not config_path.exists():
        ColorPrint.red("No active configuration found")
        return

    ColorPrint.blue("Current Configuration:")
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
        print(content)


def switch_config(config_name):
    """
    Switch to a different configuration

    Args:
        config_name: Name of config file (without .json extension)
    """
    config_dir = Path(__file__).parent / "config"
    source_path = config_dir / f"{config_name}.json"
    target_path = config_dir / "launcher_config.json"

    if not source_path.exists():
        ColorPrint.red(f"Configuration not found: {config_name}.json")
        return False

    # Backup current config
    if target_path.exists():
        backup_path = config_dir / "launcher_config.backup.json"
        shutil.copy(target_path, backup_path)
        ColorPrint.yellow(f"Backed up current config to: launcher_config.backup.json")

    # Copy new config
    shutil.copy(source_path, target_path)
    ColorPrint.green(f"Switched to configuration: {config_name}.json")

    return True


def create_config_template(name, description=""):
    """
    Create a new configuration template

    Args:
        name: Name for the new config
        description: Optional description
    """
    config_dir = Path(__file__).parent / "config"
    new_config_path = config_dir / f"launcher_config_{name}.json"

    if new_config_path.exists():
        ColorPrint.red(f"Configuration already exists: {new_config_path.name}")
        return False

    template = {
        "_description": description or f"Custom configuration: {name}",
        "rpc_server": {
            "host": "localhost",
            "port": 8765,
            "debug": True,
            "thread_name": "RpcServerThread",
            "daemon": True
        },
        "app": {
            "name": f"RPC Thread Test ({name})",
            "version": "1.0.0",
            "enable_auto_port": False,
            "port_range": [8765, 8775]
        }
    }

    import json
    with open(new_config_path, 'w', encoding='utf-8') as f:
        json.dump(template, f, indent=2, ensure_ascii=False)

    ColorPrint.green(f"Created new configuration: {new_config_path.name}")
    ColorPrint.yellow(f"Edit the file to customize settings")

    return True


def main():
    """Main entry point"""
    ColorPrint.print_header("Configuration Switcher")

    if len(sys.argv) < 2:
        ColorPrint.yellow("Usage:")
        ColorPrint.yellow("  python switch_config.py list              - List all configurations")
        ColorPrint.yellow("  python switch_config.py show              - Show current configuration")
        ColorPrint.yellow("  python switch_config.py switch <name>     - Switch to configuration")
        ColorPrint.yellow("  python switch_config.py create <name>     - Create new configuration template")
        print()

        # Show available configs
        ColorPrint.blue("Available Configurations:")
        configs = list_configs()

        if not configs:
            ColorPrint.yellow("  (No alternative configurations found)")
        else:
            for config_file in configs:
                ColorPrint.green(f"  - {config_file.stem}")

        print()
        ColorPrint.blue("Current Configuration:")
        show_current_config()

        return

    command = sys.argv[1].lower()

    if command == "list":
        ColorPrint.blue("Available Configurations:")
        configs = list_configs()

        if not configs:
            ColorPrint.yellow("  (No alternative configurations found)")
        else:
            for config_file in configs:
                ColorPrint.green(f"  - {config_file.stem}")

    elif command == "show":
        show_current_config()

    elif command == "switch":
        if len(sys.argv) < 3:
            ColorPrint.red("Please specify configuration name")
            ColorPrint.yellow("Example: python switch_config.py switch launcher_config_auto_port")
            return

        config_name = sys.argv[2]
        if switch_config(config_name):
            print()
            ColorPrint.blue("New Configuration:")
            show_current_config()

    elif command == "create":
        if len(sys.argv) < 3:
            ColorPrint.red("Please specify configuration name")
            ColorPrint.yellow("Example: python switch_config.py create production")
            return

        name = sys.argv[2]
        description = sys.argv[3] if len(sys.argv) > 3 else ""
        create_config_template(name, description)

    else:
        ColorPrint.red(f"Unknown command: {command}")
        ColorPrint.yellow("Available commands: list, show, switch, create")


if __name__ == "__main__":
    main()
