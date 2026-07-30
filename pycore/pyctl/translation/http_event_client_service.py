# -*- coding: utf-8 -*-
"""
Translation SSE Client Service (Phase C)

A pycore client that holds a long-lived Server-Sent-Events (SSE) stream on
Laravel's Octane HTTP port and receives translation-queue events in REAL TIME,
replacing the QueueMonitorService's 5s HTTP poll as the PRIMARY signal (the poll
is kept as a slower fallback/reconciler). The previous Reverb (Pusher-over-
WebSocket) transport is RETIRED: Octane provides no WebSocket and Reverb would
need its own process/port, so the same signal now rides plain HTTP on :9000.

------------------------------------------------------------------------------
Transport — SSE over the Octane HTTP port
------------------------------------------------------------------------------
Connection (from Laravel HTTP base via callmodule_config.Config):
    {scheme}://{host}:{port}{sse_path}?cursor={lastId}
    host = TRANSLATION_EVENT_HOST  (0.0.0.0 -> dial 127.0.0.1)
    port = TRANSLATION_EVENT_PORT  (9000 — laravel_main Octane)
    sch. = TRANSLATION_EVENT_SCHEME (http/https)
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
  - sentence.priority { content_id, language, priority, text }
        or aggregate { batch: true, count, languages }
        -> QueueBumpHub.record (UI toasts + HTTP events) +
           TTSSentenceWorkerService.notify_bump / notify_batch_bump
           (re-key queued task + immediate wake)

------------------------------------------------------------------------------
Threading / lifecycle (mirrors translation_worker_service / queue_monitor)
------------------------------------------------------------------------------
  - Singleton, registered as a PyHeartbeat callback
    ('translation_http_event_client',
    ENABLED by default). The heartbeat callback ``supervise()`` is LIGHT: it only
    ensures the background SSE thread is alive when enabled and signals it to stop
    when disabled. It NEVER blocks the heartbeat thread on network I/O.
  - The actual connect + recv loop runs on a dedicated daemon thread with
    auto-reconnect and QUIET-RETRY logging (ONE clear connected/disconnected/
    unreachable line, not a stack every retry — mirrors the worker's style).
  - Pycore UI enables/disables it only through HTTP
    `ui/heartbeat_workers/config`; the background Laravel SSE connection remains
    a Pycore-to-Laravel transport.

Logging: ColorPrint only (pycore rule). The SSE transport uses third-party
`requests` via get_third_package_requests() (never a bare import). This module
imports only pyfoundations + sibling services (same layer) — never rpc_v2 /
callmodule routers (no upward layer import).
"""

import json
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.http_sse import SSE_REQUEST_HEADERS, SseEventDecoder
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
# Rule §4: all inter-thread data exchange goes through the global bus.
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
# requests is a third-party dep — always via the lazy accessor (SSE transport).
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
# Sibling services (same layer): the monitor (snapshot push) + worker (word dedup).
from pycore.pyctl.queue_center.translation_monitor_service import queue_monitor_service
from pycore.pyctl.translation.worker.worker import (
    translation_worker_service,
)
# Sentence-audio lane: bump hub (UI toasts/HTTP events) + worker (re-key + wake)
# for the
# sentence.priority events that ride this same SSE stream.
from pycore.pyutils.common.queue_bump_hub import queue_bump_hub
from pycore.pyctl.tts.sentence_worker_service import (
    tts_sentence_worker_service,
)
from pycore.pyctl.tts.sentence_queue_monitor_service import (
    sentence_queue_monitor_service,
)
from pycore.pyctl.tts.word_queue_poller_service import (
    tts_queue_poller_service,
)
from pycore.pyutils.common.service_config import (
    TRANSLATION_EVENT_CHANNEL,
    TRANSLATION_EVENT_HOST,
    TRANSLATION_EVENT_PORT,
    TRANSLATION_EVENT_SCHEME,
    TRANSLATION_EVENT_WORD_TTL_SECONDS,
    TRANSLATION_SSE_PATH,
)


# THREAD_BUS signal asking the SSE read loop to exit (rule §4: threads never
# exchange data directly — the stop request rides the bus, not an Event).
_BUS_STOP = "translation_http_event_client.stop"


