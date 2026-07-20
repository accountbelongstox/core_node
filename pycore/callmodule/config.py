# -*- coding: utf-8 -*-
"""
LauncherConfig Builder for Pycore Module Caller

Builds LauncherConfig for different platforms.
Does NOT start any threads or services.
"""

import asyncio
import ctypes
import os
import platform
from pathlib import Path

# Optional environment-dependent stdlib module (absent on some headless Linux
# builds): top-of-file try + availability flag, never imported inside functions.
try:
    import tkinter
    TKINTER_AVAILABLE = True
except ImportError:
    tkinter = None
    TKINTER_AVAILABLE = False

from pycore import ColorPrint, THREAD_BUS, get_user_data_store
from pycore.pyfoundations.third_party import get_third_package_fastapi
from pycore.pylauncher import LauncherConfig
from pycore.pyutils.codesync import get_code_sync_manager, configure as configure_codesync
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.callmodule.tray_menu import build_tray_menu, tray_menu_to_dicts
from pycore.callmodule.callmodule_config import Config as CallmoduleConfig

# Modular per-area WS RPC route registration (speech-routes convention: one file
# per area, register_<area>_routes(server)). The 11 desktop-UI WS RPC handlers
# + THREAD_BUS broadcast listeners live there; _init_rpc_routes wires them up.
from pycore.callmodule.rpc_routes import (
    register_thread_bus_routes,
    register_video_extract_routes,
    register_media_routes,
    register_corebook_routes,
    register_laravel_api_routes,
    register_local_http_routes,
    register_local_engine_test_routes,
)

# Structured pycore->Laravel request recorder: every LaravelClient call (and the
# endpoint-manager health probe) notify it. Wired below into a 'laravel_http' WS
# event so the dashboard PcHttpDebugger sees URL/params/status/duration live.
from pycore.callmodule.services.sync.laravel_http_recorder import register_laravel_http_callback

# Unified priority-bump hub (any queue lane): wired below into a 'queue_bump'
# WS event so the dashboard PcQueueBumpToasts sees bumps pushed in real time
# (the 4s poll stays as fallback).
from pycore.callmodule.services.queue_bump_hub import register_queue_bump_callback

# Unified AI gateway -> desktop pipeline composition (pyctl/* packages must not
# import each other, so the APP layer wires the gateway into the desktop hooks).
from pycore.pyctl.ai import generate_text as ai_generate_text, describe_image as ai_describe_image
from pycore.pyctl.desktop.ai_hooks import set_ai_handlers

# Import management layer routers
from pycore.callmodule.routers.management import (
    status_router,
    config_router,
    control_router,
    logs_router,
    capabilities_router,
    local_config_router,
    local_stats_router,
    local_test_router,
    heartbeat_router,
)

# Import local processing layer routers (NEW)
from pycore.callmodule.routers.local import (
    screenshot_router,
    image_router,
    audio_router,
    file_router,
    video_router,
    video_extract_router,
    system_resources_router,
    user_data_router,
    books_router,
    corebook_router,
    ai_probe_router,
    ai_chat_router,
    ai_image_router,
    ai_keys_router,
    ocr_status_router,
    tts_status_router,
    stt_status_router,
    engines_load_status_router,
    speech_history_router,
    capability_status_router,
    translation_queue_router,
    task_center_router,
    queue_overview_router,
    queue_bumps_router,
    task_history_router,
    assist_router,
    poster_router,
    image_search_router,
    sentence_audio_router,
    dictionary_router,
    word_audio_router,
    word_tts_router,
    heartbeat_workers_router,
    agent_history_router,
    task_settings_router,
    version_router,
)

# Import upload layer routers (NEW)
from pycore.callmodule.routers.upload import router as upload_router

# Import client layer routers (NEW)
from pycore.callmodule.routers.client import router as client_router

