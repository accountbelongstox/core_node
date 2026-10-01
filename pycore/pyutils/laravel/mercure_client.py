# -*- coding: utf-8 -*-
"""Shared Mercure SSE subscriber for every pycore realtime stream.

Subscription is ``GET <hub>?topic=<selector>`` with one repeated ``topic``
parameter per topic, ``Authorization: Bearer <subscriber JWT>`` and a
``Last-Event-ID`` header on reconnects; the initial cursor rides the
``lastEventID`` query parameter. Requests go through ``laravel_client`` and
events are decoded by ``SseEventDecoder``. Lifecycle is injected
(``should_stop`` / ``sleep``) so any thread model can drive it.
"""

from __future__ import annotations

import json as json_module
import time
import urllib.parse
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.http_sse import SseEventDecoder, is_sse_content_type
from pycore.pyutils.common.activity_log import ActivityLog
from pycore.pyutils.common.http_client import HttpError
from pycore.pyutils.laravel.client import laravel_client


MERCURE_DEFAULT_EVENT_TYPE = "message"
MERCURE_STATE_CONNECTING = "connecting"
MERCURE_STATE_ONLINE = "online"
MERCURE_STATE_OFFLINE = "offline"
MERCURE_UNAUTHORIZED_STATUSES = (401, 403)
MERCURE_STOP_POLL_SECONDS = 0.5
MERCURE_ERROR_BODY_CHARS = 120
mercure_activity_log = ActivityLog("Mercure")

UpdateCallback = Callable[["MercureUpdate"], None]
StateCallback = Callable[[str, str], None]
StopCheck = Callable[[], bool]
Sleeper = Callable[[float], None]
TokenProvider = Callable[[bool], Union[str, Dict[str, Any]]]


class MercureUpdate:
    """One dispatched SSE update (id, event type, raw data)."""

    __slots__ = ("id", "type", "data")

    def __init__(self, update_id: str, update_type: str, data: str) -> None:
        self.id = str(update_id)
        self.type = str(update_type)
        self.data = str(data)

    def json(self) -> Any:
        return json_module.loads(self.data)


def mercure_subscribe_url(hub_url: str, topics: List[str], last_event_id: str = "") -> str:
    """Build the subscription URL with repeated ``topic`` parameters."""
    query: List[Tuple[str, str]] = [("topic", str(topic)) for topic in topics if topic]
    if last_event_id:
        query.append(("lastEventID", str(last_event_id)))
    separator = "&" if "?" in hub_url else "?"
    return hub_url + separator + urllib.parse.urlencode(query)


