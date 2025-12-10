#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git Management - Python Entry Point
Organizes Git operations and generates shell commands
Communicates via file variables instead of exit codes
"""

import os
import sys
import platform
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

from git_management_vars import GitManagementVars, GitVarKeys


class GitManagement:
    """Main Git Management class"""

    def __init__(self):
        """Initialize Git Management"""
        self.vars = GitManagementVars()
        self.is_windows = platform.system() == "Windows"
        self.core_node_root = self._find_core_node_root()

    def _find_core_node_root(self) -> Path:
        """Find the core_node project root directory"""
        # Start from current script directory and go up
        current = Path(__file__).parent
        while current != current.parent:
            if (current / ".git").exists():
                return current
            current = current.parent

        # Fallback: assume we're in scripts/git/
        return Path(__file__).parent.parent.parent

    def show_menu(self):
        """Display the Git Management menu"""
        os.system('cls' if self.is_windows else 'clear')
        print()
        print("\033[36m==================== Git Management ====================\033[0m")
        print("  1. Get the latest git version (backup + commit + pull)")
        print("  2. Force overwrite local with remote (backup local first)")
        print("  3. Cleanup Git repository with BFG (remove large files)")
        print("  4. Git time travel")
        print("  5. Back to main menu")
        print("\033[36m========================================================\033[0m")

    def get_user_choice(self) -> str:
        """Get user menu choice"""
        try:
            choice = input("Select an option (1-5): ").strip()
            return choice
        except (KeyboardInterrupt, EOFError):
            return "5"

    def handle_safe_pull(self):
        """Handle option 1: Safe git pull"""
        print("\n\033[36m=== Safe Git Pull ===\033[0m")
        print("This will backup local changes, commit them, and pull from remote.")
        print()

        # Get region setting to determine remote
        region = self._get_region_setting()
        remote = "github" if region == "Global" else "gitee"

        print(f"Target remote: {remote} (based on region: {region})")
        print()

        # Set operation parameters
        self.vars.set_var(GitVarKeys.OPERATION_TYPE, "safe_pull")
        self.vars.set_var(GitVarKeys.GIT_REMOTE, remote)
        self.vars.set_var(GitVarKeys.GIT_FORCE_MODE, "false")

        # Generate shell command
        if self.is_windows:
            shell_script = self._generate_windows_pull_command(remote, force=False)
        else:
            shell_script = self._generate_linux_pull_command(remote, force=False)

        self.vars.set_var(GitVarKeys.SHELL_SCRIPT, shell_script)
        self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_PENDING)

        print("Operation prepared. Shell will execute the pull operation.")

    def handle_force_overwrite(self):
        """Handle option 2: Force overwrite local with remote"""
        print()
        print("\033[33m╔════════════════════════════════════════════════════════════════╗\033[0m")
        print("\033[33m║              FORCE OVERWRITE LOCAL WITH REMOTE                ║\033[0m")
        print("\033[33m╚════════════════════════════════════════════════════════════════╝\033[0m")
        print()
        print("\033[31m⚠️  WARNING: This will DISCARD all local changes!\033[0m")
        print()
        print("\033[36mWhat this will do:\033[0m")
        print("  1. Create a backup branch of your local changes")
        print("  2. Commit all current changes to backup branch")
        print("  3. Fetch latest from remote")
        print("  4. Force reset local to match remote exactly")
        print("  5. Your old files will be preserved in backup branch")
        print()
        print("\033[33mBest Practices (from official Git documentation):\033[0m")
        print("  • Always backup before force operations")
        print("  • Use 'git fetch + git reset --hard' for safe overwrite")
        print("  • Old changes can be recovered from backup branch")
        print()
        print("\033[36mReferences:\033[0m")
        print("  • https://www.codecademy.com/article/force-git-pull")
        print("  • https://blog.openreplay.com/git-force-pull/")
        print("  • https://www.datacamp.com/tutorial/git-pull-force")
        print()
        print("\033[31m════════════════════════════════════════════════════════════════\033[0m")
        print("\033[31m  THIS IS A DESTRUCTIVE OPERATION - REQUIRES CONFIRMATION\033[0m")
        print("\033[31m════════════════════════════════════════════════════════════════\033[0m")
        print()

        # First confirmation
        print("\033[33mDo you understand this will discard local changes? (yes/no)\033[0m")
        first_confirm = input("> ").strip().lower()

        if first_confirm not in ['yes', 'y']:
            print("\033[32mOperation cancelled. Your local changes are safe.\033[0m")
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_CANCELLED)
            return

        # Second confirmation - special keyword
        print()
        print("\033[31mFinal confirmation required!\033[0m")
        print("\033[33mType one of these to proceed:\033[0m")
        print("  • 'confirm' - Standard confirmation")
        print("  • 'yes' - Quick confirmation")
        print("  • 'it's-server' - Server deployment confirmation")
        print()
        second_confirm = input("Enter confirmation keyword: ").strip().lower()

        valid_keywords = ['confirm', 'yes', "it's-server", 'its-server']
        if second_confirm not in valid_keywords:
            print("\033[32mOperation cancelled. Incorrect confirmation keyword.\033[0m")
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_CANCELLED)
            return

        # Confirmations passed
        self.vars.set_var(GitVarKeys.CONFIRM_FIRST, "yes")
        self.vars.set_var(GitVarKeys.CONFIRM_SECOND, second_confirm)

        print()
        print("\033[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
        print("\033[36mProceeding with force overwrite...\033[0m")
        print("\033[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
        print()

        # Get region setting to determine remote
        region = self._get_region_setting()
        remote = "github" if region == "Global" else "gitee"

        print(f"Target remote: {remote} (based on region: {region})")

        # Set operation parameters
        self.vars.set_var(GitVarKeys.OPERATION_TYPE, "force_overwrite")
        self.vars.set_var(GitVarKeys.GIT_REMOTE, remote)
        self.vars.set_var(GitVarKeys.GIT_FORCE_MODE, "true")

        # Generate backup branch name
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_branch = f"backup-before-force-overwrite-{timestamp}"
        self.vars.set_var(GitVarKeys.BACKUP_BRANCH, backup_branch)

        # Generate shell command
        if self.is_windows:
            shell_script = self._generate_windows_pull_command(remote, force=True)
        else:
            shell_script = self._generate_linux_pull_command(remote, force=True)

        self.vars.set_var(GitVarKeys.SHELL_SCRIPT, shell_script)
        self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_PENDING)

        print("Operation prepared. Shell will execute the force overwrite operation.")

    def handle_bfg_cleanup(self):
        """Handle option 3: BFG cleanup"""
        print("\n\033[36m=== BFG Repository Cleanup ===\033[0m")
        print("This will launch the BFG Repo-Cleaner script.")
        print()

        bfg_script = self.core_node_root / "scripts" / "git" / "cleanup_repo_with_bfg.sh"

        if bfg_script.exists():
            self.vars.set_var(GitVarKeys.OPERATION_TYPE, "bfg_cleanup")
            if self.is_windows:
                self.vars.set_var(GitVarKeys.SHELL_SCRIPT, f'bash "{bfg_script}"')
            else:
                self.vars.set_var(GitVarKeys.SHELL_SCRIPT, f'bash "{bfg_script}"')
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_PENDING)
        else:
            print(f"\033[31mError: BFG cleanup script not found at {bfg_script}\033[0m")
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_FAILED)

    def handle_git_time_travel(self):
        """Handle option 4: Git time travel"""
        print("\n\033[36m=== Git Time Travel ===\033[0m")
        print("This will launch the Git Time Travel script.")
        print()

        time_travel_script = self.core_node_root / "scripts" / "git" / "git_time_travel.sh"

        if time_travel_script.exists():
            self.vars.set_var(GitVarKeys.OPERATION_TYPE, "time_travel")
            if self.is_windows:
                self.vars.set_var(GitVarKeys.SHELL_SCRIPT, f'bash "{time_travel_script}"')
            else:
                self.vars.set_var(GitVarKeys.SHELL_SCRIPT, f'bash "{time_travel_script}"')
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_PENDING)
        else:
            print(f"\033[33mWarning: Git time travel script not found at {time_travel_script}\033[0m")
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_FAILED)

    def handle_back_to_menu(self):
        """Handle option 5: Back to main menu"""
        self.vars.set_var(GitVarKeys.MENU_BACK, "true")
        self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_SUCCESS)

    def _generate_linux_pull_command(self, remote: str, force: bool = False) -> str:
        """Generate Linux shell command for git pull"""
        gitput_script = self.core_node_root / "scripts" / "git" / "gitput_unified.sh"

        if force:
            return f'bash "{gitput_script}" --force-overwrite {remote}'
        else:
            return f'bash "{gitput_script}" --pull {remote}'

    def _generate_windows_pull_command(self, remote: str, force: bool = False) -> str:
        """Generate Windows PowerShell command for git pull"""
        gitput_script = self.core_node_root / "scripts" / "git" / "gitput_unified.sh"

        if force:
            return f'bash "{gitput_script}" --force-overwrite {remote}'
        else:
            return f'bash "{gitput_script}" --pull {remote}'

    def _get_region_setting(self) -> str:
        """Get the region setting from global vars"""
        try:
            # Try to read from existing global vars system
            global_var_file = Path("/var/_core_node/global_var/SELECTED_REGION")
            if global_var_file.exists():
                with open(global_var_file, 'r') as f:
                    return f.read().strip()
        except Exception:
            pass

        # Default to China (gitee)
        return "China"

    def run_menu_loop(self):
        """Main menu loop"""
        while True:
            self.show_menu()
            choice = self.get_user_choice()

            # Save menu choice
            self.vars.set_var(GitVarKeys.MENU_CHOICE, choice)

            if choice == "1":
                self.handle_safe_pull()
                break
            elif choice == "2":
                self.handle_force_overwrite()
                break
            elif choice == "3":
                self.handle_bfg_cleanup()
                break
            elif choice == "4":
                self.handle_git_time_travel()
                break
            elif choice == "5":
                self.handle_back_to_menu()
                break
            else:
                print("\033[31mInvalid option. Please try again.\033[0m")
                input("Press Enter to continue...")

    def run(self):
        """Main entry point"""
        try:
            self.run_menu_loop()
        except KeyboardInterrupt:
            print("\n\nOperation interrupted by user.")
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_CANCELLED)
        except Exception as e:
            print(f"\nError: {e}")
            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_FAILED)
            self.vars.set_var(GitVarKeys.OPERATION_MESSAGE, str(e))


def main():
    """Main function"""
    git_mgmt = GitManagement()
    git_mgmt.run()


if __name__ == "__main__":
    main()
