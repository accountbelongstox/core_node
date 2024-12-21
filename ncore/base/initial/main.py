import os
import sys
import platform
import asyncio
import subprocess
from pathlib import Path

class SystemChecker:
    def check_command_exists(self, command):
        """Check if a command exists in system PATH"""
        try:
            subprocess.run([command, '--version'], 
                         stdout=subprocess.PIPE, 
                         stderr=subprocess.PIPE,
                         check=False)
            return True
        except FileNotFoundError:
            return False

    def get_system_info(self):
        """Detect system type by checking package managers"""
        system = platform.system().lower()
        
        if system == 'linux':
            # Check package managers directly
            if self.check_command_exists('opkg'):
                return 'openwrt'
            elif self.check_command_exists('apt-get'):
                return 'debian'
            elif self.check_command_exists('yum'):
                return 'rhel'
        
        return system

    def get_package_manager(self):
        system = self.get_system_info()
        print(f"System detected by package manager: {system}")
        package_managers = {
            'debian': 'apt-get',
            'rhel': 'yum',
            'openwrt': 'opkg',
            'windows': 'winget'
        }
        manager = package_managers.get(system)
        print(f"Using package manager: {manager}")
        return manager

class Config:
    def get_core_node_path(self):
        system = platform.system().lower()
        
        if system == 'windows':
            return r'D:\programing\core_node'
        
        # For Linux-based systems
        if os.getuid() == 0:  # Root user
            base_path = '/root'
        else:
            base_path = os.path.expanduser('~')
            
        return os.path.join(base_path, 'scripts', 'core_node')

class GitInstaller:
    def __init__(self):
        self.system_checker = SystemChecker()
        self.package_manager = self.system_checker.get_package_manager()

    async def is_git_installed(self):
        success, output, _ = await execute_shell_command(
            'git --version', 
            show_output=False
        )
        return success

    async def get_git_version(self):
        success, output, _ = await execute_shell_command(
            'git --version',
            show_output=False
        )
        return output if success else ''

    async def install_git(self):
        if not self.package_manager:
            raise Exception("Unsupported system")

        if self.system_checker.get_system_info() == 'openwrt':
            # Special handling for OpenWRT
            commands = [
                'opkg update',
                'opkg install git git-http',  # Install both git and git-http
                'opkg install ca-certificates', # Required for HTTPS
                'opkg install libustream-openssl' # SSL support
            ]
            
            for cmd in commands:
                success, output, error = await execute_shell_command(cmd)
                if not success:
                    raise Exception(f"Failed to execute {cmd}: {error}")
                print(output)
            
            return

        # For other systems
        commands = {
            'apt-get': 'apt-get update && apt-get install -y git',
            'yum': 'yum install -y git',
            'winget': 'winget install --id Git.Git -e --source winget'
        }

        command = commands.get(self.package_manager)
        success, output, error = await execute_shell_command(command)
        if not success:
            raise Exception(f"Failed to install git: {error}")

class RepoManager:
    def __init__(self):
        self.config = Config()
        self.system_checker = SystemChecker()
        self.repos = self._get_repos()

    def _get_repos(self):
        """Get repository URLs based on system type"""
        base_repos = [
            'https://git.local.12gm.com:901/adminroot/core_node.git',
            'https://gitee.com/accountbelongstox/core_node.git'
        ]

        # Special handling for OpenWRT
        if self.system_checker.get_system_info() == 'openwrt':
            # Replace git.local.12gm.com with direct IP for OpenWRT
            repos = []
            for repo in base_repos:
                if 'git.local.12gm.com' in repo:
                    # Replace domain and port with OpenWRT-specific address
                    repo = repo.replace(
                        'git.local.12gm.com:901', 
                        '192.168.100.1:17003'
                    )
                repos.append(repo)
            return repos

        return base_repos

    def check_repo_exists(self, path):
        if not os.path.exists(path):
            return False
        if not os.path.isdir(path):
            return False
        if not os.listdir(path):
            return False
        return True

    async def clone_repo(self):
        path = self.config.get_core_node_path()
        os.makedirs(path, exist_ok=True)

        for repo in self.repos:
            try:
                process = await asyncio.create_subprocess_shell(
                    f'git clone {repo} {path}',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                _, stderr = await process.communicate()
                
                if process.returncode == 0:
                    print(f"Successfully cloned from {repo}")
                    return True
                else:
                    print(f"Failed to clone from {repo}: {stderr.decode()}")
            except Exception as e:
                print(f"Error cloning from {repo}: {e}")

        raise Exception("Failed to clone from all repositories")

    async def initialize_repo(self):
        system = self.system_checker.get_system_info()
        path = self.config.get_core_node_path()
        
        if system == 'windows':
            print("Windows system detected, skipping dd.sh execution")
            return

        dd_script = os.path.join(path, 'dd.sh')
        if os.path.exists(dd_script):
            process = await asyncio.create_subprocess_shell(
                f'bash {dd_script}',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            print(stdout.decode())
            if stderr:
                print(f"Errors during initialization: {stderr.decode()}")

class InitialManager:
    def __init__(self):
        self.system_checker = SystemChecker()
        self.git_installer = GitInstaller()
        self.repo_manager = RepoManager()
        self.config = Config()

    async def start(self):
        try:
            # 1. Check and install git
            if not await self.git_installer.is_git_installed():
                print("Git not found, installing...")
                await self.git_installer.install_git()
            else:
                version = await self.git_installer.get_git_version()
                print(f"Git is already installed: {version}")

            # 2. Check and clone repository
            core_node_path = self.config.get_core_node_path()
            if not self.repo_manager.check_repo_exists(core_node_path):
                print(f"Core node repository not found at {core_node_path}")
                await self.repo_manager.clone_repo()
            
            # 3. Initialize repository
            await self.repo_manager.initialize_repo()

        except Exception as e:
            print(f"Error during initialization: {e}")
            raise

async def execute_shell_command(command, cwd=None, show_output=True):
    """
    Execute shell command and return result
    Args:
        command: Command to execute
        cwd: Working directory
        show_output: Whether to print output in real time
    Returns:
        tuple: (success, output_str, error_str)
    """
    try:
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            shell=True
        )

        # Store complete output
        output_lines = []
        error_lines = []

        # Read stdout and stderr concurrently
        while True:
            # Read one line from stdout and stderr
            stdout_line = await process.stdout.readline()
            stderr_line = await process.stderr.readline()

            if not stdout_line and not stderr_line and process.returncode is not None:
                break

            # Handle stdout
            if stdout_line:
                line = stdout_line.decode('utf-8').rstrip()
                if show_output:
                    print(line)
                output_lines.append(line)

            # Handle stderr
            if stderr_line:
                line = stderr_line.decode('utf-8').rstrip()
                if show_output:
                    print(f"ERROR: {line}", file=sys.stderr)
                error_lines.append(line)

        # Wait for process to complete
        await process.wait()

        # Join all lines with newlines
        output_str = '\n'.join(output_lines)
        error_str = '\n'.join(error_lines)

        success = process.returncode == 0
        return success, output_str, error_str

    except Exception as e:
        return False, '', str(e)

if __name__ == "__main__":
    initializer = InitialManager()
    asyncio.run(initializer.start())