import os
import subprocess
from pathlib import Path
from datetime import datetime

# Add at the top after imports
PROJECT_ROOT = Path(__file__).parent.parent.parent

git_repositorie_name = PROJECT_ROOT.name 
remote_urls = {
    'local': f'ssh://git@git.local.12gm.com:17003/adminroot/{git_repositorie_name}.git',
    'gitee': f'git@gitee.com:accountbelongstox/{git_repositorie_name}.git',
    'github': f'git@github.com:accountbelongstox/{git_repositorie_name}.git'
}

class ColorPrinter:
    # ANSI escape codes for colors
    COLORS = {
        'red': '\033[91m',
        'green': '\033[92m',
        'blue': '\033[94m',
        'yellow': '\033[93m',
        'purple': '\033[95m',
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

    @staticmethod
    def step_print(step, message):
        """Step information printing"""
        color_code = ColorPrinter.COLORS['purple']
        print(f"{color_code}[STEP {step}] {message}{ColorPrinter.COLORS['reset']}")

ColorPrinter.info(f"Project root: {PROJECT_ROOT}")

def run_git_command(command, cwd=None):
    """Execute git command and return result"""
    cwd = cwd or str(PROJECT_ROOT)
    ColorPrinter.info(f"Working directory: {cwd}")
    try:
        # Use Popen for real-time output
        process = subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1
        )

        # Store complete output for return value
        full_output = []
        
        # Read stdout and stderr in real-time
        while True:
            output = process.stdout.readline()
            error = process.stderr.readline()
            
            if output:
                print(output.strip())
                full_output.append(output.strip())
            if error:
                ColorPrinter.error(error.strip())
            
            # Check if process has finished
            if output == '' and error == '' and process.poll() is not None:
                break
        
        return_code = process.poll()
        return '\n'.join(full_output)
            
    except Exception as e:
        ColorPrinter.error(f"Command failed: '{command}'")
        ColorPrinter.error(f"Error: {e}")
        return None

def set_git_remote_url(url, remote_name='origin'):
    """Set or update git remote URL"""
    existing_remotes = run_git_command('git remote')
    if existing_remotes is None:
        ColorPrinter.error("Failed to get current remotes")
        return False

    existing_remotes = existing_remotes.split('\n')
    
    if remote_name in existing_remotes:
        ColorPrinter.info(f"Updating remote '{remote_name}' URL to: {url}")
        if run_git_command(f'git remote set-url {remote_name} {url}') is not None:
            ColorPrinter.success(f"Successfully updated {remote_name} remote by {url}")
            return True
    else:
        ColorPrinter.info(f"Adding new remote '{remote_name}' with URL: {url}")
        if run_git_command(f'git remote add {remote_name} {url}') is not None:
            ColorPrinter.success(f"Successfully added {remote_name} remote by {url}")
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
                # f'git checkout -b {branch}',
                f'git push --set-upstream origin {branch}',
                # f'git branch --set-upstream-to=origin/{branch} {branch}',
                # f'git pull origin {branch}'
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
        # 'git pull',
        'git add .',
        f'git commit -m "{timestamp}"',
        f'git push --set-upstream origin {branch}'
    ]

    ColorPrinter.info("\nExecuting git commands...")
    for cmd in commands:
        ColorPrinter.info(f"Running: {cmd}")
        if run_git_command(cmd) is None:
            ColorPrinter.error(f"Failed to execute: {cmd}")
            return False
        
    ColorPrinter.success("\nCommit and push completed successfully!")
    return True

def check_and_set_remote(remote_name, url):
    """Step 1: Check and set remote repository"""
    ColorPrinter.step_print(1, f"🔄 Checking remote config [{remote_name}]")
    
    existing_remotes = run_git_command('git remote')
    if existing_remotes is None:
        ColorPrinter.error("❌ Failed to get remote list")
        return False

    if remote_name in existing_remotes.split('\n'):
        ColorPrinter.info(f"🔍 Found existing remote [{remote_name}]")
        current_url = run_git_command(f'git remote get-url {remote_name}')
        if current_url.strip() == url:
            ColorPrinter.success(f"✅ Remote [{remote_name}] is up-to-date")
            return True
        ColorPrinter.warning(f"🔄 Needs URL update\nOld URL: {current_url}\nNew URL: {url}")
    else:
        ColorPrinter.info(f"🆕 Adding new remote [{remote_name}]")

    return set_git_remote_url(url, remote_name)

def ensure_branch_exists(remote_name, branch):
    """Step 2: Ensure branch exists"""
    ColorPrinter.step_print(2, f"🌿 Checking branch status [{branch}]")
    
    # Check current branch
    current_branch = run_git_command('git branch --show-current')
    if current_branch and current_branch.strip() == branch:
        ColorPrinter.success(f"✅ Already on {branch} branch")
        return True
    
    # Check local branch existence
    local_branches = run_git_command('git branch --list')
    branch_exists = any(b.strip('* ') == branch for b in local_branches.split('\n')) if local_branches else False
    
    if branch_exists:
        ColorPrinter.info(f"🔀 Switching to existing {branch} branch")
        if run_git_command(f'git checkout {branch}') is None:
            ColorPrinter.error(f"❌ Failed to switch to {branch}")
            return False
        return True
    
    # Create new branch
    ColorPrinter.warning(f"⚠️ Creating new branch [{branch}]...")
    cmds = [
        # f'git checkout -b {branch}',
        f'git push --set-upstream {remote_name} {branch}',
        # f'git branch --set-upstream-to={remote_name}/{branch} {branch}'
    ]
    
    for cmd in cmds:
        ColorPrinter.info(f"⚡ Executing command: {cmd}")
        if run_git_command(cmd) is None:
            return False
    return True

