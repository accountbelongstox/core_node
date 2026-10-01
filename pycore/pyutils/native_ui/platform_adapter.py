#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Platform detection for native_ui: display server, tray backend, QtWebEngine flags."""

import ctypes
import os
import sys
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

from pycore.pyfoundations.desktop_session import current_desktop_session
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.native_ui.step1_config.tray_config import TrayBackend

REMOTE_DEBUGGING_PORT = 9222


class Platform(Enum):
    WINDOWS = "windows"
    LINUX = "linux"
    MACOS = "macos"
    UNKNOWN = "unknown"


@dataclass
class PlatformCapabilities:
    has_gui: bool = True
    has_x11: bool = False               # Display server available (X11 or Wayland, Linux)
    can_use_tray: bool = True
    needs_sandbox_disable: bool = False  # QtWebEngine needs --no-sandbox (root)
    recommended_tray_backend: TrayBackend = TrayBackend.PYSIDE6


def _detect_platform() -> Platform:
    if sys.platform == 'win32':
        return Platform.WINDOWS
    if sys.platform == 'darwin':
        return Platform.MACOS
    if sys.platform.startswith('linux'):
        return Platform.LINUX
    return Platform.UNKNOWN


def _is_running_as_root() -> bool:
    if sys.platform != 'win32':
        return os.geteuid() == 0
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except OSError as exc:
        ColorPrint.yellow(f"[PlatformAdapter] IsUserAnAdmin failed: {exc}")
        return False


class PlatformAdapter:
    """OS differences for native_ui; capabilities are detected on first use."""

    def __init__(self):
        self._platform = _detect_platform()
        self._capabilities: Optional[PlatformCapabilities] = None

    @property
    def capabilities(self) -> PlatformCapabilities:
        if self._capabilities is None:
            self._capabilities = self._detect_capabilities()
            ColorPrint.blue(
                f"[PlatformAdapter] {self._platform.value}: GUI={self._capabilities.has_gui} "
                f"display={self._capabilities.has_x11} tray={self._capabilities.can_use_tray}"
            )
        return self._capabilities

    def _detect_capabilities(self) -> PlatformCapabilities:
        caps = PlatformCapabilities()
        if self._platform != Platform.LINUX:
            return caps
        # Debian 13 / Ubuntu 26.04 default to Wayland; AppIndicator (SNI over D-Bus)
        # works under either display server.
        session = current_desktop_session()
        caps.has_x11 = session.has_display
        caps.has_gui = caps.has_x11
        caps.can_use_tray = caps.has_x11
        if not caps.has_x11:
            ColorPrint.yellow("[PlatformAdapter] No display server detected (headless mode)")
            caps.recommended_tray_backend = TrayBackend.NONE
        elif session.is_gnome or 'ubuntu' in session.desktop_names:
            caps.recommended_tray_backend = TrayBackend.APPINDICATOR
        else:
            caps.recommended_tray_backend = TrayBackend.PYSTRAY
        if _is_running_as_root():
            caps.needs_sandbox_disable = True
            ColorPrint.yellow("[PlatformAdapter] Running as root - QtWebEngine sandbox will be disabled")
        return caps

    @property
    def platform(self) -> Platform:
        return self._platform

    @property
    def is_windows(self) -> bool:
        return self._platform == Platform.WINDOWS

    @property
    def is_linux(self) -> bool:
        return self._platform == Platform.LINUX

    @property
    def is_macos(self) -> bool:
        return self._platform == Platform.MACOS

    @property
    def has_gui(self) -> bool:
        return self.capabilities.has_gui

    @property
    def has_x11(self) -> bool:
        return self.capabilities.has_x11

    def can_use_tray(self) -> bool:
        return self.capabilities.can_use_tray

    def needs_sandbox_disable(self) -> bool:
        return self.capabilities.needs_sandbox_disable

    def recommended_tray_backend(self) -> TrayBackend:
        return self.capabilities.recommended_tray_backend

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
        # All --enable-features values must be collapsed into ONE flag (Chromium
        # honors only the last --enable-features), else WebCodecs is silently dropped.
        enabled_features = []
        flags = []

        if enable_webcodecs:
            enabled_features.append("WebCodecs")

        if enable_hardware_acceleration:
            # Safe, cross-platform acceleration baseline. Deliberately NO
            # --enable-hardware-overlays / --enable-native-gpu-memory-buffers /
            # --ignore-gpu-blocklist / --enable-webgl2-compute-context (removed from
            # Chromium): those force the fragile Windows DirectComposition overlay
            # path that crashes hybrid laptop GPUs (IDCompositionDevice4 failure).
            flags.extend([
                "--enable-gpu",
                "--enable-gpu-rasterization",
                "--enable-accelerated-2d-canvas",
                "--enable-webgl",
            ])

            if self.is_linux:
                enabled_features.extend([
                    "AcceleratedVideoDecodeLinuxGL",
                    "VaapiVideoDecodeLinuxGL",
                    "VaapiVideoEncoder",
                ])
                flags.extend([
                    "--enable-accelerated-video-decode",
                    "--enable-native-gpu-memory-buffers",  # Linux-scoped (GBM)
                    "--enable-zero-copy",
                    "--ignore-gpu-blocklist",
                    "--disable-features=UseChromeOSDirectVideoDecoder",
                ])
                # Disable sandbox only if running as root
                if self.needs_sandbox_disable():
                    flags.append("--no-sandbox")
                    flags.append("--disable-gpu-sandbox")
                    ColorPrint.yellow("[PlatformAdapter] Added --no-sandbox flag (running as root)")
            elif self.is_windows:
                # Default ANGLE->D3D11 + DirectComposition already gives WebGL2 +
                # D3D11 video; add only the safe HW-video feature + zero-copy.
                enabled_features.append("D3D11VideoDecoder")
                flags.append("--enable-zero-copy")
            elif self.is_macos:
                flags.append("--enable-zero-copy")

        # Single, de-duplicated --enable-features flag
        if enabled_features:
            flags.insert(0, "--enable-features=" + ",".join(dict.fromkeys(enabled_features)))

        # Remote debugging
        if enable_remote_debugging:
            flags.append(f"--remote-debugging-port={REMOTE_DEBUGGING_PORT}")

        # Custom flags
        if custom_flags:
            flags.extend(custom_flags)

        return " ".join(flags)

    def print_platform_info(self):
        caps = self.capabilities
        ColorPrint.blue("=" * 60)
        for key, value in {
            'platform': self._platform.value,
            'has_gui': caps.has_gui,
            'has_x11': caps.has_x11,
            'can_use_tray': caps.can_use_tray,
            'needs_sandbox_disable': caps.needs_sandbox_disable,
            'recommended_tray_backend': caps.recommended_tray_backend.value,
        }.items():
            ColorPrint.blue(f"  {key}: {value}")
        ColorPrint.blue("=" * 60)


platform_adapter = PlatformAdapter()
