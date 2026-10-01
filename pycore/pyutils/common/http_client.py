# -*- coding: utf-8 -*-
"""Canonical synchronous HTTP client: the only HTTP connection owner in pycore."""

from __future__ import annotations

import contextvars
import json as json_module
import socket
import time
import urllib.parse
import uuid
from contextlib import contextmanager
from typing import Any, Callable, Dict, Iterator, List, Mapping, Optional, Tuple, Union

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_httpx
from pycore.pyutils.common.queue_center_contract import http_transfer_contract


ProgressCallback = Callable[[Dict[str, Any]], None]
TimeoutValue = Union[None, float, int, Tuple[Optional[float], Optional[float]], List[Optional[float]]]
HTTP_TRANSPORT_NAME = "httpx"
TRANSFER_PHASE_UPLOADING = "uploading"
TRANSFER_PHASE_AWAITING_RECEIPT = "awaiting_receipt"
TRANSFER_PHASE_RECEIVED = "received"
TRANSFER_PHASE_REJECTED = "rejected"
_POOL_MAX_CONNECTIONS = 64
_POOL_MAX_KEEPALIVE = 32
_LOOPBACK_MOUNTS = ("all://127.0.0.1", "all://localhost", "all://[::1]")
_HTTP_VERSIONS = {"HTTP/1.0": "HTTP/1.0", "HTTP/1.1": "HTTP/1.1", "HTTP/2": "HTTP/2", "HTTP/3": "HTTP/3"}
_transfer_observers: contextvars.ContextVar = contextvars.ContextVar("pycore_http_transfer_observers", default=())


class HttpError(OSError):
    """Transport-level HTTP failure; the message never carries a URL path or query."""

    def __init__(self, message: str, host: str = "") -> None:
        super().__init__(message)
        self.host = str(host or "")


class HttpConnectError(HttpError):
    """The peer could not be reached (refused, unresolvable, dropped)."""


class HttpTimeoutError(HttpError):
    """A connect, read, write or pool wait exceeded its timeout."""


class HttpConnectTimeout(HttpTimeoutError, HttpConnectError):
    """Connecting to the peer timed out."""


class HttpReadTimeout(HttpTimeoutError):
    """The peer accepted the connection but stopped sending."""


class HttpProtocolError(HttpError):
    """The peer violated HTTP framing or closed mid-response."""


class HttpStatusError(HttpError):
    """Raised by ``HttpResponse.raise_for_status`` for a 4xx/5xx response."""

    def __init__(self, response: "HttpResponse") -> None:
        host = urllib.parse.urlsplit(response.url).hostname or ""
        super().__init__(f"HTTP {response.status_code} host={host}", host)
        self.status_code = response.status_code
        self.response = response


def _host_of(url: str) -> str:
    return urllib.parse.urlsplit(str(url or "")).hostname or ""


def _failure_reason(error: BaseException) -> str:
    message = str(error).lower()
    if "refused" in message:
        return "connection refused"
    if "name or service not known" in message or "getaddrinfo" in message or "nodename" in message:
        return "host not resolvable"
    if "unreachable" in message or "no route" in message:
        return "host unreachable"
    if "reset" in message or "closed" in message or "disconnected" in message:
        return "connection closed"
    return ""


def _transport_error(error: Any, url: str) -> HttpError:
    """Map one httpx exception onto the canonical error hierarchy."""
    httpx = get_third_package_httpx()
    host = _host_of(url)
    reason = _failure_reason(error)
    suffix = f" host={host}" if host else ""
    detail = f": {reason}" if reason else ""
    if isinstance(error, httpx.ConnectTimeout):
        return HttpConnectTimeout(f"connect timed out{suffix}", host)
    if isinstance(error, httpx.ReadTimeout):
        return HttpReadTimeout(f"read timed out{suffix}", host)
    if isinstance(error, httpx.TimeoutException):
        return HttpTimeoutError(f"{type(error).__name__}{suffix}", host)
    if isinstance(error, (httpx.ConnectError, httpx.NetworkError, httpx.ProxyError)):
        return HttpConnectError(f"{type(error).__name__}{detail}{suffix}", host)
    if isinstance(error, (httpx.RemoteProtocolError, httpx.DecodingError, httpx.LocalProtocolError)):
        return HttpProtocolError(f"{type(error).__name__}{detail}{suffix}", host)
    return HttpError(f"{type(error).__name__}{detail}{suffix}", host)