# Import legacy routers (from independent files - still active)
from pycore.callmodule.routers.mcp_router import mcp_router
from pycore.callmodule.routers.code_sync_router import router as code_sync_router
from pycore.callmodule.routers.module_call_router import module_call_router
from pycore.callmodule.routers.notebooklm_stt_router import router as notebooklm_stt_router

# Web UI routes (homepage, /web, /web/subtitle redirect, favicon)
from pycore.callmodule.routers.web_router import router as web_router

# Voice subtitle API (queue, add-text/image/voice, audio, categories, tasks,
# clipboard/screenshot monitors) — consumed by the desktop UI at /voice-subtitle/*
from pycore.callmodule.routers.voice_subtitle_router import router as voice_subtitle_router

IS_WINDOWS = platform.system() == 'Windows'
IS_LINUX = platform.system() == 'Linux'

# Desired main-window size for the new desktop-manager UI. Clamped to the screen
# (minus a margin) when the display is too small to fit it.
UI_DESIRED_WINDOW_SIZE = (1788, 1159)


def _get_screen_size():
    """Best-effort (width, height) of the primary screen, or None if unknown.

    TODO(modular-split): move _get_screen_size + _resolve_window_size +
    UI_DESIRED_WINDOW_SIZE into callmodule_config/ (screen/window sizing is a
    config concern, not a launcher-config-builder concern). Deferred to keep this
    split focused on the WS RPC route seams.
    """
    try:
        if IS_WINDOWS:
            user32 = ctypes.windll.user32
            return int(user32.GetSystemMetrics(0)), int(user32.GetSystemMetrics(1))
    except Exception:
        pass
    if not TKINTER_AVAILABLE:
        return None
    try:
        root = tkinter.Tk()
        root.withdraw()
        size = (root.winfo_screenwidth(), root.winfo_screenheight())
        root.destroy()
        return size
    except Exception:
        return None


def _resolve_window_size():
    """
    Return the window size: the desired 1788x1159, but shrunk to fit when the
    screen is too small (use a screen-appropriate size instead of overflowing).
    """
    desired_w, desired_h = UI_DESIRED_WINDOW_SIZE
    screen = _get_screen_size()
    if not screen:
        return (desired_w, desired_h)
    sw, sh = screen
    margin = 80  # leave room for taskbar / window chrome
    return (min(desired_w, max(640, sw - margin)),
            min(desired_h, max(480, sh - margin)))


def _resolve_tray_icon_path():
    """Resolve the tray icon absolute path, or None if the file is missing.

    TODO(modular-split): move _resolve_tray_icon_path + build_tray_service_config
    into callmodule/tray_menu.py (they are tray concerns). Deferred to keep this
    split focused on the WS RPC route seams; both stay re-exported from here.
    """
    pycore_root = Path(__file__).parent.parent
    icon_path = pycore_root / CallmoduleConfig.TRAY_ICON_PATH_REL
    return str(icon_path) if icon_path.exists() else None


def apply_saved_language():
    """
    Apply the persisted UI language (system_settings.lang) to the Python i18n
    manager so native surfaces (tray menu, startup/main windows) speak the same
    language as the web UI. With nothing saved the i18n default ("en" from
    i18n_base.json) stays in effect — no OS-locale guessing.
    """
    try:
        lang = (get_user_data_store().get_section('system_settings') or {}).get('lang')
        if lang and lang in i18n.get_supported_languages():
            i18n.set_language(lang)
            ColorPrint.blue(f"[ConfigBuilder] Applied saved UI language: {lang}")
    except Exception as e:
        ColorPrint.yellow(f"[ConfigBuilder] Could not apply saved language: {e}")


def build_tray_service_config(port: int, singleton_port: int = None) -> dict:
    """
    Build the pystray tray service config dict.

    The native Qt tray (in the UI thread) is the default; this config is only
    used for the pystray fallback, started on demand when no system tray is
    available (THREAD_BUS event 'tray.native_unavailable').
    """
    return {
        'app_name': CallmoduleConfig.TRAY_APP_NAME,
        'app_id': CallmoduleConfig.UI_APP_ID,
        'icon_path': _resolve_tray_icon_path(),
        'menu_items': build_tray_menu(port=port, singleton_port=singleton_port),
        'trigger_shutdown_on_exit': CallmoduleConfig.TRAY_TRIGGER_SHUTDOWN_ON_EXIT,
        # Selects the independent native backend: win32 (Windows) / AppIndicator
        # (Ubuntu). "pystray" forces the cross-platform fallback.
        'backend': CallmoduleConfig.TRAY_BACKEND,
    }


