# -*- coding: utf-8 -*-
"""Launcher configuration and RPC warm-up for the pycore service entry.

Builds the LauncherConfig (no threads started here) and wires the runtime
pieces that ride on the RPC server: Code Sync boot and the event bridges that
feed the event journal.
"""

import os
from pathlib import Path
from typing import Callable, Optional

from pycore.pyctl.runtime.callmodule_config import Config as CallmoduleConfig
from pycore.pyfoundations.event_journal import event_journal
from pycore.pyfoundations.network_constants import HTTP_BIND_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import IS_LINUX, IS_WINDOWS
from pycore.pyfoundations.system_info import get_screen_resolution
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pylauncher.launcher import LauncherConfig
from pycore.pylauncher.tray_menu import build_tray_menu, tray_menu_to_dicts
from pycore.pyutils.codesync.manager import code_sync_manager
from pycore.pyutils.common.queue_bump_hub import queue_bump_hub
from pycore.pyutils.common.strtools.normalization import to_bool
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.laravel.http_recorder import laravel_http_recorder
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n

# Desired main-window size for the desktop-manager UI, clamped to the screen.
UI_DESIRED_WINDOW_SIZE = (1788, 1159)
UI_MIN_WINDOW_SIZE = (640, 480)
UI_SCREEN_MARGIN = 80
HTTP_EVENTS_ENV = "PYCORE_HTTP_EVENTS_ENABLED"
PYCORE_UI_URL_ENV = "PYCORE_UI_URL"


def _resolve_window_size() -> tuple:
    """The desired window size, shrunk to fit a smaller screen."""
    desired_w, desired_h = UI_DESIRED_WINDOW_SIZE
    screen = get_screen_resolution()
    if screen is None:
        return (desired_w, desired_h)
    return (
        min(desired_w, max(UI_MIN_WINDOW_SIZE[0], screen.width - UI_SCREEN_MARGIN)),
        min(desired_h, max(UI_MIN_WINDOW_SIZE[1], screen.height - UI_SCREEN_MARGIN)),
    )


def _tray_icon_path() -> Optional[str]:
    icon_path = Path(__file__).resolve().parents[2] / CallmoduleConfig.TRAY_ICON_PATH_REL
    return str(icon_path) if icon_path.exists() else None


def apply_saved_language() -> None:
    """Apply the persisted UI language (system_settings.lang) to the Python
    i18n manager so native surfaces speak the web UI's language."""
    lang = (user_data_store.get_section("system_settings") or {}).get("lang")
    if lang and lang in i18n.get_supported_languages():
        i18n.set_language(lang)
        ColorPrint.blue(f"[ConfigBuilder] Applied saved UI language: {lang}")


def build_tray_service_config(port: int, singleton_port: Optional[int] = None) -> dict:
    """The pystray tray service config (fallback when no native tray exists)."""
    return {
        "app_name": CallmoduleConfig.TRAY_APP_NAME,
        "app_id": CallmoduleConfig.UI_APP_ID,
        "icon_path": _tray_icon_path(),
        "menu_items": build_tray_menu(port=port, singleton_port=singleton_port),
        "trigger_shutdown_on_exit": CallmoduleConfig.TRAY_TRIGGER_SHUTDOWN_ON_EXIT,
        "backend": CallmoduleConfig.TRAY_BACKEND,
    }


def start_rpc_runtime() -> None:
    """Warm-up that rides on the RPC server: boot Code Sync and bridge the
    structured Laravel-request and queue-bump records into the event journal."""
    code_sync_manager.start()
    laravel_http_recorder.register_callback(
        lambda record: event_journal.publish_topic(BusSignals.LARAVEL_HTTP, record)
    )
    queue_bump_hub.register_callback(
        lambda record: event_journal.publish_topic(BusSignals.QUEUE_BUMP, record)
    )
    ColorPrint.green("[ConfigBuilder] Code Sync started; event bridges wired")