def redacted_http_error(error: BaseException) -> str:
    """The one HTTP error shortener: canonical HTTP errors are already redacted;
    any other exception is reduced to its class name and first line, with
    embedded URLs dropped because a path or query may carry a credential."""
    if isinstance(error, HttpError):
        return str(error) or type(error).__name__
    message = str(error).splitlines()[0] if str(error) else ""
    if "://" in message:
        message = ""
    name = type(error).__name__
    return f"{name}: {message[:160]}" if message else name


class HttpTransferProgress:
    """Stall clock for one transfer: ``stalled()`` is True once no forward
    progress was observed for ``idle_seconds``."""

    def __init__(self, idle_seconds: float) -> None:
        self._idle_seconds = float(idle_seconds)
        self._offset = 0
        self._observed_at = time.monotonic()

    def advance(self, offset: int) -> None:
        if offset > self._offset:
            self._offset = int(offset)
            self._observed_at = time.monotonic()

    def restart(self, offset: int) -> None:
        self._offset = int(offset)
        self._observed_at = time.monotonic()

    def stalled(self) -> bool:
        return time.monotonic() - self._observed_at >= self._idle_seconds


class _ProgressContent:
    """Request body iterator that reports every sent chunk to the observers."""

    def __init__(
        self, source: Any, total: int, url: str, observers: Tuple[ProgressCallback, ...], chunk_bytes: int, method: str,
    ) -> None:
        self._source = source
        self._method = method
        self._observers = observers
        self._chunk_bytes = max(1, int(chunk_bytes))
        self._chunks_sent = 0
        self.record: Dict[str, Any] = {
            "transfer_id": uuid.uuid4().hex,
            "path": url,
            "transferred_bytes": 0,
            "received_bytes": 0,
            "total_bytes": int(total),
            "progress": 0.0,
            "phase": TRANSFER_PHASE_UPLOADING,
            "observed_at": time.monotonic(),
        }

    def __iter__(self) -> Iterator[bytes]:
        self.publish(TRANSFER_PHASE_UPLOADING)
        for content in self._source:
            for offset in range(0, len(content), self._chunk_bytes):
                chunk = content[offset:offset + self._chunk_bytes]
                yield chunk
                self._chunks_sent += 1
                self.record["transferred_bytes"] += len(chunk)
                self.publish(TRANSFER_PHASE_UPLOADING)
        self.publish(TRANSFER_PHASE_AWAITING_RECEIPT)

    def publish(self, phase: str, received_bytes: Optional[int] = None) -> None:
        total = self.record["total_bytes"]
        transferred = self.record["transferred_bytes"]
        if received_bytes is not None:
            self.record["received_bytes"] = int(received_bytes)
        self.record.update({
            "progress": round(transferred * 100.0 / total, 2) if total else 0.0,
            "phase": phase,
            "observed_at": time.monotonic(),
        })
        for observer in self._observers:
            observer(dict(self.record))

    def report(self) -> None:
        """One closing line per real upload (a body of at least one contract
        chunk, or more than one chunk sent); small JSON posts stay quiet."""
        record = self.record
        if record["total_bytes"] < self._chunk_bytes and self._chunks_sent <= 1:
            return
        path = urllib.parse.urlsplit(str(record["path"])).path or "/"
        ColorPrint.gray(
            f"[http upload] {self._method} {path} bytes={record['transferred_bytes']}/{record['total_bytes']} "
            f"phase={record['phase']}"
        )


