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
        try:
            subprocess.run([sys.executable, '-m', 'pip', '--version'], 
                         check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Error: pip is not available. Please install pip first.")
            sys.exit(1)
    
    def _is_package_installed(self, package_name: str) -> bool:
        """Check if a package is installed"""
        if package_name in self.installed_packages:
            return self.installed_packages[package_name]
        
        try:
            importlib.import_module(package_name)
            self.installed_packages[package_name] = True
            return True
        except ImportError:
            self.installed_packages[package_name] = False
            return False
    
    def _install_package(self, package_name: str, pip_name: str = None) -> bool:
        """Install a package using pip"""
        if pip_name is None:
            pip_name = package_name
        
        print(f"Installing {pip_name}...")
        try:
            subprocess.run(
                [sys.executable, '-m', 'pip', 'install', pip_name],
                check=True,
                capture_output=True
            )
            print(f"✓ Successfully installed {pip_name}")
            self.installed_packages[package_name] = True
            return True
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to install {pip_name}: {e}")
            return False
    
    def _install_from_requirements(self, requirements_file: Path) -> bool:
        """Install packages from requirements.txt file"""
        if not requirements_file.exists():
            print(f"Warning: Requirements file not found: {requirements_file}")
            return False
        
        print(f"Installing packages from {requirements_file}...")
        try:
            subprocess.run(
                [sys.executable, '-m', 'pip', 'install', '-r', str(requirements_file)],
                check=True,
                capture_output=True
            )
            print(f"✓ Successfully installed packages from {requirements_file}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to install packages from {requirements_file}: {e}")
            return False
    
    def ensure_packages(self, packages: List[Dict[str, str]], requirements_file: Path = None) -> bool:
        """
        Ensure all required packages are installed
        
        Args:
            packages: List of dicts with 'module' (import name) and 'pip' (pip package name)
            requirements_file: Optional path to requirements.txt file
        
        Returns:
            True if all packages are available, False otherwise
        """
        # First, try installing from requirements file if provided
        if requirements_file and requirements_file.exists():
            self._install_from_requirements(requirements_file)
        
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
        
        # Verify all packages are now available
        all_available = True
        for package_info in packages:
            module_name = package_info['module']
            if not self._is_package_installed(module_name):
                print(f"✗ Package {module_name} is still not available after installation attempt")
                all_available = False
        
        if all_available:
            print("✓ All required packages are available")
        
        return all_available
    
    def check_system_command(self, command: str) -> bool:
        """Check if a system command is available"""
        try:
            subprocess.run([command, '--version'], 
                         check=True, capture_output=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
    
    def ensure_system_command(self, command: str, install_instructions: str = None):
        """Ensure a system command is available"""
        if self.check_system_command(command):
            print(f"✓ {command} is available")
            return True
        else:
            print(f"✗ {command} is not available")
            if install_instructions:
                print(f"  Installation instructions: {install_instructions}")
            else:
                print(f"  Please install {command} manually")
            return False


def setup_solution1_dependencies():
    """Setup dependencies for Solution 1"""
    manager = DependencyManager()
    
    # Get requirements file path
    current_dir = Path(__file__).parent.parent
    requirements_file = current_dir / "solution1" / "requirements.txt"
    
    # Define required packages
    packages = [
        {'module': 'faster_whisper', 'pip': 'faster-whisper'},
        {'module': 'edge_tts', 'pip': 'edge-tts'},
    ]
    
    # Ensure packages are installed
    if not manager.ensure_packages(packages, requirements_file):
        print("Failed to install required packages for Solution 1")
        sys.exit(1)
    
    # Check FFmpeg
    if not manager.ensure_system_command(
        'ffmpeg',
        "Windows: https://ffmpeg.org/download.html\n"
        "Linux: sudo apt-get install ffmpeg\n"
        "macOS: brew install ffmpeg"
    ):
        print("Warning: FFmpeg is not available. Video processing may fail.")
    
    return True


def setup_solution2_dependencies():
    """Setup dependencies for Solution 2"""
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
    
    # Ensure packages are installed
    if not manager.ensure_packages(packages, requirements_file):
        print("Failed to install required packages for Solution 2")
        sys.exit(1)
    
    # Check FFmpeg
    if not manager.ensure_system_command(
        'ffmpeg',
        "Windows: https://ffmpeg.org/download.html\n"
        "Linux: sudo apt-get install ffmpeg\n"
        "macOS: brew install ffmpeg"
    ):
        print("Warning: FFmpeg is not available. Video processing may fail.")
    
    return True

