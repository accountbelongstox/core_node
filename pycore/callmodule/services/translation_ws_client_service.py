# -*- coding: utf-8 -*-
"""
Translation WebSocket Client Service (Phase C)

A pycore WebSocket client that connects to Laravel's REVERB server (Pusher
protocol over WebSocket) and receives translation-queue events in REAL TIME,
replacing the QueueMonitorService's 5s HTTP poll as the PRIMARY signal. The HTTP
poll is kept as a slower fallback/reconciler (the safety net if the WS drops).

------------------------------------------------------------------------------
Which WebSocket library (rpc_v2's) and how it is reused
------------------------------------------------------------------------------
pycore's rpc_v2 WS SERVER (FastAPIRPCServer, /rpc/ws — the FE live-log channel)
runs on FastAPI + ``uvicorn[standard]``, whose WebSocket layer is the third-party
``websockets`` library. ``websockets`` is declared in pyfoundations.third_party's
DEPENDENCY_MAP ("websockets": "websockets") and obtained ONLY via
``get_third_package_websockets()`` (never a bare import) — the pycore rule.

This service REUSES that exact dependency as the WS CLIENT transport via the
library's synchronous client API (``websockets.sync.client.connect``). The sync
client lets us run a simple blocking recv loop on our OWN background thread
(no asyncio event loop needed), which matches the worker/monitor threading model
and keeps the heartbeat thread free.

------------------------------------------------------------------------------
Reverb = Pusher protocol — handshake + subscribe
------------------------------------------------------------------------------
Connection (from Laravel REVERB_* via callmodule_config.Config):
    ws://<host>:<port>/app/<app_key>?protocol=7&client=pycore&version=1.0
    host  = TRANSLATION_REVERB_HOST  (REVERB_HOST 0.0.0.0 -> dial 127.0.0.1)
    port  = TRANSLATION_REVERB_PORT  (9000 — laravel_main Octane; 8080 retired)
    sch.  = TRANSLATION_REVERB_SCHEME (http->ws, https->wss)
    key   = TRANSLATION_REVERB_APP_KEY (rotates on reverb restart — env-overridable)

Flow:
  1. Connect to the URL above.
  2. Receive ``pusher:connection_established`` (its ``data`` is a JSON STRING
     holding { socket_id, activity_timeout }).
  3. Subscribe to the PUBLIC channel:
        {"event":"pusher:subscribe","data":{"channel":"translation-queue"}}
     (public channels need no auth signature.)
  4. Receive ``pusher_internal:subscription_succeeded`` then channel events.
  5. Respond to ``pusher:ping`` with ``pusher:pong`` to keep the link alive.

Per Pusher, each frame is a JSON object { event, data, channel? } where ``data``
is itself a JSON STRING and must be parsed again. Laravel may namespace event
names (e.g. "App\\Events\\TaskQueued" or "task.queued"), so we MATCH ON SUFFIX.

Events handled (Phase C broadcast contract):
  - task.queued     { task_id, words:[str], language, target_language, priority }
        -> QueueMonitorService.apply_task_queued (live snapshot insert/update)
  - task.priority   { task_id, priority }
        -> QueueMonitorService.apply_task_priority (live update + recently_bumped)
  - word.translated { word, language, target_language, translation, provider }
        -> TranslationWorkerService.mark_words_done (WORD-LEVEL coordination:
           other pycores skip this word) — see the worker's coordination model.
  - task.completed  { task_id, target_language, word_count }
        -> QueueMonitorService.apply_task_completed (mark completed)

------------------------------------------------------------------------------
Threading / lifecycle (mirrors translation_worker_service / queue_monitor)
------------------------------------------------------------------------------
  - Singleton, registered as a PyHeartbeat callback ('translation_ws_client',
    ENABLED by default). The heartbeat callback ``supervise()`` is LIGHT: it only
    ensures the background WS thread is alive when enabled and signals it to stop
    when disabled. It NEVER blocks the heartbeat thread on network I/O.
  - The actual connect + recv loop runs on a dedicated daemon thread with
    auto-reconnect and QUIET-RETRY logging (ONE clear connected/disconnected/
    unreachable line, not a stack every retry — mirrors the worker's style).
  - Enable/disable at runtime via the heartbeat management router:
        POST /api/heartbeat/enable/translation_ws_client
        POST /api/heartbeat/disable/translation_ws_client

Logging: ColorPrint only (pycore rule). WS lib via get_third_package_websockets()
(never a bare import). This module imports only pyfoundations + sibling services
(same layer) — never rpc_v2 / callmodule routers (no upward layer import).
"""

