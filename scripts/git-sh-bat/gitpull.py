import os
import subprocess
from pathlib import Path
import string
import random
import platform


class GitManager:
    def __init__(self, project_root):
        self.PROJECT_ROOT = Path(project_root)

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

    @staticmethod
    def generate_random_string(length=6):
        """Generate a random string for email suffix"""
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

    def set_git_config(self):
        """Set Git configuration to ensure correct merge strategy, username, email and safe directory"""
        self.colored_print("info", "Setting Git pull merge strategy and marking safe directory...")

        # Set fast-forward only (ff) strategy to avoid merge commits
        self.run_command('git config --global pull.ff only')
        self.run_command('git config --global pull.rebase false')  # Disable rebase to use merge

        # Add the project directory to the safe directory list
        self.run_command(f'git config --global --add safe.directory {self.PROJECT_ROOT}')

        # Ensure username and email are set
        self.set_git_username_and_email()

        # Check if the settings were applied correctly
        ff_setting = self.run_command('git config --get pull.ff')
        rebase_setting = self.run_command('git config --get pull.rebase')
        safe_directory = self.run_command(f'git config --get safe.directory')
        username = self.run_command('git config --get user.name')
        email = self.run_command('git config --get user.email')

        self.colored_print("info", f"Pull.ff setting: {ff_setting}")
        self.colored_print("info", f"Pull.rebase setting: {rebase_setting}")
        self.colored_print("info", f"Safe directory: {safe_directory}")
        self.colored_print("info", f"Git username: {username}")
        self.colored_print("info", f"Git email: {email}")

    def set_git_username_and_email(self):
        """Set Git username and email if not already configured"""
        username = self.run_command('git config --global user.name')
        email = self.run_command('git config --global user.email')

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

    def ensure_git_init(self):
        """Ensure the git repository is initialized"""
        if not (self.PROJECT_ROOT / '.git').exists():
            self.colored_print("info", "Initializing new Git repository... 🔧")
            self.run_command('git init')

    def git_pull(self):
        """Perform git pull with proper configurations"""
        self.ensure_git_init()
        self.set_git_config()

        self.colored_print("info", "Running git pull...")

        pull_output = self.run_command('git pull')

        if pull_output is not None:
            self.colored_print("success", f"Git pull completed successfully! ✅")
        else:
            self.colored_print("error", f"Git pull failed ❌")

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
    git_manager.git_pull()
