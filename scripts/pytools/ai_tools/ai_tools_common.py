#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIALLY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

"""
Common utilities for AI tools scripts.

Provides shared functions used across multiple AI tools synchronization scripts.
"""

import os
import sys
import copy
from pathlib import Path
from typing import Dict, Any, Set


def get_user_home_directory() -> Path:
    r"""
    Get user home directory from environment variables or system default.
    
    This function respects custom user directory paths set by PowerShell scripts
    (e.g., D:\.tmp\Users\时间戳) via environment variables.
    
    Priority:
    1. USERPROFILE (Windows) or HOME (Unix) environment variable (set by PowerShell script)
    2. USER_HOME environment variable (custom)
    3. Path.home() (system default)
    
    Returns:
        Path object pointing to user home directory
        
    Example:
        >>> user_home = get_user_home_directory()
        config_path = user_home / ".claude.json"
    """
    # Try environment variables first (set by PowerShell script)
    user_home = os.environ.get('USERPROFILE') or os.environ.get('HOME') or os.environ.get('USER_HOME')
    if user_home:
        user_home_path = Path(user_home)
        print(f"[DEBUG] Using custom user directory from environment: {user_home_path}")
        return user_home_path
    
    # Fallback to system default
    default_home = Path.home()
    print(f"[DEBUG] Using system default user directory: {default_home}")
    return default_home


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


def detect_os_environment(tool_prefix: str = "", file_extension: str = ".json") -> str:
    """
    Detect the OS environment and return appropriate MCP template filename.
    
    Args:
        tool_prefix: Prefix for template filename (e.g., "Codex" -> "mcpCodexWindowsTemplate")
        file_extension: File extension for template (e.g., ".json", ".toml")
    
    Returns:
        Template filename: mcp{prefix}WindowsTemplate{ext}, mcp{prefix}WSLTemplate{ext}, etc.
    """
    prefix = tool_prefix if tool_prefix else ""
    ext = file_extension
    
    # Check if Windows
    if sys.platform == "win32":
        return f"mcp{prefix}WindowsTemplate{ext}"

    # Check if WSL (Linux with /mnt/c/Users directory)
    if sys.platform == "linux":
        wsl_indicator = Path("/mnt/c/Users")
        if wsl_indicator.exists():
            return f"mcp{prefix}WSLTemplate{ext}"

        # Check for Linux desktop environment
        has_display = os.environ.get("DISPLAY") is not None
        has_xdg_session = os.environ.get("XDG_SESSION_TYPE") is not None
        has_desktop_session = os.environ.get("DESKTOP_SESSION") is not None

        if has_display or has_xdg_session or has_desktop_session:
            return f"mcp{prefix}UbuntoDesktopTemplate{ext}"

        # Pure Linux server (no desktop environment)
        return f"mcp{prefix}LinuxTemplate{ext}"

    # Fallback to Windows template for other systems
    return f"mcp{prefix}WindowsTemplate{ext}"


def cleanup_old_backups(backup_dir: Path, keep_count: int = 5, backup_pattern: str = "*.backup.*") -> None:
    """
    Clean up old backup files, keeping only the most recent ones.
    
    Args:
        backup_dir: Directory containing backup files
        keep_count: Number of recent backups to keep
        backup_pattern: Glob pattern to match backup files (e.g., "*.backup.*.json", "*.backup.*.toml")
    """
    if not backup_dir.exists():
        return
    
    # Find all backup files matching the pattern
    backup_files = []
    for file_path in backup_dir.glob(backup_pattern):
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


def replace_project_name_in_template(template_data: Dict[str, Any], working_dir: str) -> Dict[str, Any]:
    """
    Replace $PROJECT_NAME$ placeholder in template with working directory.
    
    Args:
        template_data: Template dictionary to process
        working_dir: Working directory path to replace $PROJECT_NAME$ with
        
    Returns:
        New dictionary with $PROJECT_NAME$ replaced
    """
    result = copy.deepcopy(template_data)

    def replace_in_value(value: Any) -> Any:
        if isinstance(value, str):
            escaped_working_dir = working_dir.replace("\\", "\\\\")
            return value.replace("$PROJECT_NAME$", escaped_working_dir)
        elif isinstance(value, dict):
            return {k: replace_in_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [replace_in_value(item) for item in value]
        else:
            return value

    return replace_in_value(result)