import json
import threading
import time
from typing import Any, Dict, Optional

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# websockets is a third-party dep — always via the lazy accessor (the rpc_v2 ws lib).
from pycore.pyfoundations.third_party import get_third_package_websockets
# Sibling services (same layer): the monitor (snapshot push) + worker (word dedup).
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker_service import (
    get_translation_worker_service,
)


class TranslationWsClient:
    """
    Reverb (Pusher-protocol) WebSocket client (singleton).

    Connects to Laravel's Reverb server, subscribes to the public
    ``translation-queue`` channel, and routes the 4 contract events into the
    QueueMonitorService snapshot (real-time UI) and the TranslationWorkerService
    word-dedup set (multi-pycore coordination). Runs its recv loop on a background
    thread with auto-reconnect; supervised by a light heartbeat callback.
    """

    _instance: Optional["TranslationWsClient"] = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        """Singleton — one WS client per process."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 9000,
        scheme: str = "http",
        app_key: str = "",
        channel: str = "translation-queue",
        word_ttl_seconds: int = 120,
    ):
        """
        Initialize the WS client (idempotent — safe to call repeatedly).

        Args:
            host/port/scheme: Reverb connection (REVERB_* derived). scheme http->ws.
            app_key: Reverb app key (rotates on reverb restart — keep in sync).
            channel: public channel to subscribe to ("translation-queue").
            word_ttl_seconds: TTL fed to the worker's done-words set per broadcast.
        """
        if getattr(self, "_initialized", False):
            return

        # REVERB_HOST is often 0.0.0.0 (a bind address). Never DIAL 0.0.0.0 — map it
        # to loopback so the client connects to the local Reverb.
        self._host = "127.0.0.1" if str(host) in ("0.0.0.0", "", None) else str(host)
        self._port = int(port)
        # Map Laravel's HTTP scheme to the WS scheme (http->ws, https->wss).
        self._ws_scheme = "wss" if str(scheme).lower() in ("https", "wss") else "ws"
        self._app_key = app_key or ""
        self._channel = channel or "translation-queue"
        self._word_ttl = max(1, int(word_ttl_seconds))

        # Sibling singletons (resolved lazily on first event so init order is free).
        self._monitor = None
        self._worker = None

        # Background WS thread + control flags.
        self._thread: Optional[threading.Thread] = None
        self._thread_lock = threading.Lock()
        self._stop_event = threading.Event()  # set() asks the recv loop to exit
        self._connected = False

        # Quiet-retry bookkeeping: emit ONE "unreachable" line, then stay silent
        # until the situation changes (mirrors the worker's _conn_* style).
        self._unreachable_warned = False
        self._reconnect_delay = 3  # seconds between reconnect attempts

        # Diagnostics.
        self._events_received = 0
        self._last_event_ts = 0.0

        self._initialized = True
        ColorPrint.green(
            f"[TranslationWS] Service initialized (url={self._public_url(masked=True)}, "
            f"channel={self._channel})"
        )

    # -------------------- sibling accessors --------------------

    def _get_monitor(self):
        """Resolve the QueueMonitorService singleton (lazy)."""
        if self._monitor is None:
            self._monitor = get_queue_monitor_service()
        return self._monitor

    def _get_worker(self):
        """Resolve the TranslationWorkerService singleton (lazy)."""
        if self._worker is None:
            self._worker = get_translation_worker_service()
        return self._worker

    # -------------------- URL --------------------

    def _ws_url(self) -> str:
        """Build the Pusher-protocol WS URL Reverb expects."""
        return (
            f"{self._ws_scheme}://{self._host}:{self._port}/app/{self._app_key}"
            f"?protocol=7&client=pycore&version=1.0"
        )

    def _public_url(self, masked: bool = False) -> str:
        """URL for logging; masks the app key when ``masked`` (it's a shared secret-ish)."""
        key = "***" if masked and self._app_key else self._app_key
        return f"{self._ws_scheme}://{self._host}:{self._port}/app/{key}"

    # -------------------- connection status --------------------

    def _set_connected(self, connected: bool) -> None:
        """Update local + monitor-visible WS connection status."""
        self._connected = connected
        try:
            self._get_monitor().set_ws_connected(connected)
        except Exception:
            # Status is best-effort; never let it break the WS loop.
            pass

    # -------------------- event routing --------------------

    @staticmethod
    def _event_suffix(event_name: str) -> str:
        """
        Canonical, comparable form of a (possibly namespaced) event name.

        Laravel may broadcast a dotted contract name ("task.queued") OR a PHP
        class-name ("App\\Events\\TaskQueued"). We:
          1. strip the PHP namespace (everything up to the last "\\" or "/"), then
          2. lowercase and DROP separators ("." and "_"),
        so "task.queued", "App\\Events\\TaskQueued" and "TaskQueued" all collapse to
        the same token "taskqueued". This avoids losing the verb (a naive
        split-on-dot would turn "word.translated" into just "translated").
        """
        name = (event_name or "").strip()
        # Strip PHP namespace -> keep only the final class/segment.
        for sep in ("\\", "/"):
            if sep in name:
                name = name.split(sep)[-1]
        # Collapse dotted/underscored forms to a single comparable token.
        return name.lower().replace(".", "").replace("_", "")

    @staticmethod
    def _parse_data(data: Any) -> Dict[str, Any]:
        """Per Pusher, frame ``data`` is a JSON STRING — parse it to a dict."""
        if isinstance(data, dict):
            return data
        if isinstance(data, str) and data:
            try:
                parsed = json.loads(data)
                return parsed if isinstance(parsed, dict) else {}
            except (ValueError, TypeError):
                return {}
        return {}

    def _route_event(self, event_name: str, data: Dict[str, Any]) -> None:
        """
        Dispatch ONE parsed channel event to the monitor/worker. Matches on the
        event-name SUFFIX so bare ("task.queued") and class-name
        ("App\\Events\\TaskQueued"/"TaskCompleted") forms both work.
        """
        # Canonical token: "task.queued"/"App\\Events\\TaskQueued" -> "taskqueued".
        suffix = self._event_suffix(event_name)

        # task.queued -> live snapshot insert/update
        if suffix == "taskqueued":
            self._get_monitor().apply_task_queued(data)

        # task.priority -> live priority update + recently_bumped
        elif suffix == "taskpriority":
            self._get_monitor().apply_task_priority(data)

        # word.translated -> WORD-LEVEL coordination (other pycores skip the word)
        elif suffix == "wordtranslated":
            word = data.get("word")
            if word:
                self._get_worker().mark_words_done(
                    [word],
                    data.get("language") or "auto",
                    data.get("target_language") or "",
                    ttl_seconds=self._word_ttl,
                )
                ColorPrint.gray(
                    f"[TranslationWS] word.translated '{word}' "
                    f"-> {data.get('target_language')} (dedup across pycores)"
                )

        # task.completed -> mark completed in snapshot
        elif suffix == "taskcompleted":
            self._get_monitor().apply_task_completed(data)
        # Unknown channel events are ignored (forward-compatible).

    def _handle_frame(self, ws, raw: str) -> None:
        """
        Handle one raw Pusher frame. Manages the protocol-level events
        (connection_established / subscription_succeeded / ping) and forwards
        channel events to _route_event.
        """
        try:
            frame = json.loads(raw)
        except (ValueError, TypeError):
            return
        if not isinstance(frame, dict):
            return

        event = frame.get("event", "")

        # --- Pusher protocol events (exact names; never namespaced) ---
        if event == "pusher:connection_established":
            # Connected: now subscribe to the public channel.
            self._subscribe(ws)
            return
        if event == "pusher:ping":
            # Keep-alive: reply with pong.
            try:
                ws.send(json.dumps({"event": "pusher:pong", "data": {}}))
            except Exception:
                pass
            return
        if event in ("pusher_internal:subscription_succeeded",
                     "pusher:subscription_succeeded"):
            ColorPrint.green(
                f"[TranslationWS] Subscribed to channel '{frame.get('channel', self._channel)}'"
            )
            return
        if event == "pusher:error":
            data = self._parse_data(frame.get("data"))
            ColorPrint.yellow(
                f"[TranslationWS] Pusher error: {data.get('message') or frame.get('data')} "
                "(check REVERB_APP_KEY matches Laravel)"
            )
            return

        # --- Channel (app) events ---
        data = self._parse_data(frame.get("data"))
        self._events_received += 1
        self._last_event_ts = time.monotonic()
        self._route_event(event, data)

    def _subscribe(self, ws) -> None:
        """Send the Pusher subscribe frame for the public channel (no auth)."""
        ws.send(json.dumps({
            "event": "pusher:subscribe",
            "data": {"channel": self._channel},
        }))

    # -------------------- WS recv loop (background thread) --------------------

    def _run_loop(self) -> None:
        """
        Background-thread entry point: connect + recv until asked to stop, with
        auto-reconnect and quiet-retry logging. Each connection:
          connect -> (server sends connection_established) -> subscribe -> recv.
        A dropped connection -> log once -> sleep -> reconnect.
        """
        # The rpc_v2 WS library (websockets) — sync client API.
        websockets = get_third_package_websockets()
        from websockets.sync.client import connect as ws_connect
        from websockets.exceptions import ConnectionClosed

        url = self._ws_url()

        while not self._stop_event.is_set():
            try:
                # open_timeout keeps the connect attempt bounded; the server sends
                # connection_established immediately after the upgrade.
                with ws_connect(url, open_timeout=8, close_timeout=3) as ws:
                    self._set_connected(True)
                    if self._unreachable_warned:
                        ColorPrint.green(
                            f"[TranslationWS] Reconnected to Reverb at {self._public_url(masked=True)}"
                        )
                    else:
                        ColorPrint.green(
                            f"[TranslationWS] Connected to Reverb at {self._public_url(masked=True)}"
                        )
                    self._unreachable_warned = False

                    # Blocking recv loop. recv() with a timeout lets us notice a
                    # stop request promptly without busy-waiting.
                    while not self._stop_event.is_set():
                        try:
                            raw = ws.recv(timeout=1.0)
                        except TimeoutError:
                            continue  # no message this tick — re-check stop flag
                        if raw is None:
                            continue
                        if isinstance(raw, (bytes, bytearray)):
                            raw = raw.decode("utf-8", "ignore")
                        self._handle_frame(ws, raw)

            except ConnectionClosed:
                # Normal-ish drop (server restarted / network blip) — reconnect quietly.
                self._set_connected(False)
                if not self._stop_event.is_set():
                    ColorPrint.yellow(
                        "[TranslationWS] Reverb connection closed; will reconnect quietly."
                    )
            except Exception as e:
                # Unreachable (Reverb down) / handshake refused — ONE concise line,
                # then silence until it recovers (mirrors the worker's quiet retry).
                self._set_connected(False)
                if not self._unreachable_warned and not self._stop_event.is_set():
                    self._unreachable_warned = True
                    ColorPrint.yellow(
                        f"[TranslationWS] Reverb unreachable at {self._public_url(masked=True)} "
                        f"({self._short_err(e)}). Will keep retrying quietly "
                        "(set TRANSLATION_REVERB_HOST/PORT/APP_KEY to point at Laravel Reverb)."
                    )
            finally:
                self._set_connected(False)

            # Wait before reconnecting (interruptible by stop).
            if not self._stop_event.is_set():
                self._stop_event.wait(self._reconnect_delay)

        ColorPrint.blue("[TranslationWS] WS loop stopped")

    @staticmethod
    def _short_err(exc: Exception) -> str:
        """Condense a noisy WS/socket exception into a one-line reason."""
        name = type(exc).__name__
        text = str(exc)
        low = text.lower()
        if "refused" in low:
            return "connection refused (Reverb not listening)"
        if "timed out" in low or "timeout" in low:
            return "timed out"
        if "getaddrinfo" in low or "name or service" in low or "resolve" in low:
            return "host not resolvable"
        if "401" in text or "403" in text or "unauthorized" in low or "handshake" in low:
            return "handshake rejected (check app key / path)"
        return (text.splitlines()[0][:120] if text else name) or name

    # -------------------- thread lifecycle --------------------

    def _start_thread(self) -> None:
        """Start the background WS thread if it isn't already running."""
        with self._thread_lock:
            if self._thread and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._unreachable_warned = False
            self._thread = threading.Thread(
                target=self._run_loop, name="translation-ws", daemon=True
            )
            self._thread.start()
            ColorPrint.blue("[TranslationWS] Background WS thread started")

    def _stop_thread(self) -> None:
        """Signal the background WS thread to stop (non-blocking)."""
        with self._thread_lock:
            if not (self._thread and self._thread.is_alive()):
                return
            self._stop_event.set()
            ColorPrint.blue("[TranslationWS] Background WS thread stop requested")

    # -------------------- heartbeat supervisor callback --------------------

    def supervise(self) -> None:
        """
        PyHeartbeat callback (invoked every ~interval seconds WHEN ENABLED).

        LIGHT + exception-safe: only ensures the background WS thread is running.
        It does NO network I/O itself (the WS loop owns the socket on its own
        thread), so it never blocks the heartbeat thread. Disabling the callback
        (POST /api/heartbeat/disable/translation_ws_client) stops ticking this, so
        we also expose stop() for an explicit teardown.

        Because this callback only runs WHILE ENABLED, its presence keeps the WS
        thread alive; we additionally relaunch the thread here if it died.
        """
        try:
            self._start_thread()
        except Exception as e:
            ColorPrint.red(f"[TranslationWS] supervise error: {e}")

    def stop(self) -> None:
        """Explicitly stop the WS thread (e.g. on shutdown / disable)."""
        self._stop_thread()

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        with self._thread_lock:
            alive = bool(self._thread and self._thread.is_alive())
        return {
            "service": "Translation WS Client",
            "url": self._public_url(masked=True),
            "channel": self._channel,
            "connected": self._connected,
            "thread_alive": alive,
            "events_received": self._events_received,
            "ws_library": "websockets (rpc_v2's WS lib; sync client)",
            "initialized": self._initialized,
        }


# ============================================================
# Global singleton accessor
# ============================================================

def get_translation_ws_client(
    host: str = "127.0.0.1",
    port: int = 9000,
    scheme: str = "http",
    app_key: str = "",
    channel: str = "translation-queue",
    word_ttl_seconds: int = 120,
) -> TranslationWsClient:
    """
    Get the TranslationWsClient singleton (idempotent).

    Args mirror the Reverb connection (REVERB_* derived); see callmodule_main's
    _register_translation_ws_client for the Config-driven wiring.
    """
    return TranslationWsClient(
        host=host,
        port=port,
        scheme=scheme,
        app_key=app_key,
        channel=channel,
        word_ttl_seconds=word_ttl_seconds,
    )
