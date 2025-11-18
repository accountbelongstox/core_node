#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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

"""
Unified Git Push/Pull Script (Cross-platform Python version)
Supports multiple remotes: gitee, github, local
"""

import argparse
import os
import sys
from pathlib import Path

# Add script directory to path for module imports
SCRIPT_DIR = Path(__file__).parent.absolute()
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
# Ensure project root is on sys.path so bundled helpers (e.g., pycore) resolve
PROJECT_ROOT = SCRIPT_DIR.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from gitput_unified_modules.config import PROJECT_NAME, REMOTE_CONFIGS, DEFAULT_BRANCH
from gitput_unified_modules.utils import (
    write_color_text,
    get_core_node_dir,
    get_default_remote,
    ensure_ssh_permissions,
)
from gitput_unified_modules.git_operations import (
    run_git_command,
    get_current_remote,
    set_remote_url,
    get_current_branch,
    has_uncommitted_changes,
    stage_all_changes,
    commit_changes,
    pull_branch,
    push_branch,
    branch_exists_remote,
    branch_exists_locally,
    checkout_branch,
    create_branch,
)
from gitput_unified_modules.branch_manager import ensure_target_branch, restore_original_branch
from gitput_unified_modules.backup import create_working_backup
from gitput_unified_modules.encryption import process_encryption
from gitput_unified_modules.file_validation import test_win_common_files
from gitput_unified_modules.commit_message import get_commit_message
from gitput_unified_modules.conflict_resolver import handle_conflict_resolution, show_conflict_resolution_options


# Session state variables
encryption_check_completed = False
pull_completed = False
file_validation_completed = False
original_working_dir = Path.cwd()
original_remote_url = ""
original_branch = ""


def get_execution_order(targets: list) -> list:
    """Determine execution order - DEFAULT_REMOTE should be executed first"""
    default_remote = get_default_remote(PROJECT_NAME)
    default_remote_key = None
    
    # Find which key corresponds to DEFAULT_REMOTE
    for key, url in REMOTE_CONFIGS.items():
        if url == default_remote:
            default_remote_key = key
            break
    
    ordered_targets = []
    
    # Add default remote first if it's in the target list
    if default_remote_key and default_remote_key in targets:
        ordered_targets.append(default_remote_key)
    
    # Add remaining targets
    for target in targets:
        if target != default_remote_key:
            ordered_targets.append(target)
    
    return ordered_targets


def restore_original_remote() -> None:
    """Restore original remote URL"""
    global original_remote_url
    default_remote = get_default_remote(PROJECT_NAME)
    current_remote = get_current_remote()
    
    if original_remote_url and original_remote_url != default_remote:
        write_color_text(f"Restoring original remote: {original_remote_url}", "Yellow")
        set_remote_url(original_remote_url)
    elif current_remote != default_remote:
        write_color_text(f"Restoring default remote: {default_remote}", "Yellow")
        set_remote_url(default_remote)