def _ui_service_config(port: int, debug: bool) -> dict:
    tray_enabled = CallmoduleConfig.UI_ENABLE_TRAY
    return {
        "app_name": CallmoduleConfig.UI_APP_NAME,
        "app_id": CallmoduleConfig.UI_APP_ID,
        "window_size": _resolve_window_size(),
        "webview_url": os.environ.get(PYCORE_UI_URL_ENV) or CallmoduleConfig.FRONTEND_URL,
        "show_on_start": CallmoduleConfig.UI_SHOW_ON_START,
        "frameless": CallmoduleConfig.UI_FRAMELESS,
        # The embedded React UI renders its own title bar.
        "enable_title_bar": CallmoduleConfig.UI_ENABLE_TITLE_BAR,
        "icon_path": _tray_icon_path(),
        # Close/minimize hide to the tray; tray "Exit" is the real quit.
        "minimize_to_tray": True,
        "close_to_tray": True,
        "enable_tray": tray_enabled,
        "tray_icon_path": _tray_icon_path() if tray_enabled else None,
        "tray_menu_items": tray_menu_to_dicts(build_tray_menu(port=port)) if tray_enabled else [],
        "enable_webview": True,
        "enable_dev_tools": debug,
        "debug": debug,
        "show_startup": CallmoduleConfig.UI_SHOW_STARTUP,
        "auto_close_startup": CallmoduleConfig.UI_AUTO_CLOSE_STARTUP,
        "cache_window_state": False,
    }


def build_launcher_config(
    init_rpc_routes: Callable,
    host: str = HTTP_BIND_HOST,
    port: int = PYCORE_HTTP_PORT,
    debug: bool = False,
    local_ui_enabled: bool = True,
) -> LauncherConfig:
    """Build the LauncherConfig; ``init_rpc_routes(server)`` wires the routes."""
    ColorPrint.blue("[ConfigBuilder] Building launcher configuration...")
    # Warm the unified user-data store so user data is read before the UI connects.
    user_data_store.as_dict()
    # Sync native i18n with the saved UI language before tray texts are baked.
    apply_saved_language()

    services = {
        "heartbeat": {},
        "rpc": {
            "port": port,
            "host": host,
            "debug": debug,
            "fastapi_routers": [],
            "static_mounts": [],
            "init_callback": init_rpc_routes,
            "enable_http_events": to_bool(os.environ.get(HTTP_EVENTS_ENV, "1")),
        },
    }
    if IS_WINDOWS and local_ui_enabled:
        services["ui"] = _ui_service_config(port, debug)

    # The tray is local desktop integration and runs in every service mode.
    can_show_tray = IS_WINDOWS or (IS_LINUX and CallmoduleConfig.HAS_DISPLAY)
    qt_tray_active = CallmoduleConfig.UI_ENABLE_TRAY and "ui" in services
    if can_show_tray and not qt_tray_active:
        services["tray"] = build_tray_service_config(port=port)
        ColorPrint.blue(f"[ConfigBuilder] Added independent tray service (backend={CallmoduleConfig.TRAY_BACKEND})")
    elif can_show_tray:
        ColorPrint.blue("[ConfigBuilder] Using PySide6 Qt tray (TRAY_BACKEND=pyside)")

    config = LauncherConfig(
        app_id=CallmoduleConfig.LAUNCHER_APP_ID,
        app_name=CallmoduleConfig.LAUNCHER_APP_NAME,
        singleton=True,
        shutdown_existing=True,
        singleton_port_start=CallmoduleConfig.SINGLETON_PORT_START,
        singleton_port_range=CallmoduleConfig.SINGLETON_PORT_RANGE,
        services=services,
    )
    ColorPrint.green(f"[ConfigBuilder] Configuration built with {len(services)} services")
    ColorPrint.blue(f"[ConfigBuilder] Services: {', '.join(services.keys())}")
    return config


__all__ = [
    "apply_saved_language",
    "build_launcher_config",
    "build_tray_service_config",
    "start_rpc_runtime",
]
