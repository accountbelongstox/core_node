"""
Common Utilities Module

Provides shared functions and utilities used across all menu modules.
Replaces the functionality from spacial_common_menu.ps1
"""

import os
import re
import platform
import sys
import io
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

# Ensure UTF-8 encoding for Windows console output
if platform.system() == 'Windows':
    try:
        # Only wrap if not already wrapped and buffer exists
        if hasattr(sys.stdout, 'buffer') and not isinstance(sys.stdout, io.TextIOWrapper):
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
        if hasattr(sys.stderr, 'buffer') and not isinstance(sys.stderr, io.TextIOWrapper):
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    except (AttributeError, ValueError):
        # If wrapping fails, continue without UTF-8 wrapper
        pass


class ColorMessage:
    """Provides colored console output for different message types"""

    COLORS = {
        'error': '\033[91m',     # Red
        'warning': '\033[93m',   # Yellow
        'success': '\033[92m',   # Green
        'info': '\033[96m',      # Cyan
        'reset': '\033[0m'       # Reset
    }

    @staticmethod
    def write(message: str, msg_type: str = 'info', no_newline: bool = False):
        """Write colored message to console"""
        try:
            color = ColorMessage.COLORS.get(msg_type.lower(), ColorMessage.COLORS['reset'])
            end_char = '' if no_newline else '\n'
            print(f"{color}{message}{ColorMessage.COLORS['reset']}", end=end_char, flush=True)
        except UnicodeEncodeError:
            # Fallback: strip ANSI codes and print plain text
            print(message, end=end_char, flush=True)


def is_admin() -> bool:
    """Check if the script is running with administrator/root privileges"""
    try:
        if platform.system() == 'Windows':
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        else:
            return os.geteuid() == 0
    except:
        return False


def get_platform_type() -> str:
    """
    Detect the specific platform type

    Returns:
        'windows', 'wsl', 'ubuntu_desktop', 'linux_server', or 'linux'
    """
    system = platform.system()

    if system == 'Windows':
        return 'windows'

    # Check for WSL
    try:
        with open('/proc/version', 'r') as f:
            version_info = f.read().lower()
            if 'microsoft' in version_info or 'wsl' in version_info:
                return 'wsl'
    except:
        pass

    # Check for Linux Desktop vs Server
    if system == 'Linux':
        # Check if running on Ubuntu
        is_ubuntu = False
        try:
            with open('/etc/os-release', 'r') as f:
                os_info = f.read().lower()
                if 'ubuntu' in os_info:
                    is_ubuntu = True
        except:
            pass

        # Check for desktop environment
        has_display = os.environ.get('DISPLAY') is not None
        has_desktop = os.environ.get('XDG_CURRENT_DESKTOP') is not None

        if has_display or has_desktop:
            if is_ubuntu:
                return 'ubuntu_desktop'
            return 'linux_desktop'
        else:
            return 'linux_server'

    return 'linux'


def is_wsl() -> bool:
    """Check if running under WSL"""
    return get_platform_type() == 'wsl'


def is_desktop() -> bool:
    """Check if running on a desktop environment"""
    platform_type = get_platform_type()
    return platform_type in ['ubuntu_desktop', 'linux_desktop']


def is_server() -> bool:
    """Check if running on a server environment"""
    return get_platform_type() == 'linux_server'


def convert_wsl_path(windows_path: str) -> str:
    """
    Convert Windows path to WSL path
    C:\\path\\to\\file -> /mnt/c/path/to/file
    """
    if not windows_path:
        return windows_path

    # Handle drive letter
    if len(windows_path) >= 2 and windows_path[1] == ':':
        drive = windows_path[0].lower()
        path = windows_path[2:].replace('\\', '/')
        return f'/mnt/{drive}{path}'

    return windows_path.replace('\\', '/')


