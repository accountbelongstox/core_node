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
import subprocess
import time
import traceback
import shutil
import site
import glob
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
        print("  4. Remove directories from Git history (e.g., .venv, node_modules)")
        print("  5. Git time travel")
        print("  6. Back to main menu")
        print("\033[36m========================================================\033[0m")

    def get_user_choice(self) -> str:
        """Get user menu choice"""
        try:
            choice = input("Select an option (1-6): ").strip()
            return choice
        except (KeyboardInterrupt, EOFError):
            return "6"

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

    def handle_directory_cleanup(self):
        """Handle option 4: Remove directories from Git history"""
<<<<<<< HEAD
=======
        import subprocess
        import sys

>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
        try:
            print()
            print("\033[36m╔════════════════════════════════════════════════════════════════╗\033[0m")
            print("\033[36m║         REMOVE DIRECTORIES FROM GIT HISTORY                   ║\033[0m")
            print("\033[36m╚════════════════════════════════════════════════════════════════╝\033[0m")
            print()
            print("\033[33mExamples: .venv, node_modules, dist, __pycache__\033[0m")
            print("\033[33mYou can enter multiple directories separated by spaces\033[0m")
            print()

            sys.stdout.flush()

            dir_paths = input("\033[36mEnter directory path(s) to remove: \033[0m").strip()
            print(f"\033[90m[DEBUG] User input: '{dir_paths}'\033[0m")
            sys.stdout.flush()

            if not dir_paths:
                print("\033[31mNo directory path provided\033[0m")
                self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_CANCELLED)
                input("\n\033[33mPress Enter to continue...\033[0m")
                return

            directories = [d.rstrip('/') for d in dir_paths.split()]
            print(f"\033[90m[DEBUG] Parsed directories: {directories}\033[0m")
            sys.stdout.flush()

            print()
            print("\033[33mThis will remove the following directories from Git history:\033[0m")
            for dir_path in directories:
                print(f"  - \033[33m{dir_path}\033[0m")

            print()
            print("\033[31m⚠️  WARNING: This operation will:\033[0m")
            print("\033[31m  1. Rewrite Git history\033[0m")
            print("\033[31m  2. Automatically remove all remotes (git-filter-repo behavior)\033[0m")
            print("\033[31m  3. Require force push to update remote repository\033[0m")
            print()

            sys.stdout.flush()

            confirm = input("\033[36mContinue? (yes/no): \033[0m").strip().lower()
            print(f"\033[90m[DEBUG] Confirmation: '{confirm}'\033[0m")
            sys.stdout.flush()

            if confirm not in ['yes', 'y']:
                print("\033[32mOperation cancelled\033[0m")
                self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_CANCELLED)
                input("\n\033[33mPress Enter to continue...\033[0m")
                return

            print()
            print("\033[36m✓ Confirmation received, proceeding...\033[0m")
            sys.stdout.flush()
        except Exception as e:
            print(f"\033[31m✗ Error during input phase: {e}\033[0m")
