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
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pylauncher import LauncherConfig
from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.callmodule.tray_menu import build_tray_menu, tray_menu_to_dicts
from pycore.callmodule.callmodule_config import Config as CallmoduleConfig
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
from pycore.callmodule.services.sync.laravel_media_sync import (
    backend_status,
    resolve_laravel_base_url,
    sync_all,
    sync_book_source,
    sync_source,
)
from pycore.callmodule.services.processors.book_processor import iter_books

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
    ai_probe_router,
    ai_chat_router,
    ai_image_router,
    ocr_status_router,
    tts_status_router,
    capability_status_router,
    translation_queue_router,
    task_center_router,
    assist_router,
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

# Desired main-window size for the new desktop-manager UI. Clamped to the screen
# (minus a margin) when the display is too small to fit it.
UI_DESIRED_WINDOW_SIZE = (1788, 1159)


def _get_screen_size():
    """Best-effort (width, height) of the primary screen, or None if unknown."""
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
    """Resolve the tray icon absolute path, or None if the file is missing."""
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


def _init_rpc_routes(server):
    """
    Register the RPC routes/listeners the desktop UI needs over WebSocket.

    Restores the WS bridge the original create_rpc_server() provided: the web UI
    issues `rpcClient.call('thread_bus.trigger_event', {event_name, event_data})`
    (e.g. for subtitle fullscreen mode), which must be turned into a real
    THREAD_BUS event server-side. Also broadcasts voice-subtitle state changes to
    connected WS clients for real-time UI refresh.

    Called by start_rpc_v2 with the FastAPIRPCServer instance after start.
    """
    async def thread_bus_trigger_event(params, request_id, context):
        params = params or {}
        event_name = params.get('event_name')
        event_data = params.get('event_data', {})
        if not event_name:
            return {'success': False, 'error': 'event_name required'}
        THREAD_BUS.trigger_event(event_name, event_data)
        return {'success': True, 'event': event_name}

    async def video_extract_sync_source(params, request_id, context):
        """Idempotently sync a scanned source's media to laravel_main (:9000).

        params: { source_path | paths:[...], language? }. Runs the (blocking,
        network-heavy) sync on a worker thread via asyncio.to_thread so the event
        loop stays responsive. Progress streams over ColorPrint (UI log WS) AND a
        'video_extract_sync' THREAD_BUS event per stage. Returns the summary (one
        source) or a {results:[...]} aggregate (multiple paths).
        """
        params = params or {}
        language = params.get('language') or 'en'
        paths = params.get('paths')
        single = params.get('source_path')
        # Precondition guard: need at least one usable source path.
        targets = [p for p in (paths or ([single] if single else []))
                   if p and str(p).strip()]
        if not targets:
            return {'success': False, 'error': 'source_path (or paths) required'}

        try:
            if len(targets) == 1:
                return await asyncio.to_thread(sync_source, targets[0], language)
            results = []
            for p in targets:
                results.append(await asyncio.to_thread(sync_source, p, language))
            return {
                'success': all(r.get('success') for r in results),
                'count': len(results),
                'results': results,
            }
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] video_extract.sync_source failed: {e}")
            return {'success': False, 'error': str(e)}

    async def video_extract_backend_status(params, request_id, context):
        """Compare local extract outputs against what laravel_main actually holds.

        params: { paths?:[...], base_url? }. Defaults to ALL history entry paths
        and uses the SAME base-url resolution as the sync engine, so the status
        panel and the sync always target the same host. Runs the (network-bound)
        probe on a worker thread via asyncio.to_thread. An unreachable backend
        degrades to reachable:false (never raises from the probe itself).
        """
        params = params or {}
        try:
            return await asyncio.to_thread(
                backend_status, params.get('paths'), params.get('base_url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] video_extract.backend_status failed: {e}")
            return {'success': False, 'error': str(e)}

    async def video_extract_sync_all(params, request_id, context):
        """One-click idempotent sync of EVERY known source to laravel_main (:9000).

        params: { paths?:[...], language? }. Defaults to ALL history entry paths,
        dedupes overlapping output dirs, then runs sync_source per remaining path
        sequentially. Runs the (blocking, network-heavy) sync on a worker thread
        via asyncio.to_thread so the event loop stays responsive. Progress streams
        over ColorPrint (UI log WS) AND a 'video_extract_sync' THREAD_BUS event
        per stage (plus an outer stage="source" event per path). Returns the
        aggregate summary.
        """
        params = params or {}
        language = params.get('language') or 'en'
        try:
            return await asyncio.to_thread(sync_all, params.get('paths'), language)
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] video_extract.sync_all failed: {e}")
            return {'success': False, 'error': str(e)}

    async def book_sync_source(params, request_id, context):
        """Idempotently ingest book(s) into the shared sentence library (:9000).

        params: { source_path | paths:[...], language? }. Books map ONLY to the
        sentence library (no segments/clips). Runs the (blocking, network-heavy)
        ingest on a worker thread via asyncio.to_thread. Progress streams over
        ColorPrint AND a 'video_extract_sync' THREAD_BUS event per stage. Returns
        the summary (one book) or a {results:[...]} aggregate (multiple paths).
        """
        params = params or {}
        language = params.get('language') or 'en'
        paths = params.get('paths')
        single = params.get('source_path')
        targets = [p for p in (paths or ([single] if single else []))
                   if p and str(p).strip()]
        if not targets:
            return {'success': False, 'error': 'source_path (or paths) required'}

        # Expand any folder into its book files; a folder "source" should ingest
        # every book it contains (sync_book_source itself handles one file).
        try:
            expanded = []
            for t in targets:
                if os.path.isdir(t):
                    expanded.extend(str(p) for p in iter_books(t))
                else:
                    expanded.append(t)
            if expanded:
                targets = expanded
        except Exception as e:
            ColorPrint.yellow(f"[ConfigBuilder] book folder expansion skipped: {e}")

        try:
            if len(targets) == 1:
                return await asyncio.to_thread(sync_book_source, targets[0], language)
            results = []
            for p in targets:
                results.append(await asyncio.to_thread(sync_book_source, p, language))
            return {
                'success': all(r.get('success') for r in results),
                'count': len(results),
                'results': results,
            }
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] book.sync_source failed: {e}")
            return {'success': False, 'error': str(e)}

    async def media_enrich(params, request_id, context):
        """Trigger Laravel's sentence-library enrichment via pycore.

        params: { limit?:int, language? }. Forwards to laravel_main's
        /api/app_qy_v1/media/enrich (built by another role) and returns its JSON.
        Returns a clear error if the endpoint 404s / is unreachable.
        """
        params = params or {}
        body = {}
        if params.get('limit') is not None:
            body['limit'] = params.get('limit')
        if params.get('language'):
            body['language'] = params.get('language')

        def _do_enrich():
            base = resolve_laravel_base_url()
            url = base + '/api/app_qy_v1/media/enrich'
            requests = get_third_package_requests()
            try:
                resp = requests.post(url, json=body, timeout=120)
            except Exception as e:
                return {'success': False, 'error': f'enrich unreachable: {e}', 'url': url}
            if resp.status_code in (200, 201):
                try:
                    return resp.json()
                except Exception:
                    return {'success': True, 'status': resp.status_code, 'text': resp.text[:500]}
            return {'success': False,
                    'error': f'HTTP {resp.status_code}: {resp.text[:200]}', 'url': url}

        try:
            return await asyncio.to_thread(_do_enrich)
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] media.enrich failed: {e}")
            return {'success': False, 'error': str(e)}

    # ---- laravel_api.* — multi-endpoint manager for the laravel_main base URL.
    # Stored-first resolution + parallel 3s probes; persisted in user_data.json
    # under the 'laravel_api' section ({endpoints:[...], current}). All probing
    # runs on a worker thread (asyncio.to_thread) so the event loop stays free.
    async def laravel_api_list(params, request_id, context):
        """List endpoints with health. params: { probe?: bool (default true) }.

        Probes every candidate IN PARALLEL (3s cap) unless probe=false, which
        returns the last known results instead. Returns {success, endpoints:
        [{url, healthy, latency_ms, last_checked, status, error}], current,
        resolved}.
        """
        params = params or {}
        probe = params.get('probe', True)
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().list_endpoints, bool(probe))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.list failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_add(params, request_id, context):
        """Add a candidate endpoint. params: { url }. Invalidates the cache."""
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().add, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.add failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_remove(params, request_id, context):
        """Remove a candidate endpoint. params: { url }. Invalidates the cache."""
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().remove, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.remove failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_select(params, request_id, context):
        """Persist the user's endpoint choice. params: { url }.

        Adds the URL when missing, sets it as `current`, invalidates the
        resolve cache and probes the selection once for fresh health info.
        """
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().select, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.select failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_probe(params, request_id, context):
        """Probe ONE endpoint ({url}) or ALL candidates (no url; parallel, 3s cap)."""
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().probe_route, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.probe failed: {e}")
            return {'success': False, 'error': str(e)}

    try:
        server.route(
            name='thread_bus.trigger_event',
            handler=thread_bus_trigger_event,
            sync=False,
            description='Trigger a THREAD_BUS event from the web UI',
        )
        server.route(
            name='video_extract.sync_source',
            handler=video_extract_sync_source,
            sync=False,
            description='Idempotently sync a scanned source to laravel_main',
        )
        server.route(
            name='video_extract.backend_status',
            handler=video_extract_backend_status,
            sync=False,
            description='Compare local extract outputs against laravel_main holdings',
        )
        server.route(
            name='video_extract.sync_all',
            handler=video_extract_sync_all,
            sync=False,
            description='Idempotently sync every known source to laravel_main',
        )
        server.route(
            name='book.sync_source',
            handler=book_sync_source,
            sync=False,
            description='Idempotently ingest book(s) into the shared sentence library',
        )
        server.route(
            name='media.enrich',
            handler=media_enrich,
            sync=False,
            description='Trigger laravel_main sentence-library enrichment',
        )
        server.route(
            name='laravel_api.list',
            handler=laravel_api_list,
            sync=False,
            description='List Laravel API endpoints with health (parallel probe, 3s cap)',
        )
        server.route(
            name='laravel_api.add',
            handler=laravel_api_add,
            sync=False,
            description='Add a Laravel API endpoint candidate',
        )
        server.route(
            name='laravel_api.remove',
            handler=laravel_api_remove,
            sync=False,
            description='Remove a Laravel API endpoint candidate',
        )
        server.route(
            name='laravel_api.select',
            handler=laravel_api_select,
            sync=False,
            description='Select + persist the current Laravel API endpoint',
        )
        server.route(
            name='laravel_api.probe',
            handler=laravel_api_probe,
            sync=False,
            description='Probe one or all Laravel API endpoints (3s timeout)',
        )
        for ev in ('voice_subtitle_update', 'voice_subtitle_queue_update',
                   'voice_subtitle_ui_show', 'voice_subtitle_ui_hide'):
            server.register_thread_bus_listener(ev)
        # System-settings changes are broadcast live to the UI via THREAD_BUS.
        server.register_thread_bus_listener('system_settings_update')
        # Tray / native i18n language switches -> web UI sync (PcLanguageSync).
        server.register_thread_bus_listener('ui.i18n.language_changed')
        # Code Sync peer-mesh status/config ticks -> live UI refresh.
        server.register_thread_bus_listener('code_sync_update')
        # Boot the Code Sync manager now (the tray no longer instantiates it):
        # this starts the status mesh for every role and the file puller for
        # clients (which receive code by default) right at startup, instead of
        # lazily on the first UI request.
        try:
            get_code_sync_manager()
        except Exception as e:
            ColorPrint.yellow(f"[ConfigBuilder] Code Sync manager warm-up failed: {e}")
        # Live backend output -> UI ('pycore_log') needs NO wiring here: ColorPrint
        # streams every line to this server's WS clients directly (the server
        # registered itself + enabled streaming in FastAPIRPCServer.__init__).
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
                ai_probe_router,         # AI provider probe (/api/local/ai/probe): configured/available/models
                ai_chat_router,          # AI chat confirm (/api/local/ai/chat): send a message, get the reply
                ai_image_router,         # AI image generation (/api/local/ai/image): prompt -> base64 image via gateway
                ocr_status_router,       # OCR engine availability (/api/local/ocr/status): windows/easyocr/cnocr priority
                tts_status_router,       # TTS live availability + version (/api/local/tts/status): edge-tts 403/region probe
                capability_status_router,# CUDA/GPU readiness + free-library availability (/api/local/capabilities/status)
                translation_queue_router,# Translation queue monitor + control proxy (/api/local/translation/queue)
                task_center_router,      # Unified task-center aggregate (/api/local/task-center) — mirrors laravel_main /api/task-center/overview
                assist_router,           # Assist-Laravel worker control (/api/local/assist): status/config/cycle for cover+tts generation

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
    if IS_WINDOWS and not CallmoduleConfig.UI_ENABLE_TRAY:
        services['tray'] = build_tray_service_config(port=port)
        ColorPrint.blue(f"[ConfigBuilder] Added independent tray service (backend={CallmoduleConfig.TRAY_BACKEND})")
    elif IS_WINDOWS:
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
    if not IS_WINDOWS:
        return

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