class HttpResponse:
    """Response of the canonical client; buffered, or streamed when requested."""

    def __init__(
        self,
        status_code: int,
        headers: Mapping[str, str],
        content: bytes = b"",
        url: str = "",
        http_version: str = "",
        elapsed_ms: float = 0.0,
        stream: Any = None,
        progress: Optional[_ProgressContent] = None,
    ) -> None:
        self.status_code = int(status_code)
        self.headers = _CaseInsensitiveHeaders(headers)
        self.url = str(url or "")
        self.http_version = _HTTP_VERSIONS.get(str(http_version or ""), str(http_version or ""))
        self.elapsed_ms = float(elapsed_ms)
        self._content = None if stream is not None else bytes(content)
        self._stream = stream
        self._progress = progress

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300

    @property
    def content(self) -> bytes:
        return self.read()

    def read(self) -> bytes:
        """Read (and cache) the full body; closes a streamed response."""
        if self._content is None:
            self._content = b"".join(self.iter_bytes())
        return self._content

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json_module.loads(self.text)

    def raise_for_status(self) -> "HttpResponse":
        if self.status_code >= 400:
            raise HttpStatusError(self)
        return self

    def iter_bytes(self, chunk_size: Optional[int] = None) -> Iterator[bytes]:
        """Stream the body; buffered responses yield their content once."""
        if self._stream is None:
            if self._content:
                yield self._content
            return
        httpx = get_third_package_httpx()
        received = 0
        try:
            for chunk in self._stream.iter_bytes(chunk_size=chunk_size):
                received += len(chunk)
                if self._progress is not None:
                    self._progress.publish(self._progress.record["phase"], received)
                yield chunk
            if self._progress is not None:
                self._progress.publish(
                    TRANSFER_PHASE_RECEIVED if self.status_code < 400 else TRANSFER_PHASE_REJECTED,
                    received,
                )
        except httpx.HTTPError as error:
            raise _transport_error(error, self.url) from error
        finally:
            self.close()

    def iter_lines(self) -> Iterator[str]:
        """Stream the body as text lines (LF, CRLF and CR terminated)."""
        pending = ""
        for chunk in self.iter_bytes():
            pending += chunk.decode("utf-8", errors="replace")
            lines = pending.replace("\r\n", "\n").replace("\r", "\n").split("\n")
            pending = lines.pop()
            yield from lines
        if pending:
            yield pending

    def close(self) -> None:
        stream = self._stream
        if stream is not None:
            self._stream = None
            stream.close()
            if self._progress is not None:
                self._progress.report()


class _CaseInsensitiveHeaders(dict):
    """Header mapping with case-insensitive ``get``/``[]``/``in``."""

    def __init__(self, headers: Mapping[str, str]) -> None:
        super().__init__({str(key): str(value) for key, value in dict(headers or {}).items()})
        self._lower = {key.lower(): key for key in self}

    def __getitem__(self, key: str) -> str:
        return super().__getitem__(self._lower.get(str(key).lower(), key))

    def __contains__(self, key: object) -> bool:
        return str(key).lower() in self._lower

    def get(self, key: str, default: Any = None) -> Any:
        return self[key] if key in self else default


def _keepalive_socket_options() -> List[Tuple[int, int, int]]:
    """TCP keepalive (Windows and Linux): a request that waits for the server
    after its body was fully sent has no bytes moving, so peer liveness, not a
    timer, decides whether it is still valid (first probe after the idle
    seconds, then every interval, dead after the probe count; values from
    ``http_transfer``, shared with Laravel's outbound client)."""
    contract = http_transfer_contract()
    options = [(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)]
    for name, value in (
        ("TCP_KEEPIDLE", contract["keepalive_idle_seconds"]),
        ("TCP_KEEPINTVL", contract["keepalive_interval_seconds"]),
        ("TCP_KEEPCNT", contract["keepalive_probe_count"]),
    ):
        if hasattr(socket, name):
            options.append((socket.IPPROTO_TCP, getattr(socket, name), value))
    return options


class HttpConnectionPools:
    """Owner of the process-wide keep-alive pools (one per proxy policy).

    httpx pools are thread-safe, so every thread and every ``HttpClient``
    shares them; a pool opens on first use and lives for the process.
    Loopback hosts always bypass environment proxies.
    """

    def __init__(self) -> None:
        self._pools: Dict[bool, Any] = {}
        init_serialized_owner(self, "http_client.pools", "HttpConnectionPoolsThread")

    def pool(self, trust_env: bool) -> Any:
        pool = self._pools.get(bool(trust_env))
        return pool if pool is not None else self._open(bool(trust_env))

    @serialized_method
    def _open(self, trust_env: bool) -> Any:
        if trust_env not in self._pools:
            httpx = get_third_package_httpx()
            limits = httpx.Limits(
                max_connections=_POOL_MAX_CONNECTIONS,
                max_keepalive_connections=_POOL_MAX_KEEPALIVE,
            )
            socket_options = _keepalive_socket_options()
            self._pools[trust_env] = httpx.Client(
                transport=httpx.HTTPTransport(limits=limits, socket_options=socket_options),
                mounts={
                    pattern: httpx.HTTPTransport(limits=limits, socket_options=socket_options)
                    for pattern in _LOOPBACK_MOUNTS
                },
                trust_env=trust_env,
            )
        return self._pools[trust_env]


