import os
import sys
import subprocess
import time
import json
from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from .libs.reader import FileReader
from .libs.printer import Printer as cp
from .config import Config

class AutoInstallRequire:
    def __init__(self, use_mirror: str = None):
        """
        Initialize package installer
        :param use_mirror: Optional mirror to use ('huawei', 'aliyun', '163', 'tencent', 'douban')
        """
        # Print configuration
        Config.print_config()
        
        self.root_dir = Config.ROOT_DIR
        self.requirements_file = Config.REQUIREMENTS_FILE
        self.cache_dir = Config.CACHE_DIR
        self.mirror = Config.MIRRORS.get(use_mirror) if use_mirror else None
        self.file_reader = FileReader()
        
        # Ensure cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Clean expired cache
        self._clean_expired_cache()
        
        # Print cache status
        self._print_cache_status()
        
        # Start installation process
        self._install_requirements()

    def _get_package_cache_path(self, package_name: str) -> str:
        """Get cache file path for a package"""
        return Config.get_cache_file(package_name)

    def _is_cached(self, package_name: str) -> bool:
        """Check if package is cached as installed"""
        cache_file = self._get_package_cache_path(package_name)
        if not os.path.exists(cache_file):
            return False
            
        # Check cache age
        cache_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
        if datetime.now() - cache_time > timedelta(days=Config.CACHE_EXPIRATION_DAYS):
            cp.warning(f"Cache expired for package: {package_name}")
            os.remove(cache_file)
            return False
            
        return True

    def _clean_expired_cache(self):
        """Clean expired cache files"""
        if not os.path.exists(self.cache_dir):
            return
            
        cp.info("\nChecking cache expiration...")
        expiration_time = datetime.now() - timedelta(days=Config.CACHE_EXPIRATION_DAYS)
        cleaned = 0
        
        for file in os.listdir(self.cache_dir):
            file_path = os.path.join(self.cache_dir, file)
            if os.path.getmtime(file_path) < expiration_time.timestamp():
                os.remove(file_path)
                cleaned += 1
                
        if cleaned > 0:
            cp.warning(f"Cleaned {cleaned} expired cache files")

    def _print_cache_status(self):
        """Print cache status information"""
        cp.info("\nCache Status:")
        cached_packages = [f for f in os.listdir(self.cache_dir) if f.endswith('.installed')]
        cp.info(f"Total cached packages: {len(cached_packages)}")
        if cached_packages:
            cp.info("Cached packages:")
            for package in cached_packages:
                name = package.rsplit('_', 1)[0].replace('.installed', '')
                cp.info(f"  - {name}")

    def _cache_package(self, package_name: str):
        """Mark package as installed in cache"""
        with open(self._get_package_cache_path(package_name), 'w') as f:
            f.write(datetime.now().isoformat())

    def _find_penv_python(self) -> List[Tuple[str, str]]:
        """Find all Python and pip executables in penv directories"""
        python_paths = []
        
        for item in os.listdir(self.root_dir):
            if item.startswith('penv'):
                penv_dir = os.path.join(self.root_dir, item)
                if sys.platform == 'win32':
                    python_path = os.path.join(penv_dir, 'Scripts', 'python.exe')
                    pip_path = os.path.join(penv_dir, 'Scripts', 'pip.exe')
                else:
                    python_path = os.path.join(penv_dir, 'bin', 'python')  # 先尝试 python3
                    pip_path = os.path.join(penv_dir, 'bin', 'pip')
                
                if os.path.exists(python_path) and os.path.exists(pip_path):
                    cp.info(f"Found Python environment: {python_path}")
                    python_paths.append((python_path, pip_path))
        
        if not python_paths:
            cp.warning("No penv Python environments found")
        else:
            cp.info(f"Found {len(python_paths)} Python environment(s)")
        
        return python_paths

    def _get_pip_command(self) -> Tuple[str, str]:
        """Get Python and pip command to use"""
        penv_results = self._find_penv_python()
        
        cp.info("\nSearching for Python environments:")
        
        # Try each Python environment
        for python_path, pip_path in penv_results:
            try:
                # Test if this Python environment works
                cp.info(f"Testing Python environment:")
                cp.info(f"  Python: {python_path}")
                cp.info(f"  Pip: {pip_path}")
                
                # Get Python version
                version_result = subprocess.run(
                    [python_path, "--version"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True
                )
                cp.info(f"  Version: {version_result.stdout.strip()}")
                
                # Test Python
                subprocess.run(
                    [python_path, "-c", "print('test')"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True
                )
                
                cp.success(f"\nSelected Python environment:")
                cp.success(f"  Python: {python_path}")
                cp.success(f"  Pip: {pip_path}")
                cp.success(f"  Version: {version_result.stdout.strip()}")
                return python_path, pip_path
                
            except subprocess.CalledProcessError:
                cp.warning(f"Python environment not working: {python_path}")
                continue
            except Exception as e:
                cp.warning(f"Error testing Python environment {python_path}: {str(e)}")
                continue
        
        # If no working penv found, use system Python
        system_python = sys.executable
        system_pip = f'"{system_python}" -m pip'
        
        try:
            # Get system Python version
            version_result = subprocess.run(
                [system_python, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            cp.info(f"\nUsing system Python:")
            cp.info(f"  Python: {system_python}")
            cp.info(f"  Pip: {system_pip}")
            cp.info(f"  Version: {version_result.stdout.strip()}")
        except Exception as e:
            cp.warning(f"Error getting system Python version: {str(e)}")
        
        return system_python, system_pip

    def _check_package_installed(self, package: str) -> bool:
        """Check if a package is installed using pip list"""
        python_cmd, pip_cmd = self._get_pip_command()
        try:
            # Get package name without version
            package_name = package.split('==')[0].lower()
            
            # Use pip list to check if package is installed
            result = subprocess.run(
                f'{pip_cmd} list --format=json',
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if result.returncode != 0:
                cp.error(f"Error checking package {package_name}: {result.stderr}")
                return False
            
            # Parse JSON output
            installed_packages = json.loads(result.stdout)
            
            # Check if package is in the list (case insensitive)
            for pkg in installed_packages:
                if pkg['name'].lower() == package_name:
                    cp.info(f"Found installed package: {pkg['name']} (version {pkg['version']})")
                    return True
                
            cp.warning(f"Package not found: {package_name}")
            return False
            
        except Exception as e:
            cp.error(f"Error checking package {package}: {str(e)}")
            return False

    def _install_package(self, package: str) -> bool:
        """Install a single package"""
        _, pip_cmd = self._get_pip_command()
        mirror_arg = f"--index-url {self.mirror}" if self.mirror else ""
        return self._run_pip_command(f"{pip_cmd} install {package} {mirror_arg}")

    def _run_pip_command(self, command: str) -> bool:
        """Run a pip command"""
        try:
            cp.info(f"Running: {command}")
            process = subprocess.run(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            if process.returncode != 0:
                cp.error(f"Error: {process.stderr}")
                return False
            cp.success(process.stdout)
            return True
        except Exception as e:
            cp.error(f"Error executing command: {str(e)}")
            return False

    def _read_requirements(self) -> List[str]:
        """Read and clean requirements from file"""
        try:
            lines = self.file_reader.read_lines(self.requirements_file)
            return [line.strip() for line in lines if line.strip()]
        except Exception as e:
            cp.error(f"Error reading requirements: {str(e)}")
            return []

    def _install_requirements(self):
        """Install all required packages"""
        try:
            # Read requirements
            requirements = self._read_requirements()
            if not requirements:
                cp.warning("No requirements found or unable to read requirements file")
                return

            cp.info("\nChecking package status:")
            cp.info(f"Total requirements: {len(requirements)}")
            cp.info("Required packages:")
            for pkg in requirements:
                cp.info(f"  - {pkg}")

            # Find uncached packages
            uncached_packages = []
            for package in requirements:
                if not self._is_cached(package):
                    uncached_packages.append(package)

            if uncached_packages:
                cp.info("\nPackages to install:")
                for pkg in uncached_packages:
                    cp.info(f"  - {pkg}")
            else:
                cp.success("\nAll required packages are installed.")
                return

            # Upgrade pip first
            python_cmd, pip_cmd = self._get_pip_command()
            self._run_pip_command(f"{pip_cmd} install --upgrade pip")

            # Install uncached packages
            total = len(uncached_packages)
            for i, package in enumerate(uncached_packages, 1):
                cp.info(f"Installing package {i}/{total}: {package}")
                if self._install_package(package):
                    self._cache_package(package)
                    cp.success(f"Successfully installed {package}")
                else:
                    cp.error(f"Failed to install {package}")
                    return

            cp.success("All packages installed successfully")

        except Exception as e:
            cp.error(f"Error during package installation: {str(e)}")
# Check and install requirements, then run the application
if __name__ == "__main__":
    AutoInstallRequire()
