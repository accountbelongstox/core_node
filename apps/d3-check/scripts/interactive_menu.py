"""
Interactive Menu Library
Reusable menu system with arrow key navigation and caching support
"""

import os
import sys
import json
from pathlib import Path
from typing import List, Dict, Optional, Callable

# Platform-specific imports for arrow key handling
if os.name == 'nt':  # Windows
    import msvcrt
else:  # Unix/Linux/Mac
    import tty
    import termios


class InteractiveMenu:
    """Reusable interactive menu with arrow key navigation and caching"""

    def __init__(self, cache_file: Optional[Path] = None):
        """
        Initialize menu system

        Args:
            cache_file: Path to cache file for persistent selections
        """
        self.cache_file = cache_file
        self.cache = self._load_cache()

    def _load_cache(self) -> Dict:
        """Load cache from file"""
        if self.cache_file and self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"[WARNING] Failed to load cache: {e}")
        return {}

    def _save_cache(self):
        """Save cache to file"""
        if self.cache_file:
            try:
                # Create parent directory if needed
                self.cache_file.parent.mkdir(parents=True, exist_ok=True)
                with open(self.cache_file, 'w', encoding='utf-8') as f:
                    json.dump(self.cache, f, indent=2)
            except Exception as e:
                print(f"[WARNING] Failed to save cache: {e}")

    @staticmethod
    def get_key():
        """Get keyboard input (cross-platform)"""
        if os.name == 'nt':  # Windows
            while True:
                if msvcrt.kbhit():
                    key = msvcrt.getch()
                    # Handle special keys (arrows)
                    if key == b'\xe0' or key == b'\x00':
                        key = msvcrt.getch()
                        if key == b'H':  # Up arrow
                            return 'up'
                        elif key == b'P':  # Down arrow
                            return 'down'
                    elif key == b'\r':  # Enter
                        return 'enter'
                    elif key == b'\x1b':  # ESC
                        return 'esc'
                    elif key == b' ':  # Space
                        return 'space'
                    else:
                        try:
                            return key.decode('utf-8')
                        except:
                            pass
        else:  # Unix/Linux/Mac
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            try:
                tty.setraw(sys.stdin.fileno())
                ch = sys.stdin.read(1)
                if ch == '\x1b':  # ESC sequence
                    ch2 = sys.stdin.read(1)
                    if ch2 == '[':
                        ch3 = sys.stdin.read(1)
                        if ch3 == 'A':
                            return 'up'
                        elif ch3 == 'B':
                            return 'down'
                    else:
                        return 'esc'
                elif ch == '\r' or ch == '\n':
                    return 'enter'
                elif ch == ' ':
                    return 'space'
                else:
                    return ch
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return None

    def show_single_select_menu(self, title: str, items: List[str],
                                cache_key: str, default_index: int = 0) -> int:
        """
        Show single-select menu

        Args:
            title: Menu title
            items: List of menu items
            cache_key: Key for caching selection
            default_index: Default selection if no cache

        Returns:
            Selected index
        """
        # Get cached selection
        current_index = self.cache.get(cache_key, default_index)

        # Ensure valid index
        if not (0 <= current_index < len(items)):
            current_index = default_index

        def render_menu():
            """Render menu to screen"""
            os.system('cls' if os.name == 'nt' else 'clear')

            print("\n" + "="*70)
            print(f"  {title}")
            print("="*70)
            print()

            for idx, item in enumerate(items):
                # Current cursor position
                cursor = ">>>" if idx == current_index else "   "
                # Cached selection marker
                marker = "[*]" if idx == current_index else "   "

                print(f"{cursor} {marker} {idx}. {item}")

            print()
            print("Controls: ↑/↓ Navigate | ENTER Select | 0-9 Jump to item")
            print()

        # Initial render
        render_menu()

        # Navigation loop
        while True:
            key = self.get_key()

            if key == 'up':
                current_index = (current_index - 1) % len(items)
                render_menu()

            elif key == 'down':
                current_index = (current_index + 1) % len(items)
                render_menu()

            elif key == 'enter':
                # Save to cache and return
                self.cache[cache_key] = current_index
                self._save_cache()
                return current_index

            elif key and key.isdigit():
                # Direct jump to item
                num = int(key)
                if 0 <= num < len(items):
                    current_index = num
                    render_menu()

    def show_multi_select_menu(self, title: str, items: List[str],
                               cache_key: str, default_indices: List[int] = None) -> List[int]:
        """
        Show multi-select menu

        Args:
            title: Menu title
            items: List of menu items
            cache_key: Key for caching selections
            default_indices: Default selections if no cache

        Returns:
            List of selected indices
        """
        # Get cached selections
        if default_indices is None:
            default_indices = []

        selected_indices = self.cache.get(cache_key, default_indices.copy())

        # Ensure valid indices
        selected_indices = [idx for idx in selected_indices if 0 <= idx < len(items)]

        # If no valid selections, use defaults
        if not selected_indices and default_indices:
            selected_indices = default_indices.copy()

        current_index = selected_indices[0] if selected_indices else 0

        def render_menu():
            """Render menu to screen"""
            os.system('cls' if os.name == 'nt' else 'clear')

            print("\n" + "="*70)
            print(f"  {title}")
            print("="*70)
            print()

            for idx, item in enumerate(items):
                # Current cursor position
                cursor = ">>>" if idx == current_index else "   "
                # Selection marker
                marker = "[X]" if idx in selected_indices else "[ ]"

                print(f"{cursor} {marker} {idx}. {item}")

            print()
            print(f"Selected: {len(selected_indices)} item(s)")
            print("Controls: ↑/↓ Navigate | SPACE Toggle | ENTER Confirm | ESC Cancel | 0-9 Jump")
            print()

        # Initial render
        render_menu()

        # Navigation loop
        while True:
            key = self.get_key()

            if key == 'up':
                current_index = (current_index - 1) % len(items)
                render_menu()

            elif key == 'down':
                current_index = (current_index + 1) % len(items)
                render_menu()

            elif key == 'space':
                # Toggle current item selection
                if current_index in selected_indices:
                    selected_indices.remove(current_index)
                else:
                    selected_indices.append(current_index)

                # Save to cache immediately
                self.cache[cache_key] = selected_indices
                self._save_cache()

                render_menu()

            elif key == 'enter':
                # Return selections (empty list if none selected)
                if not selected_indices:
                    # If nothing selected, select current item
                    selected_indices = [current_index]
                    self.cache[cache_key] = selected_indices
                    self._save_cache()

                return selected_indices

            elif key == 'esc':
                # Cancel and return cached/default selections
                return self.cache.get(cache_key, default_indices.copy())

            elif key and key.isdigit():
                # Direct jump to item
                num = int(key)
                if 0 <= num < len(items):
                    current_index = num
                    render_menu()

    def get_cached_value(self, cache_key: str, default=None):
        """Get cached value"""
        return self.cache.get(cache_key, default)

    def set_cached_value(self, cache_key: str, value):
        """Set cached value"""
        self.cache[cache_key] = value
        self._save_cache()

    def clear_cache(self):
        """Clear all cached values"""
        self.cache = {}
        self._save_cache()
