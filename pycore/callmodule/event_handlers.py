# -*- coding: utf-8 -*-
"""
Event Handlers for Pycore Module Caller

Registers THREAD_BUS event handlers for tray actions.
This module only registers event handlers, does not start any threads.
"""

import os
import threading
import time
import webbrowser

from pycore import ColorPrint, THREAD_BUS, get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pylauncher import ServiceLauncher
from pycore.pythreadpool.starters import start_tray
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.pyutils.codesync import get_code_sync_manager
from pycore.callmodule.callmodule_config import Config
from pycore.callmodule.platform import system_service_manager as ssm
from pycore.pyctl.assist import translation_worker_enabled_on_start
from pycore.callmodule.services import (
    get_translation_worker_service,
    get_queue_monitor_service,
    get_translation_ws_client,
)
from pycore.callmodule.services.assist_wiring import register_assist_runtime
from pycore.callmodule.services.heartbeat_tts_workers import (
    register_sentence_queue_monitor,
    register_tts_queue_poller,
    register_tts_sentence_worker,
)
from pycore.callmodule.services.heartbeat_agent_history import (
    register_agent_history_extraction,
)
from pycore.callmodule.services.heartbeat_worker_prefs import restore_persisted_heartbeat_prefs
from pycore.callmodule.services.system_settings_boot import apply_persisted_system_settings
from pycore.callmodule.tray_menu import (
    TRAY_SET_LANGUAGE_SIGNAL,
    TRAY_TOGGLE_CODE_SYNC_DISTRIBUTE_SIGNAL,
    TRAY_TOGGLE_CODE_SYNC_SKIP_UPDATE_SIGNAL,
)
from pycore.callmodule.config import build_tray_service_config
from pycore.callmodule.tray_menu import update_tray_menu_with_singleton
from pycore.callmodule.tray_codesync_cache import (
    apply_tray_codesync_cache_refresh,
    on_code_sync_update,
    start_tray_codesync_cache,
)


class TrayServiceToggleThread(threading.Thread):
    """Apply one system-service toggle from a THREAD_BUS payload."""

    def __init__(self, queue_name: str) -> None:
        super().__init__(name='TrayServiceToggle', daemon=True)
        self._queue_name = queue_name

    def run(self) -> None:
        payload = THREAD_BUS.receive_message(self._queue_name)
        if not isinstance(payload, dict):
            return
        launcher = payload.get('launcher')
        port = payload.get('port')
        singleton_port = payload.get('singleton_port')
        try:
            if not ssm.is_supported():
                ColorPrint.yellow(
                    "[Tray] systemd not available; service toggle is a no-op."
                )
                return
            if ssm.pycore_service_enabled():
                result = ssm.disable_pycore_only()
                ColorPrint.green(
                    f"[Tray] Service disabled: pycore enabled="
                    f"{result.get('enabled')}. UI left running="
                    f"{result.get('ui_left_running')}"
                )
                command = result.get('ui_remove_command') or ''
                if command:
                    ColorPrint.yellow(
                        f"[Tray] To remove the UI unit too, run:\n    {command}"
                    )
            else:
                result = ssm.enable_both()
                ColorPrint.green(
                    f"[Tray] Service enabled: pycore="
                    f"{result['pycore'].get('enabled')} "
                    f"ui={result['ui'].get('enabled')}"
                )
        except Exception as exc:
            ColorPrint.red(f"[Tray] Service toggle failed: {exc}")
        finally:
            try:
                update_tray_menu_with_singleton(
                    launcher,
                    port=port,
                    singleton_port=singleton_port,
                )
            except Exception as exc:
                ColorPrint.yellow(
                    f"[Tray] Menu re-push after service toggle failed: {exc}"
                )
            THREAD_BUS.clear_queue(self._queue_name)


