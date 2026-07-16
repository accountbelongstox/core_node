# -*- coding: utf-8 -*-
"""
Translation SSE Client Service (Phase C)

A pycore client that holds a long-lived Server-Sent-Events (SSE) stream on
Laravel's Octane HTTP port and receives translation-queue events in REAL TIME,
replacing the QueueMonitorService's 5s HTTP poll as the PRIMARY signal (the poll
is kept as a slower fallback/reconciler). The previous Reverb (Pusher-over-
WebSocket) transport is RETIRED: Octane provides no WebSocket and Reverb would
need its own process/port, so the same signal now rides plain HTTP on :9000.
(File/class names keep the legacy "ws" wording for import back-compat.)

------------------------------------------------------------------------------
Transport — SSE over the Octane HTTP port
------------------------------------------------------------------------------
Connection (from Laravel HTTP base via callmodule_config.Config):
    {scheme}://{host}:{port}{sse_path}?cursor={lastId}
    host = TRANSLATION_REVERB_HOST  (0.0.0.0 -> dial 127.0.0.1)
    port = TRANSLATION_REVERB_PORT  (9000 — laravel_main Octane; 8080 retired)
    sch. = TRANSLATION_REVERB_SCHEME (http/https; SSE is plain HTTP, not ws)
    path = TRANSLATION_SSE_PATH      (/api/app_qy_v1/ai_tools/translation/queue/stream)

The transport dep is third-party ``requests`` via ``get_third_package_requests()``
(never a bare import), used with ``stream=True`` so we read the event stream line
by line on our OWN background thread (no asyncio), matching the worker/monitor
threading model and keeping the heartbeat thread free.

Flow:
  1. GET the SSE URL with our resume cursor (0 -> server starts at its tail).
  2. Read ``event:`` / ``data:`` lines; a blank line ends one event.
  3. Envelope events (stream.open / ping / stream.close) only carry/advance the
     cursor. The server ends each stream after ~50s; we reconnect with the cursor
     so no event is missed across the gap.

Each event's ``data`` is a JSON object carrying ``_id`` (the outbox row id used as
the resume cursor). Laravel may namespace event names (e.g.
"App\\Events\\TaskQueued" or "task.queued"), so we MATCH ON SUFFIX.

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
    ensures the background SSE thread is alive when enabled and signals it to stop
    when disabled. It NEVER blocks the heartbeat thread on network I/O.
  - The actual connect + recv loop runs on a dedicated daemon thread with
    auto-reconnect and QUIET-RETRY logging (ONE clear connected/disconnected/
    unreachable line, not a stack every retry — mirrors the worker's style).
  - Enable/disable at runtime via the heartbeat management router:
        POST /api/heartbeat/enable/translation_ws_client
        POST /api/heartbeat/disable/translation_ws_client

Logging: ColorPrint only (pycore rule). The SSE transport uses third-party
`requests` via get_third_package_requests() (never a bare import). This module
imports only pyfoundations + sibling services (same layer) — never rpc_v2 /
callmodule routers (no upward layer import).
"""

import json
import threading
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# requests is a third-party dep — always via the lazy accessor (SSE transport).
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    resolve_laravel_base_url,
)
# Sibling services (same layer): the monitor (snapshot push) + worker (word dedup).
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker_service import (
    get_translation_worker_service,
)