<<<<<<< HEAD
=======
            import traceback
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
            traceback.print_exc()
            input("\n\033[33mPress Enter to continue...\033[0m")
            return

        print()
        print("\033[36mChecking git-filter-repo installation...\033[0m")
        sys.stdout.flush()

        try:
            result = subprocess.run(
                ['git', 'filter-repo', '--help'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode != 0:
                raise FileNotFoundError("git-filter-repo not found")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("\033[33mgit-filter-repo not found. Installing...\033[0m")
            sys.stdout.flush()

            try:
                print("\033[90m[DEBUG] Attempting pip3 install with --break-system-packages...\033[0m")
                sys.stdout.flush()

                install_result = subprocess.run(
                    ['pip3', 'install', '--user', '--break-system-packages', 'git-filter-repo'],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if install_result.returncode != 0:
                    print(f"\033[33mWarning: pip3 install returned {install_result.returncode}\033[0m")
                    print(f"\033[90m[DEBUG] stderr: {install_result.stderr}\033[0m")
                    sys.stdout.flush()

<<<<<<< HEAD
=======
                import site
                import glob
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
                user_base = site.USER_BASE
                filter_repo_paths = glob.glob(f"{user_base}/bin/git-filter-repo")

                print(f"\033[90m[DEBUG] Searching in: {user_base}/bin/git-filter-repo\033[0m")
                print(f"\033[90m[DEBUG] Found paths: {filter_repo_paths}\033[0m")
                sys.stdout.flush()

                if filter_repo_paths:
                    filter_repo_path = filter_repo_paths[0]
<<<<<<< HEAD
=======
                    import shutil
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
                    print(f"\033[90m[DEBUG] Copying from: {filter_repo_path}\033[0m")
                    sys.stdout.flush()

                    try:
                        shutil.copy(filter_repo_path, '/usr/local/bin/git-filter-repo')
<<<<<<< HEAD
=======
                        import os
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
                        os.chmod('/usr/local/bin/git-filter-repo', 0o755)
                        print("\033[32m✓ Installed to /usr/local/bin/git-filter-repo\033[0m")
                        sys.stdout.flush()
                    except PermissionError:
                        print("\033[33m⚠ No permission for /usr/local/bin, using ~/.local/bin\033[0m")
                        sys.stdout.flush()
                        local_bin = Path.home() / '.local' / 'bin'
                        local_bin.mkdir(parents=True, exist_ok=True)
                        shutil.copy(filter_repo_path, local_bin / 'git-filter-repo')
<<<<<<< HEAD
=======
                        import os
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
                        os.chmod(local_bin / 'git-filter-repo', 0o755)
                        print(f"\033[32m✓ Installed to {local_bin}/git-filter-repo\033[0m")
                        sys.stdout.flush()

                        path_env = os.environ.get('PATH', '')
                        if str(local_bin) not in path_env:
                            print(f"\033[33m⚠ Adding {local_bin} to PATH for this session\033[0m")
                            os.environ['PATH'] = f"{local_bin}:{path_env}"
                            sys.stdout.flush()
                else:
                    print("\033[31m✗ git-filter-repo not found after installation\033[0m")
                    print(f"\033[33mTrying alternative locations...\033[0m")
                    sys.stdout.flush()

                    alt_paths = [
                        Path.home() / '.local' / 'bin' / 'git-filter-repo',
                        Path('/usr/local/bin/git-filter-repo'),
                        Path('/usr/bin/git-filter-repo')
                    ]

                    for alt_path in alt_paths:
                        if alt_path.exists():
                            print(f"\033[32m✓ Found at: {alt_path}\033[0m")
                            sys.stdout.flush()
                            break
                    else:
                        print("\033[31m✗ git-filter-repo not found in any location\033[0m")
                        print("\033[33mPlease install manually:\033[0m")
                        print("  \033[37mpip3 install --user --break-system-packages git-filter-repo\033[0m")
                        print("  \033[37mor\033[0m")
                        print("  \033[37msudo apt install git-filter-repo\033[0m")
                        sys.stdout.flush()
                        self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_FAILED)
                        input("\n\033[33mPress Enter to continue...\033[0m")
                        return

                print("\033[32mgit-filter-repo installed successfully\033[0m")
                sys.stdout.flush()

                test_result = subprocess.run(
                    ['git', 'filter-repo', '--help'],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=False
                )

                if test_result.returncode == 0:
                    print("\033[32m✓ git-filter-repo is working\033[0m")
                    sys.stdout.flush()
                else:
                    print(f"\033[33m⚠ git-filter-repo test failed: {test_result.returncode}\033[0m")
                    sys.stdout.flush()

            except Exception as e:
                print(f"\033[31mFailed to install git-filter-repo: {e}\033[0m")
<<<<<<< HEAD
=======
                import traceback
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
                traceback.print_exc()
                sys.stdout.flush()
                self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_FAILED)
                input("\n\033[33mPress Enter to continue...\033[0m")
                return

        print(f"\033[90m[DEBUG] Changing to directory: {self.core_node_root}\033[0m")
        sys.stdout.flush()
        os.chdir(self.core_node_root)
        print(f"\033[90m[DEBUG] Current directory: {os.getcwd()}\033[0m")
        sys.stdout.flush()

        remote_url = subprocess.run(
            ['git', 'remote', 'get-url', 'origin'],
            capture_output=True,
            text=True
        ).stdout.strip()

        print()
        print(f"\033[36mSaved remote URL: {remote_url}\033[0m")
        sys.stdout.flush()

        backup_branch = f"backup-before-filter-repo-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        print(f"\033[36mCreating backup branch: {backup_branch}\033[0m")
        sys.stdout.flush()

        branch_result = subprocess.run(['git', 'branch', backup_branch], capture_output=True, text=True, check=False)
        if branch_result.returncode == 0:
            print(f"\033[32m✓ Backup branch created\033[0m")
        else:
            print(f"\033[33m⚠ Branch creation warning: {branch_result.stderr}\033[0m")
        sys.stdout.flush()

        print()
        print("\033[36mRemoving directories from current HEAD...\033[0m")
        sys.stdout.flush()

        for dir_path in directories:
            dir_path_clean = dir_path.rstrip('/')
            dir_full_path = self.core_node_root / dir_path_clean
            print(f"\033[90m[DEBUG] Checking path: {dir_full_path}\033[0m")
            sys.stdout.flush()

            if dir_full_path.exists():
<<<<<<< HEAD
=======
                import shutil
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
                print(f"\033[90m[DEBUG] Removing: {dir_full_path}\033[0m")
                sys.stdout.flush()
                shutil.rmtree(dir_full_path)
                print(f"\033[32m✓ Removed from HEAD: {dir_path_clean}\033[0m")
                sys.stdout.flush()
            else:
                print(f"\033[33m⚠ Directory not found in current HEAD: {dir_path_clean}\033[0m")
                sys.stdout.flush()

        print()
        print("\033[36mStaging changes...\033[0m")
        sys.stdout.flush()
        subprocess.run(['git', 'add', '.'], check=False)

        print("\033[36mCommitting changes...\033[0m")
        sys.stdout.flush()

        commit_result = subprocess.run(
            ['git', 'commit', '-m', 'Remove large files from HEAD before cleanup'],
            capture_output=True,
            text=True,
            check=False
        )

        if commit_result.returncode == 0:
            print("\033[32m✓ Changes committed\033[0m")
        else:
            if "nothing to commit" in commit_result.stdout.lower():
                print("\033[33m⚠ No changes to commit (already clean)\033[0m")
            else:
                print(f"\033[33m⚠ Commit warning: {commit_result.stdout}\033[0m")
        sys.stdout.flush()

        print()
        print("\033[36mRunning git-filter-repo to clean history...\033[0m")
        sys.stdout.flush()

        filter_args = ['git', 'filter-repo']
        for dir_path_clean in directories:
            filter_args.extend(['--path', dir_path_clean, '--invert-paths'])
        filter_args.append('--force')

        print(f"\033[36mCommand: {' '.join(filter_args)}\033[0m")
        print("\033[36m" + "="*60 + "\033[0m")
        print()
        sys.stdout.flush()

        print("\033[90m[DEBUG] Executing git-filter-repo...\033[0m")
        sys.stdout.flush()

        try:
<<<<<<< HEAD
            result = subprocess.run(filter_args, text=True, check=False)
            print(f"\033[90m[DEBUG] git-filter-repo exit code: {result.returncode}\033[0m")
            sys.stdout.flush()

            print()
            print("\033[36m⏳ Waiting 5 seconds for cleanup to settle...\033[0m")
            sys.stdout.flush()
=======
            result = subprocess.run(filter_args, capture_output=True, text=True, check=False)
            print(f"\033[90m[DEBUG] git-filter-repo exit code: {result.returncode}\033[0m")
            sys.stdout.flush()

            if result.stdout:
                print("\033[37m" + result.stdout + "\033[0m")
                sys.stdout.flush()

            if result.stderr and result.returncode != 0:
                print("\033[33m" + result.stderr + "\033[0m")
                sys.stdout.flush()

            print()
            print("\033[36m⏳ Waiting 5 seconds for cleanup to settle...\033[0m")
            sys.stdout.flush()
            import time
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
            time.sleep(5)
            print()
            sys.stdout.flush()
        except Exception as e:
            print(f"\033[31m✗ Failed to execute git-filter-repo: {e}\033[0m")
<<<<<<< HEAD
=======
            import traceback
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
            traceback.print_exc()
            sys.stdout.flush()
            result = subprocess.CompletedProcess(filter_args, returncode=1, stdout='', stderr=str(e))

        print(f"\033[90m[DEBUG] Checking result.returncode: {result.returncode}\033[0m")
        sys.stdout.flush()

        if result.returncode == 0:
            print()
            print("\033[32m✓ Directories successfully removed from Git history\033[0m")
            sys.stdout.flush()

            print()
            print("\033[36mRestoring remote URL to default...\033[0m")
            sys.stdout.flush()

            default_remote = self._get_default_remote_url()
            print(f"\033[90m[DEBUG] Default remote URL: {default_remote}\033[0m")
            sys.stdout.flush()

            try:
                subprocess.run(['git', 'remote', 'get-url', 'origin'], capture_output=True, check=True)
                subprocess.run(['git', 'remote', 'set-url', 'origin', default_remote], check=True)
            except:
                subprocess.run(['git', 'remote', 'add', 'origin', default_remote], check=True)

            print(f"\033[32m✓ Remote URL restored to default: {default_remote}\033[0m")
            sys.stdout.flush()

            repo_size = subprocess.run(
                ['du', '-sh', '.git'],
                capture_output=True,
                text=True
            ).stdout.strip()
            print()
            print(f"\033[36mRepository size after cleanup: {repo_size}\033[0m")
            sys.stdout.flush()

            print()
            print(f"\033[36m📦 Backup branch created: {backup_branch}\033[0m")
            print("\033[33mTo recover old changes:\033[0m")
            print(f"  \033[37mgit checkout {backup_branch}\033[0m")
            sys.stdout.flush()

            print()
            print("\033[33m⚠️  IMPORTANT: Local changes have been cleaned.\033[0m")
            print("\033[33m⚠️  DO NOT push to remote unless you want to update it.\033[0m")
            print("\033[33m⚠️  If you want to push:\033[0m")
            print("  \033[37mgit push origin --force --all\033[0m")
            print("  \033[37mgit push origin --force --tags\033[0m")
            sys.stdout.flush()

            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_SUCCESS)
        else:
            print("\033[90m[DEBUG] git-filter-repo failed\033[0m")
            sys.stdout.flush()
            print()
            print(f"\033[31m✗ git-filter-repo failed\033[0m")
            sys.stdout.flush()

            if result.stderr:
                print(f"\033[31mError output:\033[0m")
                print(f"\033[33m{result.stderr}\033[0m")
                sys.stdout.flush()

            if result.stdout:
                print(f"\033[36mStandard output:\033[0m")
                print(f"\033[37m{result.stdout}\033[0m")
                sys.stdout.flush()

            print()
            print("\033[36mAttempting to restore remote URL...\033[0m")
            sys.stdout.flush()

            try:
                subprocess.run(['git', 'remote', 'get-url', 'origin'], capture_output=True, check=True)
                subprocess.run(['git', 'remote', 'set-url', 'origin', remote_url], check=False)
                print(f"\033[32m✓ Remote URL restored to original: {remote_url}\033[0m")
            except:
                subprocess.run(['git', 'remote', 'add', 'origin', remote_url], check=False)
                print(f"\033[32m✓ Remote URL added back: {remote_url}\033[0m")
            sys.stdout.flush()

            self.vars.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_FAILED)

        print()
        print("\033[36m" + "="*60 + "\033[0m")
        sys.stdout.flush()

        print()
        print("\033[32m[DEBUG] Cleanup function completed, waiting for user confirmation\033[0m")
        sys.stdout.flush()

        input("\n\033[33mPress Enter to continue...\033[0m")

    def _get_default_remote_url(self) -> str:
        """Get the default remote URL based on region"""
        region = self._get_region_setting()
        project_name = "core_node"

        if region == "Global":
            return f"git@github.com:accountbelongstox/{project_name}.git"
        else:
            return f"git@gitee.com:accountbelongstox/{project_name}.git"

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
                try:
                    self.handle_directory_cleanup()
                except Exception as e:
                    print()
                    print(f"\033[31m✗ Unexpected error: {e}\033[0m")
<<<<<<< HEAD
=======
                    import traceback
>>>>>>> bd3e27ea1cb269aa2e2163b64db21d1e5d678ba2
                    print("\033[33mStack trace:\033[0m")
                    traceback.print_exc()
                    print()
                    input("\033[33mPress Enter to continue...\033[0m")
            elif choice == "5":
                self.handle_git_time_travel()
                break
            elif choice == "6":
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
