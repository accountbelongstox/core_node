#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Thread bus constants — BusNamespaces, BusKeys, BusSignals, DependencyInfo.

Extracted from pycore.pyutils.native_ui.step7_managers.thread_bus_manager to
pyfoundations so that pythreadpool, step0_i18n, and other packages can import
these pure string-constant classes without triggering native_ui/__init__.py.
"""

from typing import List
from dataclasses import dataclass, field


# ============================================================
# Namespace Constants
# ============================================================

class BusNamespaces:
    """THREAD_BUS namespace organization."""

    PYCORE_DEPS = "pycore.deps"
    UI_CONFIG = "ui.config"
    UI_TRAY = "ui.tray"
    APP_STATE = "app.state"
    UI_I18N = "ui.i18n"
    UI_STARTUP = "ui.startup"


# ============================================================
# Key Constants
# ============================================================

class BusKeys:
    """Standardized THREAD_BUS keys with namespaces."""

    # PyCore dependency keys
    DEPS_CHECKED = f"{BusNamespaces.PYCORE_DEPS}.checked"
    DEPS_ALL_PACKAGES = f"{BusNamespaces.PYCORE_DEPS}.all_packages"
    DEPS_INSTALLED = f"{BusNamespaces.PYCORE_DEPS}.installed"
    DEPS_MISSING = f"{BusNamespaces.PYCORE_DEPS}.missing"
    DEPS_TOTAL = f"{BusNamespaces.PYCORE_DEPS}.total"
    DEPS_PLATFORM = f"{BusNamespaces.PYCORE_DEPS}.platform"

    # Tray configuration keys
    TRAY_CONFIG = f"{BusNamespaces.UI_TRAY}.config"
    TRAY_BACKEND = f"{BusNamespaces.UI_TRAY}.backend"
    TRAY_READY = f"{BusNamespaces.UI_TRAY}.ready"
    TRAY_VISIBLE = f"{BusNamespaces.UI_TRAY}.visible"

    # Startup window keys
    STARTUP_MODE = f"{BusNamespaces.UI_STARTUP}.mode"
    STARTUP_THREAD_ID = f"{BusNamespaces.UI_STARTUP}.thread_id"

    # I18n keys
    I18N_CURRENT_LANGUAGE = f"{BusNamespaces.UI_I18N}.current_language"
    I18N_SUPPORTED_LANGUAGES = f"{BusNamespaces.UI_I18N}.supported_languages"


# ============================================================
# Signal Constants
# ============================================================

class BusSignals:
    """Standardized THREAD_BUS signal names."""

    # PyCore signals
    DEPS_COMPLETE = "pycore.deps.complete"
    DEPS_INSTALL_START = "pycore.deps.install_start"
    DEPS_INSTALL_SUCCESS = "pycore.deps.install_success"

    # Tray signals
    TRAY_STARTED = "ui.tray.started"
    TRAY_STOPPED = "ui.tray.stopped"
    TRAY_SHOW = "ui.tray.show"
    TRAY_RESTART = "ui.tray.restart"
    TRAY_EXIT = "ui.tray.exit"
    TRAY_MENU_CLICKED = "ui.tray.menu_clicked"

    # Commands
    TRAY_UPDATE_MENU = "ui.tray.update_menu"
    TRAY_UPDATE_ICON = "ui.tray.update_icon"
    TRAY_SHOW_MESSAGE = "ui.tray.show_message"
    TRAY_STOP = "ui.tray.stop"

    # Startup window signals
    STARTUP_READY = "ui.startup.ready"
    STARTUP_CLOSED = "ui.startup.closed"
    STARTUP_STOPPED = "ui.startup.stopped"
    STARTUP_REQUEST_CLOSE = "ui.startup.request_close"

    # UI i18n signals
    I18N_SET_LANGUAGE = "ui.i18n.set_language"
    I18N_LANGUAGE_CHANGED = "ui.i18n.language_changed"
    UI_REDRAW = "ui.redraw"

    # HTTP event topics bridged from THREAD_BUS or the durable RPC outbox
    AGENT_HISTORY_SESSIONS_CHANGED = "agent_history.sessions.changed"
    ARTICLE_PUBLISHED = "article.published"
    CODE_SYNC_UPDATE = "code_sync_update"
    COREBOOK_AUTOFLOW = "corebook_autoflow"
    ENGINE_LOAD_STATUS_UPDATE = "engine_load_status_update"
    LARAVEL_HTTP = "laravel_http"
    LARAVEL_ENDPOINT_CHANGED = "laravel_endpoint_changed"
    LARAVEL_LOGS_CHANGED = "laravel.logs.changed"
    LARAVEL_LOGS_SNAPSHOT_UPDATED = "laravel.logs.snapshot.updated"
    OPERATION_CHANGED = "operation.changed"
    PYCORE_LOG = "pycore_log"
    QUEUE_BUMP = "queue_bump"
    QWEN_JOB_COMPLETED = "tts.qwen3tts.job.completed"
    QWEN_JOB_FAILED = "tts.qwen3tts.job.failed"
    QWEN_QUEUE_CHANGED = "tts.qwen3tts.queue.changed"
    QWEN_QUEUE_EVENT = "tts.qwen3tts.queue.event"
    SYSTEM_SETTINGS_UPDATE = "system_settings_update"
    SUBTITLE_LANGUAGE_FILL = "subtitle_language_fill"
    VIDEO_EXTRACT_SYNC = "video_extract_sync"
    VOICE_SUBTITLE_QUEUE_UPDATE = "voice_subtitle_queue_update"
    VOICE_SUBTITLE_UI_HIDE = "voice_subtitle_ui_hide"
    VOICE_SUBTITLE_UI_SHOW = "voice_subtitle_ui_show"
    VOICE_SUBTITLE_UPDATE = "voice_subtitle_update"


# ============================================================
# Data Class
# ============================================================

@dataclass
class DependencyInfo:
    """Dependency check information."""
    checked: bool = False
    all_packages: List[str] = field(default_factory=list)
    installed: List[str] = field(default_factory=list)
    missing: List[str] = field(default_factory=list)
    total: int = 0
    platform: str = ""