class MercureSubscriber:
    """Drive one authorized Mercure subscription with reconnect and resume."""

    def __init__(
        self,
        hub_url: str,
        topics: List[str],
        token_provider: TokenProvider,
        on_update: Optional[UpdateCallback] = None,
        on_state_change: Optional[StateCallback] = None,
        reconnect_min_seconds: float = 1.0,
        reconnect_max_seconds: float = 30.0,
        connect_timeout: float = 10.0,
        read_timeout: float = 90.0,
        max_event_bytes: int = 65536,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self.hub_url = str(hub_url or "").rstrip("/")
        self.topics = [str(topic) for topic in topics if topic]
        if not self.hub_url or not self.topics:
            raise ValueError("MercureSubscriber requires a hub URL and at least one topic")
        self.token_provider = token_provider
        self.on_update = on_update
        self.on_state_change = on_state_change
        self.backoff = Backoff(max(0.1, float(reconnect_min_seconds)), float(reconnect_max_seconds))
        self.connect_timeout = max(0.1, float(connect_timeout))
        # Must exceed the hub heartbeat interval so a healthy stream always
        # yields heartbeat comment lines before this fires.
        self.read_timeout = max(1.0, float(read_timeout))
        self.max_event_bytes = max(1, int(max_event_bytes))
        self.extra_headers = {
            key: value
            for key, value in dict(extra_headers or {}).items()
            if key.lower() != "authorization"
        }
        self.last_event_id = ""
        self._retry_delay_override = 0.0
        self._response: Any = None
        self._token_refresh_at = 0.0
        self._force_token_refresh = False

    def close(self) -> None:
        response = self._response
        if response is not None:
            response.close()

    def run(self, should_stop: StopCheck, sleep: Sleeper = time.sleep) -> None:
        """Blocking subscription loop until ``should_stop()`` turns true."""
        initial_cursor = self.last_event_id
        while not should_stop():
            reason = "closed"
            detail = ""
            connected_at = 0.0
            self._notify(MERCURE_STATE_CONNECTING, self.hub_url)
            try:
                response = self._open_stream(initial_cursor)
                self._response = response
                connected_at = time.monotonic()
                initial_cursor = ""
                self._notify(
                    MERCURE_STATE_ONLINE,
                    f"{self.hub_url} protocol={response.http_version}",
                )
                reason = self._consume_stream(response, should_stop)
            except _MercureAuthError as error:
                reason = "unauthorized"
                detail = f"hub rejected the token: {error}"
                mercure_activity_log.warning(
                    "subscription.authorization.rejected",
                    hub_url=self.hub_url,
                    error=error,
                )
            except (HttpError, RuntimeError, ValueError) as error:
                reason = "error"
                detail = str(error) or error.__class__.__name__
                mercure_activity_log.error(
                    "subscription.connection.failed",
                    hub_url=self.hub_url,
                    error_type=type(error).__name__,
                    error=error,
                )
            self.close()
            self._response = None
            self._notify(MERCURE_STATE_OFFLINE, detail or reason)
            if reason == "stop":
                return
            if reason == "renew":
                self._force_token_refresh = True
                continue
            if connected_at and time.monotonic() - connected_at >= self.read_timeout:
                self.backoff.reset()
            delay = self._retry_delay_override or self.backoff.next_delay()
            self._retry_delay_override = 0.0
            deadline = time.monotonic() + delay
            while not should_stop() and time.monotonic() < deadline:
                sleep(min(MERCURE_STOP_POLL_SECONDS, deadline - time.monotonic()))

    def _open_stream(self, initial_cursor: str) -> Any:
        token = self._token(force=self._force_token_refresh)
        self._force_token_refresh = False
        headers = {"Accept": "text/event-stream", "Cache-Control": "no-cache"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if not initial_cursor and self.last_event_id:
            headers["Last-Event-ID"] = self.last_event_id
        headers.update(self.extra_headers)
        response = laravel_client.request(
            "GET",
            mercure_subscribe_url(self.hub_url, self.topics, initial_cursor),
            headers=headers,
            timeout=(self.connect_timeout, self.read_timeout),
            stream=True,
            allow_redirects=False,
            log_line=False,
        )
        status = int(response.status_code)
        if status in MERCURE_UNAUTHORIZED_STATUSES:
            body = response.text[:MERCURE_ERROR_BODY_CHARS]
            self._force_token_refresh = True
            raise _MercureAuthError(f"HTTP {status} {body}")
        if status != 200:
            body = response.text[:MERCURE_ERROR_BODY_CHARS]
            raise RuntimeError(f"hub returned HTTP {status} {body}")
        if not is_sse_content_type(response.headers.get("Content-Type")):
            response.close()
            raise RuntimeError("mercure_content_type_invalid")
        return response

    def _token(self, force: bool) -> str:
        authorization = self.token_provider(force)
        self._token_refresh_at = 0.0
        if isinstance(authorization, dict):
            lifetime = max(0.0, float(authorization.get("token_ttl_seconds") or 0))
            if lifetime:
                margin = min(self.read_timeout, lifetime / 2)
                self._token_refresh_at = time.monotonic() + lifetime - margin
            return str(authorization.get("token") or "")
        return str(authorization or "")

    def _consume_stream(self, response: Any, should_stop: StopCheck) -> str:
        decoder = SseEventDecoder()
        data_bytes = 0
        try:
            for line in response.iter_lines():
                if should_stop():
                    return "stop"
                if self._token_refresh_at and time.monotonic() >= self._token_refresh_at:
                    return "renew"
                if line.startswith("data:"):
                    data_bytes += len(line.encode("utf-8")) - len("data:")
                    if data_bytes > self.max_event_bytes:
                        raise RuntimeError("mercure_event_payload_limit_exceeded")
                if line.startswith("retry:"):
                    self._apply_retry(line[len("retry:"):].strip())
                event = decoder.feed_line(line)
                if line == "":
                    data_bytes = 0
                if event is None:
                    continue
                event_type, data, event_id = event
                if event_id and "\x00" not in event_id:
                    self.last_event_id = event_id
                self._dispatch(event_type or MERCURE_DEFAULT_EVENT_TYPE, data)
            return "closed"
        except (HttpError, RuntimeError) as error:
            if should_stop():
                return "stop"
            mercure_activity_log.warning(
                "subscription.stream.interrupted",
                hub_url=self.hub_url,
                last_event_id=self.last_event_id,
                error_type=type(error).__name__,
                error=error,
            )
            return "error"

    def _dispatch(self, event_type: str, data: str) -> None:
        if self.on_update is None:
            return
        self.on_update(MercureUpdate(self.last_event_id, event_type, data))

    def _apply_retry(self, value: str) -> None:
        if not value.isdigit() or int(value) <= 0:
            return
        self._retry_delay_override = min(
            max(int(value) / 1000.0, self.backoff.initial_seconds),
            self.backoff.maximum_seconds,
        )

    def _notify(self, state: str, detail: str) -> None:
        if self.on_state_change is not None:
            self.on_state_change(state, detail)


class _MercureAuthError(Exception):
    """The hub rejected the subscriber token and requested a refresh."""


__all__ = [
    "MERCURE_DEFAULT_EVENT_TYPE",
    "MERCURE_STATE_CONNECTING",
    "MERCURE_STATE_OFFLINE",
    "MERCURE_STATE_ONLINE",
    "MercureSubscriber",
    "MercureUpdate",
    "TokenProvider",
    "mercure_subscribe_url",
]
