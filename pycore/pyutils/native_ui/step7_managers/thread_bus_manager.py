#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
THREAD_BUS Manager for Native UI

Provides scoped access to THREAD_BUS with namespace management.
Avoids global pollution and provides clear API for UI components.

Architecture:
    - All THREAD_BUS operations go through this manager
    - Scoped namespaces (e.g., "pycore.deps", "ui.tray", "app.config")
    - Clear separation of concerns
    - Type-safe access methods

Usage:
    from pycore.pyutils.native_ui.thread_bus_manager import NativeUIBusManager

    # Get singleton instance
    bus_mgr = NativeUIBusManager.get_instance()

    # Record dependency info
    bus_mgr.record_dependency_check(installed=['pkg1', 'pkg2'], missing=[], total=2)

    # Get dependency info
    dep_info = bus_mgr.get_dependency_info()

    # Store tray config
    bus_mgr.set_tray_config(tray_config)

    # Listen to signals with namespaced handlers
    bus_mgr.on_dependency_complete(callback_func)
"""

import threading
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import (
    BusNamespaces,
    BusKeys,
    BusSignals,
    DependencyInfo,
)
from pycore.pyutils.native_ui.step0_i18n import i18n


# ============================================================
# Main Manager Class
# ============================================================

class NativeUIBusManager:
    """
    THREAD_BUS Manager for Native UI components

    Provides scoped access with clear namespaces.
    Singleton pattern for global access.

    Usage:
        # Recommended: Use factory function
        bus_mgr = get_bus_manager()

        # Or direct instantiation (returns singleton)
        bus_mgr = NativeUIBusManager()
    """

    _instance: Optional['NativeUIBusManager'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize bus manager (only once)"""
        if getattr(self, '_initialized', False):
            return

        self._bus = THREAD_BUS

        ColorPrint.print_info("[NativeUIBusManager] Initialized (singleton)")
        self._initialized = True

    @classmethod
    def get_instance(cls) -> 'NativeUIBusManager':
        """
        Get singleton instance (alternative to direct instantiation)

        Returns:
            NativeUIBusManager singleton instance
        """
        return cls()

    # ========================================================
    # Dependency Check Methods
    # ========================================================

    def record_dependency_check(
        self,
        all_packages: List[str],
        installed: List[str],
        missing: List[str],
        platform: str
    ):
        """
        Record dependency check results to THREAD_BUS

        Args:
            all_packages: All packages to check
            installed: Successfully installed packages
            missing: Missing packages that were installed
            platform: Platform name (Windows, Linux, Darwin)
        """
        total = len(all_packages)

        # Store data with namespaced keys
        self._bus.signal(BusKeys.DEPS_CHECKED, True)
        self._bus.signal(BusKeys.DEPS_ALL_PACKAGES, sorted(all_packages))
        self._bus.signal(BusKeys.DEPS_INSTALLED, sorted(installed))
        self._bus.signal(BusKeys.DEPS_MISSING, sorted(missing))
        self._bus.signal(BusKeys.DEPS_TOTAL, total)
        self._bus.signal(BusKeys.DEPS_PLATFORM, platform)

        # Emit completion signal
        self._bus.signal(BusSignals.DEPS_COMPLETE, {
            "total": total,
            "installed": len(installed),
            "missing": len(missing),
            "platform": platform
        })

    def get_dependency_info(self) -> DependencyInfo:
        """
        Get dependency check information

        Returns:
            DependencyInfo object with all dependency data
        """
        return DependencyInfo(
            checked=self._bus.get_signal(BusKeys.DEPS_CHECKED, False),
            all_packages=self._bus.get_signal(BusKeys.DEPS_ALL_PACKAGES, []),
            installed=self._bus.get_signal(BusKeys.DEPS_INSTALLED, []),
            missing=self._bus.get_signal(BusKeys.DEPS_MISSING, []),
            total=self._bus.get_signal(BusKeys.DEPS_TOTAL, 0),
            platform=self._bus.get_signal(BusKeys.DEPS_PLATFORM, "")
        )

    def on_dependency_complete(self, callback: Callable[[Dict], None]):
        """
        Listen for dependency check completion

        Args:
            callback: Function to call when dependencies are ready
                     Receives dict with: total, installed, missing, platform
        """
        self._bus.register_event_handler(BusSignals.DEPS_COMPLETE, callback)

    # ========================================================
    # Tray Configuration Methods
    # ========================================================

    def set_tray_config(self, config: Any):
        """
        Store tray configuration

        Args:
            config: TrayConfig object (from tray_config.py)
        """
        self._bus.signal(BusKeys.TRAY_CONFIG, config)

    def get_tray_config(self) -> Optional[Any]:
        """
        Get tray configuration

        Returns:
            TrayConfig object or None
        """
        return self._bus.get_signal(BusKeys.TRAY_CONFIG)

    def set_tray_backend(self, backend: str):
        """
        Set active tray backend

        Args:
            backend: "tkinter" or "pyside6"
        """
        self._bus.signal(BusKeys.TRAY_BACKEND, backend)

    def get_tray_backend(self) -> Optional[str]:
        """
        Get active tray backend

        Returns:
            "tkinter", "pyside6", or None
        """
        return self._bus.get_signal(BusKeys.TRAY_BACKEND)

    def on_tray_show(self, callback: Callable[[Dict], None]):
        """Listen for tray show event"""
        self._bus.register_event_handler(BusSignals.TRAY_SHOW, callback)

    def on_tray_exit(self, callback: Callable[[Dict], None]):
        """Listen for tray exit event"""
        self._bus.register_event_handler(BusSignals.TRAY_EXIT, callback)

    def emit_tray_started(self, backend: str):
        """Emit tray started signal"""
        self._bus.signal(BusSignals.TRAY_STARTED, {"backend": backend})

    def emit_tray_stopped(self):
        """Emit tray stopped signal"""
        self._bus.signal(BusSignals.TRAY_STOPPED, {})

    # ========================================================
    # Startup Window Methods
    # ========================================================

    def set_startup_mode(self, mode: str):
        """
        Set startup window mode

        Args:
            mode: "debug_only" or "debug_with_tray"
        """
        self._bus.signal(BusKeys.STARTUP_MODE, mode)

    def get_startup_mode(self) -> str:
        """
        Get startup window mode

        Returns:
            "debug_only" or "debug_with_tray" (default: "debug_only")
        """
        return self._bus.get_signal(BusKeys.STARTUP_MODE, "debug_only")

    def wait_for_startup_ready(self, timeout: float = 5.0) -> bool:
        """
        Wait for startup window to be ready

        Args:
            timeout: Timeout in seconds

        Returns:
            True if ready, False if timeout
        """
        return self._bus.wait_signal("TkinterStartup_ready", timeout=timeout)

    # ========================================================
    # I18n Methods
    # ========================================================

    def get_current_language(self) -> Optional[str]:
        """Get current language from THREAD_BUS"""
        return self._bus.get_signal(BusKeys.I18N_CURRENT_LANGUAGE)

    def get_supported_languages(self) -> List[str]:
        """Get supported languages from THREAD_BUS"""
        return self._bus.get_signal(BusKeys.I18N_SUPPORTED_LANGUAGES, [])

    def on_language_changed(self, callback: Callable[[Dict], None]):
        """
        Listen for language change events

        Args:
            callback: Function to call when language changes
                     Receives dict with: language, previous_language, supported_languages
        """
        self._bus.register_event_handler(BusSignals.I18N_LANGUAGE_CHANGED, callback)

    def on_ui_redraw(self, callback: Callable[[Dict], None]):
        """
        Listen for UI redraw events (triggered by language change or other UI updates)

        Args:
            callback: Function to call when UI needs redraw
                     Receives dict with: reason, language (if language changed)
        """
        self._bus.register_event_handler(BusSignals.UI_REDRAW, callback)

    def set_language(self, language: str):
        """
        Request language change via THREAD_BUS

        Args:
            language: Language code to switch to (e.g., "en", "zh")
        """
        self._bus.trigger_event(BusSignals.I18N_SET_LANGUAGE, {"language": language})

    def setup_language_change_handler(self, tray_set_language_signal: str):
        """
        Setup language change handler for tray menu
        
        This is a library function that can be used by any app to handle language
        change requests from tray menu. It automatically registers handlers for all
        language signals in the format: {tray_set_language_signal}.{lang}
        
        Args:
            tray_set_language_signal: Base signal name for language change (e.g., "mcpserver.tray.set_language")
                                      Must match the signal used in create_language_submenu()
                                      
        Usage:
            from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import get_bus_manager
            
            bus_mgr = get_bus_manager()
            bus_mgr.setup_language_change_handler("myapp.tray.set_language")
        """
        
        def handle_set_language(event_data):
            """Handle language change request"""
            # Extract language code from signal name (format: {base_signal}.{lang})
            signal = event_data.get('signal', '')
            
            language = None
            if signal and signal.startswith(tray_set_language_signal + '.'):
                language = signal.split('.')[-1]
            else:
                # Fallback: try to get language from event_data
                language = event_data.get('language')
            
            if language:
                ColorPrint.print_info(f"[BusManager] Language change requested: {language}")
                # Use bus manager to set language (triggers I18N_SET_LANGUAGE signal)
                self.set_language(language)
            else:
                ColorPrint.print_warn(f"[BusManager] Could not determine language from event_data: {event_data}")
        
        # Register handlers for all language signals (dynamic registration)
        supported_languages = i18n.get_supported_languages()
        for lang in supported_languages:
            signal = f"{tray_set_language_signal}.{lang}"
            self._bus.register_event_handler(signal, handle_set_language)
        
        ColorPrint.print_success(f"[BusManager] Registered language change handlers for {len(supported_languages)} languages")

    # ========================================================
    # Utility Methods
    # ========================================================

    def clear_namespace(self, namespace: str):
        """
        Clear all keys in a namespace

        Args:
            namespace: Namespace to clear (e.g., BusNamespaces.PYCORE_DEPS)
        """
        # Get all keys
        all_keys = []
        if hasattr(self._bus, '_data'):
            all_keys = list(self._bus._data.keys())

        # Remove keys in namespace
        for key in all_keys:
            if key.startswith(namespace):
                self._bus.signal(key, None)

    def get_all_keys(self, namespace: Optional[str] = None) -> List[str]:
        """
        Get all keys in THREAD_BUS, optionally filtered by namespace

        Args:
            namespace: Optional namespace to filter

        Returns:
            List of keys
        """
        all_keys = []
        if hasattr(self._bus, '_data'):
            all_keys = list(self._bus._data.keys())

        if namespace:
            all_keys = [k for k in all_keys if k.startswith(namespace)]

        return sorted(all_keys)

    def dump_state(self, namespace: Optional[str] = None) -> Dict[str, Any]:
        """
        Dump current state for debugging

        Args:
            namespace: Optional namespace to filter

        Returns:
            Dictionary of key-value pairs
        """
        keys = self.get_all_keys(namespace)
        return {key: self._bus.get_signal(key) for key in keys}


