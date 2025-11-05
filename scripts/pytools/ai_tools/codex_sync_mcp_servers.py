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
Universal Codex MCP Servers Configuration Sync Tool

This script synchronizes MCP server configurations from the project template
to Codex configuration file (~/.codex/config.toml).

Supported environments:
- Windows: %USERPROFILE%\.codex\config.toml
- WSL: ~/.codex/config.toml
- Linux Desktop: ~/.codex/config.toml
- Linux Server: ~/.codex/config.toml

Template sources:
- Windows: D:\programing\core_node\_prompt\mcpCodexWindowsTemplate.toml
- WSL: D:\programing\core_node\_prompt\mcpCodexWSLTemplate.toml
- Desktop: D:\programing\core_node\_prompt\mcpCodexUbuntoDesktopTemplate.toml
- Server: D:\programing\core_node\_prompt\mcpCodexLinuxTemplate.toml

The script merges missing MCP servers from the template into the user's config.toml.
"""

import os
import sys
import argparse
import shutil
from pathlib import Path
from typing import Dict, Any, Set, Optional, List
from datetime import datetime

try:
    import tomli
    import tomli_w
except ImportError:
    print("[ERROR] Required packages not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "tomli", "tomli-w"])
    import tomli
    import tomli_w

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
MCP_TEMPLATE_DIR = PROJECT_ROOT / "_prompt"

def print_same_line(message: str, end_with_newline: bool = False) -> None:
    """
    Print message on the same line (overwriting previous content).

    Args:
        message: The message to print
        end_with_newline: If True, ends with newline; if False, stays on same line for next update

    Usage:
        print_same_line("Processing... 1/10")  # Updates same line
        print_same_line("Processing... 2/10")  # Overwrites previous
        print_same_line("Completed!", True)     # Final message with newline
    """
    padded_message = message.ljust(80)

    if end_with_newline:
        print(f"\r{padded_message}")
    else:
        print(f"\r{padded_message}", end='', flush=True)

def detect_os_environment() -> str:
    """
    Detect the OS environment and return appropriate MCP template filename.

    Returns:
        Template filename: mcpCodexWindowsTemplate.toml, mcpCodexWSLTemplate.toml,
                          mcpCodexUbuntoDesktopTemplate.toml, or mcpCodexLinuxTemplate.toml
    """
    if sys.platform == "win32":
        return "mcpCodexWindowsTemplate.toml"

    if sys.platform == "linux":
        wsl_indicator = Path("/mnt/c/Users")
        if wsl_indicator.exists():
            return "mcpCodexWSLTemplate.toml"

        has_display = os.environ.get("DISPLAY") is not None
        has_xdg_session = os.environ.get("XDG_SESSION_TYPE") is not None
        has_desktop_session = os.environ.get("DESKTOP_SESSION") is not None

        if has_display or has_xdg_session or has_desktop_session:
            return "mcpCodexUbuntoDesktopTemplate.toml"

        return "mcpCodexLinuxTemplate.toml"

    return "mcpCodexWindowsTemplate.toml"

def get_codex_config_path() -> Path:
    """Get the path to user's Codex config.toml file."""
    if sys.platform == "win32":
        config_dir = Path(os.environ.get('USERPROFILE', '.')) / '.codex'
    else:
        config_dir = Path.home() / '.codex'

    return config_dir / 'config.toml'

def get_backup_directory() -> Path:
    """Get the backup directory for Codex configurations."""
    if sys.platform == "win32":
        base_dir = Path(os.environ.get('USERPROFILE', '.')) / '.codex'
    else:
        base_dir = Path.home() / '.codex'

    backup_dir = base_dir / '.backups'
    return backup_dir

def load_toml_file(file_path: Path) -> Dict[str, Any]:
    """Load TOML file with error handling."""
    try:
        with open(file_path, 'rb') as f:
            return tomli.load(f)
    except FileNotFoundError:
        print(f"[WARNING] File not found: {file_path}")
        return {}
    except tomli.TOMLDecodeError as e:
        print(f"[ERROR] Invalid TOML in {file_path}: {e}")
        raise
    except Exception as e:
        print(f"[ERROR] Failed to read {file_path}: {e}")
        raise