http_connection_pools = HttpConnectionPools()


class HttpClient:
    """Request defaults (base URL, timeout, headers, proxy policy) over the
    shared connection pools; instances are cheap and hold no connections."""

    def __init__(
        self,
        base_url: str = "",
        default_timeout: float = 10.0,
        default_headers: Optional[Mapping[str, str]] = None,
        trust_env: bool = True,
    ) -> None:
        self.base_url = str(base_url or "").rstrip("/")
        self.default_timeout = max(0.1, float(default_timeout))
        self.default_headers = {
            str(key): str(value)
            for key, value in dict(default_headers or {}).items()
        }
        self.trust_env = bool(trust_env)

    def get(
        self,
        url: str,
        timeout: TimeoutValue = None,
        query: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
        **options: Any,
    ) -> HttpResponse:
        return self.request("GET", url, timeout=timeout, query=query, headers=headers, **options)

    def post(
        self,
        url: str,
        json: Any = None,
        timeout: TimeoutValue = None,
        headers: Optional[Mapping[str, str]] = None,
        body: Optional[Union[bytes, str]] = None,
        **options: Any,
    ) -> HttpResponse:
        return self.request("POST", url, json=json, timeout=timeout, headers=headers, body=body, **options)

    def put(self, url: str, **options: Any) -> HttpResponse:
        return self.request("PUT", url, **options)

    def delete(self, url: str, **options: Any) -> HttpResponse:
        return self.request("DELETE", url, **options)

    def head(self, url: str, **options: Any) -> HttpResponse:
        return self.request("HEAD", url, **options)

    def request(
        self,
        method: str,
        url: str,
        json: Any = None,
        timeout: TimeoutValue = None,
        query: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
        body: Optional[Union[bytes, str]] = None,
        *,
        form: Any = None,
        files: Any = None,
        stream: bool = False,
        follow_redirects: bool = True,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> HttpResponse:
        """Send one request.

        An upload - a body of at least one contract chunk (``chunk_bytes``) or
        of unknown length - is progress-driven (``http_transfer_contract()``):
        connect is bounded, a write stall longer than the idle bound fails, the
        response wait is unbounded and TCP keepalive detects a dead peer; a
        caller ``timeout`` only replaces the connect bound. Every other request
        (bodiless, or a small control body such as a pull or a heartbeat) uses
        ``timeout``: seconds (connect and per-read idle) or ``(connect, read)``,
        so a live but hung server cannot block the caller forever. Progress of
        any body reaches ``progress_callback`` and every ``transfer_observer``.
        """
        httpx = get_third_package_httpx()
        request_url = self._resolve_url(url)
        request_headers = dict(self.default_headers)
        request_headers.update({str(key): str(value) for key, value in dict(headers or {}).items()})
        pool = http_connection_pools.pool(self.trust_env)
        has_body = any(value is not None for value in (body, form, files, json))
        contract = http_transfer_contract() if has_body else None
        request = pool.build_request(
            str(method or "GET").upper(),
            request_url,
            params=self._query_pairs(query) if query else None,
            headers=request_headers,
            content=body.encode("utf-8") if isinstance(body, str) else body,
            data=form,
            files=files,
            json=json,
        )
        length = request.headers.get("Content-Length")
        upload = contract is not None and (length is None or int(length) >= int(contract["chunk_bytes"]))
        request.extensions["timeout"] = self._timeout(timeout, contract if upload else None).as_dict()
        progress = None
        if contract is not None:
            observers = tuple(_transfer_observers.get())
            if progress_callback is not None:
                observers = (*observers, progress_callback)
            progress = _ProgressContent(
                request.stream, int(request.headers.get("Content-Length") or 0), str(request.url), observers,
                max(1, min(int(contract["chunk_bytes"]), int(contract["maximum_chunk_bytes"]))),
                str(request.method),
            )
            request.stream = httpx.Request(request.method, request.url, content=progress).stream
        started = time.monotonic()
        try:
            response = pool.send(request, stream=True, follow_redirects=follow_redirects)
        except httpx.HTTPError as error:
            if progress is not None:
                progress.report()
            raise _transport_error(error, request_url) from error
        result = HttpResponse(
            response.status_code,
            dict(response.headers),
            url=str(response.url),
            http_version=response.http_version,
            elapsed_ms=(time.monotonic() - started) * 1000.0,
            stream=response,
            progress=progress,
        )
        if not stream:
            result.read()
        return result

    @contextmanager
    def transfer_observer(self, callback: ProgressCallback) -> Iterator[None]:
        """Report every upload issued inside this context (same call stack) to ``callback``."""
        token = _transfer_observers.set((*_transfer_observers.get(), callback))
        try:
            yield
        finally:
            _transfer_observers.reset(token)

    def _timeout(self, timeout: TimeoutValue, contract: Optional[Mapping[str, Any]]) -> Any:
        httpx = get_third_package_httpx()
        if contract is not None:
            idle = float(contract["idle_timeout_seconds"])
            connect = float(contract["connect_timeout_seconds"])
            requested = timeout[0] if isinstance(timeout, (tuple, list)) else timeout
            if requested is not None:
                connect = max(0.1, float(requested))
            return httpx.Timeout(None, connect=connect, read=None, write=idle, pool=idle)
        if isinstance(timeout, (tuple, list)):
            connect, read = timeout[0], timeout[1]
            return httpx.Timeout(
                None if read is None else float(read),
                connect=None if connect is None else float(connect),
            )
        return httpx.Timeout(self.default_timeout if timeout is None else max(0.1, float(timeout)))

    def _resolve_url(self, url: str) -> str:
        raw_url = str(url or "").strip()
        if raw_url.startswith(("http://", "https://")):
            return raw_url
        if not self.base_url:
            raise ValueError("Absolute HTTP URL or base_url is required")
        return f"{self.base_url}/{raw_url.lstrip('/')}"

    @staticmethod
    def _query_pairs(query: Any) -> List[Tuple[str, Any]]:
        items = query.items() if isinstance(query, Mapping) else query
        pairs: List[Tuple[str, Any]] = []
        for key, value in items:
            entries = value if isinstance(value, (list, tuple)) else [value]
            pairs.extend((str(key), entry) for entry in entries if entry is not None)
        return pairs


http_client = HttpClient()


def normalize_http_dial_host(
    host: str,
    loopback_host: str = "127.0.0.1",
) -> str:
    """Map wildcard bind addresses to a concrete client dial address."""
    normalized_host = str(host or "").strip()
    if normalized_host in {"", "0.0.0.0", "::"}:
        return loopback_host
    return normalized_host


def build_http_base_url(host: str, port: int, scheme: str = "http") -> str:
    """Build a client URL from a server bind host and port."""
    dial_host = normalize_http_dial_host(host)
    return f"{str(scheme or 'http').lower()}://{dial_host}:{int(port)}"


def http_endpoint_ok(
    host: str,
    port: int,
    path: str = "/",
    timeout: float = 2.0,
) -> bool:
    """Return whether an HTTP endpoint responds with a 200 status line."""
    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client_socket.settimeout(timeout)
    connection_error = client_socket.connect_ex((host, port))
    if connection_error != 0:
        client_socket.close()
        return False
    request = f"GET {path or '/'} HTTP/1.0\r\nHost: {host}\r\n\r\n".encode("ascii")
    client_socket.sendall(request)
    response = client_socket.recv(1024)
    client_socket.close()
    if not response:
        return False
    status_line = response.split(b"\r\n", 1)[0]
    return b"200" in status_line


__all__ = [
    "HTTP_TRANSPORT_NAME",
    "HttpClient",
    "HttpConnectionPools",
    "HttpConnectError",
    "HttpConnectTimeout",
    "HttpError",
    "HttpProtocolError",
    "HttpReadTimeout",
    "HttpResponse",
    "HttpStatusError",
    "HttpTimeoutError",
    "HttpTransferProgress",
    "TRANSFER_PHASE_AWAITING_RECEIPT",
    "TRANSFER_PHASE_RECEIVED",
    "TRANSFER_PHASE_REJECTED",
    "TRANSFER_PHASE_UPLOADING",
    "build_http_base_url",
    "http_client",
    "http_connection_pools",
    "http_endpoint_ok",
    "normalize_http_dial_host",
    "redacted_http_error",
]
