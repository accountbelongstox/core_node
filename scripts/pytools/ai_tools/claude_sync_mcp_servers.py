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

SCRIPT_DIR = Path(__file__).parent
CLAUDE_TEMPLATE_PATH = SCRIPT_DIR / "claude_template.json"
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
MCP_TEMPLATE_DIR = PROJECT_ROOT / "_prompt"

# Add current directory to path for imports
sys.path.insert(0, str(SCRIPT_DIR))

# Import common utilities
from ai_tools_common import (
    get_user_home_directory,
    print_same_line,
    detect_os_environment,
    cleanup_old_backups,
    merge_mcp_servers,
    replace_project_name_in_template
)

def load_mcp_template() -> Dict[str, Any]:
    """
    Load MCP configuration from appropriate template based on OS detection.

    Returns:
        Dictionary containing mcpServers configuration from the template
    """
    template_filename = detect_os_environment("", ".json")
    template_path = MCP_TEMPLATE_DIR / template_filename

    print(f"[INFO] Detected OS environment: {template_filename.replace('mcpTemplate.json', '').replace('mcp', '')}")

    if not template_path.exists():
        print(f"[WARNING] Template file not found: {template_path}")
        print(f"[INFO] Falling back to mcpWindowsTemplate.json")
        template_path = MCP_TEMPLATE_DIR / "mcpWindowsTemplate.json"

    if not template_path.exists():
        print(f"[ERROR] Fallback template not found: {template_path}")
        return {}

    print(f"[INFO] Loading MCP template from: {template_path}")
    template_data = load_json_file(template_path)

    # Extract mcpServers from template
    mcp_servers = {}
    if "mcpServers" in template_data:
        mcp_servers = template_data["mcpServers"]

    return mcp_servers

def get_user_config_path(target: str = "claude") -> Path:
    """Get the path to user's configuration file based on target."""
    user_home = get_user_home_directory()

    if target.lower() == "claude":
        return user_home / ".claude.json"
    elif target.lower() == "droid":
        return user_home / ".factory" / "mcp.json"
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
    user_home = get_user_home_directory()
    
    if target.lower() == "claude":
        backup_dir = user_home / ".claude.backups"
    elif target.lower() == "droid":
        backup_dir = user_home / ".factory" / ".droid.backups"
    else:
        raise ValueError(f"Unsupported target: {target}")
    
    return backup_dir


def move_existing_backups_to_namespace(target: str) -> None:
    """Move existing backup files to the namespace backup directory."""
    user_home = get_user_home_directory()
    
    if target.lower() == "claude":
        config_path = user_home / ".claude.json"
        base_dir = user_home
    elif target.lower() == "droid":
        config_path = user_home / ".factory" / "mcp.json"
        base_dir = user_home / ".factory"
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
        cleanup_old_backups(backup_dir, keep_count=5, backup_pattern="*.backup.*.json")

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

def backup_and_delete_path(source: Path, dest: Path, errors: list) -> int:
    """
    Recursively backup and delete a path (file or directory).
    Returns count of successfully processed items.
    """
    count = 0

    try:
        # Handle symlinks specially
        if source.is_symlink():
            try:
                # Copy symlink as-is
                link_target = source.readlink()
                dest.symlink_to(link_target)
                source.unlink()
                count += 1
            except Exception as e:
                errors.append(f"  - {source.name} (symlink): {e}")
        elif source.is_file():
            try:
                shutil.copy2(source, dest)
                source.unlink()
                count += 1
            except Exception as e:
                errors.append(f"  - {source.name} (file): {e}")
        elif source.is_dir():
            try:
                # Create destination directory
                dest.mkdir(exist_ok=True)

                # Recursively process all children first
                for item in list(source.iterdir()):
                    dest_item = dest / item.name
                    count += backup_and_delete_path(item, dest_item, errors)

                # After all children are processed, try to remove this directory
                # Check if directory is empty before attempting removal
                try:
                    remaining = list(source.iterdir())
                    if not remaining:
                        source.rmdir()
                        count += 1  # Count the directory itself
                    else:
                        # If not empty, list what remains
                        remaining_names = [r.name for r in remaining]
                        errors.append(f"  - {source.name}/ (directory not empty: {', '.join(remaining_names)})")
                except Exception as e:
                    errors.append(f"  - {source.name}/ (rmdir): {e}")

            except PermissionError as e:
                errors.append(f"  - {source.name}/ (permission denied): {e}")
            except Exception as e:
                errors.append(f"  - {source.name}/ (directory): {e}")
    except Exception as e:
        errors.append(f"  - {source.name} (unknown type): {e}")

    return count

def backup_and_clear_claude_directory() -> None:
    """Backup and clear .claude directory."""
    user_home = get_user_home_directory()
    claude_dir = user_home / ".claude"

    if not claude_dir.exists():
        print("[INFO] .claude directory does not exist, skipping backup")
        return

    # Create backup directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_base = user_home / ".claude.backups"
    backup_dir = backup_base / f"claude_dir_backup_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    print(f"[INFO] Backing up .claude directory to: {backup_dir}")

    # Copy and delete each file/directory recursively
    errors = []
    success_count = 0
    total_items = len(list(claude_dir.iterdir()))

    print(f"[INFO] Found {total_items} items to backup")

    for item in claude_dir.iterdir():
        dest_path = backup_dir / item.name
        item_count = backup_and_delete_path(item, dest_path, errors)
        success_count += item_count
        print(f"[DEBUG] {item.name}: {item_count} item(s) processed", flush=True)

    if errors:
        print("[WARNING] Some files could not be backed up or deleted:")
        for error in errors:
            print(error)

    print(f"[SUCCESS] Backed up and deleted {success_count} item(s) from .claude directory")

    # Check what remains and try to remove the directory if empty
    try:
        remaining = list(claude_dir.iterdir())
        if not remaining:
            claude_dir.rmdir()
            print("[INFO] .claude directory removed (now empty)")
        else:
            print(f"[INFO] .claude directory not empty, {len(remaining)} item(s) remain:")
            for item in remaining:
                print(f"  - {item.name}")
    except Exception as e:
        print(f"[WARNING] Could not check/remove .claude directory: {e}")


