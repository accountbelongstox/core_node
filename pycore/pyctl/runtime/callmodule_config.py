# -*- coding: utf-8 -*-
"""
Pycore Runtime Configuration

Single source of truth: all configuration in this file (no YAML/loader).
Used by the callmodule launcher composition and Pyctl runtime services.
"""

import os
import platform
from pathlib import Path

from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    TRANSLATION_EVENT_CHANNEL,
    TRANSLATION_EVENT_HOST,
    TRANSLATION_EVENT_PORT,
    TRANSLATION_EVENT_SCHEME,
    TRANSLATION_EVENT_SUPERVISOR_INTERVAL,
    TRANSLATION_EVENT_WORD_TTL_SECONDS,
    TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    TRANSLATION_QUEUE_MONITOR_INTERVAL,
    TRANSLATION_SSE_PATH,
    TRAY_BACKEND,
    TTS_SENTENCE_WORKER_BATCH,
    TTS_SENTENCE_WORKER_CONCURRENCY,
    TTS_SENTENCE_WORKER_INTERVAL,
    TTS_WORKER_BATCH,
    TTS_WORKER_CONCURRENCY,
    TTS_WORKER_INTERVAL,
    UI_ENABLE_TRAY,
)
from pycore.pyfoundations.network_constants import HTTP_BIND_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.pygvar import PROJECT_ROOT as PYCORE_PROJECT_ROOT


