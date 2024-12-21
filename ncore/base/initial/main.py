import os
import sys
import platform
import subprocess
from pathlib import Path

class SystemChecker:
    def check_command_exists(self, command):
        try:
            subprocess.run([command, '--version'], 
                         stdout=subprocess.PIPE, 
                         stderr=subprocess.PIPE,
                         check=False)
            return True
        except FileNotFoundError:
            return False

    def get_system_info(self):
        system = platform.system().lower()
        ColorPrinter.info(f"Detecting system type...")
        
        if system == 'linux':
            if self.check_command_exists('opkg'):
                ColorPrinter.success("Detected OpenWRT system")
                return 'openwrt'
            elif self.check_command_exists('apt-get'):
                ColorPrinter.success("Detected Debian/Ubuntu system")
                return 'debian'
            elif self.check_command_exists('yum'):
                ColorPrinter.success("Detected CentOS/RHEL system")
                return 'rhel'
        
        ColorPrinter.success(f"Detected {system} system")
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
        
        base_path = '/home'
            
        return os.path.join(base_path, 'scripts', 'core_node')

class GitInstaller:
    def __init__(self):
        self.system_checker = SystemChecker()
        self.package_manager = self.system_checker.get_package_manager()

    def is_git_installed(self):
        success, output, _ = execute_shell_command(
            'git --version', 
            show_output=False
        )
        return success

    def get_git_version(self):
        success, output, _ = execute_shell_command(
            'git --version',
            show_output=False
        )
        return output if success else ''

    def install_git(self):
        if not self.package_manager:
            ColorPrinter.error("No supported package manager found")
            raise Exception("Unsupported system")

        if self.system_checker.get_system_info() == 'openwrt':
            ColorPrinter.info("Installing Git and dependencies for OpenWRT...")
            commands = [
                'opkg update',
                'opkg install git git-http',
                'opkg install ca-certificates',
                'opkg install libustream-openssl'
            ]
            
            for cmd in commands:
                ColorPrinter.info(f"Running: {cmd}")
                success, output, error = execute_shell_command(cmd)
                if not success:
                    ColorPrinter.error(f"Command failed: {cmd}")
                    ColorPrinter.error(f"Error: {error}")
                    raise Exception(f"Failed to execute {cmd}: {error}")
                ColorPrinter.success(f"Successfully executed: {cmd}")
            return

        commands = {
            'apt-get': 'apt-get update && apt-get install -y git',
            'yum': 'yum install -y git',
            'winget': 'winget install --id Git.Git -e --source winget'
        }

        command = commands.get(self.package_manager)
        success, output, error = execute_shell_command(command)
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

    def clone_repo(self):
        path = self.config.get_core_node_path()
        ColorPrinter.info(f"Preparing to clone repository to: {path}")
        os.makedirs(path, exist_ok=True)

        for repo in self.repos:
            ColorPrinter.info(f"Attempting to clone from: {repo}")
            try:
                success, output, error = execute_shell_command(
                    f'git clone {repo} {path}',
                    show_output=True
                )
                
                if success:
                    ColorPrinter.success(f"Successfully cloned repository from {repo}")
                    return True
                else:
                    ColorPrinter.warn(f"Failed to clone from {repo}")
                    ColorPrinter.error(f"Error: {error}")
            except Exception as e:
                ColorPrinter.error(f"Exception while cloning: {str(e)}")

        ColorPrinter.error("Failed to clone from all available repositories")
        raise Exception("Failed to clone from all repositories")

    def initialize_repo(self):
        system = self.system_checker.get_system_info()
        path = self.config.get_core_node_path()
        
        if system == 'windows':
            ColorPrinter.info("Windows system detected, skipping dd.sh execution")
            return

        dd_script = os.path.join(path, 'dd.sh')
        if os.path.exists(dd_script):
            ColorPrinter.info("Found dd.sh script, executing...")
            success, output, error = execute_shell_command(
                f'bash {dd_script}',
                show_output=True
            )
            if success:
                ColorPrinter.success("Successfully executed dd.sh")
            else:
                ColorPrinter.error(f"Errors during dd.sh execution: {error}")

class InitialManager:
    def __init__(self):
        self.system_checker = SystemChecker()
        self.git_installer = GitInstaller()
        self.repo_manager = RepoManager()
        self.config = Config()

    def start(self):
        try:
            ColorPrinter.info("=== Starting Core Node Initialization ===")
            
            # 1. Git Installation Check
            ColorPrinter.info("Step 1: Checking Git installation...")
            if not self.git_installer.is_git_installed():
                ColorPrinter.warn("Git not found in system")
                ColorPrinter.info("Installing Git...")
                self.git_installer.install_git()
                ColorPrinter.success("Git installation completed")
            else:
                version = self.git_installer.get_git_version()
                ColorPrinter.success(f"Git is already installed (version: {version})")

            # 2. Repository Check
            ColorPrinter.info("\nStep 2: Checking Core Node repository...")
            core_node_path = self.config.get_core_node_path()
            if not self.repo_manager.check_repo_exists(core_node_path):
                ColorPrinter.warn(f"Repository not found at: {core_node_path}")
                ColorPrinter.info("Cloning repository...")
                self.repo_manager.clone_repo()
            else:
                ColorPrinter.success(f"Repository exists at: {core_node_path}")
            
            # 3. Repository Initialization
            ColorPrinter.info("\nStep 3: Initializing repository...")
            self.repo_manager.initialize_repo()
            ColorPrinter.success("Repository initialization completed")

            ColorPrinter.success("\n=== Core Node Initialization Completed Successfully ===")

        except Exception as e:
            ColorPrinter.error(f"\nInitialization failed: {str(e)}")
            raise

def execute_shell_command(command, cwd=None, show_output=True):
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
        process = subprocess.Popen(
            command,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True,
            universal_newlines=True,
            bufsize=1
        )

        output_lines = []
        error_lines = []

        # Read output in real-time
        while True:
            output = process.stdout.readline()
            error = process.stderr.readline()
            
            if output == '' and error == '' and process.poll() is not None:
                break

            if output:
                line = output.strip()
                if show_output:
                    print(line)
                output_lines.append(line)

            if error:
                line = error.strip()
                if show_output:
                    print(f"ERROR: {line}", file=sys.stderr)
                error_lines.append(line)

        process.wait()
        
        output_str = '\n'.join(output_lines)
        error_str = '\n'.join(error_lines)
        success = process.returncode == 0
        return success, output_str, error_str

    except Exception as e:
        return False, '', str(e)

class ColorPrinter:
    """Utility class for colored console output"""
    COLORS = {
        'HEADER': '\033[95m',
        'INFO': '\033[94m',
        'SUCCESS': '\033[92m',
        'WARNING': '\033[93m',
        'ERROR': '\033[91m',
        'ENDC': '\033[0m',
        'BOLD': '\033[1m'
    }

    @staticmethod
    def info(message):
        print(f"{ColorPrinter.COLORS['INFO']}[INFO] {message}{ColorPrinter.COLORS['ENDC']}")

    @staticmethod
    def warn(message):
        print(f"{ColorPrinter.COLORS['WARNING']}[WARNING] {message}{ColorPrinter.COLORS['ENDC']}")

    @staticmethod
    def error(message):
        print(f"{ColorPrinter.COLORS['ERROR']}[ERROR] {message}{ColorPrinter.COLORS['ENDC']}")

    @staticmethod
    def success(message):
        print(f"{ColorPrinter.COLORS['SUCCESS']}[SUCCESS] {message}{ColorPrinter.COLORS['ENDC']}")

if __name__ == "__main__":
    initializer = InitialManager()
    initializer.start()