class TranslationHttpEventClient:
    """
    Laravel SSE client (singleton) — replaces the retired Reverb WebSocket.

    Holds a long-lived Server-Sent-Events stream on Laravel's Octane HTTP port
    (9000) at /api/app_qy_v1/ai_tools/translation/queue/stream, and routes the 4
    contract events (task.queued/task.priority/word.translated/task.completed)
    into the QueueMonitorService snapshot (real-time UI) and the
    TranslationWorkerService word-dedup set (multi-pycore coordination). A `_id`
    cursor carried in every event lets reconnects resume with no gap. Runs its
    read loop on a background thread with auto-reconnect; supervised by a light
    heartbeat callback.
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 9000,
        scheme: str = "http",
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
            host/port/scheme: Laravel HTTP event endpoint.
            sse_path: SSE endpoint path on that base.
            channel: Event stream label for status output.
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
        self._channel = channel or "translation-queue"
        self._word_ttl = max(1, int(word_ttl_seconds))

        # Resume cursor: highest outbox event id seen (carried in each event's _id).
        self._cursor = 0

        # Sibling singletons (resolved lazily on first event so init order is free).
        self._monitor = None
        self._worker = None
        self._sentence_worker = None

        # The state owner retains the task handle; stop requests use THREAD_BUS.
        self._thread: Optional[Any] = None
        self._connected = False

        # Quiet-retry bookkeeping: emit ONE "unreachable" line, then stay silent
        # until the situation changes. _ever_connected keeps periodic clean
        # reconnects (the server ends each stream ~50s) from spamming the log.
        self._unreachable_warned = False
        self._ever_connected = False
        # Exponential reconnect backoff: start at 3s, double per failed attempt,
        # cap at 30s, reset to 3s on a successful connect. The wait stays
        # interruptible via THREAD_BUS.wait_signal(_BUS_STOP, ...).
        self._reconnect_delay = 3
        self._reconnect_delay_max = 30

        # Diagnostics.
        self._events_received = 0
        self._last_event_ts = 0.0
        init_serialized_owner(self, "translation.sse_client.state", "TranslationSSEState")

        self._initialized = True
        ColorPrint.green(
            f"[TranslationSSE] Service initialized (url={self._public_url()}, "
            f"cursor={self._cursor})"
        )

    # -------------------- sibling accessors --------------------

    @serialized_method
    def _get_monitor(self):
        """Resolve the QueueMonitorService singleton (lazy)."""
        if self._monitor is None:
            self._monitor = queue_monitor_service
        return self._monitor

    @serialized_method
    def _get_worker(self):
        """Resolve the TranslationWorkerService singleton (lazy)."""
        if self._worker is None:
            self._worker = translation_worker_service
        return self._worker

    @serialized_method
    def _get_sentence_worker(self):
        """Resolve the TTSSentenceWorkerService singleton (lazy)."""
        if self._sentence_worker is None:
            self._sentence_worker = tts_sentence_worker_service
        return self._sentence_worker

    # -------------------- URL --------------------

    def _resolved_http_parts(self) -> tuple:
        """Scheme/host/port from the UI-selected Laravel endpoint (live)."""
        base = laravel_endpoint_manager.resolve().rstrip("/")
        parsed = urlparse(base)
        scheme = parsed.scheme or self._scheme
        host = parsed.hostname or self._host
        if host in ("0.0.0.0", "", "None"):
            host = "127.0.0.1"
        port = parsed.port or (443 if scheme == "https" else 9000)
        return scheme, host, port

    @serialized_method
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

    @serialized_method
    def _set_connected(self, connected: bool) -> None:
        """Update local and monitor-visible HTTP event connection status."""
        self._connected = connected
        try:
            self._get_monitor().set_event_connected(connected)
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
        self._get_monitor().increment_event_count()
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

        # sentence.priority -> sentence-audio lane: record the bump + re-key /
        # wake the sentence worker (single payload), or wake-only (aggregate).
        elif suffix == "sentencepriority":
            self._handle_sentence_priority(data)

        elif suffix == "wordaudiopriority":
            items = data.get("items") if data.get("batch") else [data]
            worker = tts_queue_poller_service
            for item in items if isinstance(items, list) else []:
                if not isinstance(item, dict):
                    continue
                md5 = str(item.get("md5") or "").strip()
                language = str(item.get("language") or "").strip()
                if md5 and language:
                    worker.prioritize_word(md5, language)
            if shared_heartbeat_system.is_callback_enabled("tts_queue_poller"):
                start_bus_task(
                    worker.poll_and_process,
                    thread_name="SseWordAudioWakeThread",
                )

        # word_image.priority / cover.priority are intentionally not woken here:
        # apps/mcp-chrome owns image and cover execution. Pycore only relays
        # priority requests to Laravel.

        elif suffix == "articlepublished":
            THREAD_BUS.trigger_event(BusSignals.ARTICLE_PUBLISHED, data)
        # Unknown channel events are ignored (forward-compatible).

    @staticmethod
    def _refresh_sentence_queue_monitor() -> None:
        """Kick the sentence-queue monitor so the Queue Center 'awaiting
        synthesis' list reflects a bump/change immediately instead of waiting
        for the next monitor poll (non-blocking, re-entrancy-guarded)."""
        try:
            sentence_queue_monitor_service.poll_once()
        except Exception as e:  # noqa: BLE001 — never break the SSE read loop
            ColorPrint.yellow(f"[TranslationSSE] sentence queue monitor kick failed: {e}")

    def _handle_sentence_priority(self, data: Dict[str, Any]) -> None:
        """
        Route a sentence.priority event. Payload shapes (laravel contract):
          single:    { content_id, language, priority, text }
          aggregate: { batch: true, count, languages: [...] }
        Fully guarded — a malformed event must never kill the SSE loop.
        """
        try:
            if data.get("batch"):
                # Aggregate bump: no per-row payload; the next claim already
                # orders by priority DESC server-side, so wake only.
                if shared_heartbeat_system.is_callback_enabled("tts_sentence_worker"):
                    self._get_sentence_worker().notify_batch_bump()
                if shared_heartbeat_system.is_callback_enabled("sentence_queue_monitor"):
                    self._refresh_sentence_queue_monitor()
                return
            content_id = str(data.get("content_id") or "").strip()
            language = str(data.get("language") or "").strip()
            if not content_id or not language:
                return
            try:
                priority = int(data.get("priority") or 0)
            except (TypeError, ValueError):
                priority = 0
            text = str(data.get("text") or "")
            queue_bump_hub.record(
                lane="sentence_audio",
                item_id=f"{language}:{content_id}",
                label=text[:80],
                old_priority=0,
                new_priority=priority,
                meta={
                    "language": language,
                    "content_id": content_id,
                    "source": "sse",
                },
            )
            if shared_heartbeat_system.is_callback_enabled("tts_sentence_worker"):
                self._get_sentence_worker().notify_bump(content_id, language, priority)
            if shared_heartbeat_system.is_callback_enabled("sentence_queue_monitor"):
                self._refresh_sentence_queue_monitor()
        except Exception as e:  # noqa: BLE001 — never break the SSE read loop
            ColorPrint.yellow(f"[TranslationSSE] sentence.priority handling failed: {e}")

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
        """Parse one SSE event's data and route it (envelope vs channel event).

        Deliberately NOT a @serialized_method: it runs ONLY on the SSE read
        loop thread (single writer for _cursor/_events_received/_last_event_ts),
        and _route_event calls into OTHER serialized services (queue monitor,
        workers). Running this on the translation.sse_client.state owner meant
        any stall in those services occupied the owner, so supervise()'s
        _start_thread raised 'Serialized operation timed out' every heartbeat.
        """
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

    @serialized_method
    def _mark_connected_success(self) -> Dict[str, Any]:
        was_unreachable = self._unreachable_warned
        first_connection = not self._ever_connected
        self._set_connected(True)
        self._ever_connected = True
        self._unreachable_warned = False
        self._reconnect_delay = 3
        return {
            "was_unreachable": was_unreachable,
            "first_connection": first_connection,
        }

    @serialized_method
    def _mark_connection_failure(self) -> Dict[str, Any]:
        self._set_connected(False)
        self._reconnect_delay = min(
            self._reconnect_delay * 2,
            self._reconnect_delay_max,
        )
        should_log = not self._unreachable_warned and not THREAD_BUS.has_signal(_BUS_STOP)
        if should_log:
            self._unreachable_warned = True
        return {"should_log": should_log, "delay": self._reconnect_delay}

    @serialized_method
    def _reconnect_wait(self) -> int:
        return self._reconnect_delay

    # -------------------- SSE read loop (background thread) --------------------

    def _run_loop(self) -> None:
        """
        Background-thread entry point: hold an SSE connection to Laravel and route
        events until asked to stop, with auto-reconnect + quiet-retry logging.
        The server ends each stream after ~50s; we immediately reconnect carrying
        our cursor, so no event is missed across the gap.
        """
        while not THREAD_BUS.has_signal(_BUS_STOP):
            try:
                url = self._stream_url()
                # (connect timeout, read timeout). Server heartbeats arrive <=15s,
                # so a 60s read gap means a dead connection -> reconnect.
                # get_stream opens with stream=True so we can iterate the SSE body.
                with laravel_client.get_stream(
                    url,
                    timeout=(8, 60),
                    headers=SSE_REQUEST_HEADERS,
                ) as resp:
                    if resp.status_code != 200:
                        raise RuntimeError(f"HTTP {resp.status_code}")

                    connection_state = self._mark_connected_success()
                    if connection_state["was_unreachable"]:
                        ColorPrint.green(
                            f"[TranslationSSE] Reconnected to Laravel SSE at {self._public_url()}"
                        )
                    elif connection_state["first_connection"]:
                        ColorPrint.green(
                            f"[TranslationSSE] Connected to Laravel SSE at {self._public_url()}"
                        )
                    decoder = SseEventDecoder()
                    # SSE framing: accumulate field lines; a blank line ends one
                    # event. iter_lines yields lines without the trailing newline.
                    for raw in resp.iter_lines(decode_unicode=True):
                        if THREAD_BUS.has_signal(_BUS_STOP):
                            break
                        event = decoder.feed_line(raw)
                        if event is not None:
                            event_name, data, _event_id = event
                            self._dispatch_sse(event_name, data)

            except Exception as e:
                # Unreachable (Laravel down) / non-200 — ONE concise line, then
                # silence until it recovers (mirrors the worker's quiet retry).
                failure_state = self._mark_connection_failure()
                if failure_state["should_log"]:
                    ColorPrint.yellow(
                        f"[TranslationSSE] Laravel SSE unreachable at {self._public_url()} "
                        f"({self._short_err(e)}). Will keep retrying quietly "
                        "(set TRANSLATION_EVENT_HOST/PORT or TRANSLATION_SSE_PATH)."
                    )
            finally:
                self._set_connected(False)

            # Wait before reconnecting (interruptible by the stop signal — rule
            # §4: wait_signal returns as soon as _BUS_STOP lands). A clean
            # server-side stream end falls through here too; the cursor prevents
            # any gap.
            if not THREAD_BUS.has_signal(_BUS_STOP):
                THREAD_BUS.wait_signal(_BUS_STOP, timeout=self._reconnect_wait())

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

    @serialized_method
    def _start_thread(self) -> None:
        """Start the background SSE thread if it isn't already running.

        The alive check and task-handle update run on the serialized state owner.
        """
        thread = self._thread
        if thread and thread.is_alive():
            return
        THREAD_BUS.clear_signal(_BUS_STOP)
        self._unreachable_warned = False
        self._thread = start_bus_task(
            self._run_loop,
            thread_name="TranslationSSEClientThread",
        )
        ColorPrint.blue("[TranslationSSE] Background SSE thread started")

    @serialized_method
    def _stop_thread(self) -> None:
        """Signal the background SSE thread to stop (non-blocking).

        Rule §4: the stop request is a THREAD_BUS signal, not an Event."""
        thread = self._thread
        if not (thread and thread.is_alive()):
            return
        THREAD_BUS.signal(_BUS_STOP, True)
        ColorPrint.blue("[TranslationSSE] Background SSE thread stop requested")

    # -------------------- heartbeat supervisor callback --------------------

    def supervise(self) -> None:
        """
        PyHeartbeat callback (invoked every ~interval seconds WHEN ENABLED).

        LIGHT + exception-safe: only ensures the background SSE thread is running.
        It does NO network I/O itself (the SSE loop owns the socket on its own
        thread), so it never blocks the heartbeat thread. Disabling the callback
        through HTTP `ui/heartbeat_workers/config` stops ticking this, so we
        also expose stop() for an explicit teardown.

        Because this callback only runs while enabled, it keeps the SSE
        thread alive; we additionally relaunch the thread here if it died.
        """
        try:
            self._start_thread()
        except Exception as e:
            ColorPrint.red(f"[TranslationSSE] supervise error: {e}")

    def stop(self) -> None:
        """Explicitly stop the SSE thread on shutdown or disable."""
        self._stop_thread()

    # -------------------- introspection --------------------

    @serialized_method
    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        thread = self._thread
        alive = bool(thread and thread.is_alive())
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


translation_http_event_client = TranslationHttpEventClient(
    host=TRANSLATION_EVENT_HOST,
    port=TRANSLATION_EVENT_PORT,
    scheme=TRANSLATION_EVENT_SCHEME,
    channel=TRANSLATION_EVENT_CHANNEL,
    word_ttl_seconds=TRANSLATION_EVENT_WORD_TTL_SECONDS,
    sse_path=TRANSLATION_SSE_PATH,
)
