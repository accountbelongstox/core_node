# -*- coding: utf-8 -*-
"""
Voice Subtitle UI

Displays current voice subtitle text in a floating window using PySide6.
Window visibility controlled by THREAD_BUS events from tray menu.
"""


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
    from pycore import ColorPrint
    from pycore.pyfoundations.third_party import get_third_package_pyside6

    # Ensure PySide6 is installed
    get_third_package_pyside6()

    from pycore.pyutils.native_ui.step5_main_ui.pyside6 import (
        PySide6Framework,
        PySide6UIConfig
    )

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

    def run_pyside6_ui():
        """Run PySide6 framework in thread"""
        ColorPrint.green("[VoiceSubtitleUI] PySide6 framework starting...")
        ColorPrint.green("[VoiceSubtitleUI] THREAD_BUS namespace: voice_subtitle_ui")

        # Create and start framework
        framework = PySide6Framework(ui_config)
        framework.start()  # Blocks until window closes

    # Launch in separate thread
    import threading
    ui_thread = threading.Thread(
        target=run_pyside6_ui,
        daemon=False,
        name="VoiceSubtitleUI"
    )
    ui_thread.start()

    ColorPrint.green("[VoiceSubtitleUI] UI thread started")
    return ui_thread


__all__ = ['start_voice_subtitle_ui']
