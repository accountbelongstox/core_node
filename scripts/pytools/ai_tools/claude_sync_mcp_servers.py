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

def detect_os_environment() -> str:
    """
    Detect the OS environment and return appropriate MCP template filename.

    Returns:
        Template filename: mcpWindowsTemplate.json, mcpWSLTemplate.json,
                          mcpUbuntoDesktopTemplate.json, or mcpLinuxTemplate.json
    """
    # Check if Windows
    if sys.platform == "win32":
        return "mcpWindowsTemplate.json"

    # Check if WSL (Linux with /mnt/c/Users directory)
    if sys.platform == "linux":
        wsl_indicator = Path("/mnt/c/Users")
        if wsl_indicator.exists():
            return "mcpWSLTemplate.json"

        # Check for Linux desktop environment
        # Common indicators: DISPLAY, XDG_SESSION_TYPE, DESKTOP_SESSION
        has_display = os.environ.get("DISPLAY") is not None
        has_xdg_session = os.environ.get("XDG_SESSION_TYPE") is not None
        has_desktop_session = os.environ.get("DESKTOP_SESSION") is not None

        if has_display or has_xdg_session or has_desktop_session:
            return "mcpUbuntoDesktopTemplate.json"

        # Pure Linux server (no desktop environment)
        return "mcpLinuxTemplate.json"

    # Fallback to Windows template for other systems
    return "mcpWindowsTemplate.json"

def load_mcp_template() -> Dict[str, Any]:
    """
    Load MCP configuration from appropriate template based on OS detection.

    Returns:
        Dictionary containing mcpServers configuration from the template
    """
    template_filename = detect_os_environment()
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
    username = os.environ.get('USERNAME') or os.environ.get('USER')
    if not username:
        raise RuntimeError("Cannot determine username from environment variables")

    claude_dir = Path(f"C:\\Users\\{username}\\.claude")

    if not claude_dir.exists():
        print("[INFO] .claude directory does not exist, skipping backup")
        return

    # Create backup directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_base = Path(f"C:\\Users\\{username}\\.claude.backups")
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

def replace_project_name_in_template(template_data: Dict[str, Any], working_dir: str) -> Dict[str, Any]:
    """Replace $PROJECT_NAME$ placeholder in template with working directory."""
    # Escape backslashes for JSON
    escaped_working_dir = working_dir.replace("\\", "\\\\")
    template_str = json.dumps(template_data, ensure_ascii=False)
    template_str = template_str.replace("$PROJECT_NAME$", escaped_working_dir)
    return json.loads(template_str)

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
    parser.add_argument("--working-dir", "-w",
                       type=str,
                       default=None,
                       help="Working directory for $PROJECT_NAME$ replacement")

    args = parser.parse_args()

    try:
        return sync_mcp_configuration(args.target, args.working_dir)
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