def _register_code_sync_ws(app) -> None:
    """Serve the Code Sync file-push RECEIVER (``/code-sync/ws``) on the rpc_v2
    FastAPI app (:59000).

    Channel map (see CODE_SYNC_MESH.md): the UI talks to pycore over ``/rpc/ws``
    (:59000); pycore talks to laravel over :9000 (the "Laravel endpoint"
    selection); and the dev→client code-sync file push dials INTO each client
    peer here, at ``/code-sync/ws`` on the SAME :59000 server.

    Previously this WS route existed ONLY in the standalone codesync daemon
    (``pyutils/codesync/http_server.py``), which full pycore never starts — so a
    peer running full pycore answered ``WsPush`` handshakes with ``404 Not
    Found``. Registering it here closes that gap: the receiver runs on the live
    server every peer already exposes on :59000.

    Bridges Starlette's async WebSocket to the library's SYNC
    ``PushReceiver.handle_text(text, send)``: each frame is applied on a worker
    thread (file I/O) and its replies are scheduled back on the server loop.
    """
    fastapi_pkg = get_third_package_fastapi()
    WebSocketDisconnect = fastapi_pkg.WebSocketDisconnect

    @app.websocket("/code-sync/ws")
    async def code_sync_ws(websocket):
        await websocket.accept()
        receiver = get_code_sync_manager().push_receiver
        loop = asyncio.get_running_loop()

        def send(text: str) -> None:
            # Called from the worker thread inside handle_text(); hand the reply
            # back to the server loop (cross-thread safe, fire-and-forget).
            asyncio.run_coroutine_threadsafe(websocket.send_text(text), loop)

        try:
            while True:
                text = await websocket.receive_text()
                keep = await asyncio.to_thread(receiver.handle_text, text, send)
                if not keep:
                    break
        except WebSocketDisconnect:
            pass
        except Exception as exc:
            ColorPrint.yellow(f"[CodeSync WS] receiver error: {exc}")
        finally:
            try:
                await websocket.close()
            except Exception:
                pass


