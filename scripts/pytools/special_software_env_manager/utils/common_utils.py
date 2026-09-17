#!/usr/bin/env python3
"""
Common Utilities Module

Provides common utility functions and classes used across the special software environment manager.
"""

import os
import sys
import platform
from pathlib import Path
from typing import List, Dict, Any, Optional


class ColorMessage:
    """Provides colored console output functionality"""
    
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    GRAY = '\033[90m'
    WHITE = '\033[97m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    
    _color_map = {
        'success': GREEN,
        'error': RED,
        'warning': YELLOW,
        'info': CYAN,
        'white': WHITE,
        'gray': GRAY,
        'blue': BLUE,
    }
    
    @staticmethod
    def write(message: str, msg_type: str = 'white', no_newline: bool = False):
        """Write a colored message to console
        
        Args:
            message: Message text to display
            msg_type: Type of message ('success', 'error', 'warning', 'info', 'white', 'gray', 'blue')
            no_newline: If True, don't add newline at the end
        """
        color = ColorMessage._color_map.get(msg_type.lower(), ColorMessage.WHITE)
        if no_newline:
            print(f"{color}{message}{ColorMessage.RESET}", end='', flush=True)
        else:
            print(f"{color}{message}{ColorMessage.RESET}")


def clear_screen():
    """Clear the console screen"""
    if platform.system() == 'Windows':
        os.system('cls')
    else:
        os.system('clear')


def is_admin() -> bool:
    """Check if the script is running with administrator/root privileges
    
    Returns:
        True if running as admin/root, False otherwise
    """
    try:
        if platform.system() == 'Windows':
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        else:
            return os.geteuid() == 0
    except Exception:
        return False


def safe_write_secret(file_path: Path, content: str) -> None:
    """Safely write secret content to file without BOM

    Args:
        file_path: Path to the file to write
        content: Content to write (will be encoded as UTF-8 without BOM)

    Raises:
        OSError: If file cannot be written
    """
    # Ensure content is string
    if not isinstance(content, str):
        content = str(content)

    # Encode to UTF-8 bytes without BOM
    content_bytes = content.encode('utf-8')

    # Write as bytes to ensure no BOM is added
    file_path.write_bytes(content_bytes)


def safe_read_secret(file_path: Path) -> str:
    """Safely read secret content from file, removing BOM if present

    Args:
        file_path: Path to the file to read

    Returns:
        File content with BOM removed (if present)

    Raises:
        OSError: If file cannot be read
        UnicodeDecodeError: If file is not valid UTF-8
    """
    # Read as bytes first
    raw_bytes = file_path.read_bytes()

    # Remove UTF-8 BOM if present (EF BB BF)
    if raw_bytes[:3] == b'\xef\xbb\xbf':
        raw_bytes = raw_bytes[3:]

    # Decode to string
    content = raw_bytes.decode('utf-8')

    # Additional safety check for string-level BOM (should not occur)
    if content and content[0] == '\ufeff':
        content = content[1:]

    return content


def get_project_root() -> Path:
    """Get project root directory by finding from current script location
    
    Returns:
        Path to project root directory
    """
    # Get the directory of the current file (common_utils.py)
    current_file = Path(__file__).resolve()
    # Navigate up: utils -> special_software_env_manager -> pytools -> scripts -> core_node
    current_dir = current_file.parent.parent.parent.parent.parent
    
    # Verify it's the project root by checking for common root indicators
    root_indicators = ['main.js', 'package.json', 'pycore', 'scripts', 'poly_apps']
    if any((current_dir / indicator).exists() for indicator in root_indicators):
        return current_dir
    
    # Fallback: go up one more level if needed
    parent = current_dir.parent
    if any((parent / indicator).exists() for indicator in root_indicators):
        return parent
    
    # Final fallback
    return current_dir


def get_winenvs_dir() -> Path:
    """Get Windows environment scripts directory
    
    Returns:
        Path to winenvs directory
    """
    project_root = get_project_root()
    return project_root / 'scripts' / 'winenvs'


def get_linuxenvs_dir() -> Path:
    """Get Linux environment scripts directory
    
    Returns:
        Path to linuxenvs directory
    """
    project_root = get_project_root()
    return project_root / 'scripts' / 'linuxenvs'


def ensure_directory_exists(directory_path: str) -> bool:
    """Ensure a directory exists, creating it if necessary
    
    Args:
        directory_path: Path to directory
        
    Returns:
        True if directory exists or was created, False otherwise
    """
    try:
        path = Path(directory_path)
        path.mkdir(parents=True, exist_ok=True)
        return True
    except Exception:
        return False


def get_platform_type() -> str:
    """Get the platform type string
    
    Returns:
        Platform type: 'windows', 'wsl', 'ubuntu_desktop', 'linux_server', or 'linux'
    """
    system = platform.system()
    
    if system == 'Windows':
        # Check if running in WSL
        if 'microsoft' in platform.uname().release.lower() or 'wsl' in platform.uname().release.lower():
            return 'wsl'
        return 'windows'
    else:
        # Linux variants
        try:
            # Check for desktop environment
            if os.environ.get('DISPLAY') or os.environ.get('XDG_SESSION_TYPE') == 'x11':
                # Try to detect Ubuntu
                if os.path.exists('/etc/os-release'):
                    with open('/etc/os-release', 'r') as f:
                        content = f.read().lower()
                        if 'ubuntu' in content:
                            return 'ubuntu_desktop'
                return 'linux'
            else:
                # Server environment
                return 'linux_server'
        except Exception:
            pass
        
        return 'linux'


def show_menu(title: str, menu_items: List[Dict[str, Any]], tips: Optional[List[str]] = None) -> Optional[str]:
    """Display a number-input menu (no arrow-key navigation)
    
    Args:
        title: Menu title
        menu_items: List of menu item dictionaries with 'Text', 'Action', and optionally 'HasSubMenu'
        tips: Optional tip lines shown under the title (redrawn each frame)
        
    Returns:
        Selected action string, or None when the user goes back/cancels
        (b / q / 0; empty input just redraws)
    """
    if not menu_items:
        return None

    while True:
        # Clear screen and redraw menu
        clear_screen()
        print()
        ColorMessage.write("=" * 60, 'info')
        ColorMessage.write(title, 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        if tips:
            for tip in tips:
                ColorMessage.write(tip, 'info')
            print()

        # Display menu items
        for i, item in enumerate(menu_items):
            text = item.get('Text', '')
            has_submenu = item.get('HasSubMenu', False)
            submenu_indicator = " >" if has_submenu else ""
            ColorMessage.write(f"  [{i+1}] {text}{submenu_indicator}", 'white')

        print()
        ColorMessage.write(
            "Type a number and press ENTER to select, B to go back, 0 or Q to cancel: ",
            'info', no_newline=True)
        sys.stdout.flush()

        try:
            choice = input().strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return None

        if not choice:
            continue

        lowered = choice.lower()
        if lowered in ('b', 'back', 'q', '0'):
            return None

        try:
            choice_num = int(choice)
        except ValueError:
            ColorMessage.write("Invalid input. Press Enter to continue...", 'error')
            input()
            continue

        if 1 <= choice_num <= len(menu_items):
            return menu_items[choice_num - 1].get('Action')

        ColorMessage.write("Invalid choice. Press Enter to continue...", 'error')
        input()


__all__ = [
    'ColorMessage',
    'clear_screen',
    'is_admin',
    'get_project_root',
    'get_winenvs_dir',
    'get_linuxenvs_dir',
    'ensure_directory_exists',
    'get_platform_type',
    'show_menu'
]
