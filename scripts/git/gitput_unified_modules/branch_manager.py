#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Branch management module
"""

from gitput_unified_modules.config import DEFAULT_BRANCH
from gitput_unified_modules.git_operations import (
    get_current_branch,
    branch_exists_locally,
    branch_exists_remote,
    checkout_branch,
    create_branch,
)
from gitput_unified_modules.utils import write_color_text


def ensure_target_branch(target_branch: str = DEFAULT_BRANCH) -> bool:
    """Ensure we're on the target branch"""
    current_branch = get_current_branch()
    
    write_color_text(f"Current branch: {current_branch}", "DarkGray")
    
    if current_branch == target_branch:
        write_color_text(f"Already on target branch: {target_branch}", "Green")
        return True
    
    # Check if target branch exists locally
    if branch_exists_locally(target_branch):
        write_color_text(f"Switching to existing branch: {target_branch}", "Yellow")
        return checkout_branch(target_branch)
    
    # Check if target branch exists on remote
    if branch_exists_remote(target_branch):
        write_color_text(f"Creating local branch from remote: {target_branch}", "Yellow")
        return create_branch(target_branch, f"origin/{target_branch}")
    
    # Create new branch
    write_color_text(f"Target branch '{target_branch}' doesn't exist. Creating new branch...", "Yellow")
    return create_branch(target_branch)


def restore_original_branch(original_branch: str) -> None:
    """Restore original branch"""
    if not original_branch:
        return
    
    current_branch = get_current_branch()
    if original_branch != current_branch:
        write_color_text(f"Restoring original branch: {original_branch}", "Yellow")
        if branch_exists_locally(original_branch):
            checkout_branch(original_branch)
        else:
            write_color_text(f"Warning: Original branch '{original_branch}' no longer exists", "Red")

