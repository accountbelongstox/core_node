import os
import subprocess
from pathlib import Path
from datetime import datetime

class ColorPrinter:
    # ANSI escape codes for colors
    COLORS = {
        'red': '\033[91m',
        'green': '\033[92m',
        'blue': '\033[94m',
        'yellow': '\033[93m',
        'reset': '\033[0m'
    }

    @staticmethod
    def print_color(message, color='reset'):
        """Print message in specified color"""
        color_code = ColorPrinter.COLORS.get(color, ColorPrinter.COLORS['reset'])
        print(f"{color_code}{message}{ColorPrinter.COLORS['reset']}")

    @staticmethod
    def info(message):
        """Print info message in blue"""
        ColorPrinter.print_color(f"[INFO] {message}", 'blue')

    @staticmethod
    def success(message):
        """Print success message in green"""
        ColorPrinter.print_color(f"[SUCCESS] {message}", 'green')

    @staticmethod
    def error(message):
        """Print error message in red"""
        ColorPrinter.print_color(f"[ERROR] {message}", 'red')

    @staticmethod
    def warning(message):
        """Print warning message in yellow"""
        ColorPrinter.print_color(f"[WARNING] {message}", 'yellow')

def run_git_command(command, cwd=None):
    """Execute git command and return result"""
    cwd = cwd or str(Path(__file__).parent.parent)
    info = f"cwd: {cwd}"
    ColorPrinter.info(info)
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            shell=True,
            check=True,
            capture_output=True,
            text=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        ColorPrinter.error(f"Command failed: '{command}'")
        ColorPrinter.error(f"Error: {e}")
        return None

def set_git_remote_url(url, remote_name='origin'):
    """Set or update git remote URL"""
    # Get current remotes
    existing_remotes = run_git_command('git remote')
    if existing_remotes is None:
        ColorPrinter.error("Failed to get current remotes")
        return False

    existing_remotes = existing_remotes.split('\n')
    
    if remote_name in existing_remotes:
        # Update existing remote
        ColorPrinter.info(f"Updating remote '{remote_name}' URL to: {url}")
        if run_git_command(f'git remote set-url {remote_name} {url}') is not None:
            ColorPrinter.success(f"Successfully updated {remote_name} remote URL")
            return True
    else:
        # Add new remote
        ColorPrinter.info(f"Adding new remote '{remote_name}' with URL: {url}")
        if run_git_command(f'git remote add {remote_name} {url}') is not None:
            ColorPrinter.success(f"Successfully added {remote_name} remote")
            return True
    
    return False

def commit_and_push(remote_name='origin', branch='main'):
    """Commit and push changes with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d@%H-%M-%S")
    
    ColorPrinter.info("=" * 50)
    ColorPrinter.success(f"Starting commit process at {timestamp}")
    ColorPrinter.info("=" * 50)

    # Get all remote branches and check if target branch exists
    remote_branches = run_git_command('git branch -r')
    if remote_branches:
        branches = [b.strip() for b in remote_branches.split('\n')]
        target_branch = f"origin/{branch}"
        branch_exists = any(b.endswith(target_branch) for b in branches)
        
        ColorPrinter.info(f"Checking for branch: {target_branch}")
        ColorPrinter.info(f"Available remote branches: {', '.join(branches)}")
        
        if not branch_exists:
            ColorPrinter.warning(f"Branch '{branch}' does not exist. Creating '{branch}' branch...")
            
            # Create and setup branch
            commands = [
                f'git checkout -b {branch}',
                f'git push --set-upstream {remote_name} {branch}',
                f'git branch --set-upstream-to={remote_name}/{branch} {branch}',
                f'git pull {remote_name} {branch}'
            ]
            
            for cmd in commands:
                if run_git_command(cmd) is None:
                    ColorPrinter.error(f"Failed to execute: {cmd}")
                    return False
    else:
        ColorPrinter.warning("Could not get remote branches, attempting to create new branch...")
        # ... rest of the function remains the same ...

    # Show remote configuration
    remotes = run_git_command('git remote -v')
    if remotes:
        ColorPrinter.info("\nCurrent remote configuration:")
        ColorPrinter.print_color(remotes, 'green')
    
    # Commit and push changes
    commands = [
        'git add .',
        f'git commit -m "{timestamp}"',
        'git pull',
        'git add .',
        f'git commit -m "{timestamp}"',
        f'git push --set-upstream {remote_name} {branch}'
    ]

    ColorPrinter.info("\nExecuting git commands...")
    for cmd in commands:
        ColorPrinter.info(f"Running: {cmd}")
        if run_git_command(cmd) is None:
            ColorPrinter.error(f"Failed to execute: {cmd}")
            return False
        
    ColorPrinter.success("\nCommit and push completed successfully!")
    return True

def setup_multiple_remotes():
    """Setup multiple git remote repositories and commit changes"""
    remote_urls = {
        'local': 'ssh://git@git.local.12gm.com:5022/adminroot/node_spider.git',
        'gitee': 'git@gitee.com:accountbelongstox/core_node.git'
    }

    success_count = 0
    total_count = len(remote_urls)

    ColorPrinter.info(f"Setting up {total_count} remote repositories...")
    
    for remote_name, url in remote_urls.items():
        ColorPrinter.info(f"\nProcessing remote: {remote_name}")
        if set_git_remote_url(url, remote_name):
            success_count += 1
            # After successful remote setup, commit and push
            ColorPrinter.info(f"\nCommitting changes to {remote_name}...")
            if commit_and_push(remote_name):
                ColorPrinter.success(f"Successfully committed to {remote_name}")
            else:
                ColorPrinter.error(f"Failed to commit to {remote_name}")

    # Print summary
    ColorPrinter.info("\n=== Setup Summary ===")
    ColorPrinter.print_color(f"Total remotes: {total_count}", 'blue')
    ColorPrinter.print_color(f"Successfully configured: {success_count}", 'green')
    if success_count < total_count:
        ColorPrinter.print_color(f"Failed: {total_count - success_count}", 'red')

    # Show final remote configuration
    ColorPrinter.info("\nFinal remote configuration:")
    remotes = run_git_command('git remote -v')
    if remotes:
        ColorPrinter.print_color(remotes, 'green')

if __name__ == "__main__":
    setup_multiple_remotes()