class Config:
    """Callmodule Configuration - all values in this class."""

    # ==================== Application Info ====================
    APP_NAME = "callmodule"
    APP_ID = "pycore_module_caller"
    APP_DISPLAY_NAME = "Pycore Module Caller"

    # ==================== Project Paths ====================
    PROJECT_ROOT = Path(PYCORE_PROJECT_ROOT)
    APP_ROOT = PROJECT_ROOT / "pycore" / "callmodule"
    RESOURCES_DIR = APP_ROOT / "resources"

    # ==================== Backend ====================
    HTTP_HOST = HTTP_BIND_HOST
    HTTP_PORT = PYCORE_HTTP_PORT

    # ==================== Singleton (shared with pylauncher) ====================
    SINGLETON_PORT_START = 59100
    SINGLETON_PORT_RANGE = 100

    # ==================== Frontend Configuration ====================
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "pycore_laravel_wordnew_ui"
    FRONTEND_PORT = int(os.getenv("PYCORE_UI_PORT", "13054"))
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}/pycore-manager"
    FRONTEND_MODE = "dev"
    FRONTEND_SKIP_BUILD = False
    FRONTEND_FORCE_REBUILD = False

    # ==================== UI Configuration ====================
    IS_WINDOWS = platform.system() == 'Windows'
    IS_LINUX = platform.system() == 'Linux'
    HAS_DISPLAY = bool(os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY'))
    WINDOW_WIDTH = 1400
    WINDOW_HEIGHT = 900
    FRAMELESS = True
    SHOW_UI_ON_START = IS_WINDOWS
    ENABLE_TRAY = IS_WINDOWS or (IS_LINUX and HAS_DISPLAY)

    # ==================== Debug Window ====================
    DEBUG_WINDOW_WIDTH = 650
    DEBUG_WINDOW_HEIGHT = 500
    MIN_DISPLAY_TIME = 2.0
    ENABLE_LANGUAGE_SELECTOR = True

    # ==================== Launcher (build_launcher_config) ====================
    LAUNCHER_APP_ID = "pycore_module_caller"
    LAUNCHER_APP_NAME = "Pycore Module Caller"

    # ==================== UI service (Voice Subtitle) ====================
    # UI FRONTEND = the unified pycore_laravel_wordnew_ui shell's pycore end. The PySide6
    # webview loads http://localhost:<UiPort>/pycore-manager (PYCORE_UI_URL, set by
    # pyservice.ps1/.sh which start poly_apps/pycore_laravel_wordnew_ui via pnpm). The old
    # standalone pycore/pyctl/desktop/desktop-manager is no longer the UI.
    UI_APP_NAME = "Py模块UI界面"
    UI_APP_ID = "voice_subtitle_ui"
    UI_WINDOW_SIZE = (1000, 180)  # legacy default; main window size now via config._resolve_window_size()
    UI_SHOW_ON_START = False  # Only show tk debug window on start; open main window from tray
    # Frameless (no OS title bar) but KEEP the framework's built-in simulated
    # title bar (PySide6TitleBar): it provides the app title + minimize/maximize/
    # close buttons and native window drag (startSystemMove) for the borderless
    # window. Its title text follows the embedded web's language — the webview's
    # titleChanged (driven by the React app's document.title) retitles the bar —
    # so switching language in the UI also retitles the native bar.
    UI_FRAMELESS = True
    UI_ENABLE_TITLE_BAR = True  # Framework simulated title bar (controls + drag)
    UI_SHOW_STARTUP = True
    UI_AUTO_CLOSE_STARTUP = True  # Close tk debug window once third-party packages are loaded

    # ==================== Tray service ====================
    # Tray backend selection (independent of / started before PySide6):
    #   "native"  = platform-native tray [default]:
    #                 Windows -> Win32 Shell_NotifyIcon (pywin32, no third-party lib)
    #                 Ubuntu/GNOME -> AppIndicator (Ayatana preferred)
    #                 (falls back to pystray if the native backend is unavailable)
    #   "pystray" = cross-platform third-party pystray tray (kept as fallback/option)
    #   "pyside"  = more powerful Qt (QSystemTrayIcon) tray embedded in the UI thread
    TRAY_BACKEND = TRAY_BACKEND
    TRAY_APP_NAME = "Pycore RPC Server"
    TRAY_ICON_PATH_REL = "pyutils/native_ui/step1_config/app_icon.png"
    TRAY_TRIGGER_SHUTDOWN_ON_EXIT = True

    # The PySide6 Qt tray is enabled only when the "pyside" backend is selected.
    UI_ENABLE_TRAY = UI_ENABLE_TRAY

    # ==================== Translation Worker (Laravel worker-API) ====================
    # Base URL of the Laravel backend that exposes the worker task API.
    # Pycore sends worker identity inline with /tasks/pull, then posts /tasks/result.
    # Env-overridable so deployments can point at a different host/port.
    LARAVEL_WORKER_API_URL = LARAVEL_WORKER_API_URL
    # Heartbeat-callback interval (seconds) for the translation worker poll loop.
    TRANSLATION_WORKER_INTERVAL = int(os.getenv("TRANSLATION_WORKER_INTERVAL", "12"))
    # Task lanes and capability values are loaded from
    # config/queue_center_contract.json by queue_center_contract.py. They are not
    # configurable here because Pycore, Laravel, both UIs, and mcp-chrome must
    # always advertise the same routing vocabulary.
    # Fast-drain re-poll cadence (seconds): while pending_fast>0 the worker bursts a
    # short jittered loop of wait=0 pulls at this interval so interactive requests are
    # claimed near-instantly instead of waiting for the ~12s heartbeat tick.
    TRANSLATION_FAST_POLL_INTERVAL = float(
        os.getenv("PYCORE_TRANSLATION_FAST_POLL_INTERVAL", "0.5")
    )
    # How long (seconds) a single fast-drain burst runs before yielding back to the
    # heartbeat cadence (a fresh pending_fast signal re-arms it).
    TRANSLATION_FAST_DRAIN_WINDOW = float(
        os.getenv("PYCORE_TRANSLATION_FAST_DRAIN_WINDOW", "4.0")
    )
    # Random jitter (seconds, uniform [0, jitter]) added to each fast re-poll so N
    # workers do not synchronize their wait=0 pulls into a thundering herd.
    TRANSLATION_FAST_POLL_JITTER = float(
        os.getenv("PYCORE_TRANSLATION_FAST_POLL_JITTER", "0.25")
    )

    # ==================== TTS Queue Worker (Laravel word-generation queue) ====================
    # The TTS worker claims pending word_audio global_tasks from laravel_main
    # (GET /api/worker/tasks/pull, long-poll), synthesizes MP3s with the
    # pyutils TTS orchestrator and reports them back (/tts/worker/report). Runtime
    # ownership belongs to the Queue Center Word Audio ON/OFF control.
    # Tasks claimed per tick (server caps the claim at 50).
    TTS_WORKER_BATCH = TTS_WORKER_BATCH
    # Heartbeat-callback interval (seconds) for the TTS worker poll loop.
    TTS_WORKER_INTERVAL = TTS_WORKER_INTERVAL
    # Worker fan-out override (0 = use the per-engine recommended value from
    # services/tts_concurrency.py; serial engines are always forced to 1).
    TTS_WORKER_CONCURRENCY = TTS_WORKER_CONCURRENCY

    # ==================== TTS Sentence-Audio Worker (Laravel sentence-library queue) ====================
    # The sentence-audio worker claims pending sentence_audio global_tasks from
    # laravel_main (GET /api/worker/tasks/pull, long-poll), merges every claimed
    # ONE in-process priority queue (§5.3), synthesizes MP3s with the pyutils TTS
    # orchestrator and reports them back (/tts/sentence/report).
    # Lifecycle is controlled only by the unified user settings map.
    # Tasks claimed per tick (server caps the claim at 50).
    TTS_SENTENCE_WORKER_BATCH = TTS_SENTENCE_WORKER_BATCH
    # Heartbeat-callback interval (seconds) for the sentence-audio worker poll loop.
    TTS_SENTENCE_WORKER_INTERVAL = TTS_SENTENCE_WORKER_INTERVAL
    # Worker fan-out override (0 = use the per-engine recommended value from
    # services/tts_concurrency.py; serial engines are always forced to 1).
    TTS_SENTENCE_WORKER_CONCURRENCY = TTS_SENTENCE_WORKER_CONCURRENCY

    # ==================== Translation Queue Monitor (Laravel queue API) ====================
    # The monitor + control proxy poll/steer Laravel's translation QUEUE
    # (/api/app_qy_v1/ai_tools/translation/queue/{list,priority,stack}). It shares
    # the SAME backend as the worker via LARAVEL_WORKER_API_URL + the worker's
    # candidate-URL discovery, so monitor and worker always agree on the host.
    # Heartbeat-callback interval (seconds) for the queue-monitor poll loop (~5s).
    TRANSLATION_QUEUE_MONITOR_INTERVAL = TRANSLATION_QUEUE_MONITOR_INTERVAL
    # Enabled on start by default so the UI sees the live queue out of the box;
    # Pycore UI toggles it through HTTP `ui/heartbeat_workers/config`.
    TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START = (
        os.getenv("TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START", "1") in ("1", "true", "True")
    )
    # How long (seconds) a task stays flagged `recently_bumped` after a detected
    # priority increase, so the UI can highlight it briefly.
    TRANSLATION_QUEUE_BUMP_TTL_SECONDS = TRANSLATION_QUEUE_BUMP_TTL_SECONDS

    # ==================== Translation HTTP Event Client ====================
    # The SSE client receives translation-queue events from Laravel's Octane HTTP
    # service. The queue monitor remains a slower snapshot reconciler.
    TRANSLATION_EVENT_HOST = TRANSLATION_EVENT_HOST
    TRANSLATION_EVENT_PORT = TRANSLATION_EVENT_PORT
    TRANSLATION_EVENT_SCHEME = TRANSLATION_EVENT_SCHEME
    TRANSLATION_EVENT_CHANNEL = TRANSLATION_EVENT_CHANNEL
    TRANSLATION_SSE_PATH = TRANSLATION_SSE_PATH
    TRANSLATION_EVENT_SUPERVISOR_INTERVAL = TRANSLATION_EVENT_SUPERVISOR_INTERVAL
    TRANSLATION_EVENT_WORD_TTL_SECONDS = TRANSLATION_EVENT_WORD_TTL_SECONDS

    # ==================== Runtime Mode ====================
    MODE = os.getenv("CALLMODULE_MODE", "dev")

    # ==================== CORS ====================
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
        f"http://localhost:{HTTP_PORT}",
        f"http://127.0.0.1:{HTTP_PORT}",
    ]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]

    @classmethod
    def is_dev_mode(cls) -> bool:
        """Check if running in development mode"""
        return cls.MODE == "dev"

    @classmethod
    def is_production_mode(cls) -> bool:
        """Check if running in production mode"""
        return cls.MODE == "production"


# Global configuration instance
config = Config()
