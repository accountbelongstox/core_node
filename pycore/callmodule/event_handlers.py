# -*- coding: utf-8 -*-
"""
Event Handlers for Pycore Module Caller

Registers THREAD_BUS event handlers for tray actions.
This module only registers event handlers, does not start any threads.
"""

import webbrowser

from pycore import ColorPrint, THREAD_BUS, get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pylauncher import ServiceLauncher
from pycore.pythreadpool.starters import start_tray
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.callmodule.callmodule_config import Config
from pycore.callmodule.platform.startup_manager import get_startup_manager
from pycore.pyctl.assist import translation_worker_enabled_on_start
from pycore.callmodule.services import (
    get_translation_worker_service,
    get_queue_monitor_service,
    get_translation_ws_client,
)
from pycore.callmodule.services.assist_wiring import register_assist_worker_start
from pycore.callmodule.tray_menu import TRAY_SET_LANGUAGE_SIGNAL
from pycore.callmodule.config import build_tray_service_config, update_tray_menu_with_singleton


def register_event_handlers(launcher: ServiceLauncher, port: int, singleton_port: int = None):
    """
    Register THREAD_BUS event handlers for tray actions

    Args:
        launcher: ServiceLauncher instance
        port: RPC v2 server port
        singleton_port: Singleton port (included in the pystray fallback menu)
    """
    ColorPrint.blue("[EventHandlers] Registering tray event handlers...")

    # Guard so the pystray fallback is started at most once
    fallback_started = {'value': False}

    def handle_native_tray_unavailable(event_data):
        """Start the pystray tray as a fallback when no native system tray exists."""
        if fallback_started['value']:
            return
        fallback_started['value'] = True
        ColorPrint.yellow("[Tray] Native tray unavailable, starting pystray fallback...")
        try:
            cfg = build_tray_service_config(port=port, singleton_port=singleton_port)
            start_tray(cfg)
        except Exception as e:
            ColorPrint.red(f"[Tray] Failed to start pystray fallback: {e}")

    def handle_tray_open(event_data):
        """Open web interface in browser"""
        ColorPrint.blue("[Tray] Opening web interface...")
        webbrowser.open(f"http://localhost:{port}/")

    def handle_tray_restart(event_data):
        """
        Trigger restart via THREAD_BUS (built-in method)

        Restart is a built-in method handled by pythreadpool.
        We just need to trigger the event.
        """
        ColorPrint.blue("[Tray] Triggering built-in restart...")
        THREAD_BUS.trigger_event('app.restart', {'reason': 'Tray menu request'})

    def handle_tray_exit(event_data):
        """
        Exit application

        Note: TkinterSystemTray already has trigger_shutdown_on_exit=True,
        so when tray.stop() is called, it will trigger THREAD_BUS shutdown.
        This handler is just for the tray_action_exit signal.
        """
        ColorPrint.yellow("[Tray] Exit requested via tray...")

        # Trigger global shutdown via THREAD_BUS
        if not THREAD_BUS.is_shutdown_requested():
            THREAD_BUS.request_shutdown(reason="Tray exit requested", execute_handlers=True)

    def handle_tray_toggle_startup(event_data):
        """Toggle auto-start on boot (native per-OS startup manager)."""
        startup_manager = get_startup_manager()
        result = startup_manager.toggle()

        if result['success']:
            status = "enabled" if result['enabled'] else "disabled"
            ColorPrint.green(f"[Tray] Auto-start {status}")
        else:
            ColorPrint.red(f"[Tray] Failed: {result['message']}")

    def handle_tray_toggle_voice_subtitle(event_data):
        """Toggle voice subtitle window visibility via THREAD_BUS"""
        ColorPrint.blue("[Tray] Toggling voice subtitle window...")
        THREAD_BUS.trigger_event('voice_subtitle_ui.toggle', {})
        ColorPrint.green("[Tray] Voice subtitle window toggle event sent")

    def handle_language_changed(event_data):
        """
        React to any language change (tray submenu, web UI settings, bus):
        1. Persist it into system_settings.lang (skipped when already saved) so it
           survives restarts and the web UI — which reads the same setting — follows.
        2. Re-push the tray menu in the new language. Needed for the PySide6 Qt
           tray, whose item texts are baked into dicts at build time (the native
           Win32 tray re-translates on every right-click by itself).
        """
        lang = (event_data or {}).get('language')
        if lang:
            try:
                store = get_user_data_store()
                settings = store.get_section('system_settings') or {}
                if settings.get('lang') != lang:
                    saved = store.update_section('system_settings', {'lang': lang})
                    THREAD_BUS.trigger_event('system_settings_update', {'settings': saved})
                    ColorPrint.blue(f"[Tray] Persisted UI language: {lang}")
            except Exception as e:
                ColorPrint.yellow(f"[Tray] Failed to persist language: {e}")
        try:
            update_tray_menu_with_singleton(launcher, port=port, singleton_port=singleton_port)
            ColorPrint.blue("[Tray] Menu re-translated after language change")
        except Exception as e:
            ColorPrint.yellow(f"[Tray] Menu re-translation failed: {e}")

    def make_set_language_handler(code):
        """Handler factory for the per-language tray signals (closure over code)."""
        def handler(event_data):
            ColorPrint.blue(f"[Tray] Language switch requested: {code}")
            try:
                i18n.set_language(code)  # no-op if unchanged; broadcasts ui.i18n.language_changed
            except Exception as e:
                ColorPrint.red(f"[Tray] Failed to set language {code}: {e}")
        return handler

    # Register all event handlers
    THREAD_BUS.register_event_handler('tray_action_open', handle_tray_open)
    THREAD_BUS.register_event_handler('tray_action_restart', handle_tray_restart)
    THREAD_BUS.register_event_handler('tray_action_exit', handle_tray_exit)
    THREAD_BUS.register_event_handler('tray_action_toggle_startup', handle_tray_toggle_startup)
    THREAD_BUS.register_event_handler('tray_action_toggle_voice_subtitle', handle_tray_toggle_voice_subtitle)
    # Fallback: only fires when the PySide6 backend is selected but no system tray exists
    THREAD_BUS.register_event_handler('tray.native_unavailable', handle_native_tray_unavailable)
    # Language switch (UI settings / bus): persist + rebuild tray texts
    THREAD_BUS.register_event_handler('ui.i18n.language_changed', handle_language_changed)
    # Tray language submenu: one signal per supported language, both derived from
    # the same i18n supported-languages list as the menu itself (extensible by
    # adding a language to i18n_base.json + its translations file).
    supported = i18n.get_supported_languages()
    for code in supported:
        THREAD_BUS.register_event_handler(
            f'{TRAY_SET_LANGUAGE_SIGNAL}.{code}', make_set_language_handler(code))
    ColorPrint.green(f"[EventHandlers] Tray language handlers registered: {supported}")

    ColorPrint.green("[EventHandlers] Tray event handlers registered")

    # Register periodic heartbeat workers now that services (incl. the heartbeat
    # system) are up. Kept here because register_event_handlers() runs after
    # launcher.start(), so get_heartbeat_system() already has a running pusher to
    # accept callbacks.
    _register_heartbeat_workers()


