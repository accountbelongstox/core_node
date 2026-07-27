# -*- coding: utf-8 -*-
"""
Python RPC v2 WebSocket Client

Canonical Python-side implementation of the RPC v2 WebSocket protocol.
Used by the Qwen3TTS isolation process and any other Python service that
needs to communicate with a FastAPI RPC v2 server.

Protocol:
  - client hello  → welcome (must complete before ready)
  - request       ← response
  - server_event  → ACK  (durable at-least-once delivery)
  - Reconnect with last_acked_seq for replay
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Protocol constants
# ---------------------------------------------------------------------------
PROTOCOL_VERSION = 2
_HANDSHAKE_TIMEOUT = 10.0   # seconds to await welcome after connect
_DEFAULT_DEADLINE = 30.0    # default per-request deadline in seconds
_RECONNECT_BASE = 0.5       # seconds
_RECONNECT_MAX = 30.0       # seconds
_RECONNECT_JITTER = 0.2     # fraction (0.0–1.0)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class RpcResponse:
    request_id: str
    route: str
    success: bool
    data: Any = None
    error: Optional[Dict[str, Any]] = None


@dataclass
class _Pending:
    """In-flight request awaiting a response."""
    request_id: str
    deadline_at: float
    event: threading.Event = field(default_factory=threading.Event)
    response: Optional[RpcResponse] = None


@dataclass
class Subscription:
    """A single topic subscription."""
    callback: Callable[[str, Dict[str, Any]], None]
    topic: str
    sub_id: str = field(default_factory=lambda: uuid.uuid4().hex)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class PythonRpcV2WsClient:
    """
    Thread-safe Python WebSocket client for the RPC v2 protocol.

    Usage::

        client = PythonRpcV2WsClient(url="ws://127.0.0.1:8765/rpc/ws")
        client.start()
        response = client.call("qwen.health", {}, deadline=10.0)
        client.stop()

    The client maintains a stable ``client_id`` across reconnections and
    replays server events from ``last_acked_seq`` on reconnect.
    """

    def __init__(
        self,
        url: str,
        client_id: Optional[str] = None,
        on_error: Optional[Callable[[Exception], None]] = None,
    ) -> None:
        self._url = url
        self._client_id: str = client_id or f"pyws-{uuid.uuid4().hex}"
        self._on_error = on_error

        # State
        self._ready = threading.Event()
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        # Per-connection identity
        self._connection_id: Optional[str] = None
        self._server_instance_id: Optional[str] = None

        # Durable delivery tracking
        self._last_acked_seq: int = 0
        self._resume_token: Optional[str] = None
        self._pending_acks: Dict[str, Dict[str, Any]] = {}
        self._recent_event_ids: List[str] = []
        self._recent_event_limit = 512

        # Pending requests
        self._pending_requests: Dict[str, _Pending] = {}

        # Subscriptions: topic -> sub_id -> Subscription
        self._subscriptions: Dict[str, Dict[str, Subscription]] = {}
        self._sub_lock = threading.Lock()

        # WebSocket connection (populated by _loop)
        self._ws: Any = None  # websocket-client WebSocket object

        # Reconnect backoff state
        self._reconnect_attempts: int = 0

        # Background thread
        self._thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def client_id(self) -> str:
        return self._client_id

    @property
    def is_ready(self) -> bool:
        return self._ready.is_set()

    def start(self) -> None:
        """Start the background connection loop."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"rpc-ws-{self._client_id[:8]}")
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        """Stop the client and close the WebSocket."""
        self._stop_event.set()
        self._ready.clear()
        ws = self._ws
        if ws:
            try:
                ws.close()
            except Exception:
                pass
        if self._thread:
            self._thread.join(timeout=timeout)

    def call(
        self,
        route: str,
        params: Optional[Dict[str, Any]] = None,
        deadline: float = _DEFAULT_DEADLINE,
        idempotency_key: Optional[str] = None,
    ) -> RpcResponse:
        """
        Send an RPC request and block until a response or timeout.

        The absolute deadline is computed at call time and is NOT reset
        on reconnect (per V7 spec).
        """
        if not self._ready.wait(timeout=deadline):
            return RpcResponse(
                request_id="",
                route=route,
                success=False,
                error={"code": "not_ready", "message": "Client not connected"},
            )

        request_id = uuid.uuid4().hex
        deadline_at = time.monotonic() + deadline

        pending = _Pending(request_id=request_id, deadline_at=deadline_at)
        with self._lock:
            self._pending_requests[request_id] = pending

        message: Dict[str, Any] = {
            "type": "request",
            "request_id": request_id,
            "client_id": self._client_id,
            "route": route,
            "params": params or {},
            "deadline_at": time.time() + deadline,  # UTC epoch for server validation
        }
        if idempotency_key:
            message["idempotency_key"] = idempotency_key

        try:
            self._send(message)
        except Exception as exc:
            with self._lock:
                self._pending_requests.pop(request_id, None)
            return RpcResponse(
                request_id=request_id,
                route=route,
                success=False,
                error={"code": "send_error", "message": str(exc)},
            )

        # Wait for response up to the remaining deadline
        remaining = deadline_at - time.monotonic()
        signalled = pending.event.wait(timeout=max(remaining, 0))

        with self._lock:
            self._pending_requests.pop(request_id, None)

        if signalled and pending.response is not None:
            return pending.response

        return RpcResponse(
            request_id=request_id,
            route=route,
            success=False,
            error={"code": "timeout", "message": "Request timed out"},
        )

    def subscribe(self, topic: str, callback: Callable[[str, Dict[str, Any]], None]) -> str:
        """
        Subscribe to a server event topic.

        Returns a subscription ID that can be passed to ``unsubscribe``.
        Multiple subscriptions on the same topic are all notified independently.
        """
        sub = Subscription(callback=callback, topic=topic)
        with self._sub_lock:
            bucket = self._subscriptions.setdefault(topic, {})
            bucket[sub.sub_id] = sub
        return sub.sub_id

    def unsubscribe(self, topic: str, sub_id: str) -> None:
        """Remove a subscription by topic + sub_id (idempotent)."""
        with self._sub_lock:
            bucket = self._subscriptions.get(topic)
            if bucket:
                bucket.pop(sub_id, None)

    # ------------------------------------------------------------------
    # Connection loop
    # ------------------------------------------------------------------

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._connect_and_run()
                self._reconnect_attempts = 0  # successful run
            except Exception as exc:
                if self._stop_event.is_set():
                    break
                if self._on_error:
                    try:
                        self._on_error(exc)
                    except Exception:
                        pass
                log.warning("[rpc-ws] Connection error: %s — reconnecting", exc)
                self._ready.clear()
                self._reject_pending_on_disconnect()
                self._backoff_sleep()

    def _connect_and_run(self) -> None:
        try:
            import websocket  # websocket-client package
        except ImportError as exc:
            raise ImportError("websocket-client package required: pip install websocket-client") from exc

        ws = websocket.WebSocket()
        ws.connect(self._url)
        self._ws = ws

        # --- Send hello ---
        hello: Dict[str, Any] = {
            "type": "hello",
            "protocol_version": PROTOCOL_VERSION,
            "client_id": self._client_id,
            "last_acked_seq": self._last_acked_seq,
            "capabilities": {"ack": True, "replay": True},
        }
        if self._resume_token:
            hello["resume_token"] = self._resume_token
        self._raw_send(ws, hello)

        # --- Await welcome ---
        ws.settimeout(_HANDSHAKE_TIMEOUT)
        raw = ws.recv()
        ws.settimeout(None)
        msg = json.loads(raw)
        if msg.get("type") != "welcome":
            raise ValueError(f"Expected welcome, got: {msg.get('type')!r}")

        self._connection_id = msg.get("connection_id")
        self._server_instance_id = msg.get("server_instance_id")
        resume_token = msg.get("resume_token")
        if resume_token:
            self._resume_token = str(resume_token)
        offset = msg.get("highest_contiguous_acked_seq")
        if offset is not None:
            self._last_acked_seq = max(self._last_acked_seq, int(offset))
        log.info(
            "[rpc-ws] Connected client=%s conn=%s server=%s",
            self._client_id[:8],
            str(self._connection_id or "")[:8],
            str(self._server_instance_id or "")[:8],
        )
        self._ready.set()

        # --- Message loop ---
        while not self._stop_event.is_set():
            try:
                raw = ws.recv()
            except Exception:
                break
            if not raw:
                break
            try:
                envelope = json.loads(raw)
            except Exception as exc:
                log.warning("[rpc-ws] Failed to parse message: %s", exc)
                continue
            self._dispatch(ws, envelope)

    def _dispatch(self, ws: Any, msg: Dict[str, Any]) -> None:
        msg_type = msg.get("type")

        if msg_type == "response":
            self._handle_response(msg)
        elif msg_type == "server_event":
            self._handle_server_event(ws, msg)
        elif msg_type == "ack_confirmation":
            self._handle_ack_confirmation(msg)
        elif msg_type == "error":
            # Server-side error not tied to a request
            log.error("[rpc-ws] Server error: %s", msg)
        else:
            log.debug("[rpc-ws] Unknown message type: %s", msg_type)

    def _handle_response(self, msg: Dict[str, Any]) -> None:
        request_id = msg.get("request_id", "")
        with self._lock:
            pending = self._pending_requests.get(request_id)
        if not pending:
            return  # Response for an expired or unknown request
        if time.monotonic() > pending.deadline_at:
            return  # Past deadline — discard
        pending.response = RpcResponse(
            request_id=request_id,
            route=msg.get("route", ""),
            success=msg.get("success", False),
            data=msg.get("result", msg.get("data")),
            error=msg.get("error"),
        )
        pending.event.set()

    def _handle_ack_confirmation(self, msg: Dict[str, Any]) -> None:
        event_id = str(msg.get("event_id") or "")
        if event_id:
            self._pending_acks.pop(event_id, None)
            self._recent_event_ids.append(event_id)
            if len(self._recent_event_ids) > self._recent_event_limit:
                self._recent_event_ids = self._recent_event_ids[-self._recent_event_limit :]
        offset = msg.get("highest_contiguous_acked_seq")
        if offset is not None and msg.get("success"):
            self._last_acked_seq = max(self._last_acked_seq, int(offset))

    def _handle_server_event(self, ws: Any, msg: Dict[str, Any]) -> None:
        event_id: str = msg.get("event_id", "")
        seq: int = msg.get("seq", 0)
        topic: str = msg.get("topic", "")
        payload: Dict[str, Any] = msg.get("payload", {})
        requires_ack: bool = msg.get("requires_ack", False)

        # Dedup: skip already-processed events (at-least-once guarantee)
        if event_id and (event_id in self._pending_acks or event_id in self._recent_event_ids):
            if requires_ack:
                self._send_ack(ws, event_id, seq)
            return

        # Dispatch to subscribers — snapshot before iterating; isolate exceptions
        with self._sub_lock:
            subs = list(self._subscriptions.get(topic, {}).values())

        for sub in subs:
            try:
                sub.callback(topic, payload)
            except Exception as exc:
                log.error("[rpc-ws] Subscriber error on topic=%s: %s", topic, exc)

        # Track for dedup and advance contiguous offset
        if event_id:
            self._pending_acks[event_id] = {"seq": seq, "topic": topic, "acked": False}

        # ACK after processing (not on bytes received)
        if requires_ack and event_id:
            self._send_ack(ws, event_id, seq)

    def _send_ack(self, ws: Any, event_id: str, seq: int) -> None:
        ack: Dict[str, Any] = {
            "type": "ack",
            "client_id": self._client_id,
            "connection_id": self._connection_id,
            "event_id": event_id,
            "seq": seq,
        }
        try:
            self._raw_send(ws, ack)
        except Exception as exc:
            log.warning("[rpc-ws] ACK send failed: %s", exc)

    def _reject_pending_on_disconnect(self) -> None:
        """Reject all pending requests on disconnect (unknown outcome)."""
        disconnected = RpcResponse(
            request_id="",
            route="",
            success=False,
            data=None,
            error={"code": "disconnected", "message": "WebSocket disconnected"},
        )
        with self._lock:
            for pending in self._pending_requests.values():
                pending.response = disconnected
                pending.event.set()

    def _backoff_sleep(self) -> None:
        import random
        self._reconnect_attempts += 1
        delay = min(_RECONNECT_BASE * (2 ** min(self._reconnect_attempts - 1, 6)), _RECONNECT_MAX)
        jitter = delay * _RECONNECT_JITTER * random.random()
        sleep_time = delay + jitter
        log.info("[rpc-ws] Reconnect in %.1fs (attempt %d)", sleep_time, self._reconnect_attempts)
        self._stop_event.wait(timeout=sleep_time)

    def _send(self, message: Dict[str, Any]) -> None:
        ws = self._ws
        if ws is None:
            raise RuntimeError("Not connected")
        self._raw_send(ws, message)

    @staticmethod
    def _raw_send(ws: Any, message: Dict[str, Any]) -> None:
        ws.send(json.dumps(message, ensure_ascii=False))


__all__ = ["PythonRpcV2WsClient", "RpcResponse", "Subscription"]
