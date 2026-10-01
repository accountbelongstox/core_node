# -*- coding: utf-8 -*-
"""
Apply persisted system settings to live background services.

Bridges PcSettingsPage toggles (monitorClipboard, scheduledScreenshot,
notebooklmAutoConvert) to the runtime services they control.
"""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.user_data_store import USER_DATA_SECTION_SYSTEM_SETTINGS, user_data_store

from pycore.pyctl.desktop.background_services import background_services
from pycore.pyutils.stt.notebooklm_stt import apply_notebooklm_auto_convert


_SECTION = USER_DATA_SECTION_SYSTEM_SETTINGS


def apply_persisted_system_settings() -> None:
    """Idempotent startup hook - no-op when section absent."""
    section = user_data_store.get_section(_SECTION)
    if not section:
        return
    apply_system_settings_live(section, source="boot")


def apply_system_settings_live(
    settings: Dict[str, Any],
    *,
    source: str = "live",
) -> None:
    """Start/stop clipboard, screenshot, and notebooklm services from settings."""
    if settings.get("monitorClipboard"):
        background_services.start_clipboard_monitor()
    else:
        background_services.stop_clipboard_monitor()

    if settings.get("scheduledScreenshot"):
        interval = max(5, int(settings.get("screenshotInterval") or 60))
        lang = str(settings.get("lang") or "en").strip() or "en"
        background_services.start_screenshot_monitor(interval=interval, lang=lang)
    else:
        background_services.stop_screenshot_monitor()

    notebooklm_on = bool(settings.get("notebooklmAutoConvert"))
    apply_notebooklm_auto_convert(notebooklm_on, run_scan=notebooklm_on)

    ColorPrint.blue(f"[SystemSettings] Applied persisted settings ({source})")