def commit_local_changes(remote_name, url):
    """Step 3: Commit local changes"""
    ColorPrinter.step_print(3, f"📦 Saving snapshot for {remote_name}")
    ColorPrinter.info(f"🔗 Remote URL: {url}")
    timestamp = datetime.now().strftime("%Y-%m-%d@%H-%M-%S")
    
    # Check for changes
    status = run_git_command('git status --porcelain')
    if not status.strip():
        ColorPrinter.warning("📭 No changes to commit")
        return True

    ColorPrinter.info(f"📝 Found {len(status.splitlines())} changes")
    cmds = [
        'git add .',
        f'git commit -m "Auto commit {timestamp} ({remote_name})"'
    ]
    
    for cmd in cmds:
        ColorPrinter.info(f"⚡ Executing command: {cmd}")
        if run_git_command(cmd) is None:
            return False
    return True

def sync_with_remote(remote_name, branch):
    """Step 4: Synchronize with remote"""
    ColorPrinter.step_print(4, "🔄 Syncing remote changes")
    ColorPrinter.info(f"⏬ Pulling updates from [{remote_name}]...")
    
    # Check for uncommitted changes
    status = run_git_command('git status --porcelain')
    stash_needed = bool(status.strip())
    
    if stash_needed:
        ColorPrinter.warning("⚠️ Found uncommitted changes, stashing...")
        if run_git_command('git stash push --include-untracked') is None:
            ColorPrinter.error("❌ Failed to stash changes")
            return False

    # Attempt rebase pull
    pull_result = run_git_command(f'git pull {remote_name} {branch} --rebase')
    
    if stash_needed:
        ColorPrinter.info("🔄 Restoring stashed changes...")
        if run_git_command('git stash pop') is None:
            ColorPrinter.error("❌ Failed to restore stashed changes")
            return False

    if not pull_result:
        return False
    
    # Check merge conflicts
    conflict = run_git_command('git diff --check')
    if conflict and 'conflict' in conflict.lower():
        ColorPrinter.error("❌ Merge conflicts detected! Please resolve manually!")
        ColorPrinter.info("💡 Conflict files:\n" + conflict)
        return False
    
    ColorPrinter.success("✅ Remote changes synchronized")
    return True

def push_changes(remote_name, branch):
    """Step 5: Push changes"""
    ColorPrinter.step_print(5, "🚀 Pushing to remote")
    ColorPrinter.info(f"⏫ Pushing to [{remote_name}/{branch}]...")
    
    result = run_git_command(f'git push {remote_name} {branch}')
    
    # 更精确的成功判断
    success_indicators = [
        '-> main',
        'up to date',
        'successfully pushed',
        'new branch'
    ]
    
    # 检查实际推送结果
    if any(indicator in result.lower() for indicator in success_indicators):
        ColorPrinter.success(f"✅ Successfully pushed to [{remote_name}]")
        return True
    
    # 错误检测
    error_indicators = [
        'rejected',
        'error',
        'failed',
        'conflict'
    ]
    if any(indicator in result.lower() for indicator in error_indicators):
        ColorPrinter.error("❌ Push rejected - remote contains unmerged changes")
        return False
    
    # 非关键警告处理
    ColorPrinter.warning("⚠️ Push completed with non-critical messages")
    return True

def setup_multiple_remotes():
    """Setup multiple git remote repositories and commit changes"""
    success_count = 0
    total_count = len(remote_urls)
    branch = 'main'

    ColorPrinter.info(f"🌈 Initializing {total_count} remotes...")
    
    for remote_name, url in remote_urls.items():
        ColorPrinter.info(f"\n{'-'*5} Processing: {remote_name}  {url} {'-'*5}")
        current_success = True

        # Execute steps
        steps = [
            (check_and_set_remote, (remote_name, url)),
            (ensure_branch_exists, (remote_name, branch)),
            (commit_local_changes, (remote_name, url)),
            (sync_with_remote, (remote_name, branch)),
            (push_changes, (remote_name, branch))
        ]

        for step_idx, (step_func, args) in enumerate(steps, 1):
            ColorPrinter.info(f"\n🔰 Step {step_idx}/5")
            if not current_success:
                ColorPrinter.warning(f"⏭️ Skipping step {step_idx} (previous step failed)")
                continue
                
            if not step_func(*args):
                ColorPrinter.error(f"❌ Step {step_idx} failed")
                current_success = False

        if current_success:
            success_count += 1
            ColorPrinter.success(f"🎉 {remote_name} processed successfully!")
        else:
            ColorPrinter.error(f"💥 {remote_name} processing failed")

    # Print final results
    ColorPrinter.info("\n📊 Final result statistics")
    ColorPrinter.print_color(f"📦 Total repositories: {total_count}", 'blue')
    ColorPrinter.print_color(f"✅ Successes: {success_count}", 'green')
    if success_count < total_count:
        ColorPrinter.print_color(f"❌ Failures: {total_count - success_count}", 'red')

if __name__ == "__main__":
    setup_multiple_remotes()