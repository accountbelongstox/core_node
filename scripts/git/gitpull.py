#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import os
import sys
import subprocess
from pathlib import Path
import string
import random
import platform
import argparse
from typing import Optional, List


class GitManager:
    def __init__(self, project_root: str) -> None:
        self.PROJECT_ROOT = Path(project_root)
        self.common_dir = self.PROJECT_ROOT / "scripts" / "shells" / "linux" / "common"
        self.global_var_dir: Optional[Path] = None
        self.load_global_vars()

    def load_global_vars(self) -> None:
        """Load global variables from common directory"""
        try:
            if self.common_dir.exists():
                # Try to find global variable directory
                possible_dirs = [
                    self.PROJECT_ROOT / "ncore" / "global_vars",
                    self.PROJECT_ROOT / ".global_vars",
                    Path.home() / ".global_vars"
                ]
                for possible_dir in possible_dirs:
                    if possible_dir.exists():
                        self.global_var_dir = possible_dir
                        break
        except Exception as e:
            self.colored_print("warning", f"Could not load global vars: {e}")

    def get_var(self, var_name: str, default_value: str = "") -> str:
        """Get variable from global vars or environment"""
        try:
            # Try environment variable first
            env_value = os.environ.get(var_name)
            if env_value:
                return env_value
            
            # Try global vars file
            if self.global_var_dir:
                var_file = self.global_var_dir / f"{var_name}.var"
                if var_file.exists():
                    return var_file.read_text().strip()
            
            return default_value
        except Exception:
            return default_value

    def get_region(self) -> str:
        """Get region setting, default to gitee for China"""
        region = self.get_var("SELECTED_REGION", "")
        if not region or region.lower() == "china":
            return "gitee"
        else:
            return "github"

    def get_remote_url(self, region: str) -> str:
        """Get remote URL based on region"""
        gitee_url = "git@gitee.com:accountbelongstox/core_node.git"
        
        if region == "gitee":
            return gitee_url
        else:
            # Derive GitHub URL from Gitee URL
            github_url = gitee_url.replace("git@gitee.com:", "https://github.com/")
            github_url = github_url.replace("accountbelongstox", "accountbelongstox")
            return github_url

    def set_remote_url(self) -> None:
        """Set remote URL based on region"""
        region = self.get_region()
        current_url = self.run_command("git remote get-url origin", capture_output=True)
        
        self.colored_print("info", f"Current region: {region}")
        self.colored_print("info", f"Current remote URL: {current_url}")
        
        target_url = self.get_remote_url(region)
        
        if region == "gitee" and "gitee.com" not in current_url:
            self.colored_print("info", "Switching to Gitee remote...")
            self.run_command(f"git remote set-url origin {target_url}")
        elif region == "github" and "github.com" not in current_url:
            self.colored_print("info", "Switching to GitHub remote...")
            self.run_command(f"git remote set-url origin {target_url}")

    def run_command(self, command: str, cwd: Optional[str] = None, capture_output: bool = False) -> str:
        """Execute command and return output"""
        cwd = cwd or str(self.PROJECT_ROOT)
        try:
            if capture_output:
                result = subprocess.run(
                    command,
                    cwd=cwd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    universal_newlines=True,
                    timeout=30
                )
                return result.stdout.strip() if result.returncode == 0 else ""
            else:
                result = subprocess.run(
                    command,
                    cwd=cwd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    timeout=60
                )
                
                if result.stdout:
                    output_lines = result.stdout.strip().split('\n')
                    for line in output_lines:
                        if line.strip():
                            print(line)
                    return result.stdout.strip()
                
                return ""

        except subprocess.TimeoutExpired:
            self.colored_print("error", f"Command timeout: {command}")
            return ""
        except Exception as e:
            self.colored_print("error", f"Command failed: {e}")
            return ""

    @staticmethod
    def generate_random_string(length: int = 6) -> str:
        """Generate a random string for email suffix"""
        chars = string.ascii_lowercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))

    @staticmethod
    def get_system_username() -> str:
        """Get current system username"""
        try:
            return os.getlogin()
        except Exception:
            return "unknown_user"

    @staticmethod
    def format_username(username: str) -> str:
        """Format username to valid Git format"""
        formatted = ''.join(c if c.isalnum() or c == '_' else '_' for c in username.lower())
        return formatted[:30]

    def set_git_config(self) -> None:
        """Set Git configuration to ensure correct merge strategy, username, email and safe directory"""
        self.colored_print("info", "Setting Git pull merge strategy and marking safe directory...")

        # Set fast-forward only (ff) strategy to avoid merge commits
        self.run_command('git config --global pull.ff only')
        self.run_command('git config --global pull.rebase false')

        # Add the project directory to the safe directory list
        self.run_command(f'git config --global --add safe.directory "{self.PROJECT_ROOT}"')

        # Ensure username and email are set
        self.set_git_username_and_email()

        # Check if the settings were applied correctly
        ff_setting = self.run_command('git config --get pull.ff', capture_output=True)
        rebase_setting = self.run_command('git config --get pull.rebase', capture_output=True)
        username = self.run_command('git config --get user.name', capture_output=True)
        email = self.run_command('git config --get user.email', capture_output=True)

        self.colored_print("info", f"Pull.ff setting: {ff_setting}")
        self.colored_print("info", f"Pull.rebase setting: {rebase_setting}")
        self.colored_print("info", f"Git username: {username}")
        self.colored_print("info", f"Git email: {email}")

    def set_git_username_and_email(self) -> None:
        """Set Git username and email if not already configured"""
        username = self.run_command('git config --global user.name', capture_output=True)
        email = self.run_command('git config --global user.email', capture_output=True)

        if not username:
            system_username = self.get_system_username()
            system_info = platform.system()
            random_string = self.generate_random_string()
            raw_git_username = f"{system_username}_{system_info}_{random_string}"
            git_username = self.format_username(raw_git_username)
            self.colored_print("info", f"Generated Git username: {git_username}")
            self.run_command(f'git config --global user.name "{git_username}"')

        if not email:
            random_string = self.generate_random_string()
            email_address = f'{random_string}@random.com'
            self.colored_print("info", f"Generated Git email: {email_address}")
            self.run_command(f'git config --global user.email "{email_address}"')

    def ensure_git_init(self) -> None:
        """Ensure the git repository is initialized"""
        if not (self.PROJECT_ROOT / '.git').exists():
            self.colored_print("info", "Initializing new Git repository...")
            self.run_command('git init')

    def force_update_git(self) -> bool:
        """Perform force git update with double confirmation"""
        print("=== Git Version Update ===")
        print("This will perform the following operations:")
        print("  - git stash (save current changes)")
        print("  - git fetch --all (fetch all remote changes)")
        print("  - git reset --hard origin/main (reset to remote main branch)")
        print("  - git pull --force (force pull latest changes)")
        print("")
        print("WARNING: This will overwrite all local changes!")
        print("")
        
        # First confirmation
        try:
            first_confirm = input("Are you sure you want to continue? (yes/no): ").strip()
            if first_confirm != "yes":
                print("Operation cancelled.")
                return False
            
            # Second confirmation
            second_confirm = input("This action cannot be undone. Type 'yes' again to confirm: ").strip()
            if second_confirm != "yes":
                print("Operation cancelled.")
                return False
        except (EOFError, KeyboardInterrupt):
            print("\nOperation cancelled by user.")
            return False
        
        print("")
        print("Proceeding with git update...")
        
        self.ensure_git_init()
        self.set_git_config()
        self.set_remote_url()
        
        # Execute git commands
        commands = [
            ("git stash", "Git stash"),
            ("git fetch --all", "Git fetch"),
            ("git reset --hard origin/main", "Git reset"),
            ("git pull --force", "Git pull")
        ]
        
        for cmd, desc in commands:
            print(f"Executing: {cmd}")
            result = self.run_command(cmd)
            if result is not None and result != "":
                self.colored_print("success", f"Success: {desc} completed")
            else:
                self.colored_print("error", f"Error: {desc} failed")
                return False
        
        print("")
        self.colored_print("success", "Success: Git update completed successfully!")
        print("Current git status:")
        self.run_command("git log --oneline -5")
        
        return True

    def git_pull(self) -> None:
        """Perform git pull with proper configurations"""
        self.ensure_git_init()
        self.set_git_config()
        self.set_remote_url()

        self.colored_print("info", "Running git pull...")

        pull_output = self.run_command('git pull')

        if pull_output:
            self.colored_print("success", "Git pull completed successfully!")
        else:
            self.colored_print("error", "Git pull failed")

    def colored_print(self, message_type: str, msg: str) -> None:
        """Print messages with color based on message type"""
        color_map = {
            "success": "\033[92m",  # Green
            "info": "\033[94m",     # Blue
            "warning": "\033[93m",  # Yellow
            "error": "\033[91m",    # Red
        }
        color_code = color_map.get(message_type, "\033[0m")
        print(f"{color_code}{msg}\033[0m")


def main() -> None:
    """Main function with argument parsing"""
    parser = argparse.ArgumentParser(description='Git Pull Manager with Region Support')
    parser.add_argument('--force-update', action='store_true',
                       help='Perform force update with double confirmation')
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent.parent
    git_manager = GitManager(str(project_root))
    
    if args.force_update:
        success = git_manager.force_update_git()
        sys.exit(0 if success else 1)
    else:
        git_manager.git_pull()


if __name__ == "__main__":
    main()