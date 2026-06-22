#!/usr/bin/env python3
"""
Interactive Menu Helper
Provides interactive menu functionality for build system
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from utils.image_processor import ImageProcessor
from shared.data_exchange.unified_variable_system import unified_vars

# Try to import commander, with fallback for different directory structures
try:
    from utils.commander import commander
except ImportError:
    try:
        # Fallback for when running as script
        script_dir = Path(__file__).parent
        sys.path.append(str(script_dir))
        from commander import commander
    except ImportError:
        commander = None

# Platform-specific imports for keyboard input
if os.name == 'nt':
    import msvcrt
else:
    try:
        import termios
        import tty
    except ImportError:
        termios = None
        tty = None

class MenuHelper:
    """Interactive menu helper for console applications"""

    def __init__(self, flutter_root_dir: Optional[Path] = None):
        self.selected_index = 0
        self.flutter_root_dir = flutter_root_dir or Path.cwd()
        self.image_processor = ImageProcessor(self.flutter_root_dir)

    def get_key(self) -> str:
        """Get a single keypress from user"""
        if os.name == 'nt':  # Windows
            key = msvcrt.getch()
            if key == b'\xe0':  # Arrow keys on Windows
                key = msvcrt.getch()
                if key == b'H':  # Up arrow
                    return 'up'
                elif key == b'P':  # Down arrow
                    return 'down'
                elif key == b'K':  # Left arrow
                    return 'left'
                elif key == b'M':  # Right arrow
                    return 'right'
            elif key == b'\r':  # Enter key
                return 'enter'
            elif key == b'\x1b':  # Escape key
                return 'escape'
            else:
                return key.decode('utf-8', errors='ignore')
        else:  # Unix/Linux/Mac
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            try:
                tty.setraw(sys.stdin.fileno())
                key = sys.stdin.read(1)
                if key == '\x1b':  # Escape sequence
                    key += sys.stdin.read(2)
                    if key == '\x1b[A':  # Up arrow
                        return 'up'
                    elif key == '\x1b[B':  # Down arrow
                        return 'down'
                    elif key == '\x1b[D':  # Left arrow
                        return 'left'
                    elif key == '\x1b[C':  # Right arrow
                        return 'right'
                elif key == '\r' or key == '\n':  # Enter key
                    return 'enter'
                elif key == '\x1b':  # Escape key
                    return 'escape'
                return key
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return ''

    def _load_menu_cache(self, cache_key: str, items: List) -> Dict:
        """Load cached menu state if available"""
        try:
            cached_json = unified_vars.get_file_variable(f"menu_cache_{cache_key}")
            if cached_json:
                print(f"[CACHE] Loading cached menu state for: {cache_key}")
                cached_data = json.loads(cached_json)
                if cached_data and isinstance(cached_data, dict):
                    # Apply cached state to items if the structure matches
                    cached_items = cached_data.get('items', [])
                    if len(cached_items) == len(items):
                        # Merge cached state with current items
                        for i, cached_item in enumerate(cached_items):
                            if isinstance(items[i], dict) and isinstance(cached_item, dict):
                                # Update compression mode and other cached properties
                                for key, value in cached_item.items():
                                    if key in ['compression_mode']:
                                        items[i][key] = value
                        return {
                            'items': items,
                            'selected_index': cached_data.get('selected_index', 0)
                        }
        except Exception as e:
            # Cache loading failed, continue without cache
            print(f"[CACHE] Failed to load menu cache for {cache_key}: {e}")
            pass
        return None

    def _save_menu_cache(self, cache_key: str, items: List, selected_index: int) -> None:
        """Save current menu state to cache"""
        try:
            cache_data = {
                'items': items,
                'selected_index': selected_index
            }
            cache_json = json.dumps(cache_data, ensure_ascii=False, indent=None)
            success = unified_vars.set_file_variable(f"menu_cache_{cache_key}", cache_json)
            if success:
                print(f"[CACHE] Saved menu state for: {cache_key}")
            else:
                print(f"[CACHE] Failed to save menu state for: {cache_key}")
        except Exception as e:
            # Cache saving failed, continue silently
            print(f"[CACHE] Exception saving menu cache for {cache_key}: {e}")
            pass

    def clear_screen(self):
        """Clear the console screen"""
        os.system('cls' if os.name == 'nt' else 'clear')

    def show_directory_menu(self, directories: List[Path], app_name: str, cache_key: str = None) -> Optional[Dict]:
        """Show interactive menu for directory selection with extended options"""
        # Always show menu, even if no directories exist (user can create new)
        
        # Memory array to track directories marked for deletion
        delete_memory = []

        # Prepare menu items
        menu_items = []
        menu_items.append({
            'display': f"[NEW] Create new directory for {app_name}",
            'value': None,
            'type': 'new',
            'action': 'continue'
        })

        for i, dir_path in enumerate(directories):
            # Check compilation flags
            has_compiled = (dir_path / ".compiled").exists()
            has_build_success = (dir_path / ".build_success").exists()

            # Determine status level
            if has_build_success:
                status_text = "[Build Success]"
                status_level = 2
            elif has_compiled:
                status_text = "[Compiled]"
                status_level = 1
            else:
                status_text = "[Not Compiled]"
                status_level = 0

            # Parse timestamp
            try:
                timestamp_str = dir_path.name.split('_')[-2] + '_' + dir_path.name.split('_')[-1]
                timestamp = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                time_display = timestamp.strftime('%m-%d %H:%M')
            except:
                time_display = "Unknown"

            menu_items.append({
                'display': f"{status_text} {dir_path.name} ({time_display})",
                'value': dir_path,
                'type': 'existing',
                'compiled': has_compiled,
                'build_success': has_build_success,
                'status_level': status_level,
                'action': 'continue'
            })

        def format_directory_item(item: Dict, index: int) -> str:
            if item['type'] == 'new':
                return item['display']
            else:
                status_level = item.get('status_level', 0)
                if status_level == 2:
                    status_indicator = "[*]"  # Build success
                elif status_level == 1:
                    status_indicator = "[+]"  # Compiled
                else:
                    status_indicator = "[ ]"  # Not compiled

                action_display = ""
                if item['action'] == 'continue':
                    action_display = " [Continue]"
                elif item['action'] == 'delete':
                    action_display = " [Delete]"
                elif item['action'] == 'open':
                    action_display = " [Open Dir]"

                return f"{status_indicator} {item['display']}{action_display}"

        def format_directory_details(item: Dict) -> str:
            if item['type'] == 'new':
                return ("Selection Info:\n"
                       "  → Will create a new temporary directory with timestamp\n"
                       "  → Full project copy will be performed\n"
                       "  → Empty directories will be cleaned up before copy")
            else:
                status_level = item.get('status_level', 0)
                status_info = ""
                if status_level == 2:
                    status_info = "  → Directory has successful build ([*] .build_success flag)"
                elif status_level == 1:
                    status_info = "  → Directory is compiled ([+] .compiled flag)"
                else:
                    status_info = "  → Directory is not compiled ([ ] no compilation flags)"

                action = item['action']
                action_info = ""
                if action == 'continue':
                    action_info = "  → Action: Continue - Smart copy and use this directory"
                elif action == 'delete':
                    action_info = "  → Action: Delete - Remove this directory permanently"
                elif action == 'open':
                    action_info = "  → Action: Open Directory - Open in file explorer"

                return f"Selection Info:\n{status_info}\n{action_info}"

        def toggle_directory_action(items: List[Dict], selected_index: int) -> str:
            selected_item = items[selected_index]
            if selected_item['type'] == 'existing':
                actions = ['continue', 'delete', 'open']
                current_index = actions.index(selected_item['action'])
                old_action = selected_item['action']
                
                # Right arrow moves forward, left arrow moves backward
                if hasattr(toggle_directory_action, '_direction'):
                    if toggle_directory_action._direction == 'right':
                        new_index = (current_index + 1) % len(actions)
                    else:  # left
                        new_index = (current_index - 1) % len(actions)
                    selected_item['action'] = actions[new_index]
                    
                    # Manage delete memory array
                    dir_path = selected_item['value']
                    if old_action == 'delete' and selected_item['action'] != 'delete':
                        # Remove from delete memory when changed away from delete
                        if dir_path in delete_memory:
                            delete_memory.remove(dir_path)
                    elif old_action != 'delete' and selected_item['action'] == 'delete':
                        # Add to delete memory when changed to delete
                        if dir_path not in delete_memory:
                            delete_memory.append(dir_path)
            return 'continue'

        def handle_directory_action(items: List[Dict], selected_index: int) -> str:
            selected_item = items[selected_index]
            action = selected_item['action']

            if selected_item['type'] == 'new':
                print(f"[MENU-SELECTION] Creating new directory for {app_name}")
                print()
                # Return special result to indicate new directory creation
                handle_directory_action._result = {'action': 'continue', 'directory': None}
                return 'return'

            elif action == 'delete':
                # Use delete_memory for batch deletion
                if self.confirm_batch_deletion(delete_memory):
                    print(f"[MENU-ACTION] Attempting to delete {len(delete_memory)} directories...")
                    success_count = 0
                    failed_dirs = []
                    
                    for dir_path in delete_memory:
                        try:
                            success = commander.remove_directory(dir_path, force=True)
                            if success:
                                print(f"[DELETE-SUCCESS] Directory deleted: {dir_path.name}")
                                success_count += 1
                            else:
                                print(f"[DELETE-ERROR] Failed to delete directory: {dir_path.name}")
                                failed_dirs.append(dir_path.name)
                        except Exception as e:
                            print(f"[DELETE-ERROR] Exception while deleting {dir_path.name}: {e}")
                            failed_dirs.append(dir_path.name)
                    
                    print(f"[DELETE-SUMMARY] Successfully deleted {success_count} directories")
                    if failed_dirs:
                        print(f"[DELETE-SUMMARY] Failed to delete: {', '.join(failed_dirs)}")
                    
                    print("[DELETE-INFO] Returning to directory selection menu...")
                    # Give user a moment to see the summary
                    time.sleep(2)
                    handle_directory_action._result = {'action': 'refresh', 'directory': None}
                    return 'return'

            elif action == 'open':
                print(f"[MENU-ACTION] Opening directory: {selected_item['value'].name}")
                try:
                    success = commander.open_explorer(selected_item['value'])
                    if success:
                        print(f"[OPEN-SUCCESS] Directory opened in explorer")
                    else:
                        print(f"[OPEN-ERROR] Failed to open directory in explorer")
                except Exception as e:
                    print(f"[OPEN-ERROR] Exception while opening directory: {e}")
                input("[OPEN-INFO] Press Enter to continue...")

            elif action == 'continue':
                status_level = selected_item.get('status_level', 0)
                if status_level == 2:
                    status_info = "build success"
                elif status_level == 1:
                    status_info = "compiled"
                else:
                    status_info = "not compiled"
                print(f"[MENU-SELECTION] Selected {selected_item['value'].name} ({status_info})")
                print()
                handle_directory_action._result = {'action': 'continue', 'directory': selected_item['value']}
                return 'return'

            return 'continue'

        # Set direction for toggle function
        def set_toggle_direction(direction):
            def toggle_wrapper(items, selected_index):
                toggle_directory_action._direction = direction
                return toggle_directory_action(items, selected_index)
            return toggle_wrapper

        def format_selection_info(item: Dict) -> str:
            if item['type'] == 'new':
                return "Create new directory"
            else:
                action_text = item['action'].title()
                return f"{item['value'].name} [{action_text}]"

        def get_dynamic_legend():
            delete_count = len(delete_memory)
            base_legend = "Legend: [*] = Build Success, [+] = Compiled, [ ] = Not Compiled\nOptions: Continue = Use directory, Delete = Remove directory, Open Dir = Open in file manager"
            if delete_count > 0:
                return f"{base_legend}\n\n🗑️  {delete_count} directory(ies) marked for deletion"
            return base_legend

        config = {
            'title': f"Select Build Directory for {app_name}",
            'items': menu_items,
            'instructions': "Use UP/DOWN arrows to navigate, LEFT/RIGHT to toggle options, ENTER to select, ESC to create new",
            'legend': get_dynamic_legend(),
            'item_formatter': format_directory_item,
            'detail_formatter': format_directory_details,
            'selection_formatter': format_selection_info,
            'key_handlers': {
                'left': set_toggle_direction('left'),
                'right': set_toggle_direction('right'),
                'enter': handle_directory_action
            },
            'allow_quick_select': False,  # Disable Y key for directories
            'select_message': '[DIRECTORY-SELECTED]',
            'cancel_message': f'[MENU-SELECTION] Creating new directory for {app_name}',
            'cache_key': cache_key  # Enable caching if cache_key is provided
        }

        result = self.show_interactive_menu(config)

        # Check if we have a special result from action handler
        if hasattr(handle_directory_action, '_result'):
            special_result = handle_directory_action._result
            delattr(handle_directory_action, '_result')  # Clean up
            return special_result

        return result

    def confirm_batch_deletion(self, delete_memory: List[Path]) -> bool:
        """Show confirmation dialog for batch directory deletion"""
        if not delete_memory:
            return False
            
        options = [
            {'display': 'Yes - Delete all marked directories', 'value': True},
            {'display': 'No - Keep all directories', 'value': False}
        ]

        self.selected_index = 0  # Default to "Yes" (Delete)

        while True:
            self.clear_screen()

            print("=" * 80)
            print("CONFIRM BATCH DIRECTORY DELETION")
            print("=" * 80)
            print()
            print("The following directories will be deleted:")
            for i, dir_path in enumerate(delete_memory, 1):
                print(f"  {i}. {dir_path.name}")
            print()
            print("WARNING: This action cannot be undone!")
            print()
            print("Use UP/DOWN arrows to navigate, ENTER to confirm, ESC to cancel")
            print()

            # Display options
            for i, option in enumerate(options):
                if i == self.selected_index:
                    print(f">>> [SELECTED] {option['display']}")
                else:
                    print(f"    [OPTION] {option['display']}")

            # Handle key input
            key = self.get_key()
            if key == 'up':
                self.selected_index = (self.selected_index - 1) % len(options)
            elif key == 'down':
                self.selected_index = (self.selected_index + 1) % len(options)
            elif key == 'enter':
                return options[self.selected_index]['value']
            elif key == 'esc':
                return False

    def confirm_deletion(self, dir_name: str) -> bool:
        """Show confirmation dialog for directory deletion"""
        options = [
            {'display': 'Yes - Delete the directory', 'value': True},
            {'display': 'No - Keep the directory', 'value': False}
        ]

        self.selected_index = 0  # Default to "Yes" (Delete)

        while True:
            self.clear_screen()

            print("=" * 80)
            print("CONFIRM DIRECTORY DELETION")
            print("=" * 80)
            print()
            print(f"Are you sure you want to delete directory: {dir_name}")
            print()
            print("WARNING: This action cannot be undone!")
            print()
            print("Use UP/DOWN arrows to navigate, ENTER to confirm, ESC to cancel")
            print()

            # Display options
            for i, option in enumerate(options):
                if i == self.selected_index:
                    prefix = ">>>"
                    color = "[SELECTED]"
                else:
                    prefix = "   "
                    color = "[OPTION]"
                action_type = "DELETE" if option['value'] else "KEEP"
                print(f"{prefix} {color} {option['display']} ({action_type})")

            # Handle key input
            key = self.get_key()

            if key == 'up':
                self.selected_index = (self.selected_index - 1) % len(options)
            elif key == 'down':
                self.selected_index = (self.selected_index + 1) % len(options)
            elif key == 'enter':
                selected_option = options[self.selected_index]
                return selected_option['value']
            elif key == 'escape':
                return False

    def show_simple_menu(self, title: str, options: List[Dict[str, Any]], show_legend: bool = True, cache_key: str = None) -> Any:
        """Show a simple interactive menu using the unified interactive system"""
        if not options:
            return None

        def format_option(item: Dict, index: int) -> str:
            return item.get('display', str(item.get('value', '')))

        instructions = "Use UP/DOWN arrows to navigate, ENTER to select, Y for default, ESC to cancel"
        legend = "Press Q to quit" if show_legend else None

        config = {
            'title': title,
            'items': options,
            'instructions': instructions,
            'legend': legend,
            'item_formatter': format_option,
            'allow_quick_select': True,
            'cache_key': cache_key  # Enable caching if cache_key is provided
        }

        return self.show_interactive_menu(config)

    def confirm_selection(self, message: str, default: bool = True) -> bool:
        """Show a yes/no confirmation dialog"""
        options = [
            {'display': 'Yes', 'value': True},
            {'display': 'No', 'value': False}
        ]

        self.selected_index = 0 if default else 1

        while True:
            self.clear_screen()

            print("=" * 80)
            print("CONFIRMATION")
            print("=" * 80)
            print()
            print(message)
            print()
            print("Use UP/DOWN arrows to navigate, ENTER to confirm")
            print()

            # Display options
            for i, option in enumerate(options):
                prefix = ">>>" if i == self.selected_index else "   "
                print(f"{prefix} {option['display']}")

            # Handle key input
            key = self.get_key()

            if key == 'up':
                self.selected_index = (self.selected_index - 1) % len(options)
            elif key == 'down':
                self.selected_index = (self.selected_index + 1) % len(options)
            elif key == 'enter':
                selected_option = options[self.selected_index]
                self.clear_screen()
                return selected_option['value']
            elif key == 'escape':
                self.clear_screen()
                return False
            elif key in ['y', 'Y']:
                self.clear_screen()
                return True
            elif key in ['n', 'N']:
                self.clear_screen()
                return False

    def show_interactive_menu(self, config: Dict[str, Any]) -> Any:
        """
        Universal interactive menu system with dynamic caching and toggle support
        Config structure:
        {
            'title': 'Menu Title',
            'items': [list of menu items],
            'instructions': 'Navigation instructions',
            'legend': 'Legend text (optional)',
            'item_formatter': function to format each item,
            'detail_formatter': function to format item details (optional),
            'key_handlers': dict of custom key handlers (optional),
                          # Example: {'left': toggle_function, 'right': toggle_function}
            'allow_quick_select': boolean (default True),
            'auto_select_single': boolean (default False),
            'cancel_message': 'Cancellation message',
            'select_message': 'Selection message template',
            'cache_key': 'cache_key_name' (optional) - enables automatic caching of menu state
        }

        Key Handler Functions:
        - Should accept (items, selected_index) and return 'continue'|'return'|'exit'
        - 'continue': continue menu loop, 'return': return current item, 'exit': return None
        - Left/Right arrows are automatically mapped to 'left'/'right' handlers if provided
        """
        items = config.get('items', [])
        if not items:
            return None

        # Handle caching if cache_key is provided
        cache_key = config.get('cache_key')
        if cache_key:
            # Try to load cached menu state
            cached_state = self._load_menu_cache(cache_key, items)
            if cached_state:
                items = cached_state['items']
                if 'selected_index' in cached_state:
                    self.selected_index = cached_state['selected_index']

        # Auto-select single item if configured
        if config.get('auto_select_single', False) and len(items) == 1:
            selected_item = items[0]
            if hasattr(selected_item, 'copy'):
                selected_item = selected_item.copy()

            # Apply default settings for single item
            if 'single_item_defaults' in config:
                for key, value in config['single_item_defaults'].items():
                    if hasattr(selected_item, '__setitem__'):
                        selected_item[key] = value
                    else:
                        setattr(selected_item, key, value)

            auto_message = config.get('auto_select_message', '[AUTO-SELECT] Single item selected')
            print(f"{auto_message}: {config.get('item_formatter')(selected_item, 0)}")
            return selected_item

        # Don't reset selected_index if it's already set (for caching support)
        if not hasattr(self, 'selected_index') or self.selected_index is None:
            self.selected_index = 0
        item_formatter = config.get('item_formatter')
        detail_formatter = config.get('detail_formatter')
        key_handlers = config.get('key_handlers', {})

        while True:
            self.clear_screen()

            # Display header
            print("=" * 80)
            print(config['title'].upper())
            print("=" * 80)
            print()

            if 'instructions' in config:
                print(config['instructions'])
                print()

            # Display menu items
            for i, item in enumerate(items):
                prefix = ">>>" if i == self.selected_index else "   "
                formatted_item = item_formatter(item, i)
                print(f"{prefix} {formatted_item}")

            # Display legend
            if 'legend' in config:
                print()
                legend = config['legend']
                # Support dynamic legend (function callable)
                if callable(legend):
                    legend = legend()
                print(legend)

            # Display current selection info
            if self.selected_index < len(items):
                current_item = items[self.selected_index]
                selection_formatter = config.get('selection_formatter')
                if selection_formatter:
                    print(f"Selection: {selection_formatter(current_item)}")
                else:
                    print(f"Selection: {item_formatter(current_item, self.selected_index)}")

            # Display detailed info if formatter provided
            if detail_formatter and self.selected_index < len(items):
                print()
                print(detail_formatter(items[self.selected_index]))

            # Handle key input
            key = self.get_key()

            # Handle custom key bindings first (including arrow keys)
            if key in key_handlers:
                result = key_handlers[key](items, self.selected_index)

                # Save cache after any key handler operation (e.g., compression mode toggle)
                if cache_key and result == 'continue':
                    self._save_menu_cache(cache_key, items, self.selected_index)

                if result == 'continue':
                    continue
                elif result == 'return':
                    return items[self.selected_index]
                elif result == 'exit':
                    return None
            # Standard navigation
            elif key == 'up':
                self.selected_index = (self.selected_index - 1) % len(items)
            elif key == 'down':
                self.selected_index = (self.selected_index + 1) % len(items)
            elif key == 'enter':
                selected_item = items[self.selected_index]
                if hasattr(selected_item, 'copy'):
                    selected_item = selected_item.copy()

                self.clear_screen()
                select_message = config.get('select_message', '[SELECTED]')
                print(f"{select_message}: {item_formatter(selected_item, self.selected_index)}")
                return selected_item
            elif key in ['y', 'Y'] and config.get('allow_quick_select', True):
                selected_item = items[0]
                if hasattr(selected_item, 'copy'):
                    selected_item = selected_item.copy()

                self.clear_screen()
                quick_message = config.get('quick_select_message', '[QUICK-SELECT] Default')
                print(f"{quick_message}: {item_formatter(selected_item, 0)}")
                return selected_item
            elif key == 'escape':
                self.clear_screen()
                cancel_message = config.get('cancel_message', '[CANCELLED] Operation cancelled')
                print(cancel_message)
                return None
            elif key in ['q', 'Q']:
                self.clear_screen()
                print("[BUILD-CANCELLED] Build cancelled by user")
                sys.exit(0)

    def show_image_selection_menu(self, title: str, images: List[Dict], image_type: str, cache_key: str = None) -> Optional[Dict]:
        """Show interactive menu for image selection with compression toggle"""
        if not images:
            return None

        # Initialize compression modes for images
        for image in images:
            if 'compression_mode' not in image:
                image['compression_mode'] = 'compressed'

        def format_image_item(image: Dict, index: int) -> str:
            source_label = f"[{image['source']}]"
            compression_display = "[Compressed]" if image['compression_mode'] == 'compressed' else "[Original]"
            size_display = self._format_file_size(image['size_bytes'])

            # Add usage type information if available
            usage_type = image.get('usage_type', '')
            usage_info = f" - {usage_type.upper()} USAGE" if usage_type else ""

            return f"{index+1}. {source_label} {image['name']} ({image['format']}, {size_display}) {compression_display}{usage_info}\n    Path: {image['path']}"

        def format_image_details(image: Dict) -> str:
            mode_text = "Compressed mode (will be compressed)" if image['compression_mode'] == 'compressed' else "Original mode (keep original)"

            details = f"Selected Image Details:\n"
            details += f"  Name: {image['name']}\n"
            details += f"  Path: {image['path']}\n"
            details += f"  Format: {image['format']}\n"
            details += f"  Size: {self._format_file_size(image['size_bytes'])}\n"
            details += f"  Source: {image['source']}\n"

            # Add usage information if available
            if 'usage_description' in image:
                details += f"  Usage: {image['usage_description']}\n"
            if 'fallback_info' in image:
                details += f"  Info: {image['fallback_info']}\n"

            details += f"  Mode: {mode_text}"
            return details

        def toggle_compression(items: List[Dict], selected_index: int) -> str:
            current_image = items[selected_index]
            if current_image['compression_mode'] == 'compressed':
                current_image['compression_mode'] = 'original'
            else:
                current_image['compression_mode'] = 'compressed'
            return 'continue'

        config = {
            'title': f"{title} - {image_type} Selection",
            'items': images,
            'instructions': f"Found {len(images)} {image_type} images. Use arrows to navigate and toggle compression.\nUP/DOWN: Navigate images | LEFT/RIGHT: Toggle compression | ENTER: Select | Y: Select default | ESC: Cancel",
            'legend': "Legend: [Compressed] = Compressed mode, [Original] = Original mode",
            'item_formatter': format_image_item,
            'detail_formatter': format_image_details,
            'selection_formatter': lambda x: f"{x['name']} - {x['compression_mode']}",
            'key_handlers': {
                'left': toggle_compression,
                'right': toggle_compression
            },
            'auto_select_single': True,
            'single_item_defaults': {'compression_mode': 'compressed'},
            'auto_select_message': f'[AUTO-SELECT] Only one {image_type} image found',
            'select_message': '[IMAGE-SELECTED]',
            'quick_select_message': '[IMAGE-QUICK-SELECT] Default',
            'cancel_message': f'[IMAGE-CANCELLED] {image_type} selection cancelled',
            'cache_key': cache_key  # Enable caching if cache_key is provided
        }

        selected_image = self.show_interactive_menu(config)

        # Process selected image if one was chosen
        if selected_image:
            self._process_selected_image(selected_image)

        return selected_image

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f}KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f}MB"

    def _process_selected_image(self, selected_image: Dict) -> None:
        """Process selected image and display path information"""
        compress = selected_image.get('compression_mode') == 'compressed'
        input_path = Path(selected_image['path'])

        print()
        print("=" * 60)
        print("IMAGE PROCESSING RESULTS")
        print("=" * 60)

        # Process the image
        result = self.image_processor.process_image(
            input_path=input_path,
            output_format='.png',  # Default to PNG as requested
            compress=compress
        )

        # Display results using the image processor's print function
        self.image_processor.print_processing_result(result)

        # Store processed path in selected_image for later use
        if result['success']:
            selected_image['processed_path'] = result['processed_path']
            selected_image['processed_size'] = result['processed_size']
            selected_image['compression_ratio'] = result['compression_ratio']
        else:
            selected_image['processed_path'] = None
            selected_image['processing_error'] = result['error']

        print("=" * 60)

    def print_clean(self, message: str) -> None:
        """
        Print message without any prefix (no timestamp, no log level, no source)
        Used for clean menu displays and user-facing information
        """
        print(message)

    def print_clean_header(self, message: str, separator: str = "=") -> None:
        """
        Print a clean header without prefixes

        Args:
            message: Header text
            separator: Character to use for separator line (default "=")
        """
        separator_line = separator * len(message)
        print(separator_line)
        print(message)
        print(separator_line)

    def print_clean_section(self, title: str, items: List[str] = None, separator: str = "-") -> None:
        """
        Print a clean section with title and optional items

        Args:
            title: Section title
            items: Optional list of items to display under the title
            separator: Character to use for separator line (default "-")
        """
        separator_line = separator * len(title)
        print(title)
        print(separator_line)
        if items:
            for item in items:
                print(f"  {item}")
        print()

    def show_compilation_menu(self) -> Optional[str]:
        """Show compilation options menu and return selected option"""

        options = [
            {
                'value': 'analyze',
                'display': 'Analyze Code - Run static analysis',
                'description': 'Run static analysis on the codebase'
            },
            {
                'value': 'clean',
                'display': 'Clean Build - Remove build cache and rebuild',
                'description': 'Remove all build cache and perform clean rebuild'
            },
            {
                'value': 'debug',
                'display': 'Debug Build - Development version with debugging',
                'description': 'Build development version with debugging symbols'
            },
            {
                'value': 'profile',
                'display': 'Profile Build - Performance profiling version',
                'description': 'Build with performance profiling enabled'
            },
            {
                'value': 'release',
                'display': 'Release Build - Production optimized version',
                'description': 'Build production-ready optimized version'
            },
            {
                'value': 'test',
                'display': 'Run Tests - Execute test suite',
                'description': 'Run the complete test suite'
            }
        ]

        title = "BUILD COMPILATION MENU"
        cache_key = "compilation_option"

        # Check if there's a cached selection
        cached_selection = unified_vars.get_file_variable(unified_vars.KEY_COMPILATION_OPTION, '')
        if cached_selection:
            # Find the cached option index
            for i, option in enumerate(options):
                if option['value'] == cached_selection:
                    self.default_index = i
                    break

        # Use show_simple_menu with caching
        selected_item = self.show_simple_menu(
            title=title,
            options=options,
            show_legend=True,
            cache_key=cache_key
        )

        if selected_item:
            selected_value = selected_item.get('value')
            # Cache the selection
            unified_vars.set_file_variable(unified_vars.KEY_COMPILATION_OPTION, selected_value)

            print(f"\n✓ Selected compilation option: {selected_item.get('display')}")
            return selected_value

        # Default to debug if nothing selected
        print("\n✓ No selection made, defaulting to Debug Build")
        unified_vars.set_file_variable(unified_vars.KEY_COMPILATION_OPTION, 'debug')
        return 'debug'