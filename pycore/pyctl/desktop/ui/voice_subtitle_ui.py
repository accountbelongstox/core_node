# -*- coding: utf-8 -*-
"""
Voice Subtitle UI

Displays current voice subtitle text in a floating window using PySide6.
Window visibility controlled by THREAD_BUS events from tray menu.
"""

import threading

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_pyside6
from pycore.pyutils.native_ui.step5_main_ui.pyside6.framework import PySide6Framework
from pycore.pyutils.native_ui.step5_main_ui.pyside6.config import PySide6UIConfig


_UI_START_QUEUE = 'pyctl.desktop.voice_subtitle_ui.start'


class VoiceSubtitleUIThread(threading.Thread):
    """Run the bus-delivered PySide6 configuration."""

    def __init__(self) -> None:
        super().__init__(daemon=False, name='VoiceSubtitleUIThread')

    def run(self) -> None:
        ui_config = THREAD_BUS.receive_message(_UI_START_QUEUE)
        if ui_config is None:
            return
        ColorPrint.green("[VoiceSubtitleUI] PySide6 framework starting...")
        ColorPrint.green("[VoiceSubtitleUI] THREAD_BUS namespace: voice_subtitle_ui")
        framework = PySide6Framework(ui_config)
        framework.start()


def start_voice_subtitle_ui():
    """
    Start voice subtitle UI using PySide6 directly

    Window controlled by THREAD_BUS events:
    - voice_subtitle_ui.toggle - Toggle window visibility
    - voice_subtitle_ui.show - Show window
    - voice_subtitle_ui.hide - Hide window
    - voice_subtitle_ui.close - Close window

    Default: visible

    Returns:
        threading.Thread: UI thread
    """

    # Ensure PySide6 is installed
    get_third_package_pyside6()


    ColorPrint.green("[VoiceSubtitleUI] Starting PySide6 UI...")

    # Create PySide6 UI config
    ui_config = PySide6UIConfig(
        app_name="Voice Subtitle",
        app_id="voice_subtitle_ui",  # Used as THREAD_BUS namespace
        window_size=(1000, 180),
        show_on_start=True,  # Show window on start
        frameless=False,
        enable_tray=False,  # No tray icon needed
        enable_webview=True,
        webview_url="http://localhost:59000/web/subtitle",
        enable_dev_tools=False,
        debug=False
    )

    THREAD_BUS.send_message(_UI_START_QUEUE, ui_config)
    ui_thread = VoiceSubtitleUIThread()
    ui_thread.start()

    ColorPrint.green("[VoiceSubtitleUI] UI thread started")
    return ui_thread


__all__ = ['start_voice_subtitle_ui']
