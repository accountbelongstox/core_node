#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dependency Checker
Checks and installs required Python packages
"""

import subprocess
import sys
import importlib
from typing import Dict, List, Tuple


class DependencyChecker:
    """Checks and installs required Python packages"""
    
    def __init__(self):
        """Initialize dependency checker"""
        self.required_packages = {
            'psutil': 'psutil>=5.8.0',
            'win32gui': 'pywin32>=227',
            'win32api': 'pywin32>=227', 
            'win32con': 'pywin32>=227',
            'win32ui': 'pywin32>=227',
            'win32process': 'pywin32>=227',
            'PIL': 'Pillow>=8.0.0',
            'pywinauto': 'pywinauto>=0.6.8',
            'uiautomation': 'uiautomation>=2.0.15'
        }
        
        self.missing_packages = []
        self.installed_packages = []
    
    def check_package(self, package_name: str) -> bool:
        """Check if a package is installed"""
        try:
            importlib.import_module(package_name)
            return True
        except ImportError:
            return False
    
    def check_all_packages(self) -> Tuple[List[str], List[str]]:
        """Check all required packages"""
        missing = []
        installed = []
        
        for package_name, pip_name in self.required_packages.items():
            if self.check_package(package_name):
                installed.append(package_name)
            else:
                missing.append(pip_name)
        
        self.missing_packages = missing
        self.installed_packages = installed
        
        return missing, installed
    
    def install_package(self, package_spec: str) -> bool:
        """Install a single package"""
        try:
            print(f"Installing {package_spec}...")
            result = subprocess.run(
                [sys.executable, '-m', 'pip', 'install', package_spec],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"Successfully installed {package_spec}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Failed to install {package_spec}: {e}")
            print(f"Error output: {e.stderr}")
            return False
    
    def install_missing_packages(self) -> bool:
        """Install all missing packages"""
        if not self.missing_packages:
            print("All packages are already installed!")
            return True
        
        print(f"Installing {len(self.missing_packages)} missing packages...")
        
        success_count = 0
        for package_spec in self.missing_packages:
            if self.install_package(package_spec):
                success_count += 1
        
        if success_count == len(self.missing_packages):
            print("[OK] Package installation completed successfully")
            return True
        else:
            print(f"[WARNING] Only {success_count}/{len(self.missing_packages)} packages installed successfully")
            return False
    
    def run_dependency_check(self) -> bool:
        """Run complete dependency check and installation"""
        print("Step 2: Dependency Check")
        print("------------------------")
        print("Checking required Python packages...")
        
        missing, installed = self.check_all_packages()
        
        print(f"Checked: {len(self.required_packages)}, Missing: {len(missing)}", end="")
        
        if missing:
            print(f" Installing missing packages...")
            return self.install_missing_packages()
        else:
            print(" All packages are installed.")
            print("All packages are already installed!")
            print("[OK] Package installation completed successfully")
            return True


def main():
    """Main function for standalone execution"""
    checker = DependencyChecker()
    success = checker.run_dependency_check()
    
    if not success:
        print("[ERROR] Dependency check failed")
        sys.exit(1)
    else:
        print("[SUCCESS] All dependencies are satisfied")


if __name__ == "__main__":
    main()
