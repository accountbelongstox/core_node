# -*- coding: utf-8 -*-
"""
Voice Subtitle Window Manager

Handles window adjustments for subtitle mode using PySide6.
Listens to Thread Bus events to adjust window size and position.
"""

from PySide6.QtCore import QTimer, QRect
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QScreen

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider
from typing import Optional, Tuple


class VoiceSubtitleWindowManager:
    """
    Manages window adjustments for voice subtitle subtitle mode

    Features:
    - Subtitle mode: Small window at bottom center (above taskbar)
    - Normal mode: Restore to previous size and position
    """

    def __init__(self, window=None):
        """
        Initialize window manager

        Args:
            window: PySide6 main window instance
        """
        self.window = window
        self._saved_geometry: Optional[QRect] = None
        self._is_subtitle_mode = False

        # Register event handlers
        self._register_event_handlers()

        ColorPrint.green("[VoiceSubtitle] Window manager initialized")

    def _register_event_handlers(self):
        """Register Thread Bus event handlers"""
        THREAD_BUS.register_event_handler(
            'voice_subtitle.subtitle_mode_enter',
            self._on_subtitle_mode_enter,
            priority=50
        )

        THREAD_BUS.register_event_handler(
            'voice_subtitle.subtitle_mode_exit',
            self._on_subtitle_mode_exit,
            priority=50
        )

        ColorPrint.green("[VoiceSubtitle] Event handlers registered")

    def set_window(self, window):
        """
        Set the window instance

        Args:
            window: PySide6 main window instance
        """
        self.window = window
        ColorPrint.blue(f"[VoiceSubtitle] Window instance set: {window}")

    def _on_subtitle_mode_enter(self, event_data):
        """
        Handle subtitle mode enter event

        Args:
            event_data: Event data from Thread Bus
        """
        if not self.window:
            ColorPrint.yellow("[VoiceSubtitle] No window instance, ignoring subtitle mode enter")
            return

        ColorPrint.blue("[VoiceSubtitle] Entering subtitle mode...")

        # Save current geometry
        self._saved_geometry = self.window.geometry()
        ColorPrint.blue(f"[VoiceSubtitle] Saved geometry: {self._saved_geometry}")

        # Calculate subtitle mode geometry
        screen_geometry, taskbar_height = self._get_screen_geometry()

        # Subtitle mode window size: 1200x200
        subtitle_width = 1200
        subtitle_height = 200

        # Calculate position: centered horizontally, above taskbar
        x = (screen_geometry.width() - subtitle_width) // 2
        y = screen_geometry.height() - taskbar_height - subtitle_height - 10  # 10px margin

        ColorPrint.blue(f"[VoiceSubtitle] Screen: {screen_geometry.width()}x{screen_geometry.height()}")
        ColorPrint.blue(f"[VoiceSubtitle] Taskbar height: {taskbar_height}px")
        ColorPrint.blue(f"[VoiceSubtitle] Subtitle window: {subtitle_width}x{subtitle_height} at ({x}, {y})")

        # Apply geometry using QTimer to ensure it runs on Qt thread
        QTimer.singleShot(0, lambda: self._apply_subtitle_geometry(x, y, subtitle_width, subtitle_height))

        self._is_subtitle_mode = True

    def _on_subtitle_mode_exit(self, event_data):
        """
        Handle subtitle mode exit event

        Args:
            event_data: Event data from Thread Bus
        """
        if not self.window:
            ColorPrint.yellow("[VoiceSubtitle] No window instance, ignoring subtitle mode exit")
            return

        ColorPrint.blue("[VoiceSubtitle] Exiting subtitle mode...")

        if self._saved_geometry:
            ColorPrint.blue(f"[VoiceSubtitle] Restoring geometry: {self._saved_geometry}")

            # Restore saved geometry using QTimer
            QTimer.singleShot(0, lambda: self.window.setGeometry(self._saved_geometry))
        else:
            ColorPrint.yellow("[VoiceSubtitle] No saved geometry, using default")

            # Default to center screen
            QTimer.singleShot(0, self._restore_default_geometry)

        self._is_subtitle_mode = False

    def _apply_subtitle_geometry(self, x: int, y: int, width: int, height: int):
        """
        Apply subtitle mode geometry

        Args:
            x: X position
            y: Y position
            width: Window width
            height: Window height
        """
        try:
            self.window.setGeometry(x, y, width, height)
            ColorPrint.green(f"[VoiceSubtitle] Geometry applied: {width}x{height} at ({x}, {y})")
        except Exception as e:
            ColorPrint.red(f"[VoiceSubtitle] Error applying geometry: {e}")

    def _restore_default_geometry(self):
        """Restore default window geometry (centered, 1280x800)"""
        try:
            screen_geometry, _ = self._get_screen_geometry()

            default_width = 1280
            default_height = 800

            x = (screen_geometry.width() - default_width) // 2
            y = (screen_geometry.height() - default_height) // 2

            self.window.setGeometry(x, y, default_width, default_height)
            ColorPrint.green(f"[VoiceSubtitle] Default geometry applied: {default_width}x{default_height} at ({x}, {y})")
        except Exception as e:
            ColorPrint.red(f"[VoiceSubtitle] Error restoring default geometry: {e}")

    def _get_screen_geometry(self) -> Tuple[QRect, int]:
        """
        Get screen geometry and taskbar height

        Returns:
            Tuple of (screen_geometry, taskbar_height)
        """
        app = QApplication.instance()
        if not app:
            ColorPrint.red("[VoiceSubtitle] No QApplication instance found")
            return QRect(0, 0, 1920, 1080), 40  # Default fallback

        # Get primary screen
        screen: QScreen = app.primaryScreen()
        if not screen:
            ColorPrint.red("[VoiceSubtitle] No primary screen found")
            return QRect(0, 0, 1920, 1080), 40

        # Get available geometry (excluding taskbar)
        available_geometry = screen.availableGeometry()

        # Get full geometry
        full_geometry = screen.geometry()

        # Calculate taskbar height (difference between full and available)
        taskbar_height = full_geometry.height() - available_geometry.height()

        # If taskbar is on bottom (most common)
        if available_geometry.y() == 0:
            # Taskbar is at bottom
            pass
        else:
            # Taskbar is at top (less common)
            taskbar_height = available_geometry.y()

        ColorPrint.blue(f"[VoiceSubtitle] Full geometry: {full_geometry.width()}x{full_geometry.height()}")
        ColorPrint.blue(f"[VoiceSubtitle] Available geometry: {available_geometry.width()}x{available_geometry.height()}")
        ColorPrint.blue(f"[VoiceSubtitle] Calculated taskbar height: {taskbar_height}px")

        return full_geometry, max(taskbar_height, 40)  # Minimum 40px for safety

    def is_subtitle_mode(self) -> bool:
        """Check if currently in subtitle mode"""
        return self._is_subtitle_mode


_WINDOW_MANAGER_PROVIDER = SerializedSingletonProvider(
    VoiceSubtitleWindowManager,
    "desktop.window_manager.provider",
    "VoiceSubtitleWindowManagerProvider",
)


def get_window_manager() -> VoiceSubtitleWindowManager:
    """
    Get global window manager instance

    Returns:
        VoiceSubtitleWindowManager: Global instance
    """
    return _WINDOW_MANAGER_PROVIDER.get()
