#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utility functions for gitput_unified
"""

import os
import sys
import platform
from pathlib import Path
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import GlobalVarManager


def get_script_dir() -> Path:
    """Get the directory where the script is located"""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent.parent


def get_core_node_dir() -> Path:
    """Get the core_node project root directory"""
    script_dir = get_script_dir()
    return script_dir.parent.parent


def get_win_common_dir() -> Path:
    """Get the win_common directory path"""
    core_node_dir = get_core_node_dir()
    return core_node_dir / "scripts" / "shells" / "win" / "win_common"


def get_global_var(key: str, default: Optional[str] = None) -> Optional[str]:
    """Get global variable value"""
    # Try the same lookup paths used by the PowerShell implementation
    candidates = []
    
    # Windows/WSL user profile location
    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        candidates.append(Path(user_profile) / ".core_node" / ".global_vars" / key)
    
    # WSL host user directories (align with ps1 logic)
    wsl_users = Path("/mnt/c/Users")
    if wsl_users.exists():
        for user_dir in sorted(wsl_users.iterdir()):
            candidates.append(user_dir / ".core_node" / ".global_vars" / key)
    
    # Linux fallback used by ps1
    candidates.append(Path("/usr/core_node/global_var") / key)
    
    for path in candidates:
        try:
            if path.exists():
                raw = path.read_text(encoding="utf-8")
                return raw.replace("\x00", "")  # strip null bytes
        except Exception:
            continue
    
    # Fallback to Python global var manager
    try:
        gvm = GlobalVarManager()
        value = gvm.get(key, default)
        return value
    except Exception:
        return default


def get_default_remote(project_name: str) -> str:
    """Get default remote URL based on region setting"""
    selected_region = get_global_var("SELECTED_REGION", "")
    if selected_region == "Global":
        return f"git@github.com:accountbelongstox/{project_name}.git"
    else:
        return f"git@gitee.com:accountbelongstox/{project_name}.git"


def write_color_text(text: str, color: str = "White") -> None:
    """Write colored text to console"""
    color_map = {
        "Green": ColorPrint.green,
        "Yellow": ColorPrint.yellow,
        "Red": ColorPrint.red,
        "Cyan": ColorPrint.blue,
        "DarkGray": ColorPrint.gray,
        "DarkBlue": ColorPrint.blue,
        "DarkCyan": ColorPrint.blue,
        "Magenta": ColorPrint.blue,
        "DarkYellow": ColorPrint.yellow,
        "White": ColorPrint.white,
    }
    
    color_func = color_map.get(color, ColorPrint.white)
    color_func(text)


def read_masked_password(prompt: str) -> str:
    """Read password with masked input"""
    try:
        import getpass
        return getpass.getpass(prompt)
    except Exception:
        return input(prompt)


def ensure_ssh_permissions() -> None:
    """Ensure SSH key permissions are correct (Linux/macOS only)"""
    if platform.system() == "Windows":
        return
    
    try:
        home_dir = Path.home()
        ssh_dir = home_dir / ".ssh"
        
        if not ssh_dir.exists():
            write_color_text(f"SSH directory does not exist: {ssh_dir}", "Yellow")
            return
        
        # Find SSH private keys
        ssh_keys = list(ssh_dir.glob("id_*"))
        ssh_keys = [k for k in ssh_keys if not k.name.endswith(".pub")]
        
        if not ssh_keys:
            write_color_text(f"No SSH private keys found in {ssh_dir}", "Yellow")
            return
        
        write_color_text(f"Found {len(ssh_keys)} SSH private key(s)", "DarkGray")
        
        # Fix permissions for each key
        for ssh_key in ssh_keys:
            key_name = ssh_key.name
            write_color_text(f"Processing SSH key: {key_name}", "Cyan")
            
            try:
                current_perms = oct(ssh_key.stat().st_mode)[-3:]
                if current_perms != "600":
                    ssh_key.chmod(0o600)
                    write_color_text(f"  SSH key permissions fixed to 600", "Green")
                else:
                    write_color_text(f"  Permissions are correct", "Green")
            except Exception as e:
                write_color_text(f"  Failed to fix SSH key permissions: {e}", "Red")
        
        # Fix SSH directory permissions
        try:
            ssh_dir_perms = oct(ssh_dir.stat().st_mode)[-3:]
            if ssh_dir_perms != "700":
                ssh_dir.chmod(0o700)
                write_color_text("SSH directory permissions fixed to 700", "Green")
        except Exception as e:
            write_color_text(f"Failed to fix SSH directory permissions: {e}", "Red")
            
    except Exception as e:
        write_color_text(f"Error checking SSH permissions: {e}", "Yellow")


def ensure_git_identity() -> None:
    """Ensure git user identity is configured"""
    try:
        from gitput_unified_modules.git_operations import run_git_command
        
        git_name = run_git_command("git config --global user.name", capture_output=True)
        git_email = run_git_command("git config --global user.email", capture_output=True)
        
        if not git_name or not git_email:
            write_color_text("Git user identity not configured. Setting default values...", "Yellow")
            
            system_name = os.getlogin() if hasattr(os, 'getlogin') else os.environ.get('USER', 'user')
            hostname = platform.node()
            default_name = f"{system_name}@{hostname}"
            default_email = f"{system_name}@dev.ai"
            
            if not git_name:
                run_git_command(f'git config --global user.name "{default_name}"')
                write_color_text(f"Set git user.name to: {default_name}", "Cyan")
            
            if not git_email:
                run_git_command(f'git config --global user.email "{default_email}"')
                write_color_text(f"Set git user.email to: {default_email}", "Cyan")
            
            write_color_text("Git identity configured successfully!", "Green")
        else:
            write_color_text(f"Git identity already configured: {git_name} <{git_email}>", "DarkGray")
    except Exception as e:
        write_color_text(f"Error configuring git identity: {e}", "Yellow")

