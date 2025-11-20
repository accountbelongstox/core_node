#!/usr/bin/env python3
"""
Browser Finder Utilities

Automatically find Chrome, Edge, Firefox browser executables and their WebDrivers.
Ported from puppeteer_spider_v2 EdgeFinder.js and ChromeFinder.js
"""

import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Optional, List, Dict
from pycore import ColorPrint


class BrowserFinder:
    """Base browser finder class"""

    def __init__(self):
        """Initialize browser finder"""
        self.platform = platform.system()
        self.paths = self.get_search_paths()

    def get_search_paths(self) -> List[str]:
        """Get platform-specific search paths - override in subclass"""
        raise NotImplementedError

    def find(self) -> Optional[str]:
        """
        Find browser executable

        Returns:
            Path to browser executable or None
        """
        ColorPrint.blue(f"Searching for {self.__class__.__name__} executable...")

        # Step 1: Try which command (Linux/macOS)
        if self.platform in ['Linux', 'Darwin']:
            which_path = self.find_with_which()
            if which_path:
                return which_path

        # Step 2: Check common paths
        for browser_path in self.paths:
            if os.path.exists(browser_path):
                ColorPrint.green(f"Found browser: {browser_path}")
                return browser_path

        # Step 3: Scan common directories
        scanned_path = self.scan_common_directories()
        if scanned_path:
            return scanned_path

        # Step 4: Wide range search
        wide_search_path = self.wide_range_search()
        if wide_search_path:
            return wide_search_path

        ColorPrint.yellow(f"{self.__class__.__name__} executable not found")
        return None

    def find_with_which(self) -> Optional[str]:
        """Find browser using which command"""
        raise NotImplementedError

    def scan_common_directories(self) -> Optional[str]:
        """Scan common directories for browser"""
        raise NotImplementedError

    def wide_range_search(self) -> Optional[str]:
        """Wide range search for browser"""
        raise NotImplementedError

    def is_valid_path(self, path: str) -> bool:
        """Check if path is valid browser executable"""
        if not os.path.exists(path):
            return False

        if not os.path.isfile(path):
            return False

        return self.is_executable(path)

    def is_executable(self, file_path: str) -> bool:
        """Check if file is executable"""
        if self.platform == 'Windows':
            return file_path.lower().endswith('.exe')
        else:
            return os.access(file_path, os.X_OK)

    def get_version(self, browser_path: Optional[str] = None) -> Optional[str]:
        """Get browser version"""
        if not browser_path:
            browser_path = self.find()

        if not browser_path:
            return None

        result = subprocess.run(
            [browser_path, '--version'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            return result.stdout.strip()

        return None


class EdgeFinder(BrowserFinder):
    """Find Microsoft Edge browser"""

    def get_search_paths(self) -> List[str]:
        """Get Edge search paths"""
        paths = []

        if self.platform == 'Windows':
            username = os.environ.get('USERNAME', '')
            paths.extend([
                r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
                f'C:\\Users\\{username}\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
                r'D:\applications\Microsoft\Edge\Application\msedge.exe',
                r'D:\applications\Edge\Application\msedge.exe',
                r'D:\applications\msedge.exe',
                f'C:\\Users\\{username}\\AppData\\Local\\Microsoft\\Edge Beta\\Application\\msedge.exe',
                f'C:\\Users\\{username}\\AppData\\Local\\Microsoft\\Edge Dev\\Application\\msedge.exe'
            ])
        elif self.platform == 'Linux':
            paths.extend([
                '/usr/bin/microsoft-edge',
                '/usr/bin/microsoft-edge-stable',
                '/snap/bin/microsoft-edge',
                '/usr/bin/microsoft-edge-beta',
                '/usr/bin/microsoft-edge-dev',
                '/opt/microsoft/msedge/msedge',
                '/opt/microsoft/msedge-beta/msedge',
                '/opt/microsoft/msedge-dev/msedge',
                '/usr/local/bin/microsoft-edge',
                '/usr/local/bin/microsoft-edge-stable'
            ])
        elif self.platform == 'Darwin':
            paths.extend([
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta',
                '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev'
            ])

        return paths

    def find_with_which(self) -> Optional[str]:
        """Find Edge using which command"""
        commands = ['microsoft-edge', 'microsoft-edge-stable', 'msedge', 'edge']
        for cmd in commands:
            result = subprocess.run(
                ['which', cmd],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                path = result.stdout.strip()
                if path and os.path.exists(path):
                    ColorPrint.green(f"Found Edge via which: {path}")
                    return path

        return None

    def scan_common_directories(self) -> Optional[str]:
        """Scan common directories for Edge"""
        common_dirs = []

        if self.platform == 'Windows':
            username = os.environ.get('USERNAME', '')
            common_dirs.extend([
                r'C:\Program Files\Microsoft',
                r'C:\Program Files (x86)\Microsoft',
                r'D:\applications',
                r'D:\applications\Microsoft',
                f'C:\\Users\\{username}\\AppData\\Local\\Microsoft'
            ])
        elif self.platform == 'Linux':
            user = os.environ.get('USER', '')
            common_dirs.extend([
                '/usr/bin',
                '/usr/local/bin',
                '/opt',
                '/snap/bin',
                f'/home/{user}/.local/bin'
            ])
        elif self.platform == 'Darwin':
            common_dirs.extend([
                '/Applications',
                '/usr/local/bin',
                '/opt/homebrew/bin'
            ])

        for dir_path in common_dirs:
            if os.path.exists(dir_path):
                found = self.scan_directory_for_edge(dir_path)
                if found:
                    return found

        return None

    def scan_directory_for_edge(self, dir_path: str, depth: int = 0, max_depth: int = 3) -> Optional[str]:
        """Recursively scan directory for Edge"""
        if depth > max_depth:
            return None

        for item in os.listdir(dir_path):
            item_path = os.path.join(dir_path, item)

            if os.path.isdir(item_path):
                if self.should_search_subdirectory(item):
                    found = self.scan_directory_for_edge(item_path, depth + 1, max_depth)
                    if found:
                        return found
            elif os.path.isfile(item_path):
                if self.is_edge_executable(item):
                    if self.is_valid_path(item_path):
                        ColorPrint.green(f"Found Edge via scan: {item_path}")
                        return item_path

        return None

    def should_search_subdirectory(self, dir_name: str) -> bool:
        """Check if should search subdirectory"""
        edge_keywords = ['edge', 'microsoft', 'msedge']
        return any(keyword in dir_name.lower() for keyword in edge_keywords)

    def is_edge_executable(self, file_name: str) -> bool:
        """Check if file is Edge executable"""
        edge_names = ['msedge.exe', 'microsoft-edge', 'edge']
        return any(name in file_name.lower() for name in edge_names)

    def wide_range_search(self) -> Optional[str]:
        """Wide range search for Edge"""
        ColorPrint.blue("Performing wide range search for Edge...")

        if self.platform == 'Windows':
            return self.wide_range_search_windows()
        elif self.platform == 'Linux':
            return self.wide_range_search_linux()
        elif self.platform == 'Darwin':
            return self.wide_range_search_macos()

        return None

    def wide_range_search_windows(self) -> Optional[str]:
        """Windows wide range search"""
        result = subprocess.run(
            ['where', 'msedge'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            paths = result.stdout.strip().split('\n')
            for path in paths:
                path = path.strip()
                if path and self.is_valid_path(path):
                    return path

        return None

    def wide_range_search_linux(self) -> Optional[str]:
        """Linux wide range search"""
        commands = [
            'find /usr -name "*edge*" -type f 2>/dev/null',
            'find /opt -name "*edge*" -type f 2>/dev/null',
            'find /snap -name "*edge*" -type f 2>/dev/null'
        ]

        for cmd in commands:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode == 0:
                paths = result.stdout.strip().split('\n')
                for path in paths:
                    path = path.strip()
                    if path and self.is_valid_path(path):
                        return path

        return None

    def wide_range_search_macos(self) -> Optional[str]:
        """macOS wide range search"""
        commands = [
            'find /Applications -name "*Edge*" -type f 2>/dev/null',
            'find /usr/local -name "*edge*" -type f 2>/dev/null',
            'find /opt/homebrew -name "*edge*" -type f 2>/dev/null'
        ]

        for cmd in commands:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode == 0:
                paths = result.stdout.strip().split('\n')
                for path in paths:
                    path = path.strip()
                    if path and self.is_valid_path(path):
                        return path

        return None


class ChromeFinder(BrowserFinder):
    """Find Google Chrome browser"""

    def get_search_paths(self) -> List[str]:
        """Get Chrome search paths"""
        paths = []

        if self.platform == 'Windows':
            username = os.environ.get('USERNAME', '')
            paths.extend([
                r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
                f'C:\\Users\\{username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
                r'D:\applications\Google\Chrome\Application\chrome.exe',
                r'D:\applications\Chrome\Application\chrome.exe',
                r'D:\applications\chrome.exe',
                f'C:\\Users\\{username}\\AppData\\Local\\Google\\Chrome Beta\\Application\\chrome.exe',
                f'C:\\Users\\{username}\\AppData\\Local\\Google\\Chrome Dev\\Application\\chrome.exe',
                f'C:\\Users\\{username}\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe'
            ])
        elif self.platform == 'Linux':
            paths.extend([
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/usr/bin/google-chrome-beta',
                '/usr/bin/google-chrome-dev',
                '/snap/bin/chromium',
                '/opt/google/chrome/chrome',
                '/opt/google/chrome-beta/chrome',
                '/opt/google/chrome-dev/chrome',
                '/usr/local/bin/google-chrome',
                '/usr/local/bin/chromium'
            ])
        elif self.platform == 'Darwin':
            paths.extend([
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
                '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev',
                '/Applications/Chromium.app/Contents/MacOS/Chromium'
            ])

        return paths

    def find_with_which(self) -> Optional[str]:
        """Find Chrome using which command"""
        commands = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium', 'chrome']
        for cmd in commands:
            result = subprocess.run(
                ['which', cmd],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                path = result.stdout.strip()
                if path and os.path.exists(path):
                    ColorPrint.green(f"Found Chrome via which: {path}")
                    return path

        return None

    def scan_common_directories(self) -> Optional[str]:
        """Scan common directories for Chrome"""
        common_dirs = []

        if self.platform == 'Windows':
            username = os.environ.get('USERNAME', '')
            common_dirs.extend([
                r'C:\Program Files\Google',
                r'C:\Program Files (x86)\Google',
                r'D:\applications',
                r'D:\applications\Google',
                f'C:\\Users\\{username}\\AppData\\Local\\Google'
            ])
        elif self.platform == 'Linux':
            user = os.environ.get('USER', '')
            common_dirs.extend([
                '/usr/bin',
                '/usr/local/bin',
                '/opt',
                '/snap/bin',
                f'/home/{user}/.local/bin'
            ])
        elif self.platform == 'Darwin':
            common_dirs.extend([
                '/Applications',
                '/usr/local/bin',
                '/opt/homebrew/bin'
            ])

        for dir_path in common_dirs:
            if os.path.exists(dir_path):
                found = self.scan_directory_for_chrome(dir_path)
                if found:
                    return found

        return None

    def scan_directory_for_chrome(self, dir_path: str, depth: int = 0, max_depth: int = 3) -> Optional[str]:
        """Recursively scan directory for Chrome"""
        if depth > max_depth:
            return None

        for item in os.listdir(dir_path):
            item_path = os.path.join(dir_path, item)

            if os.path.isdir(item_path):
                if self.should_search_subdirectory(item):
                    found = self.scan_directory_for_chrome(item_path, depth + 1, max_depth)
                    if found:
                        return found
            elif os.path.isfile(item_path):
                if self.is_chrome_executable(item):
                    if self.is_valid_path(item_path):
                        ColorPrint.green(f"Found Chrome via scan: {item_path}")
                        return item_path

        return None

    def should_search_subdirectory(self, dir_name: str) -> bool:
        """Check if should search subdirectory"""
        chrome_keywords = ['chrome', 'google', 'chromium']
        return any(keyword in dir_name.lower() for keyword in chrome_keywords)

    def is_chrome_executable(self, file_name: str) -> bool:
        """Check if file is Chrome executable"""
        chrome_names = ['chrome.exe', 'chrome', 'google-chrome', 'chromium']
        return any(name in file_name.lower() for name in chrome_names)

    def wide_range_search(self) -> Optional[str]:
        """Wide range search for Chrome"""
        ColorPrint.blue("Performing wide range search for Chrome...")

        if self.platform == 'Windows':
            return self.wide_range_search_windows()
        elif self.platform == 'Linux':
            return self.wide_range_search_linux()
        elif self.platform == 'Darwin':
            return self.wide_range_search_macos()

        return None

    def wide_range_search_windows(self) -> Optional[str]:
        """Windows wide range search"""
        result = subprocess.run(
            ['where', 'chrome'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            paths = result.stdout.strip().split('\n')
            for path in paths:
                path = path.strip()
                if path and self.is_valid_path(path):
                    return path

        return None

    def wide_range_search_linux(self) -> Optional[str]:
        """Linux wide range search"""
        commands = [
            'find /usr -name "*chrome*" -type f 2>/dev/null',
            'find /opt -name "*chrome*" -type f 2>/dev/null',
            'find /snap -name "*chrome*" -type f 2>/dev/null'
        ]

        for cmd in commands:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode == 0:
                paths = result.stdout.strip().split('\n')
                for path in paths:
                    path = path.strip()
                    if path and self.is_valid_path(path):
                        return path

        return None

    def wide_range_search_macos(self) -> Optional[str]:
        """macOS wide range search"""
        commands = [
            'find /Applications -name "*Chrome*" -type f 2>/dev/null',
            'find /usr/local -name "*chrome*" -type f 2>/dev/null',
            'find /opt/homebrew -name "*chrome*" -type f 2>/dev/null'
        ]

        for cmd in commands:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode == 0:
                paths = result.stdout.strip().split('\n')
                for path in paths:
                    path = path.strip()
                    if path and self.is_valid_path(path):
                        return path

        return None


# Browser to driver mapping
BROWSER_DRIVER_MAP = {
    'chrome': {
        'finder': ChromeFinder,
        'driver_name': 'chromedriver',
        'driver_executable': 'chromedriver.exe' if platform.system() == 'Windows' else 'chromedriver'
    },
    'edge': {
        'finder': EdgeFinder,
        'driver_name': 'msedgedriver',
        'driver_executable': 'msedgedriver.exe' if platform.system() == 'Windows' else 'msedgedriver'
    }
}


def find_browser(browser_type: str = 'edge') -> Optional[str]:
    """
    Find browser executable

    Args:
        browser_type: Browser type (chrome, edge, firefox)

    Returns:
        Path to browser executable or None
    """
    browser_info = BROWSER_DRIVER_MAP.get(browser_type.lower())
    if not browser_info:
        ColorPrint.red(f"Unsupported browser type: {browser_type}")
        return None

    finder_class = browser_info['finder']
    finder = finder_class()
    return finder.find()


def find_driver(browser_type: str = 'edge') -> Optional[str]:
    """
    Find WebDriver executable

    Args:
        browser_type: Browser type (chrome, edge, firefox)

    Returns:
        Path to driver executable or None
    """
    browser_info = BROWSER_DRIVER_MAP.get(browser_type.lower())
    if not browser_info:
        ColorPrint.red(f"Unsupported browser type: {browser_type}")
        return None

    driver_executable = browser_info['driver_executable']

    # Check system PATH
    driver_path = shutil.which(driver_executable.replace('.exe', ''))
    if driver_path:
        ColorPrint.green(f"Found driver in PATH: {driver_path}")
        return driver_path

    # Check common locations
    if platform.system() == 'Windows':
        common_paths = [
            f'D:\\drivers\\{driver_executable}',
            f'C:\\drivers\\{driver_executable}',
        ]
    else:
        common_paths = [
            f'/usr/local/bin/{driver_executable}',
            f'/usr/bin/{driver_executable}',
        ]

    for path in common_paths:
        if os.path.exists(path):
            ColorPrint.green(f"Found driver at: {path}")
            return path

    ColorPrint.yellow(f"Driver not found: {driver_executable}")
    return None
