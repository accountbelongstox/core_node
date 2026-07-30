# -*- coding: utf-8 -*-
"""Shared synchronous HTTP client for all pyutils domains."""

from __future__ import annotations

import http.client
import json as json_module
import socket
import threading
import urllib.parse
from typing import Any, Dict, Mapping, Optional, Tuple


ConnectionKey = Tuple[int, str, str, int]
_RETRYABLE_HTTP_ERRORS = (http.client.HTTPException, OSError)


class HttpResponse:
    """Small immutable-by-convention HTTP response shared by pycore clients."""

    def __init__(
        self,
        status_code: int,
        headers: Mapping[str, str],
        content: bytes,
    ) -> None:
        self.status_code = int(status_code)
        self.headers = {str(key): str(value) for key, value in headers.items()}
        self.content = bytes(content)

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json_module.loads(self.text)


class HttpClient:
    """Send synchronous requests over persistent HTTP connections."""

    def __init__(
        self,
        base_url: str = "",
        default_timeout: float = 10.0,
        default_headers: Optional[Mapping[str, str]] = None,
    ) -> None:
        self.base_url = str(base_url or "").rstrip("/")
        self.default_timeout = max(0.1, float(default_timeout))
        self.default_headers = {
            str(key): str(value)
            for key, value in dict(default_headers or {}).items()
        }
        self._connections: Dict[ConnectionKey, http.client.HTTPConnection] = {}

    def get(
        self,
        url: str,
        timeout: Optional[float] = None,
        query: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> HttpResponse:
        return self.request(
            "GET",
            url,
            timeout=timeout,
            query=query,
            headers=headers,
        )

    def post(
        self,
        url: str,
        json: Any = None,
        timeout: Optional[float] = None,
        headers: Optional[Mapping[str, str]] = None,
        body: Optional[bytes] = None,
    ) -> HttpResponse:
        return self.request(
            "POST",
            url,
            json=json,
            timeout=timeout,
            headers=headers,
            body=body,
        )

    def request(
        self,
        method: str,
        url: str,
        json: Any = None,
        timeout: Optional[float] = None,
        query: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
        body: Optional[bytes] = None,
    ) -> HttpResponse:
        request_url = self._resolve_url(url)
        parsed_url = urllib.parse.urlsplit(request_url)
        request_headers = dict(self.default_headers)
        request_headers.update(
            {str(key): str(value) for key, value in dict(headers or {}).items()}
        )
        request_body = body
        if json is not None:
            request_body = json_module.dumps(json, ensure_ascii=False).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/json")
        request_path = self._request_path(parsed_url, query)
        request_timeout = (
            self.default_timeout if timeout is None else max(0.1, float(timeout))
        )
        connection_key = self._connection_key(parsed_url)
        connection = self._connections.get(connection_key)
        if connection is None:
            connection = self._create_connection(parsed_url, request_timeout)
            self._connections[connection_key] = connection
        else:
            self._set_connection_timeout(connection, request_timeout)
        try:
            return self._send_request(
                connection,
                method,
                request_path,
                request_body,
                request_headers,
            )
        except _RETRYABLE_HTTP_ERRORS:
            self._discard_connection(connection_key, connection)
            raise

    def close(self) -> None:
        connections = tuple(self._connections.values())
        self._connections.clear()
        for connection in connections:
            connection.close()

    @staticmethod
    def _connection_key(parsed_url: urllib.parse.SplitResult) -> ConnectionKey:
        scheme = str(parsed_url.scheme or "http").lower()
        host = str(parsed_url.hostname or "")
        port = int(parsed_url.port or (443 if scheme == "https" else 80))
        return threading.get_ident(), scheme, host, port

    @staticmethod
    def _create_connection(
        parsed_url: urllib.parse.SplitResult,
        timeout: float,
    ) -> http.client.HTTPConnection:
        connection_class = (
            http.client.HTTPSConnection
            if parsed_url.scheme == "https"
            else http.client.HTTPConnection
        )
        return connection_class(
            parsed_url.hostname,
            parsed_url.port,
            timeout=timeout,
        )

    @staticmethod
    def _set_connection_timeout(
        connection: http.client.HTTPConnection,
        timeout: float,
    ) -> None:
        connection.timeout = timeout
        if connection.sock is not None:
            connection.sock.settimeout(timeout)

    @staticmethod
    def _send_request(
        connection: http.client.HTTPConnection,
        method: str,
        request_path: str,
        request_body: Optional[bytes],
        request_headers: Mapping[str, str],
    ) -> HttpResponse:
        connection.request(
            str(method or "GET").upper(),
            request_path,
            body=request_body,
            headers=dict(request_headers),
        )
        response = connection.getresponse()
        response_body = response.read()
        response_headers = dict(response.getheaders())
        return HttpResponse(response.status, response_headers, response_body)

    def _discard_connection(
        self,
        connection_key: ConnectionKey,
        connection: http.client.HTTPConnection,
    ) -> None:
        cached_connection = self._connections.get(connection_key)
        if cached_connection is connection:
            self._connections.pop(connection_key, None)
        connection.close()

    def _resolve_url(self, url: str) -> str:
        raw_url = str(url or "").strip()
        if raw_url.startswith(("http://", "https://")):
            return raw_url
        if not self.base_url:
            raise ValueError("Absolute HTTP URL or base_url is required")
        return f"{self.base_url}/{raw_url.lstrip('/')}"

    @staticmethod
    def _request_path(
        parsed_url: urllib.parse.SplitResult,
        query: Optional[Mapping[str, Any]],
    ) -> str:
        query_pairs = urllib.parse.parse_qsl(
            parsed_url.query,
            keep_blank_values=True,
        )
        if query:
            for key, value in query.items():
                if isinstance(value, (list, tuple)):
                    query_pairs.extend((str(key), item) for item in value)
                else:
                    query_pairs.append((str(key), value))
        query_string = urllib.parse.urlencode(query_pairs, doseq=True)
        path = parsed_url.path or "/"
        if query_string:
            path = f"{path}?{query_string}"
        return path


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
    "HttpClient",
    "HttpResponse",
    "build_http_base_url",
    "http_endpoint_ok",
    "normalize_http_dial_host",
]