def sync_mcp_configuration(target: str = "claude", working_dir: Optional[str] = None) -> int:
    """
    Main synchronization function.

    Args:
        target: Target configuration ("claude" or "droid")
        working_dir: Working directory for $PROJECT_NAME$ replacement

    Returns 0 on success, 1 on error.
    """
    # For Claude target: backup and clear .claude directory first
    if target.lower() == "claude":
        print("=" * 80)
        print("[STEP 0] Backing up and clearing .claude directory")
        print("=" * 80)
        try:
            backup_and_clear_claude_directory()
        except Exception as e:
            print(f"[WARNING] .claude directory backup failed: {e}")
        print()

    # Clean up old backups at the start of each execution
    print_same_line("[0/3] Cleaning up old backups...")
    try:
        backup_dir = get_backup_directory(target)
        cleanup_old_backups(backup_dir, keep_count=5)
        print_same_line("[0/3] Backup cleanup completed", True)
    except Exception as e:
        print_same_line(f"[0/3] Backup cleanup warning: {e}", True)

    # Use claude_template.json for Claude, fallback for others
    if target.lower() == "claude":
        template_path = CLAUDE_TEMPLATE_PATH
    else:
        # Fallback for droid and others - could add droid_template.json later
        template_path = CLAUDE_TEMPLATE_PATH

    user_config_path = get_user_config_path(target)

    if not template_path.exists():
        print(f"[ERROR] Template file not found: {template_path}")
        return 1

    # Step 1: Load template (show progress on same line)
    print_same_line("[1/4] Loading template...")
    template_data = load_json_file(template_path)

    # Replace $PROJECT_NAME$ if working_dir provided
    if working_dir and target.lower() == "claude":
        print_same_line("[1/4] Loading template and replacing $PROJECT_NAME$...")
        template_data = replace_project_name_in_template(template_data, working_dir)
        print(f"[INFO] Replaced $PROJECT_NAME$ with: {working_dir}")

    # Load MCP servers from OS-specific template
    print_same_line("[1/4] Loading MCP template based on OS...")
    template_servers = load_mcp_template()

    if not template_servers:
        print(f"\n[WARNING] No MCP servers found in OS-specific template")
        print("[INFO] Continuing with empty MCP configuration")
        template_servers = {}
    else:
        # Dynamically find and update all mcpServers objects in template_data
        if target.lower() == "claude" and working_dir:
            template_mcp_paths = find_mcp_servers_objects(template_data)
            if template_mcp_paths:
                updated_locations = 0
                for path, current_servers in template_mcp_paths.items():
                    current_servers.update(template_servers)
                    updated_locations += 1
                print(f"[INFO] Updated MCP servers in {updated_locations} location(s) in template")
            else:
                print("[WARNING] No mcpServers objects found in template_data")

    print_same_line(f"[1/4] Template: {len(template_servers)} MCP servers found", True)

    # Step 2: Replace user config with template (for Claude)
    print_same_line("[2/4] Preparing user config...")
    if target.lower() == "claude" and working_dir:
        # Backup existing .claude.json if it exists
        if user_config_path.exists():
            backup_dir = get_backup_directory(target)
            backup_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = backup_dir / f"{user_config_path.stem}.backup.{timestamp}.json"
            shutil.copy2(user_config_path, backup_path)
            print(f"[INFO] Backed up existing .claude.json to: {backup_path.name}")

        # Use template_data (already has $PROJECT_NAME$ replaced) as the new config
        user_data = template_data
        print("[INFO] Replaced .claude.json with template (with $PROJECT_NAME$ substituted)")
    else:
        # For droid or Claude without working_dir, load existing config
        if not user_config_path.exists():
            if target.lower() == "droid":
                user_config_path.parent.mkdir(parents=True, exist_ok=True)
                user_data = {"mcpServers": {}}
            else:
                user_data = {}
        else:
            user_data = load_json_file(user_config_path)
    print_same_line("[2/4] User config prepared", True)

    # Step 3: Sync configurations (show progress on same line)
    print_same_line("[3/4] Syncing configurations...")

    # Check if we're in template replacement mode (Claude with working_dir)
    template_replace_mode = target.lower() == "claude" and working_dir

    if template_replace_mode:
        # Template already has MCP servers merged at line 512-513, just count them
        total_added = set(template_servers.keys())
        mcp_servers_paths = find_mcp_servers_objects(user_data)
        total_locations = len(mcp_servers_paths)
        locations_updated = total_locations
        print_same_line(f"[3/4] Template mode: {len(total_added)} servers pre-configured", True)
    else:
        # Normal merge mode (for droid or claude without working_dir)
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
                       choices=["claude", "droid", "codex"],
                       default="claude",
                       help="Target configuration (default: claude)")
    parser.add_argument("--working-dir", "-w",
                       type=str,
                       default=None,
                       help="Working directory for $PROJECT_NAME$ replacement (default: current directory)")

    args = parser.parse_args()

    # Auto-detect working directory if not provided
    working_dir = args.working_dir
    if working_dir is None:
        working_dir = os.getcwd()
        print(f"[INFO] Auto-detected working directory: {working_dir}")

    try:
        return sync_mcp_configuration(args.target, working_dir)
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
