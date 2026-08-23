# -*- coding: utf-8 -*-
"""
Runtime Event Handlers for Pycore Module Caller

Registers THREAD_BUS event handlers for tray actions.
This module only registers event handlers, does not start any threads.
"""

import os
import time
import webbrowser

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_DIFF_DELIVERY
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pylauncher.launcher import ServiceLauncher
from pycore.pythreadpool.starters import start_tray
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.codesync.manager import get_code_sync_manager
from pycore.pyctl.runtime.callmodule_config import Config
import pycore.pylauncher.platform.system_service_manager as ssm
from pycore.pyctl.ai.rate_reset_service import ai_rate_reset_service
from pycore.pyctl.agent_history.heartbeat import (
    register_agent_history_extraction,
)
from pycore.pyctl.queue_center.snapshot_service import queue_center_snapshot_service
from pycore.pyctl.relay import relay_service
from pycore.pyctl.runtime.system_settings_service import apply_persisted_system_settings
from pycore.pyctl.runtime.pyservice_mode_service import pyservice_mode_service
from pycore.pyctl.assist.assist_settings import (
    assist_callback_states,
    load_assist_settings,
)
from pycore.pyctl.assist.capability_sync import apply_assist_runtime
from pycore.pyctl.queue_center.lane_registry import (
    LANE_REGISTRY,
    lane_worker,
)
from pycore.pyctl.tts.sentence_audio_auto import (
    restore_persisted_auto_start as restore_sentence_audio_settings,
)
from pycore.pyctl.tts.word_tts_auto import (
    restore_persisted_auto_start as restore_word_audio_settings,
)
from pycore.pyutils.tts.tts_orchestrator import report_tts_engine_startup
from pycore.pylauncher.tray_menu import (
    TRAY_SET_LANGUAGE_SIGNAL,
    TRAY_TOGGLE_CODE_SYNC_DISTRIBUTE_SIGNAL,
    TRAY_TOGGLE_CODE_SYNC_SKIP_UPDATE_SIGNAL,
)
from pycore.pylauncher.tray_menu import update_tray_menu_with_singleton
from pycore.pylauncher.tray_codesync_cache import (
    apply_tray_codesync_cache_refresh,
    on_code_sync_update,
    start_tray_codesync_cache,
)


_RUNTIME_STEPS_COMPLETED = set()
# Heartbeat fallback cadence for the pull loops. The fast path is
# event-driven: Mercure queue events reach worker.request_pull() through the
# shared Queue Center socket, so these intervals only matter when realtime
# is down. 1-second fallbacks used to keep every worker in a permanent
# lockForUpdate claim transaction on the same global_tasks rows that the
# browser UI bumps, which is what caused the mutual timeouts.
_QUEUE_DIFF_INTERVAL_SECONDS = max(
    1,
    int(QUEUE_CENTER_DIFF_DELIVERY.get("poll_interval_ms") or 1000) // 1000,
)
# The canonical lane registry owns the control -> callback -> worker mapping;
# registration order follows the registry (translation, word, sentence).
_QUEUE_WORKER_CALLBACKS = tuple(
    (
        LANE_REGISTRY[control]["heartbeat_callback"],
        worker.poll_diff_once,
        _QUEUE_DIFF_INTERVAL_SECONDS,
    )
    for control, worker in (
        (control, lane_worker(control)) for control in LANE_REGISTRY
    )
    if worker is not None
)


def _apply_tray_service_toggle(launcher, port, singleton_port) -> None:
    """Apply one system-service toggle outside the event dispatcher."""
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


def register_event_handlers(
    launcher: ServiceLauncher,
    port: int,
    singleton_port: int = None,
    *,
    tray_config_builder,
):
    """
    Register THREAD_BUS event handlers for tray actions

    Args:
        launcher: ServiceLauncher instance
        port: RPC v2 server port
        singleton_port: Singleton port (included in the pystray fallback menu)
    """
    ColorPrint.blue("[EventHandlers] Registering tray event handlers...")

    apply_tray_codesync_cache_refresh(push_menu=False)
    start_tray_codesync_cache(
        launcher,
        port=port,
        singleton_port=singleton_port,
        menu_update_callback=update_tray_menu_with_singleton,
    )
    THREAD_BUS.register_event_handler(BusSignals.CODE_SYNC_UPDATE, on_code_sync_update, priority=5)

    # Guard so the pystray fallback is started at most once
    fallback_started = {'value': False}

    def handle_native_tray_unavailable(event_data):
        """Start the pystray tray as a fallback when no native system tray exists."""
        if fallback_started['value']:
            return
        fallback_started['value'] = True
        ColorPrint.yellow("[Tray] Native tray unavailable, starting pystray fallback...")
        try:
            cfg = tray_config_builder(port=port, singleton_port=singleton_port)
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
        timing = event_data.get("_tray_timing") if isinstance(event_data, dict) else None
        if isinstance(timing, dict):
            elapsed_ms = (time.perf_counter() - timing["started_at"]) * 1000
            ColorPrint.blue(
                f"[TrayTiming] id={timing.get('trace_id', '?')} handler_entered "
                f"wall={time.strftime('%Y-%m-%d %H:%M:%S')} elapsed={elapsed_ms:.3f}ms"
            )
        ColorPrint.blue("[Tray] Toggling voice subtitle window...")
        THREAD_BUS.trigger_event('voice_subtitle_ui.toggle', {"_tray_timing": timing})
        if isinstance(timing, dict):
            elapsed_ms = (time.perf_counter() - timing["started_at"]) * 1000
            ColorPrint.blue(
                f"[TrayTiming] id={timing.get('trace_id', '?')} toggle_event_sent "
                f"wall={time.strftime('%Y-%m-%d %H:%M:%S')} elapsed={elapsed_ms:.3f}ms"
            )
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
        start_bus_task(
            _apply_tray_service_toggle,
            launcher,
            port,
            singleton_port,
            thread_name="TrayServiceToggle",
        )

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
                store = user_data_store
                settings = store.get_section('system_settings') or {}
                if settings.get('lang') != lang:
                    saved = store.update_section('system_settings', {'lang': lang})
                    THREAD_BUS.trigger_event(BusSignals.SYSTEM_SETTINGS_UPDATE, {'settings': saved})
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
    THREAD_BUS.register_event_handler(BusSignals.I18N_LANGUAGE_CHANGED, handle_language_changed)
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
    # launcher.start(), so shared_heartbeat_system already has a running ticker to
    # accept callbacks.
    register_runtime_workers()


