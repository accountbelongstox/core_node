#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Platform Adapter - Unified Linux/Windows/macOS Difference Handling

Provides centralized platform detection and adaptation logic for Native UI.

Features:
- Platform detection (Windows/Linux/macOS)
- X11 display detection (Linux)
- Tray backend auto-selection
- Windows-specific configuration (AppUserModelID)
- QtWebEngine sandbox handling (root user)
- Platform-specific feature availability

Usage:
    from pycore.pyutils.native_ui.platform_adapter import (
        PlatformAdapter,
        get_platform_adapter
    )

    # Get singleton instance
    adapter = get_platform_adapter()

    # Check platform
    if adapter.is_linux:
        print("Running on Linux")

    # Check tray availability
    if adapter.can_use_tray():
        config.enable_tray = True
        config.tray_backend = adapter.get_recommended_tray_backend()

    # Get platform-specific config
    qtwebengine_flags = adapter.get_qtwebengine_flags()
"""

import os
import sys
from enum import Enum
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from pathlib import Path

from pycore import ColorPrint


# ============================================================
# Enums
# ============================================================

class Platform(Enum):
    """Platform types"""
    WINDOWS = "windows"
    LINUX = "linux"
    MACOS = "macos"
    UNKNOWN = "unknown"


class TrayBackend(Enum):
    """Tray backend types"""
    PYSTRAY = "pystray"      # Tkinter + pystray (cross-platform)
    PYSIDE6 = "pyside6"      # Qt system tray
    NONE = "none"            # No tray support


# ============================================================
# Platform Adapter
# ============================================================

@dataclass
class PlatformCapabilities:
    """Platform-specific capabilities"""
    has_gui: bool = True                # GUI support available
    has_x11: bool = False               # X11 display available (Linux)
    can_use_tray: bool = True           # System tray available
    can_use_notifications: bool = True  # System notifications available
    needs_sandbox_disable: bool = False # QtWebEngine needs --no-sandbox
    recommended_tray_backend: TrayBackend = TrayBackend.PYSIDE6


class PlatformAdapter:
    """
    Unified platform adapter for handling OS differences

    Singleton pattern - use get_platform_adapter() to access
    """

    def __init__(self):
        """Initialize platform adapter"""
        self._platform = self._detect_platform()
        self._capabilities = self._detect_capabilities()

        ColorPrint.blue(f"[PlatformAdapter] Initialized for {self._platform.value}")
        ColorPrint.blue(f"[PlatformAdapter] GUI: {self._capabilities.has_gui}, "
                       f"X11: {self._capabilities.has_x11}, "
                       f"Tray: {self._capabilities.can_use_tray}")

    # ========================================
    # Platform Detection
    # ========================================

    @staticmethod
    def _detect_platform() -> Platform:
        """Detect current platform"""
        if sys.platform == 'win32':
            return Platform.WINDOWS
        elif sys.platform == 'darwin':
            return Platform.MACOS
        elif sys.platform.startswith('linux'):
            return Platform.LINUX
        else:
            return Platform.UNKNOWN

    @staticmethod
    def _detect_x11_display() -> bool:
        """
        Detect if X11 display is available (Linux only)

        Returns:
            True if DISPLAY environment variable is set
        """
        display = os.environ.get('DISPLAY')
        if display:
            ColorPrint.blue(f"[PlatformAdapter] X11 display detected: {display}")
            return True
        else:
            ColorPrint.yellow("[PlatformAdapter] No X11 display detected (headless mode)")
            return False

    @staticmethod
    def _is_running_as_root() -> bool:
        """Check if running as root/administrator"""
        if sys.platform != 'win32':
            # Linux/macOS: check UID
            return os.geteuid() == 0
        else:
            # Windows: check admin privileges
            try:
                import ctypes
                return ctypes.windll.shell32.IsUserAnAdmin() != 0
            except:
                return False

    def _detect_capabilities(self) -> PlatformCapabilities:
        """Detect platform capabilities"""
        caps = PlatformCapabilities()

        if self._platform == Platform.LINUX:
            # Linux: check X11 for GUI/tray support
            caps.has_x11 = self._detect_x11_display()
            caps.has_gui = caps.has_x11
            caps.can_use_tray = caps.has_x11
            caps.recommended_tray_backend = TrayBackend.PYSTRAY if caps.has_x11 else TrayBackend.NONE

            # Check if running as root (needs --no-sandbox for QtWebEngine)
            if self._is_running_as_root():
                caps.needs_sandbox_disable = True
                ColorPrint.yellow("[PlatformAdapter] Running as root - QtWebEngine sandbox will be disabled")

        elif self._platform == Platform.WINDOWS:
            # Windows: full GUI support
            caps.has_gui = True
            caps.can_use_tray = True
            caps.can_use_notifications = True
            caps.recommended_tray_backend = TrayBackend.PYSIDE6

        elif self._platform == Platform.MACOS:
            # macOS: full GUI support
            caps.has_gui = True
            caps.can_use_tray = True
            caps.can_use_notifications = True
            caps.recommended_tray_backend = TrayBackend.PYSIDE6

        return caps

    # ========================================
    # Platform Properties
    # ========================================

    @property
    def platform(self) -> Platform:
        """Get current platform"""
        return self._platform

    @property
    def is_windows(self) -> bool:
        """Check if running on Windows"""
        return self._platform == Platform.WINDOWS

    @property
    def is_linux(self) -> bool:
        """Check if running on Linux"""
        return self._platform == Platform.LINUX

    @property
    def is_macos(self) -> bool:
        """Check if running on macOS"""
        return self._platform == Platform.MACOS

    @property
    def has_gui(self) -> bool:
        """Check if GUI is available"""
        return self._capabilities.has_gui

    @property
    def has_x11(self) -> bool:
        """Check if X11 display is available (Linux)"""
        return self._capabilities.has_x11

    def can_use_tray(self) -> bool:
        """Check if system tray is available"""
        return self._capabilities.can_use_tray

    def can_use_notifications(self) -> bool:
        """Check if system notifications are available"""
        return self._capabilities.can_use_notifications

    def needs_sandbox_disable(self) -> bool:
        """Check if QtWebEngine needs --no-sandbox flag"""
        return self._capabilities.needs_sandbox_disable

    # ========================================
    # Tray Backend Selection
    # ========================================

    def get_recommended_tray_backend(self) -> TrayBackend:
        """
        Get recommended tray backend for current platform

        Returns:
            TrayBackend.PYSTRAY - For lightweight tray (Linux with X11)
            TrayBackend.PYSIDE6 - For Qt-integrated tray (Windows/macOS)
            TrayBackend.NONE - If tray not available
        """
        return self._capabilities.recommended_tray_backend

    def select_tray_backend(self, preferred: Optional[str] = None) -> TrayBackend:
        """
        Select tray backend based on preference and platform capabilities

        Args:
            preferred: Preferred backend ("pystray", "pyside6", or "auto")

        Returns:
            Selected TrayBackend
        """
        # If tray not available, return NONE
        if not self.can_use_tray():
            ColorPrint.yellow("[PlatformAdapter] Tray not available on this platform")
            return TrayBackend.NONE

        # Auto-select based on platform
        if not preferred or preferred == "auto":
            backend = self.get_recommended_tray_backend()
            ColorPrint.blue(f"[PlatformAdapter] Auto-selected tray backend: {backend.value}")
            return backend

        # Use preferred backend if specified
        if preferred == "pystray":
            if self.is_linux and not self.has_x11:
                ColorPrint.yellow("[PlatformAdapter] pystray requires X11 on Linux, falling back to NONE")
                return TrayBackend.NONE
            return TrayBackend.PYSTRAY
        elif preferred == "pyside6":
            return TrayBackend.PYSIDE6
        else:
            ColorPrint.yellow(f"[PlatformAdapter] Unknown backend '{preferred}', using recommended")
            return self.get_recommended_tray_backend()

    # ========================================
    # Platform-Specific Configuration
    # ========================================

    def get_qtwebengine_flags(self,
                              enable_webcodecs: bool = True,
                              enable_hardware_acceleration: bool = True,
                              enable_remote_debugging: bool = False,
                              custom_flags: Optional[List[str]] = None) -> str:
        """
        Get QtWebEngine Chromium flags based on platform

        Args:
            enable_webcodecs: Enable WebCodecs API
            enable_hardware_acceleration: Enable GPU acceleration
            enable_remote_debugging: Enable remote debugging
            custom_flags: Additional custom flags

        Returns:
            Space-separated Chromium flags string
        """
        flags = []

        # Common flags
        if enable_webcodecs:
            flags.append("--enable-features=WebCodecs")

        if enable_hardware_acceleration:
            flags.extend([
                "--enable-gpu",
                "--enable-gpu-rasterization",
                "--enable-accelerated-video-decode",
                "--enable-accelerated-2d-canvas",
                "--enable-webgl",
                "--enable-webgl2-compute-context",
                "--ignore-gpu-blocklist",
                "--ignore-gpu-blacklist",
                "--enable-hardware-overlays",
                "--enable-zero-copy",
                "--enable-native-gpu-memory-buffers"
            ])

        # Linux-specific flags
        if self.is_linux:
            if enable_hardware_acceleration:
                flags.extend([
                    "--enable-features=AcceleratedVideoDecodeLinuxGL,VaapiVideoDecodeLinuxGL,VaapiVideoEncoder",
                    "--disable-features=UseChromeOSDirectVideoDecoder"
                ])

            # Disable sandbox if running as root
            if self.needs_sandbox_disable():
                flags.append("--no-sandbox")
                flags.append("--disable-gpu-sandbox")
                ColorPrint.yellow("[PlatformAdapter] Added --no-sandbox flag (running as root)")

        # Windows-specific flags
        elif self.is_windows:
            if enable_hardware_acceleration:
                flags.extend([
                    "--enable-features=D3D11VideoDecoder",
                    "--enable-direct-composition"
                ])

        # Remote debugging
        if enable_remote_debugging:
            flags.append("--remote-debugging-port=9222")

        # Custom flags
        if custom_flags:
            flags.extend(custom_flags)

        return " ".join(flags)

    def get_windows_appusermodelid(self, app_id: str, app_name: str) -> Optional[str]:
        """
        Generate Windows AppUserModelID

        Args:
            app_id: Application ID
            app_name: Application name

        Returns:
            AppUserModelID string (Windows only), None on other platforms
        """
        if not self.is_windows:
            return None

        # Format: CompanyName.ProductName.SubProduct.VersionInformation
        # Example: pycore.my_app.1.0
        safe_app_id = app_id.lower().replace(' ', '_').replace('-', '_')
        return f"pycore.{safe_app_id}.1.0"

    def set_windows_appusermodelid(self, app_id: str, app_name: str) -> bool:
        """
        Set Windows AppUserModelID for taskbar grouping

        Args:
            app_id: Application ID
            app_name: Application name

        Returns:
            True if successfully set, False otherwise
        """
        if not self.is_windows:
            return False

        try:
            import ctypes
            myappid = self.get_windows_appusermodelid(app_id, app_name)
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
            ColorPrint.green(f"[PlatformAdapter] Set Windows AppUserModelID: {myappid}")
            return True
        except Exception as e:
            ColorPrint.yellow(f"[PlatformAdapter] Failed to set AppUserModelID: {e}")
            return False

    # ========================================
    # Configuration Helpers
    # ========================================

    def adapt_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adapt configuration based on platform capabilities

        Args:
            config: Original configuration dict

        Returns:
            Adapted configuration dict
        """
        adapted = config.copy()

        # Disable tray if not available
        if 'enable_tray' in adapted and adapted['enable_tray']:
            if not self.can_use_tray():
                ColorPrint.yellow("[PlatformAdapter] Disabling tray (not available on this platform)")
                adapted['enable_tray'] = False
            else:
                # Auto-select tray backend
                if 'tray_backend' not in adapted or adapted['tray_backend'] == 'auto':
                    backend = self.get_recommended_tray_backend()
                    adapted['tray_backend'] = backend.value
                    ColorPrint.blue(f"[PlatformAdapter] Selected tray backend: {backend.value}")

        # Add QtWebEngine flags
        if 'qtwebengine_flags' not in adapted:
            adapted['qtwebengine_flags'] = self.get_qtwebengine_flags()

        # Windows: add AppUserModelID
        if self.is_windows and 'app_id' in adapted and 'app_name' in adapted:
            if 'app_user_model_id' not in adapted:
                adapted['app_user_model_id'] = self.get_windows_appusermodelid(
                    adapted['app_id'],
                    adapted['app_name']
                )

        return adapted

    def get_platform_info(self) -> Dict[str, Any]:
        """
        Get platform information dict

        Returns:
            Dict with platform details
        """
        return {
            'platform': self._platform.value,
            'is_windows': self.is_windows,
            'is_linux': self.is_linux,
            'is_macos': self.is_macos,
            'has_gui': self.has_gui,
            'has_x11': self.has_x11,
            'can_use_tray': self.can_use_tray(),
            'can_use_notifications': self.can_use_notifications(),
            'needs_sandbox_disable': self.needs_sandbox_disable(),
            'recommended_tray_backend': self._capabilities.recommended_tray_backend.value,
            'is_root': self._is_running_as_root()
        }

    def print_platform_info(self):
        """Print platform information"""
        info = self.get_platform_info()

        ColorPrint.blue("=" * 60)
        ColorPrint.blue("Platform Information")
        ColorPrint.blue("=" * 60)

        for key, value in info.items():
            ColorPrint.blue(f"  {key}: {value}")

        ColorPrint.blue("=" * 60)


# ============================================================
# Singleton Instance
# ============================================================

_platform_adapter_instance: Optional[PlatformAdapter] = None


def get_platform_adapter() -> PlatformAdapter:
    """
    Get singleton PlatformAdapter instance

    Returns:
        PlatformAdapter singleton
    """
    global _platform_adapter_instance

    if _platform_adapter_instance is None:
        _platform_adapter_instance = PlatformAdapter()

    return _platform_adapter_instance


# ============================================================
# Convenience Functions
# ============================================================

def is_linux() -> bool:
    """Check if running on Linux"""
    return get_platform_adapter().is_linux


def is_windows() -> bool:
    """Check if running on Windows"""
    return get_platform_adapter().is_windows


def is_macos() -> bool:
    """Check if running on macOS"""
    return get_platform_adapter().is_macos


def can_use_tray() -> bool:
    """Check if system tray is available"""
    return get_platform_adapter().can_use_tray()


def get_recommended_tray_backend() -> TrayBackend:
    """Get recommended tray backend for current platform"""
    return get_platform_adapter().get_recommended_tray_backend()