def save_toml_file(file_path: Path, data: Dict[str, Any], backup: bool = True) -> None:
    """Save TOML file with backup and formatting."""
    if backup and file_path.exists():
        backup_dir = get_backup_directory()
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"config.backup.{timestamp}.toml"
        shutil.copy2(file_path, backup_path)
        print(f"[INFO] Created backup: {backup_path.name}")

        cleanup_old_backups(backup_dir, keep_count=5)

    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, 'wb') as f:
        tomli_w.dump(data, f)

def cleanup_old_backups(backup_dir: Path, keep_count: int = 5) -> None:
    """Clean up old backup files, keeping only the most recent ones."""
    if not backup_dir.exists():
        return

    backup_files = []
    for file_path in backup_dir.glob("config.backup.*.toml"):
        if file_path.is_file():
            backup_files.append(file_path)

    backup_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)

    if len(backup_files) > keep_count:
        files_to_remove = backup_files[keep_count:]
        for file_path in files_to_remove:
            try:
                file_path.unlink()
                print(f"[CLEANUP] Removed old backup: {file_path.name}")
            except Exception as e:
                print(f"[WARNING] Failed to remove old backup {file_path.name}: {e}")

def load_mcp_template() -> Dict[str, Any]:
    """
    Load MCP configuration from appropriate template based on OS detection.

    Returns:
        Dictionary containing mcp_servers configuration from the template
    """
    template_filename = detect_os_environment()
    template_path = MCP_TEMPLATE_DIR / template_filename

    print(f"[INFO] Detected OS environment: {template_filename.replace('mcpCodexTemplate.toml', '').replace('mcpCodex', '')}")

    if not template_path.exists():
        print(f"[WARNING] Template file not found: {template_path}")
        print(f"[INFO] Falling back to mcpCodexWindowsTemplate.toml")
        template_path = MCP_TEMPLATE_DIR / "mcpCodexWindowsTemplate.toml"

    if not template_path.exists():
        print(f"[ERROR] Fallback template not found: {template_path}")
        return {}

    print(f"[INFO] Loading MCP template from: {template_path}")
    template_data = load_toml_file(template_path)

    mcp_servers = {}
    if "mcp_servers" in template_data:
        mcp_servers = template_data["mcp_servers"]

    return mcp_servers

def merge_mcp_servers(
    target_servers: Dict[str, Any],
    template_servers: Dict[str, Any]
) -> tuple[Dict[str, Any], Set[str]]:
    """
    Merge template servers into target servers, adding missing ones.

    Returns (merged_servers, added_server_names)
    """
    merged = target_servers.copy()
    added = set()

    for server_name, server_config in template_servers.items():
        if server_name not in merged:
            merged[server_name] = server_config
            added.add(server_name)

    return merged, added

