"""
Common Utilities Module

Provides shared functions and utilities used across all menu modules.
Replaces the functionality from spacial_common_menu.ps1
"""

import os
import re
import platform
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path


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
        color = ColorMessage.COLORS.get(msg_type.lower(), ColorMessage.COLORS['reset'])
        end_char = '' if no_newline else '\n'
        print(f"{color}{message}{ColorMessage.COLORS['reset']}", end=end_char)


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
    """Get arrow key input (cross-platform)"""
    if platform.system() == 'Windows':
        import msvcrt
        if msvcrt.kbhit():
            key = msvcrt.getch()
            if key == b'\xe0':  # Arrow key prefix
                key = msvcrt.getch()
                if key == b'H':
                    return 'up'
                elif key == b'P':
                    return 'down'
                elif key == b'K':
                    return 'left'
                elif key == b'M':
                    return 'right'
            elif key == b'\r':
                return 'enter'
        return None
    else:
        import sys
        import tty
        import termios
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(sys.stdin.fileno())
            ch = sys.stdin.read(1)
            if ch == '\x1b':  # ESC
                ch = sys.stdin.read(2)
                if ch == '[A':
                    return 'up'
                elif ch == '[B':
                    return 'down'
                elif ch == '[D':
                    return 'left'
                elif ch == '[C':
                    return 'right'
            elif ch == '\r' or ch == '\n':
                return 'enter'
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return None


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
        ColorMessage.write(title, 'info')
        ColorMessage.write("Use Up/Down arrows to navigate, Enter to select", 'info')
        ColorMessage.write("=" * len(title), 'info')

        for i, item in enumerate(menu_items):
            text = item['Text']
            has_submenu = item.get('HasSubMenu', False)

            if i == selected_index:
                indicator = '> '
                color = 'warning'  # Yellow for selected
            else:
                indicator = '  '
                color = 'reset'

            if has_submenu:
                text = f"{text} >"

            if color == 'warning':
                ColorMessage.write(f"{indicator}{text}", color)
            else:
                print(f"{indicator}{text}")

        key = get_arrow_key()
        if key == 'up':
            selected_index = (selected_index - 1) % len(menu_items)
        elif key == 'down':
            selected_index = (selected_index + 1) % len(menu_items)
        elif key == 'enter':
            return menu_items[selected_index]['Action']