def _register_heartbeat_workers():
    """
    Register pycore's periodic PyHeartbeat workers (idempotent).

    Registers (1) the translation WORKER (Laravel worker-task pipeline) and (2) the
    translation QUEUE MONITOR (queue snapshot + priority-bump detection). Both on
    the active launcher path so they run under `pycore_module_caller.py`. Toggle at
    runtime via POST /api/heartbeat/{enable,disable}/{translation_worker,
    translation_queue_monitor}.
    """
    try:
        heartbeat = get_heartbeat_system()
        worker = get_translation_worker_service(laravel_api_url=Config.LARAVEL_WORKER_API_URL)
        # Master-toggle gate (assist_laravel): while the assist_laravel section
        # is absent from user_data.json the legacy Config default applies
        # unchanged; once it exists, enabled && capabilities.translation rules.
        # Runtime changes are applied live by POST /api/local/assist/config.
        translation_enabled = translation_worker_enabled_on_start(
            Config.TRANSLATION_WORKER_ENABLED_ON_START)
        heartbeat.register_callback(
            name='translation_worker',
            callback=worker.poll_once,
            interval=Config.TRANSLATION_WORKER_INTERVAL,
            enabled=translation_enabled,
        )
        ColorPrint.green(
            f"[EventHandlers] Registered translation_worker callback "
            f"(interval={Config.TRANSLATION_WORKER_INTERVAL}s, "
            f"enabled={translation_enabled} (assist_laravel gate), "
            f"api={Config.LARAVEL_WORKER_API_URL})"
        )
    except Exception as e:
        ColorPrint.red(f"[EventHandlers] Failed to register translation_worker: {e}")

    # Assist-Laravel worker (cover + tts claim/generate/submit): wired here —
    # the active launcher path — right beside the translation worker so it
    # starts at sys-init whenever the persisted assist_laravel.enabled toggle
    # is on (default off). register_assist_worker_start() is exception-safe.
    register_assist_worker_start()

    try:
        heartbeat = get_heartbeat_system()
        # Shares the worker's discovered Laravel base URL (same LARAVEL_WORKER_API_URL).
        monitor = get_queue_monitor_service(
            laravel_api_url=Config.LARAVEL_WORKER_API_URL,
            bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
        )
        heartbeat.register_callback(
            name='translation_queue_monitor',
            callback=monitor.poll_once,
            interval=Config.TRANSLATION_QUEUE_MONITOR_INTERVAL,
            enabled=Config.TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START,
        )
        ColorPrint.green(
            f"[EventHandlers] Registered translation_queue_monitor callback "
            f"(interval={Config.TRANSLATION_QUEUE_MONITOR_INTERVAL}s, "
            f"enabled={Config.TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START}, "
            f"bump_ttl={Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS}s)"
        )
    except Exception as e:
        ColorPrint.red(f"[EventHandlers] Failed to register translation_queue_monitor: {e}")

    try:
        heartbeat = get_heartbeat_system()
        # Phase C: Reverb WS client (real-time queue events + multi-pycore word
        # coordination). Connects to Laravel's Reverb via Config.TRANSLATION_REVERB_*.
        # The 'supervise' callback only keeps the background WS thread alive (no
        # network I/O on the heartbeat thread). Registered HERE — the active
        # launcher path — so Phase C real-time actually starts under
        # pycore_module_caller.py (callmodule_main registers it on the native_ui path).
        ws_client = get_translation_ws_client(
            host=Config.TRANSLATION_REVERB_HOST,
            port=Config.TRANSLATION_REVERB_PORT,
            scheme=Config.TRANSLATION_REVERB_SCHEME,
            app_key=Config.TRANSLATION_REVERB_APP_KEY,
            channel=Config.TRANSLATION_REVERB_CHANNEL,
            word_ttl_seconds=Config.TRANSLATION_WS_WORD_TTL_SECONDS,
        )
        heartbeat.register_callback(
            name='translation_ws_client',
            callback=ws_client.supervise,
            interval=Config.TRANSLATION_WS_SUPERVISOR_INTERVAL,
            enabled=Config.TRANSLATION_WS_ENABLED_ON_START,
        )
        ColorPrint.green(
            f"[EventHandlers] Registered translation_ws_client callback "
            f"(interval={Config.TRANSLATION_WS_SUPERVISOR_INTERVAL}s, "
            f"enabled={Config.TRANSLATION_WS_ENABLED_ON_START})"
        )
    except Exception as e:
        ColorPrint.red(f"[EventHandlers] Failed to register translation_ws_client: {e}")
