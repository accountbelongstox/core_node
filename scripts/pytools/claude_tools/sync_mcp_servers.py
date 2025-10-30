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
Universal MCP Servers Configuration Sync Tool

This script synchronizes MCP server configurations from the project template
to various AI tool configuration files.

Supported targets:
- Claude: C:\Users\{USERNAME}\.claude.json
- Factory AI Droid: C:\Users\{USERNAME}\.factory\mcp.json

Template: D:\programing\core_node\_prompt\mcpWindowsTemplate.json

The script recursively finds all 'mcpServers' objects in the target file
and merges missing servers from the template.
"""

import json
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, Any, Set, Optional
import shutil
from datetime import datetime

TEMPLATE_PATH = r"D:\programing\core_node\_prompt\mcpWindowsTemplate.json"

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
    # Clear the line by padding with spaces (80 chars wide)
    padded_message = message.ljust(80)

    if end_with_newline:
        print(f"\r{padded_message}")
    else:
        print(f"\r{padded_message}", end='', flush=True)

def get_user_config_path(target: str = "claude") -> Path:
    """Get the path to user's configuration file based on target."""
    username = os.environ.get('USERNAME') or os.environ.get('USER')
    if not username:
        raise RuntimeError("Cannot determine username from environment variables")

    if target.lower() == "claude":
        return Path(f"C:\\Users\\{username}\\.claude.json")
    elif target.lower() == "droid":
        return Path(f"C:\\Users\\{username}\\.factory\\mcp.json")
    else:
        raise ValueError(f"Unsupported target: {target}. Supported targets: claude, droid")

def get_user_claude_config_path() -> Path:
    """Get the path to user's .claude.json configuration file (backward compatibility)."""
    return get_user_config_path("claude")

