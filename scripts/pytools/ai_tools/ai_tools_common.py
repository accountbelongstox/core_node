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
import subprocess
from pathlib import Path
from typing import Dict, Any, Set, List, Optional


def ensure_dependencies(package_map: Dict[str, str], install_strategies: Optional[List[List[str]]] = None) -> bool:
    """
    Ensure required Python packages are installed with real-time output.
    
    This function checks all packages using key-value mapping (pip_name -> import_name),
    and immediately installs any missing packages.
    
    Args:
        package_map: Dictionary mapping pip package names to Python import names.
            Key: pip package name (e.g., "tomli-w")
            Value: Python import name (e.g., "tomli_w")
            Example: {"tomli": "tomli", "tomli-w": "tomli_w"}
        install_strategies: List of pip install command strategies to try.
            Each strategy is a list of additional arguments for pip install.
            Default strategies:
            1. ["--user"] - Install to user directory
            2. ["--break-system-packages"] - Override externally-managed-environment
            3. [] - Standard installation (last resort)
    
    Returns:
        True if all packages are successfully installed, False otherwise
    
    Example:
        >>> packages = {"tomli": "tomli", "tomli-w": "tomli_w"}
        >>> if not ensure_dependencies(packages):
        ...     sys.exit(1)
        >>> import tomli
        >>> import tomli_w
    """
    if install_strategies is None:
        # Detect OS and adjust strategy order
        # On Linux with externally-managed-environment, --break-system-packages should be tried first
        if sys.platform == "linux":
            install_strategies = [
                ["--break-system-packages"],
                ["--user"],
                []
            ]
        elif sys.platform == "win32":
            # Windows doesn't need --user or --break-system-packages
            install_strategies = [
                []
            ]
        else:
            install_strategies = [
                ["--user"],
                ["--break-system-packages"],
                []
            ]
    
    # Check all packages and collect missing ones
    missing_packages = {}
    for pip_name, import_name in package_map.items():
        try:
            __import__(import_name)
            print(f"[OK] Package '{pip_name}' (import: {import_name}) is already installed")
        except ImportError:
            missing_packages[pip_name] = import_name
            print(f"[MISSING] Package '{pip_name}' (import: {import_name}) not found")
    
    if not missing_packages:
        print("[INFO] All required packages are installed")
        return True
    
    print()
    print(f"[INFO] Found {len(missing_packages)} missing package(s). Installing...")
    print()
    
    # Install each missing package immediately
    failed_packages = []
    for pip_name, import_name in missing_packages.items():
        print(f"[INSTALL] Installing package: {pip_name} (import: {import_name})")
        
        package_installed = False
        for strategy_idx, strategy_args in enumerate(install_strategies, 1):
            strategy_name = " ".join(strategy_args) if strategy_args else "standard"
            print(f"  [STRATEGY {strategy_idx}/{len(install_strategies)}] Trying: {strategy_name or 'standard'}")
            
            cmd = [sys.executable, "-m", "pip", "install"] + strategy_args + [pip_name]
            
            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    bufsize=1
                )
                
                for line in process.stdout:
                    print(f"  {line}", end='', flush=True)
                
                return_code = process.wait()
                
                if return_code == 0:
                    # Verify installation by trying to import
                    try:
                        __import__(import_name)
                        print()
                        print(f"  [SUCCESS] Package '{pip_name}' installed and verified")
                        print()
                        package_installed = True
                        break
                    except ImportError:
                        print()
                        print(f"  [WARNING] Package '{pip_name}' installed but import '{import_name}' still fails")
                        print()
                else:
                    print()
                    print(f"  [WARNING] Strategy {strategy_idx} failed with return code {return_code}")
                    print()
            
            except Exception as e:
                print()
                print(f"  [WARNING] Strategy {strategy_idx} raised exception: {e}")
                print()
                continue
        
        if not package_installed:
            failed_packages.append((pip_name, import_name))
            print(f"  [ERROR] Failed to install package: {pip_name}")
            print()
    
    if failed_packages:
        print("[ERROR] Some packages failed to install:")
        for pip_name, import_name in failed_packages:
            print(f"  - {pip_name} (import: {import_name})")
        print()
        
        # Provide platform-specific solutions
        if sys.platform == "linux":
            print("[INFO] Linux environment detected. Try these solutions:")
            print()
            print("Option 1: Use --break-system-packages (recommended for externally-managed environments):")
            for pip_name, _ in failed_packages:
                print(f"  {sys.executable} -m pip install --break-system-packages {pip_name}")
            print()
            print("Option 2: Install to user directory:")
            for pip_name, _ in failed_packages:
                print(f"  {sys.executable} -m pip install --user {pip_name}")
            print()
            print("Option 3: Install system packages (if available):")
            print("  sudo apt update")
            for pip_name, _ in failed_packages:
                # Try to suggest system package name
                module_name = pip_name.replace("-", "_")
                print(f"  sudo apt install python3-{module_name}  # May not be available")
            print()
            print("Option 4: Use virtual environment:")
            print("  python3 -m venv venv")
            print("  source venv/bin/activate")
            for pip_name, _ in failed_packages:
                print(f"  pip install {pip_name}")
            print()
            print("Option 5: Use pipx (for applications):")
            print("  sudo apt install pipx")
            for pip_name, _ in failed_packages:
                print(f"  pipx install {pip_name}")
        elif sys.platform == "win32":
            print("[INFO] Windows environment detected. Try this solution:")
            print()
            print("Standard installation:")
            for pip_name, _ in failed_packages:
                print(f"  {sys.executable} -m pip install {pip_name}")
        else:
            print("Please install manually:")
            for pip_name, _ in failed_packages:
                print(f"  {sys.executable} -m pip install {pip_name}")
            print()
            print("Or use one of these options:")
            for pip_name, _ in failed_packages:
                print(f"  {sys.executable} -m pip install --user {pip_name}")
                print(f"  {sys.executable} -m pip install --break-system-packages {pip_name}")
        print()
        return False
    
    print("[SUCCESS] All packages installed successfully")
    print()
    return True


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

