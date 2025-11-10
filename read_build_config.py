#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build Config Reader Entry Point

This script reads build_config.ini from an app directory and outputs
configuration values in a format that can be consumed by shell scripts.

Usage:
    python read_build_config.py <app_dir> [field]

Examples:
    python read_build_config.py /path/to/app exists
    python read_build_config.py /path/to/app display_name
    python read_build_config.py /path/to/app require_nodejs
    python read_build_config.py /path/to/app all
"""

import sys
import json
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.build_config_parser import BuildConfigParser


def main():
    """Main entry point"""

    if len(sys.argv) < 2:
        print("Usage: python read_build_config.py <app_dir> [field]", file=sys.stderr)
        sys.exit(1)

    app_dir = sys.argv[1]
    field = sys.argv[2] if len(sys.argv) > 2 else "all"

    # Parse configuration
    config_path = Path(app_dir) / "build_config.ini"
    parser = BuildConfigParser(str(config_path))

    # Check existence
    if field == "exists":
        print("true" if parser.exists() else "false")
        sys.exit(0)

    # If config doesn't exist, return empty/default values
    if not parser.exists():
        if field == "all":
            print(json.dumps({}))
        else:
            print("")
        sys.exit(0)

    # Parse config
    config = parser.parse()
    if not config:
        if field == "all":
            print(json.dumps({}))
        else:
            print("")
        sys.exit(0)

    # Return requested field
    try:
        if field == "all":
            # Return all configuration as JSON
            output = {
                "app_info": {
                    "display_name_chinese": config.get_display_name_chinese(),
                    "display_name_english": config.get_display_name_english(),
                    "description": config.get_description(),
                    "version": config.get_version(),
                    "author": config.get_author(),
                },
                "dependencies": {
                    "require_nodejs": config.requires_node(),
                    "require_python": config.requires_python(),
                    "nodejs_version": config.get_node_version(),
                    "python_version": config.get_python_version(),
                    "npm_packages": config.get_npm_packages(),
                    "pip_packages": config.get_pip_packages(),
                },
                "installation": {
                    "skip_pnpm_install": config.skip_pnpm_install(),
                    "skip_pycore_init": config.skip_pycore_init(),
                    "create_desktop_shortcut": config.create_desktop_shortcut(),
                    "pre_install_commands": config.get_pre_install_commands(),
                    "post_install_commands": config.get_post_install_commands(),
                },
                "startup": {
                    "command": config.get_startup_command(),
                    "working_directory": config.get_working_directory(),
                    "environment": config.get_environment_variables(),
                },
            }
            print(json.dumps(output, ensure_ascii=False, indent=2))

        elif field == "display_name":
            print(config.get_display_name() or "")

        elif field == "display_name_chinese":
            print(config.get_display_name_chinese() or "")

        elif field == "display_name_english":
            print(config.get_display_name_english() or "")

        elif field == "description":
            print(config.get_description() or "")

        elif field == "version":
            print(config.get_version() or "")

        elif field == "require_nodejs":
            print("true" if config.requires_node() else "false")

        elif field == "require_python":
            print("true" if config.requires_python() else "false")

        elif field == "skip_pnpm_install":
            print("true" if config.skip_pnpm_install() else "false")

        elif field == "skip_pycore_init":
            print("true" if config.skip_pycore_init() else "false")

        elif field == "create_desktop_shortcut":
            print("true" if config.create_desktop_shortcut() else "false")

        elif field == "startup_command":
            print(config.get_startup_command() or "")

        elif field == "npm_packages":
            print(",".join(config.get_npm_packages()))

        elif field == "pip_packages":
            print(",".join(config.get_pip_packages()))

        elif field == "pre_install_commands":
            print(";".join(config.get_pre_install_commands()))

        elif field == "post_install_commands":
            print(";".join(config.get_post_install_commands()))

        else:
            print(f"Unknown field: {field}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"Error reading field '{field}': {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
