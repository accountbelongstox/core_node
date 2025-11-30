#!/usr/bin/env python3
"""
Factory Directory Analyzer
Analyzes compile_factory directory structure and provides detailed information about builds
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import re

class FactoryAnalyzer:
    """Analyzes compile_factory directory and provides build information"""

    def __init__(self, factory_path: str = "D:/programing/.build_dir/compile_factory"):
        self.factory_path = Path(factory_path)

    def is_in_temp_directory(self, current_path: str) -> bool:
        """Check if current path is within compile_factory temporary directory"""
        current_path = Path(current_path).resolve()
        return "compile_factory" in str(current_path)

    def parse_directory_name(self, dir_name: str) -> Optional[Dict[str, str]]:
        """Parse directory name to extract app name and timestamp"""
        # Pattern: app_name_YYYYMMDD_HHMMSS
        pattern = r'^(.+)_(\d{8}_\d{6})$'
        match = re.match(pattern, dir_name)

        if match:
            app_name = match.group(1)
            timestamp_str = match.group(2)
            try:
                timestamp = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                return {
                    'app_name': app_name,
                    'timestamp_str': timestamp_str,
                    'timestamp': timestamp,
                    'formatted_time': timestamp.strftime('%Y-%m-%d %H:%M:%S')
                }
            except ValueError:
                pass

        return None

    def has_cache_flag(self, dir_path: Path) -> bool:
        """Check if directory has .cache compilation flag"""
        return (dir_path / ".cache").exists()

    def get_directory_info(self, dir_path: Path) -> Dict:
        """Get basic information about a build directory"""
        info = {
            'path': str(dir_path),
            'name': dir_path.name,
            'exists': dir_path.exists(),
            'is_cached': False,
            'app_info': None
        }

        if not dir_path.exists():
            return info

        # Parse directory name
        info['app_info'] = self.parse_directory_name(dir_path.name)

        # Check cache flag - this is the only check we need
        info['is_cached'] = self.has_cache_flag(dir_path)

        return info

    def analyze_factory_directory(self) -> Dict[str, any]:
        """Analyze compile_factory directory - only scan first level subdirectories"""
        analysis = {
            'factory_exists': self.factory_path.exists(),
            'total_directories': 0,
            'apps': {},
            'directories': [],
            'total_cached': 0,
            'total_uncached': 0
        }

        if not self.factory_path.exists():
            return analysis

        # Get all directories in factory - only scan first level
        directories = []
        for item in self.factory_path.iterdir():
            if item.is_dir():
                dir_info = self.get_directory_info(item)
                directories.append(dir_info)

        # Sort by timestamp (newest first)
        directories.sort(key=lambda x: x['app_info']['timestamp'] if x['app_info'] else datetime.min, reverse=True)

        analysis['directories'] = directories
        analysis['total_directories'] = len(directories)

        # Group by app name
        apps = {}
        cached_count = 0
        uncached_count = 0

        for dir_info in directories:
            if dir_info['is_cached']:
                cached_count += 1
            else:
                uncached_count += 1

            if dir_info['app_info']:
                app_name = dir_info['app_info']['app_name']
                if app_name not in apps:
                    apps[app_name] = {
                        'name': app_name,
                        'directories': [],
                        'cached_count': 0,
                        'uncached_count': 0,
                        'newest_build': None
                    }

                apps[app_name]['directories'].append(dir_info)

                if dir_info['is_cached']:
                    apps[app_name]['cached_count'] += 1
                else:
                    apps[app_name]['uncached_count'] += 1

                # Track newest build
                if (apps[app_name]['newest_build'] is None or
                    dir_info['app_info']['timestamp'] > apps[app_name]['newest_build']['timestamp']):
                    apps[app_name]['newest_build'] = dir_info['app_info']

        analysis['apps'] = apps
        analysis['total_cached'] = cached_count
        analysis['total_uncached'] = uncached_count

        return analysis

    def print_factory_analysis(self, analysis: Dict[str, any], detailed: bool = False):
        """Print factory directory analysis"""
        print("\n[FACTORY-ANALYSIS] Compile Factory Directory Analysis")
        print("=" * 60)

        if not analysis['factory_exists']:
            print("[FACTORY-INFO] Compile factory directory does not exist")
            return

        print(f"[FACTORY-INFO] Factory Path: {self.factory_path}")
        print(f"[FACTORY-INFO] Total Directories: {analysis['total_directories']}")
        print(f"[FACTORY-INFO] Cached Builds: {analysis['total_cached']}")
        print(f"[FACTORY-INFO] Uncached Builds: {analysis['total_uncached']}")
        print()

        if analysis['total_directories'] == 0:
            print("[FACTORY-INFO] No build directories found")
            return

        # Print app-wise summary
        print("[FACTORY-APPS] Applications Summary:")
        print("-" * 50)

        for app_name, app_info in analysis['apps'].items():
            status_icon = "[C]" if app_info['cached_count'] > 0 else "[U]"
            print(f"{status_icon} {app_name}:")
            print(f"   Builds: {len(app_info['directories'])} (Cached: {app_info['cached_count']}, Uncached: {app_info['uncached_count']})")
            if app_info['newest_build']:
                print(f"   Latest: {app_info['newest_build']['formatted_time']}")
            print()

        # Print detailed directory listing only if requested or few directories
        if detailed or analysis['total_directories'] <= 10:
            print("[FACTORY-DIRS] All Build Directories:")
            print("-" * 50)

            for i, dir_info in enumerate(analysis['directories'], 1):
                cache_status = "[Y] Cached" if dir_info['is_cached'] else "[N] Uncached"

                if dir_info['app_info']:
                    time_info = dir_info['app_info']['formatted_time']
                    print(f"  {i:2d}. {dir_info['name']}")
                    print(f"      Status: {cache_status} | Time: {time_info}")
                else:
                    print(f"  {i:2d}. {dir_info['name']} (Invalid format)")
                    print(f"      Status: {cache_status}")
        else:
            print(f"[FACTORY-INFO] ({analysis['total_directories']} directories - use detailed mode to see full list)")

        print()