def register_runtime_workers() -> None:
    """
    Register pycore's periodic PyHeartbeat workers (idempotent).

    Queue worker callbacks are always registered. Persisted UI switches decide
    which callbacks are enabled, so processing continues after the UI closes.
    """
    heartbeat = shared_heartbeat_system
    if not heartbeat.is_running():
        heartbeat.start()

    assist_settings = load_assist_settings()
    callback_states = assist_callback_states(assist_settings)
    runtime_steps = (
        ("restore_word_audio", restore_word_audio_settings),
        ("restore_sentence_audio", restore_sentence_audio_settings),
    )
    for step_name, step in runtime_steps:
        if step_name in _RUNTIME_STEPS_COMPLETED:
            continue
        try:
            step()
            _RUNTIME_STEPS_COMPLETED.add(step_name)
        except Exception as exc:
            ColorPrint.red(f"[EventHandlers] Runtime step {step_name} failed: {exc}")
    for callback_name, callback, interval in _QUEUE_WORKER_CALLBACKS:
        step_name = f"queue_callback:{callback_name}"
        if step_name in _RUNTIME_STEPS_COMPLETED:
            continue
        try:
            heartbeat.register_callback(
                name=callback_name,
                callback=callback,
                interval=interval,
                enabled=callback_states[callback_name],
            )
            _RUNTIME_STEPS_COMPLETED.add(step_name)
        except Exception as exc:
            ColorPrint.red(f"[EventHandlers] Runtime step {step_name} failed: {exc}")
    apply_assist_runtime(assist_settings)
    service_steps = (
        ("queue_center_snapshot", queue_center_snapshot_service.start),
        ("agent_history", register_agent_history_extraction),
    )
    if pyservice_mode_service.relay_enabled():
        service_steps = (
            ("relay_service", relay_service.start),
            *service_steps,
        )
    for step_name, step in service_steps:
        if step_name in _RUNTIME_STEPS_COMPLETED:
            continue
        try:
            step()
            _RUNTIME_STEPS_COMPLETED.add(step_name)
        except Exception as exc:
            ColorPrint.red(f"[EventHandlers] Runtime step {step_name} failed: {exc}")

    # Agent-history extraction worker (backfill -> live article pipeline):
    # previously registered ONLY on the native_ui path (callmodule_main), so
    # "auto process history" never ticked under pycore_module_caller.
    rate_interval = 30
    raw_interval = os.environ.get("PYCORE_AI_RATE_RESET_INTERVAL", "").strip()
    if raw_interval.isdigit() and int(raw_interval) > 0:
        rate_interval = int(raw_interval)
    rate_enabled = os.environ.get("PYCORE_AI_RATE_RESET", "1").strip().lower()
    if "ai_rate_reset" not in _RUNTIME_STEPS_COMPLETED:
        try:
            heartbeat.register_callback(
                name="ai_rate_reset",
                callback=ai_rate_reset_service.tick,
                interval=rate_interval,
                enabled=rate_enabled not in ("0", "false", "no"),
            )
            _RUNTIME_STEPS_COMPLETED.add("ai_rate_reset")
        except Exception as exc:
            ColorPrint.red(f"[EventHandlers] Runtime step ai_rate_reset failed: {exc}")
    final_steps = (
        ("system_settings", apply_persisted_system_settings),
        ("tts_engine_startup", report_tts_engine_startup),
    )
    for step_name, step in final_steps:
        if step_name in _RUNTIME_STEPS_COMPLETED:
            continue
        try:
            step()
            _RUNTIME_STEPS_COMPLETED.add(step_name)
        except Exception as exc:
            ColorPrint.yellow(f"[EventHandlers] Runtime step {step_name} failed: {exc}")


__all__ = ["register_event_handlers", "register_runtime_workers"]
