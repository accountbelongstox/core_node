import os
import subprocess
from pathlib import Path
from datetime import datetime
import string
import random
import platform


class GitManager:
    def __init__(self, project_root):
        self.PROJECT_ROOT = Path(project_root)
        self.git_repositorie_name = self.PROJECT_ROOT.name
        self.remote_urls = {
            'local': f'ssh://git@git.local.12gm.com:17003/adminroot/{self.git_repositorie_name}.git',
            'gitee': f'git@gitee.com:accountbelongstox/{self.git_repositorie_name}.git',
            'github': f'git@github.com:accountbelongstox/{self.git_repositorie_name}.git'
        }

    @staticmethod
    def generate_random_string(length=6):
        """Generate random string for username suffix"""
        chars = string.ascii_lowercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))

    @staticmethod
    def get_system_username():
        """Get current system username"""
        try:
            return os.getlogin()
        except Exception:
            return "unknown_user"

    @staticmethod
    def format_username(username):
        """Format username to valid Git format"""
        formatted = ''.join(c if c.isalnum() or c == '_' else '_' for c in username.lower())
        return formatted[:30]

    @staticmethod
    def run_command(command, cwd=None):
        """Execute command and return output"""
        cwd = cwd or str(Path(__file__).parent.parent.parent)
        try:
            process = subprocess.Popen(
                command,
                cwd=cwd,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1
            )

            full_output = []
            while True:
                output = process.stdout.readline()
                error = process.stderr.readline()

                if output:
                    full_output.append(output.strip())
                if error:
                    print(f"\033[91m[ERROR] {error.strip()}\033[0m")
                if output == '' and error == '' and process.poll() is not None:
                    break

            return '\n'.join(full_output)

        except Exception as e:
            print(f"\033[91m[ERROR] {e}\033[0m")
            return None

    def set_git_remote_url(self, url, remote_name='origin'):
        """Set or update git remote URL"""
        existing_remotes = self.run_command('git remote')
        if existing_remotes is None:
            return False

        existing_remotes = existing_remotes.split('\n')
        if remote_name in existing_remotes:
            if self.run_command(f'git remote set-url {remote_name} {url}') is not None:
                self.colored_print("success", f"Successfully updated {remote_name} remote to {url} ✅")
                return True
        else:
            if self.run_command(f'git remote add {remote_name} {url}') is not None:
                self.colored_print("success", f"Successfully added {remote_name} remote with {url} ✅")
                return True
        return False

    def commit_and_push(self, remote_name='origin', branch='main'):
        """Commit and push changes with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d@%H-%M-%S")
        self.colored_print("info", "=" * 50)
        self.colored_print("info", f"Starting commit process at {timestamp}")
        self.colored_print("info", "=" * 50)

        remote_branches = self.run_command('git branch -r')
        if remote_branches:
            branches = [b.strip() for b in remote_branches.split('\n')]
            target_branch = f"origin/{branch}"
            branch_exists = any(b.endswith(target_branch) for b in branches)

            if not branch_exists:
                self.colored_print("warning", f"Branch '{branch}' does not exist. Creating '{branch}' branch...")
                if self.run_command(f'git push --set-upstream origin {branch}') is None:
                    return False

        remotes = self.run_command('git remote -v')
        if remotes:
            self.colored_print("info", f"Current remote configuration: {remotes}")

        commands = [
            'git add .',
            f'git commit -m "{timestamp}"',
            f'git push --set-upstream origin {branch}'
        ]

        for cmd in commands:
            self.colored_print("info", f"Running: {cmd}")
            if self.run_command(cmd) is None:
                return False

        self.colored_print("success", f"Commit and push completed successfully! 🎉")
        return True

    def initialize_git_settings(self):
        """Initialize Git configuration with auto-generated settings"""
        system_username = self.get_system_username()
        system_info = platform.system()
        random_string = self.generate_random_string()
        raw_git_username = f"{system_username}_{system_info}_{random_string}"
        git_username = self.format_username(raw_git_username)
        self.colored_print("info", f"Generated Git username: {git_username}")

        config_commands = [
            ('user.name', git_username, 'Git username'),
            ('user.email', f'{git_username}@server.com', 'Git email'),
            ('http.sslVerify', 'false', 'SSL verification'),
            ('credential.helper', 'cache', 'Credential caching')
        ]

        for key, value, desc in config_commands:
            current = self.run_command(f'git config --global {key}')
            if not current.strip():
                self.colored_print("info", f"Setting {desc}...")
                self.run_command(f'git config --global {key} "{value}"')

        if not (self.PROJECT_ROOT / '.git').exists():
            self.colored_print("info", "Initializing new Git repository... 🔧")
            self.run_command('git init')

    def setup_multiple_remotes(self):
        """Setup multiple git remote repositories and commit changes"""
        self.initialize_git_settings()

        success_count = 0
        total_count = len(self.remote_urls)

        self.colored_print("info", f"\nProcessing {total_count} remotes...")

        for remote_name, url in self.remote_urls.items():
            self.colored_print("info", f"\nProcessing: {remote_name}")
            current_success = True

            steps = [
                (self.set_git_remote_url, (url, remote_name)),
                (self.commit_and_push, (remote_name, 'main')),
            ]

            for step_idx, (step_func, args) in enumerate(steps, 1):
                self.colored_print("info", f"\nStep {step_idx}/2")
                if not current_success:
                    self.colored_print("warning", f"Skipping step {step_idx} (previous step failed) ⚠️")
                    continue

                if not step_func(*args):
                    self.colored_print("error", f"Step {step_idx} failed ❌")
                    current_success = False

            if current_success:
                success_count += 1
                self.colored_print("success", f"{remote_name} processed successfully! ✅")
            else:
                self.colored_print("error", f"{remote_name} processing failed ❌")

        self.colored_print("info", f"\nFinal result statistics")
        self.colored_print("info", f"Total repositories: {total_count}")
        self.colored_print("info", f"Successes: {success_count}")
        if success_count < total_count:
            self.colored_print("warning", f"Failures: {total_count - success_count} ⚠️")

    def colored_print(self, message_type, msg):
        """Print messages with color and symbols based on message type"""
        color_map = {
            "success": "\033[92m",  # Green
            "info": "\033[94m",     # Blue
            "warning": "\033[93m",  # Yellow
            "error": "\033[91m",    # Red
        }
        color_code = color_map.get(message_type, "\033[0m")
        print(f"{color_code}{msg}\033[0m")


# Main execution
if __name__ == "__main__":
    project_root = Path(__file__).parent.parent.parent
    git_manager = GitManager(project_root)
    git_manager.setup_multiple_remotes()