def convert_path_for_platform(path: str, target_platform: str = None) -> str:
    """
    Convert path to the appropriate format for the target platform

    Args:
        path: Original path
        target_platform: Target platform type (if None, uses current platform)

    Returns:
        Converted path
    """
    if target_platform is None:
        target_platform = get_platform_type()

    if target_platform == 'wsl':
        # If path looks like Windows path, convert it
        if len(path) >= 2 and path[1] == ':':
            return convert_wsl_path(path)
    elif target_platform == 'windows':
        # If path looks like WSL path, convert back
        if path.startswith('/mnt/'):
            parts = path[5:].split('/', 1)
            if len(parts) >= 1:
                drive = parts[0].upper()
                rest = parts[1] if len(parts) > 1 else ''
                return f"{drive}:\\{rest.replace('/', '\\')}"

    return path


def test_string_has_whitespace_in_middle(input_string: str) -> bool:
    """Check if string has whitespace in the middle"""
    trimmed = input_string.strip()
    if len(trimmed) != len(input_string):
        return True
    if re.search(r'\s', input_string):
        return True
    if re.search(r'[\r\n]', input_string):
        return True
    return False


def extract_api_url_and_token(input_text: str) -> Dict[str, Any]:
    """
    Extract API URLs and tokens from multi-line input

    Returns dictionary with:
    - ApiUrls: List of URLs found
    - Tokens: List of tokens found (length > 37)
    - AccessKeyIds: List of access key IDs (16+ uppercase alphanumeric)
    - CleanedText: Cleaned input text
    - TotalSegments: Number of segments found
    """
    cleaned_text = re.sub(r'\r\n|\r|\n', ' ', input_text)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
    cleaned_text = cleaned_text.strip()

    tokens_list = [t.strip() for t in re.split(r'[\s\n\r]+', cleaned_text) if t.strip()]

    api_urls = []
    found_tokens = []
    access_key_ids = []

    for token in tokens_list:
        if re.match(r'^https?://', token):
            api_urls.append(token)
        elif re.match(r'^[A-Z0-9]{16,}$', token):
            access_key_ids.append(token)
        elif len(token) > 37:
            found_tokens.append(token)

    return {
        'ApiUrls': api_urls,
        'Tokens': found_tokens,
        'AccessKeyIds': access_key_ids,
        'CleanedText': cleaned_text,
        'TotalSegments': len(tokens_list)
    }


def get_default_value_for_variable(variable: Dict[str, Any], user_input_values: Dict[str, str]) -> Optional[str]:
    """Get default value for a variable from user inputs or environment"""
    if 'DefaultValue' in variable and variable['DefaultValue']:
        default_var_name = variable['DefaultValue']

        if default_var_name in user_input_values:
            return user_input_values[default_var_name]

        default_value = os.environ.get(default_var_name)
        if default_value:
            return default_value

    return None


def ensure_directory_exists(directory_path: str) -> bool:
    """Ensure directory exists, create if it doesn't"""
    try:
        Path(directory_path).mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        ColorMessage.write(f"Failed to create directory: {e}", 'error')
        return False


def get_project_root() -> Path:
    """Get the project root directory"""
    current_file = Path(__file__)
    pytools_dir = current_file.parent.parent
    scripts_dir = pytools_dir.parent
    return scripts_dir.parent


def get_winenvs_dir() -> Path:
    """Get the Windows environment scripts directory"""
    return get_project_root() / 'scripts' / 'winenvs'


def get_linuxenvs_dir() -> Path:
    """Get the Linux environment scripts directory"""
    return get_project_root() / 'scripts' / 'liunxenvs'


def clear_screen():
    """Clear the console screen"""
    try:
        if platform.system() == 'Windows':
            # Use ANSI escape codes for better compatibility
            print('\033[2J\033[H', end='', flush=True)
            # Fallback to cls if ANSI doesn't work
            os.system('cls')
        else:
            # Use ANSI escape codes for Linux/Mac
            print('\033[2J\033[H', end='', flush=True)
    except:
        # Final fallback
        os.system('cls' if platform.system() == 'Windows' else 'clear')