def load_json_file(file_path: Path) -> Dict[str, Any]:
    """Load JSON file with error handling."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[WARNING] File not found: {file_path}")
        return {}
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON in {file_path}: {e}")
        raise
    except Exception as e:
        print(f"[ERROR] Failed to read {file_path}: {e}")
        raise

def get_backup_directory(target: str) -> Path:
    """Get the backup directory for the specified target."""
    username = os.environ.get('USERNAME') or os.environ.get('USER')
    if not username:
        raise RuntimeError("Cannot determine username from environment variables")
    
    if target.lower() == "claude":
        base_dir = Path(f"C:\\Users\\{username}")
        backup_dir = base_dir / ".claude.backups"
    elif target.lower() == "droid":
        base_dir = Path(f"C:\\Users\\{username}\\.factory")
        backup_dir = base_dir / ".droid.backups"
    else:
        raise ValueError(f"Unsupported target: {target}")
    
    return backup_dir

def cleanup_old_backups(backup_dir: Path, keep_count: int = 5) -> None:
    """Clean up old backup files, keeping only the most recent ones."""
    if not backup_dir.exists():
        return
    
    # Find all backup files
    backup_files = []
    for file_path in backup_dir.glob("*.backup.*.json"):
        if file_path.is_file():
            backup_files.append(file_path)
    
    # Sort by modification time (newest first)
    backup_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    
    # Remove old backups if we have more than keep_count
    if len(backup_files) > keep_count:
        files_to_remove = backup_files[keep_count:]
        for file_path in files_to_remove:
            try:
                file_path.unlink()
                print(f"[CLEANUP] Removed old backup: {file_path.name}")
            except Exception as e:
                print(f"[WARNING] Failed to remove old backup {file_path.name}: {e}")

def move_existing_backups_to_namespace(target: str) -> None:
    """Move existing backup files to the namespace backup directory."""
    username = os.environ.get('USERNAME') or os.environ.get('USER')
    if not username:
        return
    
    if target.lower() == "claude":
        config_path = Path(f"C:\\Users\\{username}\\.claude.json")
        base_dir = Path(f"C:\\Users\\{username}")
    elif target.lower() == "droid":
        config_path = Path(f"C:\\Users\\{username}\\.factory\\mcp.json")
        base_dir = Path(f"C:\\Users\\{username}\\.factory")
    else:
        return
    
    # Find existing backup files in the config directory
    existing_backups = []
    for file_path in config_path.parent.glob("*.backup.*.json"):
        if file_path.is_file():
            existing_backups.append(file_path)
    
    if existing_backups:
        backup_dir = get_backup_directory(target)
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        for backup_file in existing_backups:
            try:
                new_path = backup_dir / backup_file.name
                shutil.move(str(backup_file), str(new_path))
                print(f"[MOVE] Moved backup to namespace: {backup_file.name}")
            except Exception as e:
                print(f"[WARNING] Failed to move backup {backup_file.name}: {e}")

def save_json_file(file_path: Path, data: Dict[str, Any], backup: bool = True, target: str = "claude") -> None:
    """Save JSON file with backup and formatting."""
    if backup and file_path.exists():
        # Create namespace backup directory
        backup_dir = get_backup_directory(target)
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Move existing backups to namespace directory
        move_existing_backups_to_namespace(target)
        
        # Create new backup in namespace directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"{file_path.stem}.backup.{timestamp}.json"
        shutil.copy2(file_path, backup_path)
        
        # Clean up old backups (keep only 5 most recent)
        cleanup_old_backups(backup_dir, keep_count=5)

    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def find_mcp_servers_objects(obj: Any, path: str = "root") -> Dict[str, Dict[str, Any]]:
    """
    Recursively find all 'mcpServers' objects in the configuration.

    Returns a dictionary mapping path -> mcpServers object
    """
    result = {}

    if isinstance(obj, dict):
        for key, value in obj.items():
            current_path = f"{path}.{key}"

            if key == "mcpServers" and isinstance(value, dict):
                result[current_path] = value

            if isinstance(value, (dict, list)):
                nested_results = find_mcp_servers_objects(value, current_path)
                result.update(nested_results)

    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            current_path = f"{path}[{idx}]"
            if isinstance(item, (dict, list)):
                nested_results = find_mcp_servers_objects(item, current_path)
                result.update(nested_results)

    return result

def merge_mcp_servers(target_servers: Dict[str, Any], template_servers: Dict[str, Any]) -> tuple[Dict[str, Any], Set[str]]:
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

def update_nested_object(obj: Any, path_parts: list[str], new_value: Dict[str, Any]) -> None:
    """Update a nested object in-place using a path."""
    if not path_parts:
        return

    if len(path_parts) == 1:
        if isinstance(obj, dict):
            obj[path_parts[0]] = new_value
        return

    current_key = path_parts[0]

    if current_key.endswith(']'):
        key_name = current_key[:current_key.index('[')]
        index_str = current_key[current_key.index('[')+1:current_key.index(']')]
        index = int(index_str)

        if isinstance(obj, dict) and key_name in obj:
            if isinstance(obj[key_name], list) and len(obj[key_name]) > index:
                update_nested_object(obj[key_name][index], path_parts[1:], new_value)
    else:
        if isinstance(obj, dict) and current_key in obj:
            update_nested_object(obj[current_key], path_parts[1:], new_value)

def sync_mcp_configuration(target: str = "claude") -> int:
    """
    Main synchronization function.

    Args:
        target: Target configuration ("claude" or "droid")

    Returns 0 on success, 1 on error.
    """
    # Clean up old backups at the start of each execution
    print_same_line("[0/3] Cleaning up old backups...")
    try:
        backup_dir = get_backup_directory(target)
        cleanup_old_backups(backup_dir, keep_count=5)
        print_same_line("[0/3] Backup cleanup completed", True)
    except Exception as e:
        print_same_line(f"[0/3] Backup cleanup warning: {e}", True)
    
    template_path = Path(TEMPLATE_PATH)
    user_config_path = get_user_config_path(target)

    if not template_path.exists():
        print(f"[ERROR] Template file not found: {template_path}")
        return 1

    # Step 1: Load template (show progress on same line)
    print_same_line("[1/4] Loading template...")
    template_data = load_json_file(template_path)

    if "mcpServers" not in template_data:
        print(f"\n[ERROR] Template file does not contain 'mcpServers' key")
        return 1

    template_servers = template_data["mcpServers"]
    print_same_line(f"[1/4] Template: {len(template_servers)} MCP servers found", True)

    # Step 2: Load user config (show progress on same line)
    print_same_line("[2/4] Loading user config...")
    if not user_config_path.exists():
        # For droid, create the .factory directory structure
        if target.lower() == "droid":
            user_config_path.parent.mkdir(parents=True, exist_ok=True)
            user_data = {"mcpServers": {}}
        else:
            user_data = {}
    else:
        user_data = load_json_file(user_config_path)
    print_same_line("[2/4] User config loaded", True)

    # Step 3: Sync configurations (show progress on same line)
    print_same_line("[3/4] Syncing configurations...")
    mcp_servers_paths = find_mcp_servers_objects(user_data)

    if not mcp_servers_paths:
        mcp_servers_paths = {"root.mcpServers": {}}
        user_data["mcpServers"] = {}

    total_added = set()
    locations_updated = 0
    total_locations = len(mcp_servers_paths)

    for idx, (path, current_servers) in enumerate(mcp_servers_paths.items(), 1):
        print_same_line(f"[3/4] Syncing... ({idx}/{total_locations} locations)")
        merged_servers, added_servers = merge_mcp_servers(current_servers, template_servers)

        if added_servers:
            total_added.update(added_servers)
            locations_updated += 1

            path_parts = path.replace("root.", "").split(".")
            update_nested_object(user_data, path_parts, merged_servers)

    print_same_line("[3/4] Sync completed", True)
    
    # Step 4: Save configuration with backup management
    print_same_line("[4/4] Saving configuration with backup management...")

    # Summary
    print()
    print("=" * 80)

    if total_added:
        print(f"[SUCCESS] Updated {locations_updated} of {total_locations} mcpServers location(s)")
        print(f"[SUCCESS] Added {len(total_added)} unique MCP server(s):")

        for server_name in sorted(total_added):
            print(f"  + {server_name}")

        print()
        save_json_file(user_config_path, user_data, backup=True, target=target)
        print_same_line("[4/4] Configuration saved with backup management", True)
        print("=" * 80)
        if target.lower() == "claude":
            print("[IMPORTANT] Please restart Claude Code to apply changes!")
        else:
            print("[IMPORTANT] Please restart Factory AI Droid to apply changes!")
        print("=" * 80)
    else:
        print("[INFO] Configuration is up to date - no changes needed")
        print("=" * 80)

    return 0

def main() -> int:
    """Entry point."""
    parser = argparse.ArgumentParser(description="Sync MCP servers configuration")
    parser.add_argument("--target", "-t", 
                       choices=["claude", "droid"], 
                       default="claude",
                       help="Target configuration (default: claude)")
    
    args = parser.parse_args()
    
    try:
        return sync_mcp_configuration(args.target)
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user")
        return 130
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
