# -*- coding: utf-8 -*-
"""Shared Mercure SSE subscriber for every pycore realtime lane.

Speaks the protocol implemented by the Mercure hub embedded in the pinned
FrankenPHP runtime:

- Subscription = ``GET <hub>?topic=<selector>`` with one ``topic`` query
  parameter per topic (repeated), ``Accept: text/event-stream``.
- Authorization = a topic-scoped Mercure JWT in the ``Authorization: Bearer``
  header for non-browser clients; the hub closes streams at token ``exp``,
  so the token provider is re-asked on
  every (re)connection and forced on 401/403.
- Reconciliation = ``Last-Event-ID`` request header on reconnects; the
  initial cursor rides the ``last_event_id`` query parameter.

Parsing follows the SSE spec: ``event``/``data``/``id``/``retry`` fields,
``:`` comment lines (hub heartbeat), CRLF/LF/CR line endings, dispatch on
blank lines, multi-line data joined with ``\\n``.

Stdlib only, same ``http.client`` stack as ``http_client.py``; lifecycle is
injected (``should_stop`` / ``sleep``) so any thread model can drive it.
"""

from __future__ import annotations

import http.client
import json as json_module
import socket
import ssl
import time
import urllib.parse
from typing import Any, Callable, Dict, List, Optional, Tuple


MERCURE_DEFAULT_EVENT_TYPE = "message"
MERCURE_STATE_CONNECTING = "connecting"
MERCURE_STATE_ONLINE = "online"
MERCURE_STATE_OFFLINE = "offline"

TokenProvider = Callable[[bool], str]
UpdateCallback = Callable[["MercureUpdate"], None]
StateCallback = Callable[[str, str], None]
StopCheck = Callable[[], bool]
Sleeper = Callable[[float], None]


class MercureUpdate:
    """One dispatched SSE update (id, event type, raw data)."""

    __slots__ = ("id", "type", "data")

    def __init__(self, update_id: str, update_type: str, data: str) -> None:
        self.id = str(update_id)
        self.type = str(update_type)
        self.data = str(data)

    def json(self) -> Any:
        return json_module.loads(self.data)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"MercureUpdate(id={self.id!r}, type={self.type!r})"


def mercure_subscribe_url(
    hub_url: str,
    topics: List[str],
    last_event_id: str = "",
) -> str:
    """Build the subscription URL with repeated ``topic`` parameters.

    ``last_event_id`` is only honored for the INITIAL cursor (spec query
    parameter); reconnects use the ``Last-Event-ID`` header instead.
    """
    query: List[Tuple[str, str]] = [("topic", str(topic)) for topic in topics if topic]
    if last_event_id:
        query.append(("lastEventID", str(last_event_id)))
    separator = "&" if "?" in hub_url else "?"
    return hub_url + separator + urllib.parse.urlencode(query)


