#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dependency Manager for Video Processing
Automatically checks and installs required packages
"""

import sys
import subprocess
import importlib
from pathlib import Path
from typing import List, Dict, Tuple


class DependencyManager:
    """Manages dependencies for video processing solutions"""
    
    def __init__(self):
        self.installed_packages = {}
        self._check_pip_available()
    
    def _check_pip_available(self):
        """Check if pip is available"""
        print("Checking pip availability...")
        subprocess.run([sys.executable, '-m', 'pip', '--version'])
        print("✓ pip is available")
    
    def _is_package_installed(self, package_name: str) -> bool:
        """Check if a package is installed"""
        # Clear cache if package was previously marked as not installed
        if package_name in self.installed_packages and not self.installed_packages[package_name]:
            # Remove from cache to re-check after potential installation
            del self.installed_packages[package_name]
            # Clear import cache
            if package_name in sys.modules:
                del sys.modules[package_name]
        
        if package_name in self.installed_packages:
            return self.installed_packages[package_name]
        
        try:
            importlib.import_module(package_name)
            self.installed_packages[package_name] = True
            return True
        except ImportError:
            self.installed_packages[package_name] = False
            return False
    
    def _install_package(self, package_name: str, pip_name: str = None):
        """Install a package using pip with real-time output"""
        if pip_name is None:
            pip_name = package_name
        
        print(f"\nInstalling {pip_name}...")
        print("-" * 60)
        # Run without capture_output to show real-time output
        subprocess.run([sys.executable, '-m', 'pip', 'install', pip_name])
        print("-" * 60)
        
        # Clear cache to allow re-import after installation
        if package_name in sys.modules:
            del sys.modules[package_name]
        if package_name in self.installed_packages:
            del self.installed_packages[package_name]
    
    def _install_from_requirements(self, requirements_file: Path):
        """Install packages from requirements.txt file with real-time output"""
        if not requirements_file.exists():
            print(f"Warning: Requirements file not found: {requirements_file}")
            return
        
        print(f"\nInstalling packages from {requirements_file}...")
        print("-" * 60)
        # Run without capture_output to show real-time output
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', str(requirements_file)])
        print("-" * 60)
    
    def ensure_packages(self, packages: List[Dict[str, str]], requirements_file: Path = None):
        """
        Ensure all required packages are installed
        
        Args:
            packages: List of dicts with 'module' (import name) and 'pip' (pip package name)
            requirements_file: Optional path to requirements.txt file
        """
        # First, try installing from requirements file if provided
        if requirements_file and requirements_file.exists():
            self._install_from_requirements(requirements_file)
            # Clear all caches after installing from requirements
            self.installed_packages.clear()
            for package_info in packages:
                module_name = package_info.get('module')
                if module_name in sys.modules:
                    del sys.modules[module_name]
        
        # Check and install individual packages
        missing_packages = []
        for package_info in packages:
            module_name = package_info.get('module')
            pip_name = package_info.get('pip', module_name)
            
            if not self._is_package_installed(module_name):
                missing_packages.append({'module': module_name, 'pip': pip_name})
        
        # Install missing packages
        if missing_packages:
            print(f"\nInstalling {len(missing_packages)} missing package(s)...")
            for package_info in missing_packages:
                self._install_package(package_info['module'], package_info['pip'])
        
        # Verify all packages are now available (force re-check)
        print("\nVerifying installed packages...")
        for package_info in packages:
            module_name = package_info['module']
            # Force re-check by clearing cache
            if module_name in self.installed_packages:
                del self.installed_packages[module_name]
            if module_name in sys.modules:
                del sys.modules[module_name]
            
            # Final verification by attempting import
            if not self._is_package_installed(module_name):
                print(f"✗ Package {module_name} is not available after installation")
                print(f"  Please install it manually: pip install {package_info.get('pip', module_name)}")
                sys.exit(1)
            else:
                # Successfully verified, import it to ensure it works
                importlib.import_module(module_name)
                print(f"✓ Package {module_name} is available")
        
        print("✓ All required packages are available and verified")
    
    def check_system_command(self, command: str) -> bool:
        """Check if a system command is available by attempting to import/use it"""
        # Try to run the command and check if it exists
        # We use capture_output to suppress output during check
        try:
            subprocess.run([command, '--version'], 
                         capture_output=True,
                         timeout=5)
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    def ensure_system_command(self, command: str, install_instructions: str = None):
        """Ensure a system command is available"""
        print(f"Checking {command} availability...")
        if self.check_system_command(command):
            print(f"✓ {command} is available")
        else:
            print(f"✗ {command} is not available")
            if install_instructions:
                print(f"  Installation instructions:\n{install_instructions}")
            else:
                print(f"  Please install {command} manually")


def setup_solution1_dependencies():
    """Setup dependencies for Solution 1"""
    print("=" * 60)
    print("Setting up dependencies for Solution 1")
    print("=" * 60)
    
    manager = DependencyManager()
    
    # Get requirements file path
    current_dir = Path(__file__).parent.parent
    requirements_file = current_dir / "solution1" / "requirements.txt"
    
    # Define required packages
    packages = [
        {'module': 'faster_whisper', 'pip': 'faster-whisper'},
        {'module': 'edge_tts', 'pip': 'edge-tts'},
    ]
    
    # Ensure packages are installed (will exit if failed)
    manager.ensure_packages(packages, requirements_file)
    
    # Check FFmpeg
    manager.ensure_system_command(
        'ffmpeg',
        "Windows: https://ffmpeg.org/download.html\n"
        "Linux: sudo apt-get install ffmpeg\n"
        "macOS: brew install ffmpeg"
    )
    
    print("=" * 60)
    print("Dependency setup completed for Solution 1")
    print("=" * 60)
    print()


def setup_solution2_dependencies():
    """Setup dependencies for Solution 2"""
    print("=" * 60)
    print("Setting up dependencies for Solution 2")
    print("=" * 60)
    
    manager = DependencyManager()
    
    # Get requirements file path
    current_dir = Path(__file__).parent.parent
    requirements_file = current_dir / "solution2" / "requirements.txt"
    
    # Define required packages
    packages = [
        {'module': 'whisperx', 'pip': 'whisperx'},
        {'module': 'torch', 'pip': 'torch'},
        {'module': 'moviepy', 'pip': 'moviepy'},
    ]
    
    # Ensure packages are installed (will exit if failed)
    manager.ensure_packages(packages, requirements_file)
    
    # Check FFmpeg
    manager.ensure_system_command(
        'ffmpeg',
        "Windows: https://ffmpeg.org/download.html\n"
        "Linux: sudo apt-get install ffmpeg\n"
        "macOS: brew install ffmpeg"
    )
    
    print("=" * 60)
    print("Dependency setup completed for Solution 2")
    print("=" * 60)
    print()

