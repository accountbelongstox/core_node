#!/usr/bin/env python3
"""
Python Package Detector for Flutter Bloom Build System
Detects missing Python packages with optimized import checking
"""

import sys
from typing import Dict, List, Set

class FlutterBloomPackageDetector:
    """Package detector optimized for Flutter Bloom build system requirements"""

    def __init__(self):
        # Import name to pip install name mapping
        self.package_mapping = {
            'PIL': 'Pillow',
            'cv2': 'opencv-python',
            'yaml': 'PyYAML',
            'requests': 'requests',
            'numpy': 'numpy',
            'pandas': 'pandas',
            'matplotlib': 'matplotlib',
            'flask': 'Flask',
            'jinja2': 'Jinja2',
            'werkzeug': 'Werkzeug',
            'psutil': 'psutil',
            'pathvalidate': 'pathvalidate',
            'colorama': 'colorama'
        }

        # Core packages required for build system
        self.core_packages = [
            'PIL',      # Image processing for assets
            'yaml',     # Configuration parsing
            'requests', # Web requests
            'psutil'    # System monitoring
        ]

        # Optional packages that enhance functionality
        self.optional_packages = [
            'colorama',      # Terminal colors
            'pathvalidate'   # Path validation
        ]

        # All packages to check
        self.all_packages = self.core_packages + self.optional_packages

    def check_single_package(self, import_name: str) -> bool:
        """Fast import check for a single package"""
        try:
            __import__(import_name)
            return True
        except ImportError:
            return False

    def detect_missing_packages(self) -> List[str]:
        """Detect missing packages and return pip install names"""
        missing_pip_names = []

        for import_name in self.all_packages:
            if not self.check_single_package(import_name):
                pip_name = self.package_mapping.get(import_name, import_name)
                missing_pip_names.append(pip_name)

        return missing_pip_names

    def get_package_status(self) -> Dict[str, List[str]]:
        """Get complete package status breakdown"""
        installed = []
        missing = []

        for import_name in self.all_packages:
            pip_name = self.package_mapping.get(import_name, import_name)
            if self.check_single_package(import_name):
                installed.append(pip_name)
            else:
                missing.append(pip_name)

        return {
            'installed': installed,
            'missing': missing,
            'core_missing': [pkg for pkg in missing if self.package_mapping.get(pkg, pkg) in [self.package_mapping.get(core, core) for core in self.core_packages]],
            'optional_missing': [pkg for pkg in missing if pkg not in [self.package_mapping.get(core, core) for core in self.core_packages]]
        }

def main():
    """Command line interface - outputs only missing package names"""
    detector = FlutterBloomPackageDetector()
    missing_packages = detector.detect_missing_packages()

    # Output only missing package names for PowerShell consumption
    # No extra output to keep it clean for scripting
    for package in missing_packages:
        print(package)

if __name__ == "__main__":
    main()