def get_key_press():
    """Get a single key press from user"""
    if platform.system() == 'Windows':
        import msvcrt
        return msvcrt.getch().decode('utf-8')
    else:
        import sys
        import tty
        import termios
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(sys.stdin.fileno())
            ch = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return ch


def get_arrow_key():
    """Get arrow key input (cross-platform) - blocks until valid key is pressed"""
    if platform.system() == 'Windows':
        import msvcrt
        import time

        # Block and wait for valid key press
        while True:
            try:
                if msvcrt.kbhit():
                    first_key = msvcrt.getch()

                    # Check for special key prefix (0xe0 or 0x00)
                    if first_key in (b'\xe0', b'\x00'):
                        # Arrow keys and function keys
                        second_key = msvcrt.getch()
                        if second_key == b'H':
                            return 'up'
                        elif second_key == b'P':
                            return 'down'
                        elif second_key == b'K':
                            return 'left'
                        elif second_key == b'M':
                            return 'right'
                        # Ignore other special keys, continue waiting

                    # Check for Enter key
                    elif first_key == b'\r':
                        return 'enter'

                    # Check for ESC key
                    elif first_key == b'\x1b':
                        return 'esc'

                    # Ignore all other keys and continue waiting

                else:
                    # Small sleep to avoid busy-waiting
                    time.sleep(0.01)

            except Exception as e:
                # On error, wait a bit and continue
                time.sleep(0.01)

    else:
        # Linux/Mac implementation
        import sys
        import tty
        import termios
        import select

        input_stream = sys.stdin
        close_stream = False

        if not sys.stdin.isatty():
            try:
                input_stream = open('/dev/tty')
                close_stream = True
            except OSError:
                input_stream = sys.stdin

        fd = input_stream.fileno()
        old_settings = termios.tcgetattr(fd)

        try:
            tty.setraw(fd)

            while True:
                ch = input_stream.read(1)

                if ch == '\x1b':  # ESC sequence
                    ready, _, _ = select.select([fd], [], [], 0.5)
                    if not ready:
                        return 'esc'

                    second = input_stream.read(1)
                    if not second:
                        return 'esc'

                    if second in ('[', 'O'):
                        ready, _, _ = select.select([fd], [], [], 0.5)
                        if not ready:
                            return 'esc'

                        third = input_stream.read(1)
                        if third == 'A':
                            return 'up'
                        if third == 'B':
                            return 'down'
                        if third == 'C':
                            return 'right'
                        if third == 'D':
                            return 'left'
                        return 'esc'

                    return 'esc'

                elif ch == '\r' or ch == '\n':
                    return 'enter'

                # Ignore other keys and continue waiting

        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            if close_stream:
                input_stream.close()


def show_menu(title: str, menu_items: List[Dict[str, Any]]) -> str:
    """
    Display an interactive menu and return the selected action

    Args:
        title: Menu title
        menu_items: List of dictionaries with 'Text' and 'Action' keys

    Returns:
        Action string of the selected item
    """
    selected_index = 0

    while True:
        clear_screen()

        # Print title and instructions
        ColorMessage.write(title, 'info')
        ColorMessage.write("Use Up/Down arrows to navigate, Enter to select", 'info')
        ColorMessage.write("=" * len(title), 'info')
        print()  # Add blank line for spacing

        # Print menu items
        for i, item in enumerate(menu_items):
            text = item['Text']
            has_submenu = item.get('HasSubMenu', False)

            if has_submenu:
                text = f"{text} >"

            if i == selected_index:
                # Selected item in yellow
                ColorMessage.write(f"> {text}", 'warning')
            else:
                # Non-selected item in default color
                print(f"  {text}", flush=True)

        # Force output flush
        sys.stdout.flush()

        # Get user input
        key = get_arrow_key()
        if key == 'up':
            selected_index = (selected_index - 1) % len(menu_items)
        elif key == 'down':
            selected_index = (selected_index + 1) % len(menu_items)
        elif key == 'enter':
            return menu_items[selected_index]['Action']
        # Ignore other keys and continue loop
