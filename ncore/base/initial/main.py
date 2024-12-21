import os
import sys
import platform
import asyncio
import subprocess
from pathlib import Path

class SystemChecker:
    def get_system_info(self):
        system = platform.system().lower()
        if system == 'linux':
            try:
                with open('/etc/os-release') as f:
                    lines = f.readlines()
                    info = dict(line.strip().split('=', 1) for line in lines if '=' in line)
                    id = info.get('ID', '').strip('"').lower()
                    if id in ['ubuntu', 'debian']:
                        return 'debian'
                    elif id in ['centos', 'rhel']:
                        return 'rhel'
                    elif id == 'openwrt':
                        return 'openwrt'
            except:
                pass
        return system

    def get_package_manager(self):
        system = self.get_system_info()
        package_managers = {
            'debian': 'apt-get',
            'rhel': 'yum',
            'openwrt': 'opkg',
            'windows': 'winget'
        }
        return package_managers.get(system)

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
        try:
            process = await asyncio.create_subprocess_shell(
                'git --version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await process.communicate()
            return process.returncode == 0
        except:
            return False

    async def get_git_version(self):
        process = await asyncio.create_subprocess_shell(
            'git --version',
            stdout=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        return stdout.decode().strip()

    async def install_git(self):
        if not self.package_manager:
            raise Exception("Unsupported system")

        commands = {
            'apt-get': 'apt-get update && apt-get install -y git',
            'yum': 'yum install -y git',
            'opkg': 'opkg update && opkg install git',
            'winget': 'winget install --id Git.Git -e --source winget'
        }

        command = commands.get(self.package_manager)
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

class RepoManager:
    def __init__(self):
        self.config = Config()
        self.system_checker = SystemChecker()
        self.repos = [
            'https://git.local.12gm.com:901/adminroot/core_node.git',
            'git@gitee.com:accountbelongstox/core_node.git'
        ]

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

if __name__ == "__main__":
    initializer = InitialManager()
    asyncio.run(initializer.start())