class MercureSubscriber:
    """Drive one Mercure subscription with reconnect, resume and refresh.

    ``token_provider(force_refresh)`` returns the current Bearer token
    (``""`` for anonymous hubs); it is called once per connection attempt
    and forced after a 401/403 so short-lived tokens refresh transparently.
    """

    def __init__(
        self,
        hub_url: str,
        topics: List[str],
        token_provider: Optional[TokenProvider] = None,
        on_update: Optional[UpdateCallback] = None,
        on_state_change: Optional[StateCallback] = None,
        reconnect_min_seconds: float = 1.0,
        reconnect_max_seconds: float = 30.0,
        connect_timeout: float = 10.0,
        read_timeout: float = 90.0,
        max_redirects: int = 3,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self.hub_url = str(hub_url or "").rstrip("/")
        self.topics = [str(topic) for topic in topics if topic]
        if not self.hub_url or not self.topics:
            raise ValueError("MercureSubscriber requires a hub URL and at least one topic")
        self.token_provider = token_provider
        self.on_update = on_update
        self.on_state_change = on_state_change
        self.reconnect_min_seconds = max(0.1, float(reconnect_min_seconds))
        self.reconnect_max_seconds = max(self.reconnect_min_seconds, float(reconnect_max_seconds))
        self.connect_timeout = max(0.1, float(connect_timeout))
        # Must exceed the hub heartbeat interval (default 40s) so healthy
        # streams always yield heartbeat comment lines before this fires.
        self.read_timeout = max(1.0, float(read_timeout))
        self.max_redirects = max(0, int(max_redirects))
        self.extra_headers = dict(extra_headers or {})
        self.last_event_id = ""
        self._retry_delay_override = 0.0

    # ------------------------------------------------------------------ loop

    def run(self, should_stop: StopCheck, sleep: Sleeper = time.sleep) -> None:
        """Blocking subscription loop until ``should_stop()`` turns true."""
        reconnect_seconds = self.reconnect_min_seconds
        initial_cursor = self.last_event_id
        while not should_stop():
            connection = None
            reason = "closed"
            try:
                self._notify(MERCURE_STATE_CONNECTING, self.hub_url)
                connection, url, headers = self._open_stream(initial_cursor)
                initial_cursor = ""
                self._notify(MERCURE_STATE_ONLINE, url)
                reconnect_seconds = self.reconnect_min_seconds
                reason = self._consume_stream(connection, should_stop)
            except _MercureAuthError as exc:
                reason = "unauthorized"
                self._notify(MERCURE_STATE_OFFLINE, f"hub rejected the token: {exc}")
                reconnect_seconds = self.reconnect_min_seconds
            except (http.client.HTTPException, OSError, ssl.SSLError) as exc:
                reason = "error"
                self._notify(MERCURE_STATE_OFFLINE, str(exc) or exc.__class__.__name__)
            finally:
                self._close(connection)
            if reason == "stop":
                return
            if reason == "closed":
                # Clean server close (token expiry window) - resume at once.
                reconnect_seconds = self.reconnect_min_seconds
            delay = self._retry_delay_override or reconnect_seconds
            self._retry_delay_override = 0.0
            reconnect_seconds = min(self.reconnect_max_seconds, reconnect_seconds * 2)
            deadline = time.monotonic() + delay
            while not should_stop() and time.monotonic() < deadline:
                sleep(min(0.5, deadline - time.monotonic()))

    # --------------------------------------------------------------- connect

    def _open_stream(
        self,
        initial_cursor: str,
    ) -> Tuple[http.client.HTTPConnection, str, Dict[str, str]]:
        token = self._token(force=False)
        redirects_left = self.max_redirects
        url = mercure_subscribe_url(self.hub_url, self.topics, initial_cursor)
        while True:
            parsed = urllib.parse.urlsplit(url)
            connection = self._new_connection(parsed)
            request_headers = self._request_headers(token, resume=not initial_cursor)
            try:
                connection.request("GET", self._request_target(parsed), headers=request_headers)
                response = connection.getresponse()
            except (http.client.HTTPException, OSError):
                self._close(connection)
                raise
            status = response.status
            if status in (301, 302, 303, 307, 308):
                location = response.getheader("Location") or ""
                self._close(connection)
                if not location or redirects_left <= 0:
                    raise http.client.HTTPException(f"hub redirect failed at {url}")
                redirects_left -= 1
                url = urllib.parse.urljoin(url, location)
                continue
            if status in (401, 403):
                body = self._short_body(response)
                self._close(connection)
                self._token(force=True)
                raise _MercureAuthError(f"HTTP {status} {body[:120]}")
            if status != 200:
                body = self._short_body(response)
                self._close(connection)
                raise http.client.HTTPException(f"hub returned HTTP {status} {body[:120]}")
            # Keep the response object referenced by the connection wrapper:
            # stream lines straight from it until the server closes.
            connection.mercure_response = response  # type: ignore[attr-defined]
            return connection, url, request_headers

    def _new_connection(self, parsed: urllib.parse.SplitResult) -> http.client.HTTPConnection:
        host = parsed.hostname or ""
        if not host:
            raise http.client.HTTPException("hub URL has no host")
        port = parsed.port
        if parsed.scheme == "https":
            return http.client.HTTPSConnection(
                host,
                port=port or 443,
                timeout=self.connect_timeout,
                context=ssl.create_default_context(),
            )
        return http.client.HTTPConnection(host, port=port or 80, timeout=self.connect_timeout)

    @staticmethod
    def _request_target(parsed: urllib.parse.SplitResult) -> str:
        path = parsed.path or "/"
        if parsed.query:
            return f"{path}?{parsed.query}"
        return path

    def _request_headers(self, token: str, resume: bool) -> Dict[str, str]:
        headers = {
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if resume and self.last_event_id:
            headers["Last-Event-ID"] = self.last_event_id
        headers.update(self.extra_headers)
        return headers

    def _token(self, force: bool) -> str:
        if self.token_provider is None:
            return ""
        return str(self.token_provider(force) or "")

    # ---------------------------------------------------------------- stream

    def _consume_stream(self, connection: http.client.HTTPConnection, should_stop: StopCheck) -> str:
        response = getattr(connection, "mercure_response", None)
        if response is None:
            return "closed"
        if connection.sock is not None:
            connection.sock.settimeout(self.read_timeout)
        event_type = MERCURE_DEFAULT_EVENT_TYPE
        data_lines: List[str] = []
        dispatchable = False
        try:
            while not should_stop():
                try:
                    raw_line = response.readline()
                except socket.timeout:
                    return "closed"
                if not raw_line:
                    return "closed"
                line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
                if line == "":
                    if dispatchable:
                        self._dispatch(event_type, data_lines)
                    event_type = MERCURE_DEFAULT_EVENT_TYPE
                    data_lines = []
                    dispatchable = False
                    continue
                if line.startswith(":"):
                    continue
                field, _, value = line.partition(":")
                if value.startswith(" "):
                    value = value[1:]
                if field == "data":
                    data_lines.append(value)
                    dispatchable = True
                elif field == "event":
                    event_type = value or MERCURE_DEFAULT_EVENT_TYPE
                elif field == "id":
                    if "\x00" not in value:
                        self.last_event_id = value
                elif field == "retry":
                    self._apply_retry(value)
            return "stop"
        finally:
            pass

    def _dispatch(self, event_type: str, data_lines: List[str]) -> None:
        if self.on_update is None:
            return
        update = MercureUpdate(self.last_event_id, event_type, "\n".join(data_lines))
        try:
            self.on_update(update)
        except Exception:  # noqa: BLE001 - one bad handler never kills the stream
            pass

    def _apply_retry(self, value: str) -> None:
        try:
            seconds = int(value) / 1000.0
        except ValueError:
            return
        if seconds <= 0:
            return
        self._retry_delay_override = min(
            max(seconds, self.reconnect_min_seconds),
            self.reconnect_max_seconds,
        )

    # ---------------------------------------------------------------- helpers

    def _notify(self, state: str, detail: str) -> None:
        if self.on_state_change is None:
            return
        try:
            self.on_state_change(state, detail)
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _short_body(response: http.client.HTTPResponse) -> str:
        try:
            return (response.read(2048) or b"").decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            return ""

    @staticmethod
    def _close(connection: Optional[http.client.HTTPConnection]) -> None:
        if connection is None:
            return
        try:
            connection.close()
        except Exception:  # noqa: BLE001
            pass


class _MercureAuthError(Exception):
    """Hub rejected the presented token (401/403) - refresh and retry."""


__all__ = [
    "MercureUpdate",
    "MercureSubscriber",
    "mercure_subscribe_url",
    "MERCURE_DEFAULT_EVENT_TYPE",
    "MERCURE_STATE_CONNECTING",
    "MERCURE_STATE_ONLINE",
    "MERCURE_STATE_OFFLINE",
]
