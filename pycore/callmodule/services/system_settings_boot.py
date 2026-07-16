# -*- coding: utf-8 -*-
"""
Apply persisted system_settings to live background services on boot.

Bridges PcSettingsPage toggles (monitorClipboard, scheduledScreenshot,
notebooklmAutoConvert) to the runtime services they control.
"""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store

from pycore.pyctl.desktop.background_services import get_background_services
from pycore.callmodule.routers.notebooklm_stt_router import apply_notebooklm_auto_convert


_SECTION = "system_settings"


def apply_persisted_system_settings() -> None:
    """Idempotent startup hook — no-op when section absent."""
    section = get_user_data_store().get_section(_SECTION)
    if not section:
        return
    apply_system_settings_live(section, source="boot")


def apply_system_settings_live(
    settings: Dict[str, Any],
    *,
    source: str = "live",
) -> None:
    """Start/stop clipboard, screenshot, and notebooklm services from settings."""
    try:
        services = get_background_services()
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SystemSettings] background services unavailable ({exc})")
        return

    clipboard_on = bool(settings.get("monitorClipboard"))
    try:
        if clipboard_on:
            services.start_clipboard_monitor()
        else:
            services.stop_clipboard_monitor()
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SystemSettings] clipboard apply failed ({exc})")

    screenshot_on = bool(settings.get("scheduledScreenshot"))
    interval = max(5, int(settings.get("screenshotInterval") or 60))
    try:
        if screenshot_on:
            lang = str(settings.get("lang") or "en").strip() or "en"
            services.start_screenshot_monitor(interval=interval, lang=lang)
        else:
            services.stop_screenshot_monitor()
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SystemSettings] screenshot apply failed ({exc})")

    notebooklm_on = bool(settings.get("notebooklmAutoConvert"))
    try:
        apply_notebooklm_auto_convert(notebooklm_on, run_scan=notebooklm_on)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SystemSettings] notebooklm apply failed ({exc})")

    ColorPrint.blue(f"[SystemSettings] Applied persisted settings ({source})")