def register_event_handlers(launcher: ServiceLauncher, port: int, singleton_port: int = None):
    """
    Register THREAD_BUS event handlers for tray actions

    Args:
        launcher: ServiceLauncher instance
        port: RPC v2 server port
        singleton_port: Singleton port (included in the pystray fallback menu)
    """
    ColorPrint.blue("[EventHandlers] Registering tray event handlers...")

    apply_tray_codesync_cache_refresh(push_menu=False)
    start_tray_codesync_cache(launcher, port=port, singleton_port=singleton_port)
    THREAD_BUS.register_event_handler("code_sync_update", on_code_sync_update, priority=5)

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
        """Open the web interface in browser.

        Opens the pycore-manager dashboard frontend (served by the unified shell
        on the UI port, default 13054), NOT the RPC backend homepage on the rpc
        port. The frontend URL is resolved in priority order:
          1. PYCORE_UI_URL env (exported by pyservice.sh/.ps1 after launching the
             UI dev server -> http://localhost:<UI_PORT>/pycore-manager)
          2. http://localhost:<PYCORE_UI_PORT|13054>/pycore-manager
        The RPC backend on `port` keeps running unaffected; it is only the
        last-resort target when no UI is configured (headless / legacy runs).
        """
        ColorPrint.blue("[Tray] Opening web interface...")
        ui_url = os.environ.get('PYCORE_UI_URL')
        if not ui_url:
            ui_port = os.environ.get('PYCORE_UI_PORT') or '13054'
            ui_url = f"http://localhost:{ui_port}/pycore-manager"
        try:
            webbrowser.open(ui_url)
        except Exception as e:
            # Last resort: fall back to the RPC backend homepage so the tray
            # action never silently no-ops when the frontend is unreachable.
            ColorPrint.yellow(f"[Tray] Failed to open UI ({ui_url}): {e}; falling back to RPC port {port}")
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

    # Auto-start on boot is toggled from the pycore-manager UI (Settings ->
    # Startup) via GET/POST /api/manage/control/autostart, so the tray no longer
    # carries a toggle and this handler was removed. The boot-time
    # refresh_startup_launcher() in pycore_module_caller.py is unaffected.

    def handle_tray_toggle_voice_subtitle(event_data):
        """Toggle voice subtitle window visibility via THREAD_BUS"""
        ColorPrint.blue("[Tray] Toggling voice subtitle window...")
        THREAD_BUS.trigger_event('voice_subtitle_ui.toggle', {})
        ColorPrint.green("[Tray] Voice subtitle window toggle event sent")

    def handle_tray_toggle_service(event_data):
        """Toggle pycore (+ UI) as systemd system services (Linux only).

        ON  -> install BOTH the `pycore` and `ncore-nexus-dash` units (start on
               boot). OFF -> remove ONLY the `pycore` unit; the UI unit is left
               running and its removal command is printed. The long install/
               uninstall runs in a background daemon thread so the tick/tray
        thread is never blocked. The menu is re-pushed afterwards so the
        [X]/[ ] state refreshes live.
        """
        request_id = f"{threading.get_ident()}.{time.time_ns()}"
        queue_name = f"callmodule.tray.service_toggle.{request_id}"
        THREAD_BUS.send_message(queue_name, {
            'launcher': launcher,
            'port': port,
            'singleton_port': singleton_port,
        })
        TrayServiceToggleThread(queue_name).start()

    def handle_tray_toggle_code_sync_distribute(event_data):
        """Toggle dev-end code distribution (same CodeSyncManager as the UI API)."""
        ColorPrint.blue("[Tray] Toggling code sync distribute...")
        try:
            mgr = get_code_sync_manager()
            if mgr.get_role() != "dev":
                ColorPrint.yellow("[Tray] Distribute toggle only applies to dev role")
                return
            result = mgr.set_distributing(not mgr.distributing)
            if result.get("success"):
                ColorPrint.green(f"[Tray] Code sync distribute: {result.get('message', result)}")
                apply_tray_codesync_cache_refresh(push_menu=True)
            else:
                ColorPrint.yellow(f"[Tray] Code sync distribute failed: {result.get('message', result)}")
        except Exception as e:
            ColorPrint.red(f"[Tray] Code sync distribute toggle failed: {e}")

    def handle_tray_toggle_code_sync_skip_update(event_data):
        """Toggle client skip-update (same CodeSyncManager as the UI API)."""
        ColorPrint.blue("[Tray] Toggling code sync skip-update...")
        try:
            mgr = get_code_sync_manager()
            if mgr.get_role() != "client":
                ColorPrint.yellow("[Tray] Skip-update toggle only applies to client role")
                return
            if mgr.light:
                ColorPrint.yellow("[Tray] Skip-update toggle not available in light client mode")
                return
            result = mgr.set_skip_update(not mgr.is_skip_update())
            if result.get("success"):
                ColorPrint.green(f"[Tray] Code sync skip-update: {result.get('message', result)}")
                apply_tray_codesync_cache_refresh(push_menu=True)
            else:
                ColorPrint.yellow(f"[Tray] Code sync skip-update failed: {result.get('message', result)}")
        except Exception as e:
            ColorPrint.red(f"[Tray] Code sync skip-update toggle failed: {e}")

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
    THREAD_BUS.register_event_handler('tray_action_toggle_voice_subtitle', handle_tray_toggle_voice_subtitle)
    # Linux system-service toggle (install both units / remove pycore only).
    THREAD_BUS.register_event_handler('tray_action_toggle_service', handle_tray_toggle_service)
    THREAD_BUS.register_event_handler(
        TRAY_TOGGLE_CODE_SYNC_DISTRIBUTE_SIGNAL, handle_tray_toggle_code_sync_distribute)
    THREAD_BUS.register_event_handler(
        TRAY_TOGGLE_CODE_SYNC_SKIP_UPDATE_SIGNAL, handle_tray_toggle_code_sync_skip_update)
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

    Registers TTS word/sentence workers, the translation WORKER, the translation
    QUEUE MONITOR, and the sentence-audio monitor on the active launcher path
    (`pycore_module_caller.py`). Toggle at runtime via POST
    /api/heartbeat/{enable,disable}/<callback> or Queue Center assist toggles.
    """
    # TTS workers live in callmodule_main_entry on the native_ui path; mirror them
    # here so assist_laravel voice toggles can enable callbacks that exist.
    try:
        register_tts_queue_poller()
        register_tts_sentence_worker()
        register_sentence_queue_monitor()
    except Exception as e:
        ColorPrint.red(f"[EventHandlers] Failed to register TTS/sentence heartbeat workers: {e}")

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

    # Apply the persisted control plane after every callback is registered.
    register_assist_runtime()

    # Agent-history extraction worker (backfill -> live article pipeline):
    # previously registered ONLY on the native_ui path (callmodule_main), so
    # "auto process history" never ticked under pycore_module_caller.
    try:
        register_agent_history_extraction()
    except Exception as e:
        ColorPrint.red(f"[EventHandlers] Failed to register agent_history_extraction: {e}")

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

    try:
        restore_persisted_heartbeat_prefs()
        apply_persisted_system_settings()
    except Exception as e:
        ColorPrint.yellow(f"[EventHandlers] Worker prefs / system_settings restore: {e}")
