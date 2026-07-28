# -*- coding: utf-8 -*-
"""
Pycore Callmodule Configuration

Single source of truth: all configuration in this file (no YAML/loader).
Used by: callmodule/config.py (build_launcher_config), callmodule_main.py.
"""

import os
import platform
from pathlib import Path

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
    RPC_HOST = "0.0.0.0"
    RPC_PORT = 59000

    # ==================== Singleton (shared with pylauncher) ====================
    SINGLETON_PORT_START = 59100
    SINGLETON_PORT_RANGE = 100

    # ==================== Frontend Configuration ====================
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "pycore-management"
    FRONTEND_PORT = 3100
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
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
    # UI FRONTEND = the unified pycore_laravel_wordflow_ui shell's pycore end. The PySide6
    # webview loads http://localhost:<UiPort>/pycore-manager (PYCORE_UI_URL, set by
    # pyservice.ps1/.sh which start poly_apps/pycore_laravel_wordflow_ui via pnpm). The old
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
    TRAY_BACKEND = "native"
    TRAY_APP_NAME = "Pycore RPC Server"
    TRAY_ICON_PATH_REL = "pyutils/native_ui/step1_config/app_icon.png"
    TRAY_TRIGGER_SHUTDOWN_ON_EXIT = True

    # The PySide6 Qt tray is enabled only when the "pyside" backend is selected.
    UI_ENABLE_TRAY = (TRAY_BACKEND == "pyside")

    # ==================== Translation Worker (Laravel worker-API) ====================
    # Base URL of the Laravel backend that exposes the worker task API
    # (/api/worker/register, /heartbeat, /tasks/pull, /tasks/result).
    # Env-overridable so deployments can point at a different host/port.
    LARAVEL_WORKER_API_URL = os.getenv("LARAVEL_WORKER_API_URL", "http://127.0.0.1:9000")
    # Heartbeat-callback interval (seconds) for the translation worker poll loop.
    TRANSLATION_WORKER_INTERVAL = int(os.getenv("TRANSLATION_WORKER_INTERVAL", "12"))
    # Whether the translation worker callback is enabled on start (pipeline runs
    # by default; can be toggled at runtime via /api/heartbeat/disable/translation_worker).
    TRANSLATION_WORKER_ENABLED_ON_START = (
        os.getenv("TRANSLATION_WORKER_ENABLED_ON_START", "1") in ("1", "true", "True")
    )

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

    # ---- Unified-task client (2026-06-22) — dedicated lane enable knobs ----
    # Each flag is a HARD kill-switch (env off => the worker never advertises the
    # lane). Layered user-data / assist toggles (read live by the worker) allow
    # enable/disable WITHOUT a restart while the Config flag is on.
    #
    # AI-translate capability (shared fast lane; task_type stays word_translation).
    AI_TRANSLATE_ENABLED = (
        os.getenv("PYCORE_AI_TRANSLATE", "1") in ("1", "true", "True", "yes", "on")
    )
    # Dedicated subtitle-retrieval lane (remote_subtitle).
    SUBTITLE_SEARCH_WORKER_ENABLED = (
        os.getenv("PYCORE_SUBTITLE_SEARCH_WORKER", "1") in ("1", "true", "True", "yes", "on")
    )
    # ==================== TTS Queue Worker (Laravel word-generation queue) ====================
    # The TTS worker claims pending word TTS tasks from laravel_main
    # (/api/app_qy_v1/ai_tools/tts/worker/claim), synthesizes MP3s with the
    # pyutils TTS orchestrator and reports them back (/tts/worker/report). Runtime
    # ownership belongs to the Queue Center Word Audio ON/OFF control; the env
    # value only supplies the initial state before persisted settings are applied.
    TTS_WORKER_ENABLED_ON_START = (
        os.getenv("PYCORE_TTS_WORKER", "0") in ("1", "true", "True")
    )
    # Tasks claimed per tick (server caps the claim at 50).
    TTS_WORKER_BATCH = int(os.getenv("PYCORE_TTS_WORKER_BATCH", "10"))
    # Heartbeat-callback interval (seconds) for the TTS worker poll loop.
    TTS_WORKER_INTERVAL = int(os.getenv("PYCORE_TTS_WORKER_INTERVAL", "60"))
    # Worker fan-out override (0 = use the per-engine recommended value from
    # services/tts_concurrency.py; serial engines are always forced to 1).
    TTS_WORKER_CONCURRENCY = int(os.getenv("PYCORE_TTS_WORKER_CONCURRENCY", "0"))

    # ==================== TTS Sentence-Audio Worker (Laravel sentence-library queue) ====================
    # The sentence-audio worker claims pending SENTENCE TTS tasks from laravel_main
    # (/api/app_qy_v1/ai_tools/tts/sentence/claim), merges every claimed task into
    # ONE in-process priority queue (§5.3), synthesizes MP3s with the pyutils TTS
    # orchestrator and reports them back (/tts/sentence/report).
    # OFF by default (legacy fallback only). The effective startup state is the
    # PERSISTED UI toggle via sentence_audio_auto_enabled_on_start(); this env flag
    # is just the fallback when assist was never configured. Force-enable a headless
    # deploy with PYCORE_TTS_SENTENCE_WORKER=1, or toggle at runtime via the UI /
    # POST /api/heartbeat/enable/tts_sentence_worker.
    TTS_SENTENCE_WORKER_ENABLED_ON_START = (
        os.getenv("PYCORE_TTS_SENTENCE_WORKER", "0") in ("1", "true", "True")
    )
    # Tasks claimed per tick (server caps the claim at 50).
    TTS_SENTENCE_WORKER_BATCH = int(os.getenv("PYCORE_TTS_SENTENCE_WORKER_BATCH", "10"))
    # Heartbeat-callback interval (seconds) for the sentence-audio worker poll loop.
    TTS_SENTENCE_WORKER_INTERVAL = int(os.getenv("PYCORE_TTS_SENTENCE_WORKER_INTERVAL", "60"))
    # Worker fan-out override (0 = use the per-engine recommended value from
    # services/tts_concurrency.py; serial engines are always forced to 1).
    TTS_SENTENCE_WORKER_CONCURRENCY = int(os.getenv("PYCORE_TTS_SENTENCE_WORKER_CONCURRENCY", "0"))

    # ==================== Translation Queue Monitor (Laravel queue API) ====================
    # The monitor + control proxy poll/steer Laravel's translation QUEUE
    # (/api/app_qy_v1/ai_tools/translation/queue/{list,priority,stack}). It shares
    # the SAME backend as the worker via LARAVEL_WORKER_API_URL + the worker's
    # candidate-URL discovery, so monitor and worker always agree on the host.
    # Heartbeat-callback interval (seconds) for the queue-monitor poll loop (~5s).
    TRANSLATION_QUEUE_MONITOR_INTERVAL = int(os.getenv("TRANSLATION_QUEUE_MONITOR_INTERVAL", "5"))
    # Enabled on start by default so the UI sees the live queue out of the box;
    # toggle at runtime via /api/heartbeat/disable/translation_queue_monitor.
    TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START = (
        os.getenv("TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START", "1") in ("1", "true", "True")
    )
    # How long (seconds) a task stays flagged `recently_bumped` after a detected
    # priority increase, so the UI can highlight it briefly.
    TRANSLATION_QUEUE_BUMP_TTL_SECONDS = int(os.getenv("TRANSLATION_QUEUE_BUMP_TTL_SECONDS", "30"))

    # ==================== Translation WS Client (Laravel Reverb broadcasts) ====================
    # Phase C: a WebSocket client subscribes to Laravel's Reverb server (Pusher
    # protocol over WS) and receives translation-queue events in REAL TIME,
    # replacing the queue monitor's 5s HTTP poll as the primary signal (the poll is
    # kept as a slower fallback/reconciler if the WS drops).
    #
    # The pycore end does NOT read laravel_main/.env — these defaults are the
    # source of truth (env vars only act as optional overrides). laravel_main now
    # serves on port 9000 (Octane HTTP, systemd octane-poly-9000) and the Reverb
    # broadcast endpoint is reached on that same host:port via the Pusher path
    # /app/<app_key>. 8080 is the OLD/retired Reverb port — do not reintroduce it.
    # We connect to 127.0.0.1 (0.0.0.0 is a bind address, not a dial address) and
    # map scheme http->ws / https->wss. NOTE: Laravel rotates the app key on each
    # reverb (re)start; keep TRANSLATION_REVERB_APP_KEY in sync or the Pusher
    # handshake's subscribe will be refused. The default below is the last-seen key.
    TRANSLATION_REVERB_HOST = os.getenv(
        "TRANSLATION_REVERB_HOST", os.getenv("REVERB_HOST", "127.0.0.1")
    )
    TRANSLATION_REVERB_PORT = int(
        os.getenv("TRANSLATION_REVERB_PORT", os.getenv("REVERB_PORT", "9000"))
    )
    TRANSLATION_REVERB_SCHEME = os.getenv(
        "TRANSLATION_REVERB_SCHEME", os.getenv("REVERB_SCHEME", "http")
    )
    TRANSLATION_REVERB_APP_KEY = os.getenv(
        "TRANSLATION_REVERB_APP_KEY",
        os.getenv("REVERB_APP_KEY", "reverb-key-1769434123"),
    )
    # Public channel name (kept for status/back-compat; unused by the SSE transport).
    TRANSLATION_REVERB_CHANNEL = os.getenv("TRANSLATION_REVERB_CHANNEL", "translation-queue")
    # SSE endpoint path on the Laravel HTTP base (replaces the Reverb /app/<key>
    # WS path). The translation WS client GETs this with a ?cursor= resume id.
    TRANSLATION_SSE_PATH = os.getenv(
        "TRANSLATION_SSE_PATH", "/api/app_qy_v1/ai_tools/translation/queue/stream"
    )
    # Whether the WS client is enabled on start (real-time signal runs by default);
    # toggle at runtime via /api/heartbeat/disable/translation_ws_client.
    TRANSLATION_WS_ENABLED_ON_START = (
        os.getenv("TRANSLATION_WS_ENABLED_ON_START", "1") in ("1", "true", "True")
    )
    # Heartbeat-callback interval (seconds) for the WS supervisor tick. This is NOT
    # the network read interval (the WS loop runs on its own background thread); it
    # is how often the light heartbeat callback checks/relaunches that thread.
    TRANSLATION_WS_SUPERVISOR_INTERVAL = int(
        os.getenv("TRANSLATION_WS_SUPERVISOR_INTERVAL", "5")
    )
    # TTL (seconds) for the "recently completed words" coordination set. A word
    # broadcast as translated by ANY pycore is skipped by the others for this long.
    TRANSLATION_WS_WORD_TTL_SECONDS = int(
        os.getenv("TRANSLATION_WS_WORD_TTL_SECONDS", "120")
    )

    # ==================== Runtime Mode ====================
    MODE = os.getenv("CALLMODULE_MODE", "dev")

    # ==================== CORS ====================
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
        f"http://localhost:{RPC_PORT}",
        f"http://127.0.0.1:{RPC_PORT}",
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