def replace_project_name_in_template(
    template_data: Dict[str, Any],
    working_dir: str
) -> Dict[str, Any]:
    """Replace $PROJECT_NAME$ placeholder in template with working directory."""
    import copy
    result = copy.deepcopy(template_data)

    def replace_in_value(value: Any) -> Any:
        if isinstance(value, str):
            return value.replace("$PROJECT_NAME$", working_dir)
        elif isinstance(value, dict):
            return {k: replace_in_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [replace_in_value(item) for item in value]
        else:
            return value

    return replace_in_value(result)

def extract_mcp_servers_from_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract all mcp_servers entries from Codex config.

    In Codex, MCP servers can be defined in multiple ways:
    - [mcp_servers] section
    - Top-level [mcp_servers.server_name] tables
    """
    mcp_servers = {}

    if "mcp_servers" in config:
        if isinstance(config["mcp_servers"], dict):
            mcp_servers.update(config["mcp_servers"])

    for key, value in config.items():
        if key.startswith("mcp_servers."):
            server_name = key.replace("mcp_servers.", "")
            if isinstance(value, dict):
                mcp_servers[server_name] = value

    return mcp_servers

def sync_codex_configuration(working_dir: Optional[str] = None) -> int:
    """
    Main synchronization function for Codex.

    Args:
        working_dir: Working directory for $PROJECT_NAME$ replacement

    Returns 0 on success, 1 on error.
    """
    print_same_line("[0/4] Starting Codex MCP configuration sync...")

    config_path = get_codex_config_path()

    print_same_line("[0/4] Cleaning up old backups...")
    try:
        backup_dir = get_backup_directory()
        cleanup_old_backups(backup_dir, keep_count=5)
        print_same_line("[0/4] Backup cleanup completed", True)
    except Exception as e:
        print_same_line(f"[0/4] Backup cleanup warning: {e}", True)

    print_same_line("[1/4] Loading MCP template based on OS...")
    template_servers = load_mcp_template()

    if not template_servers:
        print(f"\n[WARNING] No MCP servers found in OS-specific template")
        print("[INFO] Continuing with empty MCP configuration")
        template_servers = {}

    if working_dir:
        print(f"[INFO] Replacing $PROJECT_NAME$ with: {working_dir}")
        template_servers = replace_project_name_in_template(
            {"mcp_servers": template_servers},
            working_dir
        ).get("mcp_servers", {})

    print_same_line(f"[1/4] Template: {len(template_servers)} MCP servers found", True)

    print_same_line("[2/4] Loading user config...")
    if not config_path.exists():
        print(f"\n[INFO] Creating new config file: {config_path}")
        user_data = {}
    else:
        user_data = load_toml_file(config_path)
    print_same_line("[2/4] User config loaded", True)

    print_same_line("[3/4] Syncing configurations...")

    if "mcp_servers" not in user_data:
        user_data["mcp_servers"] = {}

    current_servers = extract_mcp_servers_from_config(user_data)
    merged_servers, added_servers = merge_mcp_servers(current_servers, template_servers)

    user_data["mcp_servers"] = merged_servers

    for key in list(user_data.keys()):
        if key.startswith("mcp_servers."):
            del user_data[key]

    print_same_line("[3/4] Sync completed", True)

    print_same_line("[4/4] Saving configuration...")

    print()
    print("=" * 80)

    if added_servers:
        print(f"[SUCCESS] Added {len(added_servers)} MCP server(s):")
        for server_name in sorted(added_servers):
            print(f"  + {server_name}")
        print()

        save_toml_file(config_path, user_data, backup=True)
        print_same_line("[4/4] Configuration saved with backup", True)
        print("=" * 80)
        print("[IMPORTANT] Codex will automatically reload the configuration")
        print("[INFO] If using Codex CLI, you may need to restart your session")
        print("[INFO] If using Codex IDE extension, changes will apply on next launch")
        print("=" * 80)
    else:
        print("[INFO] Configuration is up to date - no changes needed")
        print("=" * 80)

    return 0

def add_mcp_server_http(name: str, url: str, headers: Optional[List[str]] = None) -> int:
    """
    Add HTTP MCP server to Codex configuration.

    Args:
        name: Server name
        url: HTTP/HTTPS URL
        headers: List of headers in "KEY: VALUE" format

    Returns 0 on success, 1 on error.
    """
    config_path = get_codex_config_path()

    if config_path.exists():
        config = load_toml_file(config_path)
    else:
        config = {}

    if "mcp_servers" not in config:
        config["mcp_servers"] = {}

    if name in config["mcp_servers"]:
        print(f"[WARNING] MCP server '{name}' already exists")
        response = input("Do you want to overwrite it? (y/N): ").strip().lower()
        if response != 'y':
            print("[INFO] Operation cancelled")
            return 0

    server_config = {
        "type": "http",
        "url": url
    }

    if headers:
        header_dict = {}
        for header in headers:
            if ':' not in header:
                print(f"[WARNING] Invalid header format (must be 'KEY: VALUE'): {header}")
                continue
            key, value = header.split(':', 1)
            header_dict[key.strip()] = value.strip()

        if header_dict:
            server_config["headers"] = header_dict

    config["mcp_servers"][name] = server_config

    save_toml_file(config_path, config, backup=True)

    print("=" * 80)
    print(f"[SUCCESS] Added HTTP MCP server: {name}")
    print(f"  URL: {url}")
    if headers:
        print(f"  Headers: {len(header_dict)} configured")
    print("=" * 80)
    print("[INFO] Codex will automatically reload the configuration")
    print("=" * 80)

    return 0

def add_mcp_server_stdio(name: str, command: str, env_vars: Optional[List[str]] = None) -> int:
    """
    Add stdio MCP server to Codex configuration.

    Args:
        name: Server name
        command: Command to start server
        env_vars: List of environment variables in "KEY=VALUE" format

    Returns 0 on success, 1 on error.
    """
    config_path = get_codex_config_path()

    if config_path.exists():
        config = load_toml_file(config_path)
    else:
        config = {}

    if "mcp_servers" not in config:
        config["mcp_servers"] = {}

    if name in config["mcp_servers"]:
        print(f"[WARNING] MCP server '{name}' already exists")
        response = input("Do you want to overwrite it? (y/N): ").strip().lower()
        if response != 'y':
            print("[INFO] Operation cancelled")
            return 0

    command_parts = command.split()
    server_config = {
        "command": command_parts[0]
    }

    if len(command_parts) > 1:
        server_config["args"] = command_parts[1:]

    if env_vars:
        env_dict = {}
        for env_var in env_vars:
            if '=' not in env_var:
                print(f"[WARNING] Invalid environment variable format (must be 'KEY=VALUE'): {env_var}")
                continue
            key, value = env_var.split('=', 1)
            env_dict[key.strip()] = value.strip()

        if env_dict:
            server_config["env"] = env_dict

    config["mcp_servers"][name] = server_config

    save_toml_file(config_path, config, backup=True)

    print("=" * 80)
    print(f"[SUCCESS] Added stdio MCP server: {name}")
    print(f"  Command: {command}")
    if env_vars:
        print(f"  Environment: {len(env_dict)} variables configured")
    print("=" * 80)
    print("[INFO] Codex will automatically reload the configuration")
    print("=" * 80)

    return 0

def remove_mcp_server(name: str) -> int:
    """
    Remove MCP server from Codex configuration.

    Args:
        name: Server name to remove

    Returns 0 on success, 1 on error.
    """
    config_path = get_codex_config_path()

    if not config_path.exists():
        print(f"[ERROR] Config file not found: {config_path}")
        return 1

    config = load_toml_file(config_path)

    if "mcp_servers" not in config or name not in config["mcp_servers"]:
        print(f"[ERROR] MCP server '{name}' not found")
        return 1

    del config["mcp_servers"][name]

    save_toml_file(config_path, config, backup=True)

    print("=" * 80)
    print(f"[SUCCESS] Removed MCP server: {name}")
    print("=" * 80)
    print("[INFO] Codex will automatically reload the configuration")
    print("=" * 80)

    return 0

def list_mcp_servers() -> int:
    """
    List all configured MCP servers.

    Returns 0 on success, 1 on error.
    """
    config_path = get_codex_config_path()

    if not config_path.exists():
        print(f"[INFO] Config file not found: {config_path}")
        print("[INFO] No MCP servers configured")
        return 0

    config = load_toml_file(config_path)
    servers = extract_mcp_servers_from_config(config)

    if not servers:
        print("[INFO] No MCP servers configured")
        return 0

    print("=" * 80)
    print(f"Configured MCP Servers ({len(servers)} total)")
    print("=" * 80)

    for name in sorted(servers.keys()):
        server_config = servers[name]
        disabled = server_config.get("disabled", False)
        status = "[DISABLED]" if disabled else "[ENABLED]"

        print(f"\n{status} {name}")

        if "type" in server_config and server_config["type"] == "http":
            print(f"  Type: HTTP")
            print(f"  URL: {server_config.get('url', 'N/A')}")
            if "headers" in server_config:
                print(f"  Headers: {len(server_config['headers'])} configured")
        elif "command" in server_config:
            print(f"  Type: stdio")
            print(f"  Command: {server_config['command']}")
            if "args" in server_config:
                print(f"  Args: {' '.join(server_config['args'])}")
            if "env" in server_config:
                print(f"  Environment: {len(server_config['env'])} variables")
        else:
            print(f"  Type: Unknown")

    print("\n" + "=" * 80)

    return 0

def toggle_mcp_server(name: str, enable: bool) -> int:
    """
    Enable or disable an MCP server.

    Args:
        name: Server name
        enable: True to enable, False to disable

    Returns 0 on success, 1 on error.
    """
    config_path = get_codex_config_path()

    if not config_path.exists():
        print(f"[ERROR] Config file not found: {config_path}")
        return 1

    config = load_toml_file(config_path)

    if "mcp_servers" not in config or name not in config["mcp_servers"]:
        print(f"[ERROR] MCP server '{name}' not found")
        return 1

    if enable:
        if "disabled" in config["mcp_servers"][name]:
            del config["mcp_servers"][name]["disabled"]
        action = "enabled"
    else:
        config["mcp_servers"][name]["disabled"] = True
        action = "disabled"

    save_toml_file(config_path, config, backup=True)

    print("=" * 80)
    print(f"[SUCCESS] MCP server '{name}' has been {action}")
    print("=" * 80)
    print("[INFO] Codex will automatically reload the configuration")
    print("=" * 80)

    return 0

def main() -> int:
    """Entry point."""
    parser = argparse.ArgumentParser(
        description="Codex MCP Servers Configuration Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Sync from template:
    python %(prog)s sync

  Add HTTP server:
    python %(prog)s add sentry https://mcp.sentry.dev/mcp --type http
    python %(prog)s add notion https://mcp.notion.com/mcp --type http --header "Authorization: Bearer TOKEN"

  Add stdio server:
    python %(prog)s add airtable "npx -y airtable-mcp-server" --env AIRTABLE_API_KEY=your_key

  List servers:
    python %(prog)s list

  Remove server:
    python %(prog)s remove sentry

  Enable/Disable server:
    python %(prog)s enable sentry
    python %(prog)s disable sentry
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    sync_parser = subparsers.add_parser('sync', help='Sync MCP servers from template')
    sync_parser.add_argument(
        "--working-dir", "-w",
        type=str,
        default=None,
        help="Working directory for $PROJECT_NAME$ replacement"
    )

    add_parser = subparsers.add_parser('add', help='Add MCP server')
    add_parser.add_argument('name', help='Server name')
    add_parser.add_argument('target', help='URL for HTTP server or command for stdio server')
    add_parser.add_argument('--type', choices=['http', 'stdio'], default='stdio', help='Server type (default: stdio)')
    add_parser.add_argument('--header', action='append', help='HTTP header (format: "KEY: VALUE", can be used multiple times)')
    add_parser.add_argument('--env', action='append', help='Environment variable (format: "KEY=VALUE", can be used multiple times)')

    remove_parser = subparsers.add_parser('remove', help='Remove MCP server')
    remove_parser.add_argument('name', help='Server name to remove')

    list_parser = subparsers.add_parser('list', help='List all MCP servers')

    enable_parser = subparsers.add_parser('enable', help='Enable MCP server')
    enable_parser.add_argument('name', help='Server name to enable')

    disable_parser = subparsers.add_parser('disable', help='Disable MCP server')
    disable_parser.add_argument('name', help='Server name to disable')

    show_parser = subparsers.add_parser('show-config', help='Show Codex configuration path')

    args = parser.parse_args()

    if args.command == 'show-config':
        config_path = get_codex_config_path()
        print(f"Codex config path: {config_path}")
        print(f"Exists: {config_path.exists()}")
        if config_path.exists():
            try:
                config = load_toml_file(config_path)
                servers = extract_mcp_servers_from_config(config)
                print(f"Current MCP servers: {len(servers)}")
                for name in sorted(servers.keys()):
                    print(f"  - {name}")
            except Exception as e:
                print(f"Error reading config: {e}")
        return 0

    if args.command == 'add':
        if args.type == 'http':
            return add_mcp_server_http(args.name, args.target, args.header)
        else:
            return add_mcp_server_stdio(args.name, args.target, args.env)

    if args.command == 'remove':
        return remove_mcp_server(args.name)

    if args.command == 'list':
        return list_mcp_servers()

    if args.command == 'enable':
        return toggle_mcp_server(args.name, True)

    if args.command == 'disable':
        return toggle_mcp_server(args.name, False)

    if args.command == 'sync':
        try:
            return sync_codex_configuration(args.working_dir)
        except KeyboardInterrupt:
            print("\n[INFO] Interrupted by user")
            return 130
        except Exception as e:
            print(f"\n[ERROR] Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            return 1

    parser.print_help()
    return 0

if __name__ == "__main__":
    sys.exit(main())
