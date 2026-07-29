#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git operations module
"""

import subprocess
from pathlib import Path
from typing import Optional, Tuple
from gitput_unified_modules.utils import write_color_text, get_core_node_dir
from pycore.pyfoundations.pybasecommon.commander import Commander


def run_git_command(command: str, cwd: Optional[Path] = None, capture_output: bool = False) -> str:
    """
    Execute git command and return output
    
    Note: Uses Commander.exec_realtime() which collects output.
    Recommended to check returned string instead of return code.
    """
    if cwd is None:
        cwd = get_core_node_dir()
    
    try:
        write_color_text(f"Executing: {command}", "DarkGray")
        
        # Use Commander for execution
        if capture_output:
            # Silent mode for capture
            result = Commander.exec_silent(command, info=False, cwd=str(cwd))
        else:
            # Real-time output mode
            result = Commander.exec_realtime(command, info=False, show_output=True, cwd=str(cwd))
        
        # Return combined output (recommended approach)
        return result.get_output().strip()
            
    except Exception as e:
        write_color_text(f"Command failed: {e}", "Red")
        return ""


def get_current_remote() -> str:
    """Get current remote URL"""
    return run_git_command("git remote get-url origin", capture_output=True)


def set_remote_url(remote_url: str) -> bool:
    """Set remote URL"""
    try:
        run_git_command(f"git remote set-url origin {remote_url}")
        write_color_text(f"Remote set to: {remote_url}", "Green")
        return True
    except Exception as e:
        write_color_text(f"Failed to set remote: {e}", "Red")
        return False


def get_current_branch() -> str:
    """Get current git branch"""
    branch = run_git_command("git branch --show-current", capture_output=True)
    if not branch:
        branch = run_git_command("git rev-parse --abbrev-ref HEAD", capture_output=True)
    if not branch:
        return "HEAD"
    return branch


def branch_exists_locally(branch: str) -> bool:
    """Check if branch exists locally"""
    result = run_git_command(f"git show-ref --verify --quiet refs/heads/{branch}", capture_output=True)
    return result != ""


def branch_exists_remote(branch: str) -> bool:
    """Check if branch exists on remote"""
    result = run_git_command(f"git ls-remote --heads origin {branch}", capture_output=True)
    return branch in result


def checkout_branch(branch: str) -> bool:
    """Checkout branch"""
    try:
        run_git_command(f"git checkout {branch}")
        return True
    except Exception:
        return False


def create_branch(branch: str, from_remote: Optional[str] = None) -> bool:
    """Create new branch"""
    try:
        if from_remote:
            run_git_command(f"git checkout -b {branch} {from_remote}")
        else:
            run_git_command(f"git checkout -b {branch}")
        return True
    except Exception:
        return False


def get_remote_branches() -> list:
    """Get list of remote branches"""
    result = run_git_command("git branch -r", capture_output=True)
    if not result:
        return []
    return [line.strip().replace("origin/", "") for line in result.split('\n') if line.strip()]


def has_uncommitted_changes() -> bool:
    """Check if there are uncommitted changes"""
    result = run_git_command("git status --porcelain", capture_output=True)
    return bool(result.strip())


def stage_all_changes() -> bool:
    """Stage all changes"""
    try:
        run_git_command("git add .")
        return True
    except Exception:
        return False


def commit_changes(message: str) -> bool:
    """Commit changes with message"""
    try:
        run_git_command(f'git commit -m "{message}"')
        return True
    except Exception:
        return False


def pull_branch(branch: str, no_edit: bool = True) -> Tuple[bool, str]:
    """Pull from remote branch"""
    try:
        cmd = f"git pull origin {branch}"
        if no_edit:
            cmd += " --no-edit"
        
        # Use real-time output to see progress and collect result
        output = run_git_command(cmd, capture_output=False)
        
        # Check for merge conflicts in output (recommended approach)
        if "CONFLICT" in output.upper() or "conflict" in output.lower():
            return False, output
        
        return True, output
    except Exception as e:
        return False, str(e)


def push_branch(branch: str, set_upstream: bool = True, force: bool = False) -> bool:
    """Push branch to remote"""
    try:
        force_flag = "--force " if force else ""
        if set_upstream:
            run_git_command(f"git push {force_flag}--set-upstream origin {branch}")
        else:
            run_git_command(f"git push {force_flag}origin {branch}")
        return True
    except Exception:
        return False