def _init_rpc_routes(server):
    """
    Register the RPC routes/listeners the desktop UI needs over WebSocket.

    The 11 WS RPC handlers + THREAD_BUS broadcast listeners are registered by the
    per-area ``register_<area>_routes`` functions in ``pycore.callmodule.rpc_routes``
    (one file per area, speech-routes convention). This orchestrator wires them up
    and then performs the APP-level Code Sync warm-up (which must stay here:
    ``_register_code_sync_ws`` serves the ``/code-sync/ws`` receiver on the rpc_v2
    app, and the manager boot starts the status mesh + file puller at startup).

    Called by start_rpc_v2 with the FastAPIRPCServer instance after start.
    """
    try:
        # Register WS RPC routes by functional area (modular).
        register_thread_bus_routes(server)
        register_video_extract_routes(server)
        register_media_routes(server)
        register_corebook_routes(server)
        register_laravel_api_routes(server)
        register_local_http_routes(server)
        register_local_engine_test_routes(server)

        # Boot the Code Sync manager now (the tray no longer instantiates it):
        # this starts the status mesh for every role and the file puller for
        # clients (which receive code by default) right at startup, instead of
        # lazily on the first UI request.
        try:
            # Inject pycore's services into the standalone Code Sync library so it
            # logs through ColorPrint, fires UI events via THREAD_BUS, and honours
            # the global shutdown - the same library that runs headless under
            # `pyservice.sh codesync`. Must run BEFORE the first get_manager().
            configure_codesync(
                logger=ColorPrint,
                emit_event=THREAD_BUS.trigger_event,
                is_shutdown_requested=THREAD_BUS.is_shutdown_requested,
                register_shutdown_handler=THREAD_BUS.register_shutdown_handler,
                # Node-local light-mode toggle (mesh-only client). Passed BEFORE the
                # first get_code_sync_manager() below so the manager reads it in
                # __init__; honours the CODESYNC_LIGHT env truthy set.
                light=os.environ.get('CODESYNC_LIGHT', '') in ('1', 'true', 'True', 'yes', 'on'),
            )
            get_code_sync_manager()
            # Serve the codesync file-push receiver (/code-sync/ws) on THIS
            # rpc_v2 server (:59000) so peers running full pycore accept the
            # dev's pushes - closes the "ws handshake failed: 404" gap where the
            # route only existed in the never-started standalone daemon.
            _register_code_sync_ws(server.app)
        except Exception as e:
            ColorPrint.yellow(f"[ConfigBuilder] Code Sync manager warm-up failed: {e}")
        # Live backend output -> UI ('pycore_log') needs NO wiring here: ColorPrint
        # streams every line to this server's WS clients directly (the server
        # registered itself + enabled streaming in FastAPIRPCServer.__init__).
        # Structured pycore->Laravel request records -> UI 'laravel_http' WS event
        # (PcHttpDebugger). Mirrors the ColorPrint->pycore_log pipe but carries
        # structured fields (method/path/params/status/ms) instead of free text.
        try:
            def _laravel_http_ws_callback(record):
                server.broadcast_event_sync("laravel_http", record)
            register_laravel_http_callback(_laravel_http_ws_callback)
        except Exception as e:
            ColorPrint.yellow(f"[ConfigBuilder] laravel_http WS bridge not wired: {e}")
        # Priority-bump records (any queue lane) -> UI 'queue_bump' WS event
        # (PcQueueBumpToasts). Same observer pattern as the laravel_http bridge.
        try:
            def _queue_bump_ws_callback(record):
                server.broadcast_event_sync("queue_bump", record)
            register_queue_bump_callback(_queue_bump_ws_callback)
        except Exception as e:
            ColorPrint.yellow(f"[ConfigBuilder] queue_bump WS bridge not wired: {e}")
        ColorPrint.green("[ConfigBuilder] Registered RPC WS bridge (thread_bus.trigger_event + broadcasts)")
    except Exception as e:
        ColorPrint.yellow(f"[ConfigBuilder] Failed to register RPC WS bridge: {e}")


