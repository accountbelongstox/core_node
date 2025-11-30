#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Conflict resolution module
"""

from datetime import datetime
from gitput_unified_modules.git_operations import run_git_command
from gitput_unified_modules.utils import write_color_text


def handle_conflict_resolution() -> bool:
    """Handle automated conflict resolution"""
    write_color_text("", "White")
    write_color_text("AUTOMATED CONFLICT RESOLUTION OPTIONS:", "Magenta")
    write_color_text("", "White")
    
    try:
        user_choice = input("Would you like to automatically resolve conflicts? [Y/n]: ").strip()
        if not user_choice:
            user_choice = "Y"
    except (EOFError, KeyboardInterrupt):
        write_color_text("Manual resolution required.", "Yellow")
        return False
    
    if user_choice.upper() not in ['Y', 'YES']:
        write_color_text("Manual resolution required. Please resolve conflicts using the options above.", "Yellow")
        return False
    
    write_color_text("", "White")
    write_color_text("Select resolution strategy:", "Yellow")
    write_color_text("1) Keep REMOTE version (recommended for pulling latest changes)", "Cyan")
    write_color_text("2) Keep LOCAL version (preserve your changes)", "Cyan")
    write_color_text("3) Abort operation", "Cyan")
    
    try:
        resolution_choice = input("Enter choice [1-3]: ").strip()
    except (EOFError, KeyboardInterrupt):
        write_color_text("Invalid choice. Please resolve conflicts manually.", "Red")
        return False
    
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    if resolution_choice == "1":
        write_color_text("Applying REMOTE version...", "Green")
        run_git_command("git checkout --theirs .")
        run_git_command("git add .")
        run_git_command(f'git commit -m "Resolved conflicts by keeping remote version - {timestamp}"')
        write_color_text("SUCCESS: Conflicts resolved automatically!", "Green")
        write_color_text("Continuing with git operations...", "Cyan")
        return True
    
    elif resolution_choice == "2":
        write_color_text("Applying LOCAL version...", "Green")
        run_git_command("git checkout --ours .")
        run_git_command("git add .")
        run_git_command(f'git commit -m "Resolved conflicts by keeping local version - {timestamp}"')
        write_color_text("SUCCESS: Conflicts resolved automatically!", "Green")
        write_color_text("Continuing with git operations...", "Cyan")
        return True
    
    elif resolution_choice == "3":
        write_color_text("Aborting merge operation...", "Yellow")
        run_git_command("git merge --abort")
        write_color_text("Merge aborted. Repository restored to previous state.", "Yellow")
        return False
    
    else:
        write_color_text("Invalid choice. Please resolve conflicts manually.", "Red")
        return False


def show_conflict_resolution_options() -> None:
    """Show conflict resolution options to user"""
    write_color_text("MERGE CONFLICT RESOLUTION OPTIONS:", "Yellow")
    write_color_text("", "White")
    write_color_text("Option 1 - Keep REMOTE version (discard local changes):", "Cyan")
    write_color_text("git checkout --theirs .", "White")
    write_color_text("git add .", "White")
    write_color_text('git commit -m "Resolved conflicts by keeping remote version"', "White")
    write_color_text("", "White")
    write_color_text("Option 2 - Keep LOCAL version (discard remote changes):", "Cyan")
    write_color_text("git checkout --ours .", "White")
    write_color_text("git add .", "White")
    write_color_text('git commit -m "Resolved conflicts by keeping local version"', "White")
    write_color_text("", "White")
    write_color_text("Option 3 - Manual resolution:", "Cyan")
    write_color_text("Edit conflicted files manually, then:", "White")
    write_color_text("git add .", "White")
    write_color_text('git commit -m "Manually resolved merge conflicts"', "White")
    write_color_text("", "White")
    write_color_text("Option 4 - Abort and try later:", "Cyan")
    write_color_text("git merge --abort", "White")
    write_color_text("git reset --hard HEAD~1  # Remove auto-commit", "White")

