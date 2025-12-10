#!/usr/bin/env python3
"""
Common Utilities Module

Provides common utility functions and classes used across the special software environment manager.
"""

import os
import sys
import platform
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

# Try to import platform-specific modules
try:
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False

try:
    import termios
    import tty
    HAS_TERMIOS = True
except ImportError:
    HAS_TERMIOS = False


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


def _get_key_input():
    """Get a single key input with arrow key support for Windows and Linux"""
    if HAS_MSVCRT and os.name == 'nt':  # Windows
        # Wait for a key press
        while True:
            if msvcrt.kbhit():
                key = msvcrt.getch()
                # Handle special keys (arrows) - Windows uses \xe0 or \x00 prefix
                if key == b'\xe0' or key == b'\x00':
                    # Get the second byte for arrow keys
                    key2 = msvcrt.getch()
                    arrow_map = {
                        b'H': 'up',      # Up arrow
                        b'P': 'down',    # Down arrow
                        b'K': 'left',    # Left arrow
                        b'M': 'right'    # Right arrow
                    }
                    result = arrow_map.get(key2, '')
                    if result:
                        return result
                elif key == b'\r':  # Enter
                    return 'enter'
                elif key == b'\x1b':  # ESC
                    return 'esc'
                elif key == b'\x08':  # Backspace
                    return 'backspace'
                elif key == b'0':
                    return '0'
                elif key == b'q' or key == b'Q':
                    return 'q'
                else:
                    try:
                        char = key.decode('utf-8', errors='ignore').lower()
                        if char and (char.isdigit() or char.isalpha()):
                            return char
                    except:
                        pass
            # Small delay to avoid busy waiting
            time.sleep(0.01)
    elif HAS_TERMIOS:  # Linux/Mac
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            key = sys.stdin.read(1)
            if key == '\x1b':  # ESC sequence
                key += sys.stdin.read(2)
                if key == '\x1b[A':  # Up arrow
                    return 'up'
                elif key == '\x1b[B':  # Down arrow
                    return 'down'
                elif key == '\x1b[C':  # Right arrow
                    return 'right'
                elif key == '\x1b[D':  # Left arrow
                    return 'left'
                else:
                    return 'esc'
            elif key == '\n' or key == '\r':  # Enter
                return 'enter'
            elif key == '0':
                return '0'
            elif key == 'q' or key == 'Q':
                return 'q'
            else:
                return key.lower()
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    else:
        # Fallback: use simple input
        return input().strip().lower()


def show_menu(title: str, menu_items: List[Dict[str, Any]]) -> Optional[str]:
    """Display an interactive menu with arrow key navigation
    
    Args:
        title: Menu title
        menu_items: List of menu item dictionaries with 'Text', 'Action', and optionally 'HasSubMenu'
        
    Returns:
        Selected action string, or None if cancelled
    """
    if not menu_items:
        return None
    
    selected_index = 0
    
    # Check if we can use interactive mode (arrow keys)
    use_arrow_keys = (HAS_MSVCRT and os.name == 'nt') or HAS_TERMIOS
    
    while True:
        # Clear screen and redraw menu
        clear_screen()
        print()
        ColorMessage.write("=" * 60, 'info')
        ColorMessage.write(title, 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        
        # Display menu items with clear selection indicator
        for i, item in enumerate(menu_items):
            text = item.get('Text', '')
            action = item.get('Action', '')
            has_submenu = item.get('HasSubMenu', False)
            
            submenu_indicator = " >" if has_submenu else ""
            
            if i == selected_index:
                # Highlight selected item with > indicator
                ColorMessage.write(f"> [{i+1}] {text}{submenu_indicator}", 'yellow')
            else:
                ColorMessage.write(f"  [{i+1}] {text}{submenu_indicator}", 'white')
        
        print()
        
        if use_arrow_keys:
            ColorMessage.write("Use UP/DOWN arrows to navigate, ENTER to select, 0 or Q to cancel", 'info')
            # Flush output to ensure menu is displayed before waiting for input
            sys.stdout.flush()
        else:
            ColorMessage.write("Enter your choice (or 0 to cancel): ", 'info', no_newline=True)
            sys.stdout.flush()
        
        if use_arrow_keys:
            key = _get_key_input()
            
            if key == 'up':
                if selected_index == 0:
                    selected_index = len(menu_items) - 1  # 从顶部循环到底部
                else:
                    selected_index = selected_index - 1
                continue
            elif key == 'down':
                if selected_index == len(menu_items) - 1:
                    selected_index = 0  # 从底部循环到顶部
                else:
                    selected_index = selected_index + 1
                continue
            elif key == 'enter':
                selected_item = menu_items[selected_index]
                return selected_item.get('Action')
            elif key == 'esc' or key == '0' or key == 'q':
                return None
            elif key and key.isdigit():
                # Allow direct number input
                choice_num = int(key)
                if 1 <= choice_num <= len(menu_items):
                    selected_item = menu_items[choice_num - 1]
                    return selected_item.get('Action')
        else:
            # Fallback to simple input
            try:
                choice = input().strip()
                
                if choice == '0' or choice.lower() == 'q':
                    return None
                
                choice_num = int(choice)
                if 1 <= choice_num <= len(menu_items):
                    selected_item = menu_items[choice_num - 1]
                    return selected_item.get('Action')
                else:
                    ColorMessage.write("Invalid choice. Press Enter to continue...", 'error')
                    input()
            except ValueError:
                ColorMessage.write("Invalid input. Press Enter to continue...", 'error')
                input()
            except KeyboardInterrupt:
                print()
                return None
            except Exception as e:
                ColorMessage.write(f"Error: {e}", 'error')
                input()
                return None


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