def invoke_safe_git_pull(target_url: str) -> bool:
    """Perform safe git pull operations"""
    global original_branch, original_remote_url
    
    write_color_text("Starting SAFE GIT PULL operations for: " + target_url, "Cyan")
    write_color_text(f"Project: {PROJECT_NAME}", "Green")
    from datetime import datetime
    write_color_text(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", "Green")
    
    core_node_dir = get_core_node_dir()
    original_working_dir = Path.cwd()
    
    try:
        os.chdir(core_node_dir)
        write_color_text(f"Changed to: {core_node_dir}", "DarkCyan")
        
        # Store original branch and remote for restoration
        original_branch = get_current_branch()
        original_remote_url = get_current_remote()
        write_color_text(f"Original branch: {original_branch}", "DarkGray")
        write_color_text(f"Original remote: {original_remote_url}", "DarkGray")
        
        # Set target remote
        if not set_remote_url(target_url):
            return False
        
        # Show remote configuration
        write_color_text("--------------------------------", "Green")
        write_color_text("Executing: git remote -v", "DarkGray")
        run_git_command("git remote -v")
        write_color_text("--------------------------------", "Green")
        
        # Step 1: Ensure local changes are committed
        write_color_text("Step 1: Checking for uncommitted changes...", "Cyan")
        run_git_command("git status --porcelain", capture_output=False)
        if has_uncommitted_changes():
            write_color_text("Found uncommitted changes. Saving local work...", "Yellow")
            stage_all_changes()
            commit_message = get_commit_message()
            commit_changes(commit_message)
        else:
            write_color_text("No uncommitted changes found.", "Green")
        
        # Step 2: Ensure we're on the target branch
        write_color_text("Step 2: Ensuring we're on the target branch...", "Cyan")
        ensure_target_branch(DEFAULT_BRANCH)
        current_branch = get_current_branch()
        
        # Step 3: Check if branch exists on remote
        write_color_text("Step 3: Checking if branch exists on remote...", "Cyan")
        write_color_text(f"Executing: git branch -r | Select-String -Pattern 'origin/{current_branch}'", "DarkGray")
        if not branch_exists_remote(current_branch):
            write_color_text(f"Branch '{current_branch}' does not exist. Creating '{current_branch}' branch...", "Red")
            if not branch_exists_locally(current_branch):
                write_color_text(f"Executing: git checkout -b {current_branch}", "DarkGray")
                create_branch(current_branch)
            else:
                write_color_text(f"Executing: git checkout {current_branch}", "DarkGray")
                checkout_branch(current_branch)
            write_color_text(f"Executing: git push --set-upstream origin {current_branch}", "DarkGray")
            push_branch(current_branch, set_upstream=True)
            write_color_text(f"Executing: git branch --set-upstream-to=origin/{current_branch} {current_branch}", "DarkGray")
            run_git_command(f"git branch --set-upstream-to=origin/{current_branch} {current_branch}")
            return True
        
        # Step 4: Safe pull with merge
        write_color_text("Step 4: Performing safe pull...", "Cyan")
        write_color_text(f"Executing: git pull origin {DEFAULT_BRANCH} --no-edit", "DarkGray")
        success, output = pull_branch(DEFAULT_BRANCH, no_edit=True)
        
        if success:
            write_color_text("SUCCESS: Safe pull completed successfully!", "Green")
        else:
            write_color_text("WARNING: Pull failed with merge conflicts!", "Red")
            show_conflict_resolution_options()
            
            if handle_conflict_resolution():
                write_color_text("Conflict resolution completed successfully!", "Green")
                return True
            else:
                write_color_text("Conflict resolution failed or was aborted", "Yellow")
                return False
        
        write_color_text("----------------------------------------------------------------", "DarkBlue")
        return True
        
    except Exception as e:
        write_color_text(f"Git pull operation failed: {e}", "Red")
        return False
    finally:
        os.chdir(original_working_dir)
        restore_original_remote()


def invoke_git_operations(target_url: str) -> bool:
    """Perform git operations (push)"""
    global encryption_check_completed, pull_completed, file_validation_completed
    global original_branch, original_remote_url
    
    write_color_text("----------------------------------------------------------------", "DarkYellow")
    write_color_text("Starting git operations for: " + target_url, "Cyan")
    write_color_text(f"Project: {PROJECT_NAME}", "Green")
    from datetime import datetime
    write_color_text(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", "Green")
    write_color_text("--------------------------------", "Green")
    
    core_node_dir = get_core_node_dir()
    original_working_dir = Path.cwd()
    
    try:
        os.chdir(core_node_dir)
        write_color_text(f"Changed to: {core_node_dir}", "DarkCyan")
        
        # Store original branch and remote for restoration
        original_branch = get_current_branch()
        original_remote_url = get_current_remote()
        write_color_text(f"Original branch: {original_branch}", "DarkGray")
        write_color_text(f"Original remote: {original_remote_url}", "DarkGray")
        
        # Set target remote
        if not set_remote_url(target_url):
            return False
        
        # Show remote configuration
        write_color_text("--------------------------------", "Green")
        write_color_text("Executing: git remote -v", "DarkGray")
        from gitput_unified_modules.git_operations import run_git_command
        run_git_command("git remote -v")
        write_color_text("--------------------------------", "Green")
        write_color_text("----------------------------------------------------------------", "DarkYellow")
        
        # Run pre-commit encryption check (only once per session)
        if not encryption_check_completed:
            if process_encryption():
                encryption_check_completed = True
            else:
                write_color_text("INFO: Encryption check already completed in this session.", "DarkGray")
        else:
            write_color_text("INFO: Encryption check already completed in this session.", "DarkGray")
        
        # Ensure we're on the target branch
        ensure_target_branch(DEFAULT_BRANCH)
        current_branch = get_current_branch()
        
        # Ensure branch exists on remote (and set upstream) before normal flow
        if not branch_exists_remote(current_branch):
            write_color_text(f"Branch '{current_branch}' does not exist. Creating '{current_branch}' branch...", "Red")
            if not branch_exists_locally(current_branch):
                create_branch(current_branch)
            else:
                checkout_branch(current_branch)
            write_color_text(f"Executing: git push --set-upstream origin {current_branch}", "DarkGray")
            push_branch(current_branch, set_upstream=True)
            write_color_text(f"Executing: git branch --set-upstream-to=origin/{current_branch} {current_branch}", "DarkGray")
            run_git_command(f"git branch --set-upstream-to=origin/{current_branch} {current_branch}")
            write_color_text(f"Executing: git pull origin {DEFAULT_BRANCH}", "DarkGray")
            run_git_command(f"git pull origin {DEFAULT_BRANCH}")
            return True
        
        # Stage all changes FIRST (before pull)
        write_color_text("Staging all changes...", "Cyan")
        stage_all_changes()
        
        # Validate win_common files before commit (only once per session)
        if not file_validation_completed:
            test_win_common_files()
            file_validation_completed = True
        else:
            write_color_text("INFO: File validation already completed in this session.", "DarkGray")
        
        # Commit changes BEFORE pulling
        commit_message = get_commit_message()
        write_color_text(f"Committing changes with message: {commit_message}", "Cyan")
        write_color_text(f'Executing: git commit -m "{commit_message}"', "DarkGray")
        commit_changes(commit_message)
        
        # Only pull if this is the first remote (should be DEFAULT_REMOTE) and not yet completed
        if not pull_completed:
            write_color_text("Pulling and merging remote changes after commit...", "Cyan")
            write_color_text(f"Executing: git pull origin {current_branch} --no-edit", "DarkGray")
            success, output = pull_branch(current_branch, no_edit=True)
            if not success:
                show_conflict_resolution_options()
                if handle_conflict_resolution():
                    write_color_text("Conflict resolution completed successfully!", "Green")
                else:
                    write_color_text("Conflict resolution failed or was aborted", "Yellow")
                    return False
            pull_completed = True
        else:
            write_color_text("Skipping pull - already synchronized in this session", "Yellow")
        
        # Push changes to remote
        write_color_text("Pushing changes to remote...", "Cyan")
        write_color_text(f"Executing: git push --set-upstream origin {current_branch}", "DarkGray")
        push_branch(current_branch, set_upstream=True)
        write_color_text("----------------------------------------------------------------", "DarkBlue")
        
        return True
        
    except Exception as e:
        write_color_text(f"Git operation failed: {e}", "Red")
        return False
    finally:
        os.chdir(original_working_dir)
        restore_original_remote()


def main():
    """Main execution with error handling"""
    global original_working_dir
    
    parser = argparse.ArgumentParser(description='Unified Git Push/Pull Script')
    parser.add_argument('target', nargs='?', choices=['gitee', 'github', 'local'], 
                       help='Target remote (gitee, github, or local)')
    parser.add_argument('--pull', action='store_true', help='Perform pull instead of push')
    parser.add_argument('--backup', action='store_true', help='Enable backup before operations')
    
    args = parser.parse_args()
    
    if args.pull:
        write_color_text("=== Unified Git PULL Script ===", "Magenta")
    else:
        write_color_text("=== Unified Git PUSH Script ===", "Magenta")
    
    core_node_dir = get_core_node_dir()
    os.chdir(core_node_dir)
    write_color_text(f"Changed to: {core_node_dir}", "DarkCyan")
    
    default_remote = get_default_remote(PROJECT_NAME)
    write_color_text(f"Default remote: {default_remote}", "DarkCyan")
    write_color_text(f"Current branch: {get_current_branch()}", "DarkGray")
    
    try:
        # Create backup if enabled
        if args.backup:
            create_working_backup(backup_enabled=True)
        
        # Ensure we're on the correct branch before processing remotes
        if not ensure_target_branch(DEFAULT_BRANCH):
            write_color_text("Branch management failed. Please resolve manually.", "Red")
            return
        
        # Determine target remote
        if not args.target:
            write_color_text("No target specified, using all remotes", "Yellow")
            targets = ["gitee", "github", "local"]
        else:
            targets = [args.target]
        
        # Reorder targets to execute DEFAULT_REMOTE first
        targets = get_execution_order(targets)
        
        all_success = True
        
        for target in targets:
            if target in REMOTE_CONFIGS:
                target_url = REMOTE_CONFIGS[target]
                
                if args.pull:
                    write_color_text(f"\n=== Pulling from {target} ({target_url}) ===", "Magenta")
                    success = invoke_safe_git_pull(target_url)
                    if success:
                        write_color_text(f"Successfully pulled from {target}", "Green")
                    else:
                        all_success = False
                        write_color_text(f"Failed to pull from {target}", "Red")
                    # For pull operations, only process the first (default) remote
                    break
                else:
                    write_color_text(f"\n=== Pushing to {target} ({target_url}) ===", "Magenta")
                    success = invoke_git_operations(target_url)
                    if success:
                        write_color_text(f"Successfully pushed to {target}", "Green")
                    else:
                        all_success = False
                        write_color_text(f"Failed to push to {target}", "Red")
            else:
                write_color_text(f"Unknown remote target: {target}", "Red")
                all_success = False
            
            # Always restore original branch and remote after each operation
            restore_original_branch(original_branch)
            restore_original_remote()
        
        write_color_text("\n=== Summary ===", "Magenta")
        if args.pull:
            if all_success:
                write_color_text("Git pull operation completed successfully!", "Green")
            else:
                write_color_text("Git pull operation failed!", "Red")
        else:
            if all_success:
                write_color_text("All git push operations completed successfully!", "Green")
            else:
                write_color_text("Some git push operations failed!", "Red")
    finally:
        # Restore original working directory
        os.chdir(original_working_dir)
        write_color_text(f"Restored working directory: {original_working_dir}", "DarkCyan")


if __name__ == "__main__":
    main()