class TranslationWsClient:
    """
    Laravel SSE client (singleton) — replaces the retired Reverb WebSocket.

    Holds a long-lived Server-Sent-Events stream on Laravel's Octane HTTP port
    (9000) at /api/app_qy_v1/ai_tools/translation/queue/stream, and routes the 4
    contract events (task.queued/task.priority/word.translated/task.completed)
    into the QueueMonitorService snapshot (real-time UI) and the
    TranslationWorkerService word-dedup set (multi-pycore coordination). A `_id`
    cursor carried in every event lets reconnects resume with no gap. Runs its
    read loop on a background thread with auto-reconnect; supervised by a light
    heartbeat callback. (Class name kept for import/back-compat.)
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
        sse_path: str = "/api/app_qy_v1/ai_tools/translation/queue/stream",
    ):
        """
        Initialize the SSE client (idempotent — safe to call repeatedly).

        Transport is a long-lived SSE stream on Laravel's Octane HTTP port (the
        retired Reverb WebSocket is gone). Same 4 contract events are routed into
        the QueueMonitor snapshot + worker word-dedup set.

        Args:
            host/port/scheme: Laravel HTTP base (TRANSLATION_REVERB_* derived).
            sse_path: SSE endpoint path on that base.
            app_key/channel: kept for status/back-compat (unused by SSE).
            word_ttl_seconds: TTL fed to the worker's done-words set per event.
        """
        if getattr(self, "_initialized", False):
            return

        # 0.0.0.0 is a bind address — never DIAL it; map to loopback.
        self._host = "127.0.0.1" if str(host) in ("0.0.0.0", "", "None") else str(host)
        self._port = int(port)
        # SSE rides plain HTTP(S) on the Octane port (NOT ws/wss).
        self._scheme = "https" if str(scheme).lower() in ("https", "wss") else "http"
        self._sse_path = sse_path or "/api/app_qy_v1/ai_tools/translation/queue/stream"
        self._app_key = app_key or ""
        self._channel = channel or "translation-queue"
        self._word_ttl = max(1, int(word_ttl_seconds))

        # Resume cursor: highest outbox event id seen (carried in each event's _id).
        self._cursor = 0

        # Sibling singletons (resolved lazily on first event so init order is free).
        self._monitor = None
        self._worker = None

        # Background thread + control flags.
        self._thread: Optional[threading.Thread] = None
        self._thread_lock = threading.Lock()
        self._stop_event = threading.Event()  # set() asks the read loop to exit
        self._connected = False

        # Quiet-retry bookkeeping: emit ONE "unreachable" line, then stay silent
        # until the situation changes. _ever_connected keeps periodic clean
        # reconnects (the server ends each stream ~50s) from spamming the log.
        self._unreachable_warned = False
        self._ever_connected = False
        self._reconnect_delay = 3  # seconds between reconnect attempts

        # Diagnostics.
        self._events_received = 0
        self._last_event_ts = 0.0

        self._initialized = True
        ColorPrint.green(
            f"[TranslationSSE] Service initialized (url={self._public_url()}, "
            f"cursor={self._cursor})"
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

    def _resolved_http_parts(self) -> tuple:
        """Scheme/host/port from the UI-selected Laravel endpoint (live)."""
        base = resolve_laravel_base_url().rstrip("/")
        parsed = urlparse(base)
        scheme = parsed.scheme or self._scheme
        host = parsed.hostname or self._host
        if host in ("0.0.0.0", "", "None"):
            host = "127.0.0.1"
        port = parsed.port or (443 if scheme == "https" else 9000)
        return scheme, host, port

    def _stream_url(self) -> str:
        """Build the SSE GET URL (cursor lets the server resume from our position)."""
        scheme, host, port = self._resolved_http_parts()
        return (
            f"{scheme}://{host}:{port}{self._sse_path}"
            f"?cursor={int(self._cursor)}"
        )

    def _public_url(self, masked: bool = False) -> str:
        """Base URL for logging (no secrets in the SSE transport; `masked` kept
        for call-site compatibility)."""
        scheme, host, port = self._resolved_http_parts()
        return f"{scheme}://{host}:{port}{self._sse_path}"

    # -------------------- connection status --------------------

    def _set_connected(self, connected: bool) -> None:
        """Update local + monitor-visible WS connection status."""
        self._connected = connected
        try:
            self._get_monitor().set_ws_connected(connected)
        except Exception:
            # Status is best-effort; never let it break the SSE loop.
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
                    f"[TranslationSSE] word.translated '{word}' "
                    f"-> {data.get('target_language')} (dedup across pycores)"
                )

        # task.completed -> mark completed in snapshot
        elif suffix == "taskcompleted":
            self._get_monitor().apply_task_completed(data)
        # Unknown channel events are ignored (forward-compatible).

    # Envelope events the stream uses for resume/keep-alive (not channel events).
    _ENVELOPE_EVENTS = ("stream.open", "ping", "stream.close")

    def _advance_cursor(self, data: Dict[str, Any]) -> None:
        """Move the resume cursor forward from an event payload (_id or cursor)."""
        raw = data.get("_id", data.get("cursor"))
        try:
            new_id = int(raw)
        except (TypeError, ValueError):
            return
        if new_id > self._cursor:
            self._cursor = new_id

    def _dispatch_sse(self, event_name: str, data_str: str) -> None:
        """Parse one SSE event's data and route it (envelope vs channel event)."""
        data = self._parse_data(data_str)
        # Envelope events (stream.open/ping/stream.close) only carry the cursor.
        if event_name in self._ENVELOPE_EVENTS:
            self._advance_cursor(data)
            return
        # Channel event: advance cursor + route to monitor/worker.
        self._advance_cursor(data)
        self._events_received += 1
        self._last_event_ts = time.monotonic()
        self._route_event(event_name, data)

    # -------------------- SSE read loop (background thread) --------------------

    def _run_loop(self) -> None:
        """
        Background-thread entry point: hold an SSE connection to Laravel and route
        events until asked to stop, with auto-reconnect + quiet-retry logging.
        The server ends each stream after ~50s; we immediately reconnect carrying
        our cursor, so no event is missed across the gap.
        """
        requests = get_third_package_requests()

        while not self._stop_event.is_set():
            event_name = ""
            data_buf: list = []
            try:
                url = self._stream_url()
                # (connect timeout, read timeout). Server heartbeats arrive <=15s,
                # so a 60s read gap means a dead connection -> reconnect.
                with requests.get(
                    url,
                    stream=True,
                    timeout=(8, 60),
                    headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"},
                ) as resp:
                    if resp.status_code != 200:
                        raise RuntimeError(f"HTTP {resp.status_code}")

                    self._set_connected(True)
                    if self._unreachable_warned:
                        ColorPrint.green(
                            f"[TranslationSSE] Reconnected to Laravel SSE at {self._public_url()}"
                        )
                    elif not self._ever_connected:
                        ColorPrint.green(
                            f"[TranslationSSE] Connected to Laravel SSE at {self._public_url()}"
                        )
                    self._ever_connected = True
                    self._unreachable_warned = False

                    # SSE framing: accumulate field lines; a blank line ends one
                    # event. iter_lines yields lines without the trailing newline.
                    for raw in resp.iter_lines(decode_unicode=True):
                        if self._stop_event.is_set():
                            break
                        if raw is None:
                            continue
                        if isinstance(raw, (bytes, bytearray)):
                            raw = raw.decode("utf-8", "ignore")
                        line = raw.rstrip("\r")

                        if line == "":
                            if event_name or data_buf:
                                self._dispatch_sse(event_name, "\n".join(data_buf))
                            event_name = ""
                            data_buf = []
                            continue
                        if line.startswith(":"):
                            continue  # SSE comment / keep-alive
                        if line.startswith("event:"):
                            event_name = line[len("event:"):].strip()
                        elif line.startswith("data:"):
                            data_buf.append(line[len("data:"):].lstrip(" "))
                        # other SSE fields (id:/retry:) are ignored

            except Exception as e:
                # Unreachable (Laravel down) / non-200 — ONE concise line, then
                # silence until it recovers (mirrors the worker's quiet retry).
                self._set_connected(False)
                if not self._unreachable_warned and not self._stop_event.is_set():
                    self._unreachable_warned = True
                    ColorPrint.yellow(
                        f"[TranslationSSE] Laravel SSE unreachable at {self._public_url()} "
                        f"({self._short_err(e)}). Will keep retrying quietly "
                        "(set TRANSLATION_REVERB_HOST/PORT or TRANSLATION_SSE_PATH)."
                    )
            finally:
                self._set_connected(False)

            # Wait before reconnecting (interruptible by stop). A clean server-side
            # stream end falls through here too; the cursor prevents any gap.
            if not self._stop_event.is_set():
                self._stop_event.wait(self._reconnect_delay)

        ColorPrint.blue("[TranslationSSE] SSE loop stopped")

    @staticmethod
    def _short_err(exc: Exception) -> str:
        """Condense a noisy HTTP/socket exception into a one-line reason."""
        name = type(exc).__name__
        text = str(exc)
        low = text.lower()
        if "refused" in low:
            return "connection refused (Laravel SSE not listening)"
        if "timed out" in low or "timeout" in low:
            return "timed out"
        if "getaddrinfo" in low or "name or service" in low or "resolve" in low:
            return "host not resolvable"
        if "404" in text or "405" in text:
            return "stream route not found (check TRANSLATION_SSE_PATH)"
        if "401" in text or "403" in text or "unauthorized" in low:
            return "rejected (check route is in the no-auth control group)"
        return (text.splitlines()[0][:120] if text else name) or name

    # -------------------- thread lifecycle --------------------

    def _start_thread(self) -> None:
        """Start the background SSE thread if it isn't already running."""
        with self._thread_lock:
            if self._thread and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._unreachable_warned = False
            self._thread = threading.Thread(
                target=self._run_loop, name="translation-ws", daemon=True
            )
            self._thread.start()
            ColorPrint.blue("[TranslationSSE] Background SSE thread started")

    def _stop_thread(self) -> None:
        """Signal the background SSE thread to stop (non-blocking)."""
        with self._thread_lock:
            if not (self._thread and self._thread.is_alive()):
                return
            self._stop_event.set()
            ColorPrint.blue("[TranslationSSE] Background SSE thread stop requested")

    # -------------------- heartbeat supervisor callback --------------------

    def supervise(self) -> None:
        """
        PyHeartbeat callback (invoked every ~interval seconds WHEN ENABLED).

        LIGHT + exception-safe: only ensures the background SSE thread is running.
        It does NO network I/O itself (the SSE loop owns the socket on its own
        thread), so it never blocks the heartbeat thread. Disabling the callback
        (POST /api/heartbeat/disable/translation_ws_client) stops ticking this, so
        we also expose stop() for an explicit teardown.

        Because this callback only runs WHILE ENABLED, its presence keeps the WS
        thread alive; we additionally relaunch the thread here if it died.
        """
        try:
            self._start_thread()
        except Exception as e:
            ColorPrint.red(f"[TranslationSSE] supervise error: {e}")

    def stop(self) -> None:
        """Explicitly stop the WS thread (e.g. on shutdown / disable)."""
        self._stop_thread()

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        with self._thread_lock:
            alive = bool(self._thread and self._thread.is_alive())
        return {
            "service": "Translation SSE Client",
            "url": self._public_url(),
            "channel": self._channel,
            "connected": self._connected,
            "thread_alive": alive,
            "events_received": self._events_received,
            "cursor": self._cursor,
            "transport": "requests (SSE stream)",
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
    sse_path: str = "/api/app_qy_v1/ai_tools/translation/queue/stream",
) -> TranslationWsClient:
    """
    Get the TranslationWsClient (SSE) singleton (idempotent).

    Args mirror Laravel's HTTP base (TRANSLATION_REVERB_* / TRANSLATION_SSE_*
    derived); see callmodule_main's _register_translation_ws_client for the
    Config-driven wiring.
    """
    return TranslationWsClient(
        host=host,
        port=port,
        scheme=scheme,
        app_key=app_key,
        channel=channel,
        word_ttl_seconds=word_ttl_seconds,
        sse_path=sse_path,
    )