def build_launcher_config(host='0.0.0.0', port=59000, debug=False):
    """
    Build LauncherConfig for Pycore Module Caller

    Args:
        host: RPC v2 server host
        port: RPC v2 server port
        debug: Debug mode

    Returns:
        LauncherConfig instance
    """
    ColorPrint.blue("[ConfigBuilder] Building launcher configuration...")

    # Warm the unified user-data store so user data (system settings, video-extract
    # history) is read from disk at startup and ready before the UI connects.
    try:
        get_user_data_store()
    except Exception as e:
        ColorPrint.yellow(f"[ConfigBuilder] User data store warm-up failed: {e}")

    # Sync the Python-side i18n (tray, native windows) with the saved UI language
    # BEFORE any tray menu text is baked below (tray_menu_to_dicts renders now).
    apply_saved_language()

    # Wire the unified AI gateway into the desktop voice-subtitle pipelines
    # (screenshot/clipboard monitors, image input). Single AI exit: smart
    # provider dispatch + quota/cooldown handling + per-task records.
    set_ai_handlers(text_handler=ai_generate_text, image_handler=ai_describe_image)

    # Define static mounts configuration
    PYCORE_ROOT = Path(__file__).parent.parent
    DESKTOP_UI_DIR = PYCORE_ROOT / "pyctl" / "desktop" / "ui"

    static_mounts = []
    if DESKTOP_UI_DIR.exists():
        static_mounts.append({
            'url_prefix': '/desktop',
            'directory': str(DESKTOP_UI_DIR),
            'name': 'desktop_ui_static'
        })
        ColorPrint.blue(f"[ConfigBuilder] Added static mount: /desktop -> {DESKTOP_UI_DIR}")

    # RPC v2 JavaScript client (defines FastAPIWsRpcClient used by the desktop UI
    # via <script src="/js/rpc/ws_rpc_client.js">)
    RPC_CLIENT_DIR = PYCORE_ROOT / "pyutils" / "rpc_v2" / "client"
    if RPC_CLIENT_DIR.exists():
        static_mounts.append({
            'url_prefix': '/js/rpc',
            'directory': str(RPC_CLIENT_DIR),
            'name': 'rpc_client_js'
        })
        ColorPrint.blue(f"[ConfigBuilder] Added static mount: /js/rpc -> {RPC_CLIENT_DIR}")

    # Base services (common to all platforms)
    services = {
        'heartbeat': {},
        'rpc_v2': {
            'port': port,
            'host': host,
            'debug': debug,
            'fastapi_routers': [
                # === Management Layer Routers ===
                status_router,           # System status endpoint
                config_router,           # System configuration endpoints
                control_router,          # System control operations
                logs_router,             # Log management endpoints
                capabilities_router,     # Local processing capabilities
                local_config_router,     # Local processing configuration
                local_stats_router,      # Local processing statistics
                local_test_router,       # Local processing test endpoint
                heartbeat_router,        # PyHeartbeat callback enable/disable/stats (translation_worker, tts_queue_poller)

                # === Local Processing Layer Routers (Edge Computing) ===
                screenshot_router,       # Screenshot capture with auto-OCR
                image_router,            # Image OCR and processing
                audio_router,            # Audio transcription and subtitle generation
                file_router,             # File analysis (PDF/DOCX/XLSX)
                video_router,            # Video processing (audio extraction, subtitles)
                video_extract_router,    # Batch/single video -> audio + tiny-mp4 + subtitle (whisper)
                system_resources_router, # Live CPU/memory/GPU snapshot (/api/local/system/resources)
                user_data_router,        # Unified user data: system settings + video-extract history
                books_router,            # Books document analyze/preview (/api/local/books): scan + multi-language stats + preview
                corebook_router,         # CoreBook portable bundles (/api/local/corebook): convert/enrich/submit
                ai_probe_router,         # AI provider probe (/api/local/ai/probe): configured/available/models
                ai_chat_router,          # AI chat confirm (/api/local/ai/chat): send a message, get the reply
                ai_image_router,         # AI image generation (/api/local/ai/image): prompt -> base64 image via gateway
                ai_keys_router,          # AI provider key pool (/api/local/ai/keys): set/delete/masked status
                ocr_status_router,       # OCR engine availability (/api/local/ocr/status): windows/easyocr/cnocr priority
                tts_status_router,       # TTS live availability + version (/api/local/tts/status) + live /test per engine
                stt_status_router,       # STT engine availability (/api/local/stt/status) + live /test: faster-whisper/whisper/vosk/azure
                engines_load_status_router, # Unified model-load progress for ALL engines (/api/local/engines/load-status): class-B models + class-C servers, TTS+STT
                speech_history_router,   # Speech (TTS/STT) clip history (/api/local/speech/history): list/file/reveal/delete/clear for the Records timeline
                capability_status_router,# CUDA/GPU readiness + free-library availability (/api/local/capabilities/status)
                translation_queue_router,# Translation queue monitor + control proxy (/api/local/translation/queue)
                task_center_router,      # Unified task-center aggregate (/api/local/task-center) — mirrors laravel_main /api/task-center/overview
                queue_overview_router,   # Unified queue overview — never-blind category catalog incl ai_translate+subtitle_search (/api/local/queue/overview)
                queue_bumps_router,      # Cross-lane priority bump feed (/api/local/queue/bumps)
                task_history_router,     # Recent-task cross-end log + clear (/api/local/tasks/recent, /clear)
                assist_router,           # Assist-Laravel worker control (/api/local/assist): status/config/cycle for cover+tts generation
                poster_router,           # Movie/TV poster status+config+test (/api/local/poster): TMDB/OMDB/SerpApi key status + fetch toggle + lookup preview
                image_search_router,     # SerpApi Google-Images search + AI compare + history (/api/local/image-search)
                sentence_audio_router,   # Sentence-library audio auto-start + run-once (/api/local/sentence-audio)
                word_tts_router,         # Word-dictionary TTS auto-start + run-once (/api/local/word-tts)
                heartbeat_workers_router,# Heartbeat worker status + monitor/WS toggles (/api/local/heartbeat-workers)
                dictionary_router,       # Offline ECDICT+WordNet word dictionary (/api/local/dictionary): lookup + status
                word_audio_router,       # Real word pronunciation chain status+test (/api/local/word-audio): free-dict/cambridge/forvo + base64 audio
                agent_history_router,    # Local AI agent history (/api/local/agent-history): Claude/Codex/Cursor/Gemini txt store
                task_settings_router,    # Per-task-type capability chains (/api/local/task-settings/chains)
                version_router,          # Code-version chip: pycore own newest-source mtime + proxied laravel version (/api/local/version)

                # === Upload Layer Routers ===
                upload_router,           # Upload task management and server config

                # === Client Layer Routers ===
                client_router,           # Remote server request forwarding

                # === Legacy Routers (Still Active) ===
                mcp_router,              # MCP backend routes (file, database, codebase tools)
                code_sync_router,        # Code sync routes
                module_call_router,      # Module call API routes
                notebooklm_stt_router,   # NotebookLM STT routes

                # === Web UI Routes ===
                web_router,              # Homepage, /web, /web/subtitle redirect, favicon

                # === Voice Subtitle API (desktop UI backend) ===
                voice_subtitle_router,   # /voice-subtitle/* queue, TTS add, audio, monitors
            ],
            'static_mounts': static_mounts,  # Mount static files
            'init_callback': _init_rpc_routes,  # Register WS RPC bridge (thread_bus.trigger_event)
        },
    }

    # Add UI service (voice subtitle window) - from callmodule_config/config.py
    # Note: Only on Windows for now, can be extended to other platforms
    if IS_WINDOWS:
        # New desktop-manager UI wants a large window (1788x1159), clamped to the
        # screen when too small (falls back to a screen-appropriate size).
        window_size_tuple = _resolve_window_size()
        services['ui'] = {
            'app_name': CallmoduleConfig.UI_APP_NAME,
            'app_id': CallmoduleConfig.UI_APP_ID,
            'window_size': window_size_tuple,
            # The PySide6 webview loads the new React "Desktop Manager" UI when
            # PYCORE_UI_URL is set (pyservice.ps1/.sh exports it after launching the
            # UI dev server, default http://localhost:13054). Falls back to the
            # legacy in-process /web/subtitle page when unset (e.g. direct runs).
            'webview_url': os.environ.get('PYCORE_UI_URL') or f'http://localhost:{port}/web/subtitle',
            'show_on_start': CallmoduleConfig.UI_SHOW_ON_START,
            'frameless': CallmoduleConfig.UI_FRAMELESS,
            # No Qt custom title bar: the embedded React UI renders its own
            # (i18n) simulated title bar / header, so we avoid duplicate bars.
            'enable_title_bar': CallmoduleConfig.UI_ENABLE_TITLE_BAR,
            'icon_path': _resolve_tray_icon_path(),  # PY logo for window + taskbar
            # The Voice Subtitle window lives in the tray: close/minimize hide it
            # back to the tray instead of quitting (tray "Exit" is the real quit).
            'minimize_to_tray': True,
            'close_to_tray': True,
            'enable_tray': CallmoduleConfig.UI_ENABLE_TRAY,
            # PySide6 Qt tray menu (only built when TRAY_BACKEND == "pyside"; the
            # native pystray tray builds its own menu in the 'tray' service).
            # Singleton port is appended later via update_tray_menu_with_singleton().
            'tray_icon_path': _resolve_tray_icon_path() if CallmoduleConfig.UI_ENABLE_TRAY else None,
            'tray_menu_items': tray_menu_to_dicts(build_tray_menu(port=port)) if CallmoduleConfig.UI_ENABLE_TRAY else [],
            'enable_webview': True,
            'enable_dev_tools': debug,
            'debug': debug,
            'show_startup': CallmoduleConfig.UI_SHOW_STARTUP,
            'auto_close_startup': CallmoduleConfig.UI_AUTO_CLOSE_STARTUP,
            'cache_window_state': False,
        }

    # Native tray (default): independent pystray service, started before/without
    # PySide6. Used unless TRAY_BACKEND == "pyside" (then the Qt tray in the UI
    # thread is used instead). The PySide6 tray code is kept and gated by config.
    # On Linux desktop (DISPLAY set), use the native tray (AppIndicator/pystray).
    _can_show_tray = IS_WINDOWS or (IS_LINUX and CallmoduleConfig.HAS_DISPLAY)
    if _can_show_tray and not CallmoduleConfig.UI_ENABLE_TRAY:
        services['tray'] = build_tray_service_config(port=port)
        ColorPrint.blue(f"[ConfigBuilder] Added independent tray service (backend={CallmoduleConfig.TRAY_BACKEND})")
    elif _can_show_tray and CallmoduleConfig.UI_ENABLE_TRAY:
        ColorPrint.blue("[ConfigBuilder] Using PySide6 Qt tray (TRAY_BACKEND=pyside)")

    # Create launcher configuration - from callmodule_config/config.py
    config = LauncherConfig(
        app_id=CallmoduleConfig.LAUNCHER_APP_ID,
        app_name=CallmoduleConfig.LAUNCHER_APP_NAME,
        singleton=True,
        shutdown_existing=True,
        singleton_port_start=CallmoduleConfig.SINGLETON_PORT_START,
        singleton_port_range=CallmoduleConfig.SINGLETON_PORT_RANGE,
        services=services
    )

    ColorPrint.green(f"[ConfigBuilder] Configuration built with {len(services)} services")
    ColorPrint.blue(f"[ConfigBuilder] Services: {', '.join(services.keys())}")
    return config


