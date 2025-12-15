#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Hotkey Listener
Provides system-wide hotkey monitoring with high priority and conflict resolution
"""

import os
import sys
import time
import threading
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from typing import Dict, List, Callable, Optional, Set
from dataclasses import dataclass
from enum import Enum

# Import ColorPrint from pycore (same package)
from pycore.pyfoundations.color_print import ColorPrint


def _auto_install_dependencies():
    """
    Automatically install required dependencies using python -m pip
    """
    try:
        ColorPrint.blue("[AUTO-INSTALL] Installing required dependencies...")
        
        # Get the current Python executable path
        python_exe = sys.executable
        
        # Install keyboard and mouse packages
        packages = ['keyboard', 'mouse']
        
        for package in packages:
            ColorPrint.blue(f"[AUTO-INSTALL] Installing {package}...")
            try:
                # Use python -m pip install to ensure we use the correct pip
                result = exec_silent(
                    [python_exe, '-m', 'pip', 'install', package],
                    capture_output=True,
                    text=True,
                    timeout=60  # 60 second timeout
                )
                
                if result.return_code == 0:
                    ColorPrint.green(f"[AUTO-INSTALL] Successfully installed {package}")
                else:
                    ColorPrint.red(f"[AUTO-INSTALL] Failed to install {package}: {result.stderr}")
                    return False
                    
            except subprocess.TimeoutExpired:
                ColorPrint.red(f"[AUTO-INSTALL] Timeout while installing {package}")
                return False
            except Exception as e:
                ColorPrint.red(f"[AUTO-INSTALL] Error installing {package}: {e}")
                return False
        
        ColorPrint.green("[AUTO-INSTALL] All dependencies installed successfully")
        return True
        
    except Exception as e:
        ColorPrint.red(f"[AUTO-INSTALL] Failed to auto-install dependencies: {e}")
        return False


def _check_and_install_dependencies():
    """
    Check if dependencies are available, if not, try to install them
    """
    try:
        import keyboard
        import mouse
        return True
    except ImportError:
        ColorPrint.yellow("[DEPENDENCY] Required modules not found, attempting auto-installation...")
        
        if _auto_install_dependencies():
            # Try importing again after installation
            try:
                import keyboard
                import mouse
                ColorPrint.green("[DEPENDENCY] Dependencies successfully installed and imported")
                return True
            except ImportError as e:
                ColorPrint.red(f"[DEPENDENCY] Still unable to import after installation: {e}")
                return False
        else:
            ColorPrint.red("[DEPENDENCY] Auto-installation failed")
            return False


# Check and install dependencies
KEYBOARD_AVAILABLE = _check_and_install_dependencies()

# Import modules after auto-installation
if KEYBOARD_AVAILABLE:
    try:
        import keyboard
        import mouse
    except ImportError:
        KEYBOARD_AVAILABLE = False


class HotkeyType(Enum):
    """Hotkey types"""
    KEYBOARD = "keyboard"
    MOUSE = "mouse"
    COMBINATION = "combination"


@dataclass
class HotkeyInfo:
    """Hotkey information"""
    hotkey: str
    callback: Callable
    description: str = ""
    hotkey_type: HotkeyType = HotkeyType.KEYBOARD
    priority: int = 0  # Higher number = higher priority
    enabled: bool = True
    original_callback: Optional[Callable] = None  # For conflict resolution


class HotkeyListener:
    """
    Global hotkey listener with high priority and conflict resolution
    """
    
    def __init__(self):
        """Initialize hotkey listener"""
        self.hotkeys: Dict[str, HotkeyInfo] = {}
        self.listening = False
        self.listener_thread: Optional[threading.Thread] = None
        self.conflict_resolution = True
        self.original_hooks: Dict[str, Callable] = {}
        self.keyboard_available = KEYBOARD_AVAILABLE
        
        if not KEYBOARD_AVAILABLE:
            ColorPrint.yellow("[INIT] HotkeyListener initialized but keyboard/mouse modules not available")
            ColorPrint.yellow("[INIT] Hotkey functionality will be limited")
        else:
            ColorPrint.green("[INIT] HotkeyListener initialized")
    
    def register_hotkey(
        self, 
        hotkey: str, 
        callback: Callable, 
        description: str = "",
        priority: int = 0,
        enabled: bool = True
    ) -> bool:
        """
        Register a hotkey with callback
        
        Args:
            hotkey: Hotkey string (e.g., 'ctrl+shift+f1', 'f12', 'ctrl+alt+q')
            callback: Function to call when hotkey is pressed
            description: Description of the hotkey
            priority: Priority level (higher = more important)
            enabled: Whether the hotkey is enabled
            
        Returns:
            True if registered successfully, False otherwise
        """
        try:
            # Normalize hotkey string
            normalized_hotkey = self._normalize_hotkey(hotkey)
            
            if normalized_hotkey in self.hotkeys:
                ColorPrint.yellow(f"[WARN] Hotkey '{hotkey}' already registered, updating...")
            
            # Store hotkey info
            hotkey_info = HotkeyInfo(
                hotkey=normalized_hotkey,
                callback=callback,
                description=description,
                priority=priority,
                enabled=enabled
            )
            
            self.hotkeys[normalized_hotkey] = hotkey_info
            
            ColorPrint.green(f"[REGISTER] Hotkey '{hotkey}' registered (priority: {priority})")
            
            # If already listening, register with keyboard module
            if self.listening:
                self._register_with_keyboard(normalized_hotkey, hotkey_info)
            
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to register hotkey '{hotkey}': {e}")
            return False
    
    def unregister_hotkey(self, hotkey: str) -> bool:
        """
        Unregister a hotkey
        
        Args:
            hotkey: Hotkey string to unregister
            
        Returns:
            True if unregistered successfully, False otherwise
        """
        try:
            normalized_hotkey = self._normalize_hotkey(hotkey)
            
            if normalized_hotkey not in self.hotkeys:
                ColorPrint.yellow(f"[WARN] Hotkey '{hotkey}' not registered")
                return False
            
            # Remove from keyboard module if listening
            if self.listening:
                self._unregister_from_keyboard(normalized_hotkey)
            
            # Remove from our registry
            del self.hotkeys[normalized_hotkey]
            
            ColorPrint.green(f"[UNREGISTER] Hotkey '{hotkey}' unregistered")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to unregister hotkey '{hotkey}': {e}")
            return False
    
    def enable_hotkey(self, hotkey: str) -> bool:
        """Enable a hotkey"""
        return self._set_hotkey_enabled(hotkey, True)
    
    def disable_hotkey(self, hotkey: str) -> bool:
        """Disable a hotkey"""
        return self._set_hotkey_enabled(hotkey, False)
    
    def _set_hotkey_enabled(self, hotkey: str, enabled: bool) -> bool:
        """Set hotkey enabled state"""
        try:
            normalized_hotkey = self._normalize_hotkey(hotkey)
            
            if normalized_hotkey not in self.hotkeys:
                ColorPrint.yellow(f"[WARN] Hotkey '{hotkey}' not registered")
                return False
            
            self.hotkeys[normalized_hotkey].enabled = enabled
            
            if self.listening:
                if enabled:
                    self._register_with_keyboard(normalized_hotkey, self.hotkeys[normalized_hotkey])
                else:
                    self._unregister_from_keyboard(normalized_hotkey)
            
            status = "enabled" if enabled else "disabled"
            ColorPrint.blue(f"[UPDATE] Hotkey '{hotkey}' {status}")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to set hotkey '{hotkey}' enabled state: {e}")
            return False
    
    def start_listening(self) -> bool:
        """
        Start listening for hotkeys
        
        Returns:
            True if started successfully, False otherwise
        """
        if not self.keyboard_available:
            ColorPrint.yellow("[WARN] Cannot start listening - keyboard/mouse modules not available")
            return False
            
        if self.listening:
            ColorPrint.yellow("[WARN] Already listening for hotkeys")
            return True
        
        try:
            # Register all hotkeys with keyboard module
            for hotkey, info in self.hotkeys.items():
                if info.enabled:
                    self._register_with_keyboard(hotkey, info)
            
            self.listening = True
            ColorPrint.green(f"[START] Started listening for {len(self.hotkeys)} hotkey(s)")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to start listening: {e}")
            return False
    
    def stop_listening(self) -> bool:
        """
        Stop listening for hotkeys
        
        Returns:
            True if stopped successfully, False otherwise
        """
        if not self.listening:
            ColorPrint.yellow("[WARN] Not currently listening")
            return True
        
        try:
            # Unregister all hotkeys from keyboard module
            for hotkey in list(self.hotkeys.keys()):
                self._unregister_from_keyboard(hotkey)
            
            self.listening = False
            ColorPrint.green("[STOP] Stopped listening for hotkeys")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to stop listening: {e}")
            return False
    
    def update_hotkey(self, old_hotkey: str, new_hotkey: str) -> bool:
        """
        Update a hotkey binding
        
        Args:
            old_hotkey: Current hotkey string
            new_hotkey: New hotkey string
            
        Returns:
            True if updated successfully, False otherwise
        """
        try:
            old_normalized = self._normalize_hotkey(old_hotkey)
            new_normalized = self._normalize_hotkey(new_hotkey)
            
            if old_normalized not in self.hotkeys:
                ColorPrint.yellow(f"[WARN] Hotkey '{old_hotkey}' not registered")
                return False
            
            # Get the hotkey info
            hotkey_info = self.hotkeys[old_normalized]
            
            # Unregister old hotkey
            if self.listening:
                self._unregister_from_keyboard(old_normalized)
            
            # Update hotkey string
            hotkey_info.hotkey = new_normalized
            
            # Remove old entry and add new entry
            del self.hotkeys[old_normalized]
            self.hotkeys[new_normalized] = hotkey_info
            
            # Register new hotkey if listening
            if self.listening and hotkey_info.enabled:
                self._register_with_keyboard(new_normalized, hotkey_info)
            
            ColorPrint.green(f"[UPDATE] Hotkey updated: '{old_hotkey}' -> '{new_hotkey}'")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to update hotkey: {e}")
            return False
    
    def get_registered_hotkeys(self) -> List[Dict]:
        """
        Get list of registered hotkeys
        
        Returns:
            List of hotkey information dictionaries
        """
        return [
            {
                "hotkey": info.hotkey,
                "description": info.description,
                "priority": info.priority,
                "enabled": info.enabled
            }
            for info in self.hotkeys.values()
        ]
    
    def clear_all_hotkeys(self) -> bool:
        """
        Clear all registered hotkeys
        
        Returns:
            True if cleared successfully, False otherwise
        """
        try:
            # Stop listening first
            if self.listening:
                self.stop_listening()
            
            # Clear registry
            count = len(self.hotkeys)
            self.hotkeys.clear()
            
            ColorPrint.green(f"[CLEAR] Cleared {count} hotkey(s)")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to clear hotkeys: {e}")
            return False
    
    def _normalize_hotkey(self, hotkey: str) -> str:
        """Normalize hotkey string for consistent comparison"""
        return hotkey.lower().replace(' ', '').replace('+', '+')
    
    def _register_with_keyboard(self, hotkey: str, info: HotkeyInfo):
        """Register hotkey with keyboard module with conflict resolution"""
        if not KEYBOARD_AVAILABLE:
            ColorPrint.red("[ERROR] Keyboard module not available")
            return
            
        try:
            def hotkey_callback():
                if info.enabled:
                    try:
                        ColorPrint.blue(f"[HOTKEY] Triggered: {hotkey}")
                        
                        # Execute the main callback
                        info.callback()
                        
                        # If there's an original callback (system hotkey), execute it after
                        if info.original_callback:
                            try:
                                ColorPrint.blue(f"[HOTKEY] Executing original system callback for '{hotkey}'")
                                info.original_callback()
                            except Exception as e:
                                ColorPrint.red(f"[ERROR] Original callback error for '{hotkey}': {e}")
                                
                    except Exception as e:
                        ColorPrint.red(f"[ERROR] Hotkey callback error for '{hotkey}': {e}")
            
            # Try to register with keyboard module
            try:
                # First attempt: try to register normally
                keyboard.add_hotkey(hotkey, hotkey_callback, suppress=False)
                ColorPrint.green(f"[HOTKEY] Successfully registered '{hotkey}'")
                
            except Exception as register_error:
                # If registration fails, try to handle conflicts
                ColorPrint.yellow(f"[HOTKEY] Registration failed for '{hotkey}': {register_error}")
                
                if self._handle_hotkey_conflict(hotkey, info, hotkey_callback):
                    ColorPrint.green(f"[HOTKEY] Successfully handled conflict for '{hotkey}'")
                else:
                    ColorPrint.red(f"[HOTKEY] Failed to handle conflict for '{hotkey}'")
                    raise register_error
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to register '{hotkey}' with keyboard module: {e}")
    
    def _handle_hotkey_conflict(self, hotkey: str, info: HotkeyInfo, new_callback: Callable) -> bool:
        """
        Handle hotkey conflicts by attempting to take over existing hotkeys
        
        Args:
            hotkey: Hotkey string
            info: Hotkey info
            new_callback: New callback function
            
        Returns:
            True if conflict handled successfully, False otherwise
        """
        try:
            # Try to remove any existing hotkey first
            try:
                keyboard.remove_hotkey(hotkey)
                ColorPrint.blue(f"[HOTKEY] Removed existing hotkey '{hotkey}'")
            except:
                pass  # No existing hotkey to remove
            
            # Try to register with suppress=True to take over system hotkeys
            try:
                keyboard.add_hotkey(hotkey, new_callback, suppress=True)
                ColorPrint.green(f"[HOTKEY] Successfully took over '{hotkey}' with suppress=True")
                return True
            except Exception as suppress_error:
                ColorPrint.yellow(f"[HOTKEY] Suppress registration failed for '{hotkey}': {suppress_error}")
                
                # Try alternative registration methods
                return self._try_alternative_registration(hotkey, info, new_callback)
                
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to handle conflict for '{hotkey}': {e}")
            return False
    
    def _try_alternative_registration(self, hotkey: str, info: HotkeyInfo, new_callback: Callable) -> bool:
        """
        Try alternative registration methods for problematic hotkeys
        
        Args:
            hotkey: Hotkey string
            info: Hotkey info
            new_callback: New callback function
            
        Returns:
            True if registered successfully, False otherwise
        """
        try:
            # Method 1: Try with different suppress settings
            try:
                keyboard.add_hotkey(hotkey, new_callback, suppress=False)
                ColorPrint.green(f"[HOTKEY] Alternative registration successful for '{hotkey}'")
                return True
            except:
                pass
            
            # Method 2: Try registering with a slight delay
            import time
            time.sleep(0.1)
            try:
                keyboard.add_hotkey(hotkey, new_callback, suppress=True)
                ColorPrint.green(f"[HOTKEY] Delayed registration successful for '{hotkey}'")
                return True
            except:
                pass
            
            # Method 3: Try with different hotkey format
            try:
                # Convert to different format (e.g., 'ctrl+shift+f1' -> 'ctrl shift f1')
                alt_hotkey = hotkey.replace('+', ' ')
                keyboard.add_hotkey(alt_hotkey, new_callback, suppress=True)
                ColorPrint.green(f"[HOTKEY] Alternative format registration successful for '{alt_hotkey}'")
                return True
            except:
                pass
            
            ColorPrint.red(f"[HOTKEY] All alternative registration methods failed for '{hotkey}'")
            return False
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Alternative registration failed for '{hotkey}': {e}")
            return False
    
    def _unregister_from_keyboard(self, hotkey: str):
        """Unregister hotkey from keyboard module"""
        if not KEYBOARD_AVAILABLE:
            ColorPrint.red("[ERROR] Keyboard module not available")
            return
            
        try:
            keyboard.remove_hotkey(hotkey)
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to unregister '{hotkey}' from keyboard module: {e}")
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        try:
            if self.listening:
                self.stop_listening()
        except:
            pass


# Global hotkey listener instance
_global_hotkey_listener: Optional[HotkeyListener] = None


def get_global_hotkey_listener() -> HotkeyListener:
    """
    Get the global hotkey listener instance
    
    Returns:
        Global HotkeyListener instance
    """
    global _global_hotkey_listener
    if _global_hotkey_listener is None:
        _global_hotkey_listener = HotkeyListener()
    return _global_hotkey_listener


def register_global_hotkey(
    hotkey: str, 
    callback: Callable, 
    description: str = "",
    priority: int = 0,
    enabled: bool = True
) -> bool:
    """
    Register a hotkey with the global listener
    
    Args:
        hotkey: Hotkey string
        callback: Function to call when hotkey is pressed
        description: Description of the hotkey
        priority: Priority level
        enabled: Whether the hotkey is enabled
        
    Returns:
        True if registered successfully, False otherwise
    """
    listener = get_global_hotkey_listener()
    return listener.register_hotkey(hotkey, callback, description, priority, enabled)


def unregister_global_hotkey(hotkey: str) -> bool:
    """
    Unregister a hotkey from the global listener
    
    Args:
        hotkey: Hotkey string to unregister
        
    Returns:
        True if unregistered successfully, False otherwise
    """
    listener = get_global_hotkey_listener()
    return listener.unregister_hotkey(hotkey)


def start_global_hotkey_listening() -> bool:
    """
    Start the global hotkey listener
    
    Returns:
        True if started successfully, False otherwise
    """
    listener = get_global_hotkey_listener()
    return listener.start_listening()


def stop_global_hotkey_listening() -> bool:
    """
    Stop the global hotkey listener
    
    Returns:
        True if stopped successfully, False otherwise
    """
    listener = get_global_hotkey_listener()
    return listener.stop_listening()


def main():
    """Test function for hotkey listener"""
    if not KEYBOARD_AVAILABLE:
        ColorPrint.red("[ERROR] Required modules not available. Auto-installation failed.")
        ColorPrint.blue("[INFO] You can try manually installing with: pip install keyboard mouse")
        return
    
    ColorPrint.blue("=== Hotkey Listener Test ===")
    
    try:
        # Create listener
        listener = HotkeyListener()
        
        # Test callbacks
        def test_callback_1():
            ColorPrint.green("[TEST] Hotkey F12 triggered!")
        
        def test_callback_2():
            ColorPrint.yellow("[TEST] Hotkey Ctrl+Shift+F1 triggered!")
        
        def test_callback_3():
            ColorPrint.blue("[TEST] Hotkey Alt+Q triggered!")
        
        # Register test hotkeys
        listener.register_hotkey("f12", test_callback_1, "Test hotkey 1", priority=1)
        listener.register_hotkey("ctrl+shift+f1", test_callback_2, "Test hotkey 2", priority=2)
        listener.register_hotkey("alt+q", test_callback_3, "Test hotkey 3", priority=3)
        
        # Start listening
        if listener.start_listening():
            ColorPrint.green("[TEST] Hotkey listener started. Press F12, Ctrl+Shift+F1, or Alt+Q to test.")
            ColorPrint.blue("[TEST] Press Ctrl+C to exit...")
            
            try:
                while True:
                    time.sleep(0.1)
            except KeyboardInterrupt:
                ColorPrint.yellow("\n[TEST] Stopping hotkey listener...")
                listener.stop_listening()
                ColorPrint.green("[TEST] Test completed")
        else:
            ColorPrint.red("[TEST] Failed to start hotkey listener")
            
    except ImportError as e:
        ColorPrint.red(f"[ERROR] Failed to initialize HotkeyListener: {e}")
    except Exception as e:
        ColorPrint.red(f"[ERROR] Unexpected error: {e}")


if __name__ == "__main__":
    main()
