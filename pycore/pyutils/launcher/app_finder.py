# -*- coding: utf-8 -*-
"""
Application Finder
Finds application executables in common installation directories
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class AppFinder:
    """Find application executables"""
    
    # Chrome-related constants (shared between chrome and chrome_beta)
    CHROME_EXE_NAMES = ['chrome.exe', 'GoogleChrome.exe']
    CHROME_SEARCH_PATHS = [
        'D:\\applications',
        'C:\\Users\\{username}\\AppData\\Local\\Programs',
        'C:\\Program Files\\Google\\Chrome',
        'C:\\Program Files (x86)\\Google\\Chrome'
    ]
    CHROME_STANDARD_PATHS = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ]
    CHROME_BETA_KEYWORDS = ['Beta', 'beta', 'BETA']
    CHROME_CANARY_KEYWORDS = ['Canary', 'canary', 'CANARY']
    CHROME_STABLE_KEYWORDS = ['Stable', 'stable', 'STABLE']
    CHROME_VERSION_KEYWORDS = {
        'canary': CHROME_CANARY_KEYWORDS,
        'stable': CHROME_STABLE_KEYWORDS,
        'beta': CHROME_BETA_KEYWORDS
    }
    
    # Application definitions
    APP_DEFINITIONS = {
        'chrome': {
            'names': CHROME_EXE_NAMES,
            'search_paths': CHROME_SEARCH_PATHS,
            'beta_keywords': CHROME_BETA_KEYWORDS,
            'version_keywords': CHROME_VERSION_KEYWORDS
        },
        'chrome_beta': {
            'names': CHROME_EXE_NAMES,
            'search_paths': CHROME_SEARCH_PATHS,
            'beta_keywords': CHROME_BETA_KEYWORDS,
            'version_keywords': {
                'beta': CHROME_BETA_KEYWORDS
            },
            'version': 'beta'  # Always beta for chrome_beta
        },
        'cursor': {
            'names': ['cursor.exe', 'Cursor.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Users\\{username}\\AppData\\Local\\Programs\\cursor'
            ]
        },
        'edge': {
            'names': ['msedge.exe', 'MicrosoftEdge.exe'],
            'search_paths': [
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application',
                'C:\\Program Files\\Microsoft\\Edge\\Application'
            ]
        },
        'wechat': {
            'names': ['Weixin.exe', 'WeChat.exe', 'wechat.exe'],
            'search_paths': [
                'C:\\Program Files\\Tencent\\Weixin',
                'D:\\applications',
                'C:\\Program Files\\Tencent\\WeChat',
                'C:\\Users\\{username}\\AppData\\Roaming\\Tencent\\WeChat'
            ]
        },
        'qq': {
            'names': ['QQ.exe', 'qq.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Program Files\\Tencent\\QQ',
                'C:\\Users\\{username}\\AppData\\Roaming\\Tencent\\QQ'
            ]
        },
        'notepad++': {
            'names': ['notepad++.exe', 'Notepad++.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Program Files\\Notepad++',
                'C:\\Program Files (x86)\\Notepad++'
            ]
        },
        'vscode': {
            'names': ['code.exe', 'Code.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Users\\{username}\\AppData\\Local\\Programs\\Microsoft VS Code',
                'C:\\Program Files\\Microsoft VS Code'
            ]
        }
    }
    
    def __init__(self, cache_path=None):
        """
        Initialize app finder
        
        Args:
            cache_path: Path to cache file
        """
        if cache_path is None:
            username = os.getenv('USERNAME') or os.getenv('USER')
            cache_dir = Path(f'C:\\Users\\{username}\\.core_node\\launch_multiple')
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path = cache_dir / 'app_cache.json'
        
        self.cache_path = Path(cache_path)
        self.cache = self.load_cache()
        self.username = os.getenv('USERNAME') or os.getenv('USER')
    
    def load_cache(self):
        """Load application cache"""
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_cache(self):
        """Save application cache"""
        try:
            with open(self.cache_path, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error: Failed to save cache: {e}")
            return False
    
    def expand_path(self, path):
        """Expand path with username"""
        return path.format(username=self.username)
    
    def find_app(self, app_name: str, force_refresh: bool = False) -> Optional[str]:
        """
        Find application executable
        
        Args:
            app_name: Application name
            force_refresh: Force refresh cache
        
        Returns:
            Path to executable or None
        """
        # Check cache first
        cache_key = f"{app_name}_path"
        if not force_refresh and cache_key in self.cache:
            cached_path = Path(self.cache[cache_key])
            if cached_path.exists():
                return str(cached_path)
        
        # Get app definition
        app_def = self.APP_DEFINITIONS.get(app_name)
        if not app_def:
            return None
        
        # Special handling for Chrome (multiple versions)
        if app_name == 'chrome':
            result = self.find_chrome_by_version('stable')
            if result:
                # Cache also under chrome_path for backward compatibility
                self.cache['chrome_path'] = result
                self.save_cache()
            return result
        
        # Special handling for Chrome Beta
        if app_name == 'chrome_beta':
            return self.find_chrome_by_version('beta')
        
        # Search for application
        search_paths = [self.expand_path(p) for p in app_def.get('search_paths', [])]
        exe_names = app_def.get('names', [])
        
        for search_path_str in search_paths:
            search_path = Path(search_path_str)
            if not search_path.exists():
                continue
            
            # Search recursively
            for exe_name in exe_names:
                found_path = self._search_recursive(search_path, exe_name)
                if found_path:
                    self.cache[cache_key] = str(found_path)
                    self.save_cache()
                    return str(found_path)
        
        return None
    
    def find_chrome_versions(self, force_refresh: bool = False) -> Dict[str, str]:
        """
        Find all Chrome versions and cache them
        
        Args:
            force_refresh: Force refresh cache
            
        Returns:
            Dictionary of version -> path mappings
        """
        all_versions = {}
        
        # Check cache for version-specific paths
        if not force_refresh:
            cached_versions = {}
            if 'chrome_canary' in self.cache:
                canary_path = Path(self.cache['chrome_canary'])
                if canary_path.exists():
                    cached_versions['canary'] = str(canary_path)
            if 'chrome_beta' in self.cache:
                beta_path = Path(self.cache['chrome_beta'])
                if beta_path.exists():
                    cached_versions['beta'] = str(beta_path)
            if 'chrome_stable' in self.cache:
                stable_path = Path(self.cache['chrome_stable'])
                if stable_path.exists():
                    cached_versions['stable'] = str(stable_path)
            
            # If all versions are cached and valid, return them
            if len(cached_versions) >= 1:
                return cached_versions
        
        # Search for all Chrome versions
        search_paths = [self.expand_path(p) for p in self.CHROME_SEARCH_PATHS]
        
        found_paths = {}  # Track all found paths to avoid duplicates
        
        for search_path_str in search_paths:
            search_path = Path(search_path_str)
            if not search_path.exists():
                continue
            
            # Search for Chrome executable
            try:
                for item in search_path.rglob(self.CHROME_EXE_NAMES[0]):
                    if str(item) in found_paths.values():
                        continue  # Skip duplicates
                    
                    folder = item.parent
                    folder_path_str = str(folder)
                    folder_lower = folder_path_str.lower()
                    
                    # Check version keywords - must check beta/canary BEFORE stable
                    has_canary = any(kw.lower() in folder_lower or kw in folder_path_str 
                                    for kw in self.CHROME_CANARY_KEYWORDS)
                    has_beta = any(kw.lower() in folder_lower or kw in folder_path_str 
                                  for kw in self.CHROME_BETA_KEYWORDS)
                    
                    if has_canary and 'canary' not in all_versions:
                        all_versions['canary'] = str(item)
                        self.cache['chrome_canary'] = str(item)
                        found_paths['canary'] = str(item)
                    elif has_beta and 'beta' not in all_versions:
                        all_versions['beta'] = str(item)
                        self.cache['chrome_beta'] = str(item)
                        found_paths['beta'] = str(item)
                    elif 'chrome' in folder_lower and 'stable' not in all_versions:
                        # Only mark as stable if it's clearly a Chrome path and not beta/canary
                        if not has_beta and not has_canary:
                            all_versions['stable'] = str(item)
                            self.cache['chrome_stable'] = str(item)
                            found_paths['stable'] = str(item)
            except (PermissionError, OSError):
                continue
        
        # Also search in standard locations (these are always stable)
        for std_path in self.CHROME_STANDARD_PATHS:
            if Path(std_path).exists() and 'stable' not in all_versions:
                all_versions['stable'] = std_path
                self.cache['chrome_stable'] = std_path
                found_paths['stable'] = std_path
        
        self.save_cache()
        
        return all_versions
    
    def find_chrome_by_version(self, version: str) -> Optional[str]:
        """
        Find Chrome by specific version
        
        Args:
            version: Version string (canary, stable, beta)
        
        Returns:
            Path to Chrome executable or None
        """
        cache_key = f'chrome_{version}'
        
        # Check cache first
        if cache_key in self.cache:
            cached_path = Path(self.cache[cache_key])
            if cached_path.exists():
                return str(cached_path)
        
        # Find all versions and cache them
        all_versions = self.find_chrome_versions(force_refresh=True)
        
        # Return the requested version
        return all_versions.get(version)
    
    def _search_recursive(self, search_path: Path, exe_name: str, max_depth: int = 5) -> Optional[Path]:
        """
        Recursively search for executable
        
        Args:
            search_path: Directory to search
            exe_name: Executable name to find
            max_depth: Maximum search depth
        
        Returns:
            Path to executable or None
        """
        if max_depth <= 0:
            return None
        
        try:
            # Check current directory
            exe_path = search_path / exe_name
            if exe_path.exists():
                return exe_path
            
            # Search subdirectories
            for item in search_path.iterdir():
                if item.is_dir():
                    result = self._search_recursive(item, exe_name, max_depth - 1)
                    if result:
                        return result
        except (PermissionError, OSError):
            pass
        
        return None
    
    def find_all_apps(self, force_refresh: bool = False) -> Dict[str, Optional[str]]:
        """
        Find all applications
        
        Args:
            force_refresh: Force refresh cache
        
        Returns:
            Dictionary of app_name -> exe_path
        """
        # First, find all Chrome versions to populate cache
        chrome_versions = self.find_chrome_versions(force_refresh)
        
        results = {}
        for app_name in self.APP_DEFINITIONS.keys():
            results[app_name] = self.find_app(app_name, force_refresh)
        
        return results