def update_tray_menu_with_singleton(launcher, port: int, singleton_port: int):
    """
    Update tray menu with singleton port info.

    Emits a 'tray.update_menu' event (canonical dict menu) that the native Qt
    tray (PySide6 framework) listens for and rebuilds in the Qt main thread.

    Args:
        launcher: ServiceLauncher instance (unused; kept for call-site compatibility)
        port: RPC v2 server port
        singleton_port: Singleton port
    """
    # All tray backends (Win32, AppIndicator, pystray, PySide6 Qt) listen for
    # 'tray.update_menu' and rebuild live - including on Linux - so this re-push
    # refreshes the service-toggle [X]/[ ] state after a toggle and re-translates
    # the menu after a language change on every platform.

    # Backend-aware payload: the pystray tray consumes TrayMenuItem objects, while
    # the PySide6 Qt tray consumes canonical dicts. Both listen to 'tray.update_menu'
    # but only one backend runs at a time (selected by TRAY_BACKEND).
    menu = build_tray_menu(port=port, singleton_port=singleton_port)
    if CallmoduleConfig.UI_ENABLE_TRAY:
        payload = tray_menu_to_dicts(menu)  # PySide6 Qt tray
    else:
        payload = menu  # native pystray tray (TrayMenuItem objects)

    # Use THREAD_BUS event to update menu (thread-safe; framework marshals to Qt thread)
    THREAD_BUS.trigger_event('tray.update_menu', {'menu_items': payload})
    ColorPrint.blue("[ConfigBuilder] Tray menu update requested via THREAD_BUS")