# ============================================================
# Convenience Functions
# ============================================================

def get_bus_manager() -> NativeUIBusManager:
    """
    Get NativeUIBusManager singleton instance

    Returns:
        NativeUIBusManager instance
    """
    return NativeUIBusManager()


def get_native_ui_bus_manager() -> NativeUIBusManager:
    """
    Get NativeUIBusManager singleton instance (consistent naming)

    This is an alias for get_bus_manager() with consistent naming pattern.

    Returns:
        NativeUIBusManager singleton instance
    """
    return NativeUIBusManager()


# ============================================================
# Example / Test
# ============================================================

if __name__ == "__main__":
    from pycore import ColorPrint

    ColorPrint.print_info("=" * 70)
    ColorPrint.print_info(" THREAD_BUS MANAGER TEST")
    ColorPrint.print_info("=" * 70)

    # Get manager
    bus_mgr = get_bus_manager()

    # Test 1: Record dependency info
    ColorPrint.print_success("\n[Test 1] Recording dependency info...")
    bus_mgr.record_dependency_check(
        all_packages=["pkg1", "pkg2", "pkg3"],
        installed=["pkg1", "pkg2", "pkg3"],
        missing=[],
        platform="Windows"
    )

    # Test 2: Retrieve dependency info
    ColorPrint.print_success("\n[Test 2] Retrieving dependency info...")
    dep_info = bus_mgr.get_dependency_info()
    ColorPrint.print_info(f"Checked: {dep_info.checked}")
    ColorPrint.print_info(f"Total: {dep_info.total}")
    ColorPrint.print_info(f"Installed: {dep_info.installed}")
    ColorPrint.print_info(f"Platform: {dep_info.platform}")

    # Test 3: Listen to signals
    ColorPrint.print_success("\n[Test 3] Testing signal listeners...")
    bus_mgr.on_dependency_complete(
        lambda data: ColorPrint.print_success(f"Signal received: {data}")
    )

    # Test 4: Namespace dump
    ColorPrint.print_success("\n[Test 4] Dumping pycore.deps namespace...")
    state = bus_mgr.dump_state(BusNamespaces.PYCORE_DEPS)
    for key, value in state.items():
        ColorPrint.print_info(f"  {key}: {value}")

    # Test 5: Clear namespace
    ColorPrint.print_success("\n[Test 5] Clearing namespace...")
    bus_mgr.clear_namespace(BusNamespaces.PYCORE_DEPS)
    ColorPrint.print_info(f"Keys after clear: {bus_mgr.get_all_keys(BusNamespaces.PYCORE_DEPS)}")

    ColorPrint.print_info("\n" + "=" * 70)
    ColorPrint.print_success(" ALL TESTS PASSED")
    ColorPrint.print_info("=" * 70)
