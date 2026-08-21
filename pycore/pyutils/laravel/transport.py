# -*- coding: utf-8 -*-
"""Shared transport and payload adaptation for Pycore-to-Laravel HTTP traffic."""

import os
from typing import Any, Dict, Iterable, Mapping, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_curl_cffi_mime,
    get_third_package_curl_cffi_requests,
    get_third_package_requests,
)

HTTP3_VERSION = "v3"
TRANSPORT_CURL_CFFI = "curl_cffi"
TRANSPORT_REQUESTS = "requests"


def _field_items(value: Any) -> Iterable[Tuple[Any, Any]]:
    if isinstance(value, Mapping):
        return value.items()
    if isinstance(value, (list, tuple)):
        return value
    return ()


def _field_bytes(value: Any) -> bytes:
    if isinstance(value, bytes):
        return value
    if value is None:
        return b""
    return str(value).encode("utf-8")


def create_curl_multipart(data: Any, files: Any) -> Any:
    """Translate requests-style form fields and files into one CurlMime body."""
    curl_mime = get_third_package_curl_cffi_mime()
    multipart = curl_mime()
    try:
        for name, value in _field_items(data):
            multipart.addpart(str(name), data=_field_bytes(value))
        for name, definition in _field_items(files):
            filename = str(name)
            content = definition
            content_type: Optional[str] = None
            if isinstance(definition, (list, tuple)):
                if definition:
                    filename = str(definition[0])
                if len(definition) > 1:
                    content = definition[1]
                if len(definition) > 2 and definition[2]:
                    content_type = str(definition[2])
            local_path = getattr(content, "name", None)
            if isinstance(local_path, (str, bytes, os.PathLike)) and os.path.isfile(local_path):
                multipart.addpart(
                    str(name),
                    content_type=content_type,
                    filename=filename,
                    local_path=local_path,
                )
                continue
            payload = content.read() if hasattr(content, "read") else content
            multipart.addpart(
                str(name),
                content_type=content_type,
                filename=filename,
                data=_field_bytes(payload),
            )
    except Exception:
        multipart.close()
        raise
    return multipart


def create_laravel_http_session(url: str, stream: bool = False) -> Tuple[Any, Dict[str, Any], str]:
    """Create an isolated session and request options for one Laravel call.

    HTTPS calls, including streaming SSE, prefer HTTP/3 with protocol fallback
    handled by libcurl.
    """
    if url.startswith("https://"):
        try:
            curl_requests = get_third_package_curl_cffi_requests()
            return curl_requests.Session(), {"http_version": HTTP3_VERSION}, TRANSPORT_CURL_CFFI
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[laravel] HTTP/3 transport unavailable: {str(exc)[:160]}")
    requests = get_third_package_requests()
    return requests.Session(), {}, TRANSPORT_REQUESTS


def response_http_version(response: Any) -> str:
    """Normalize a transport-specific response protocol value for diagnostics."""
    value = getattr(response, "http_version", None)
    if value is not None:
        name = getattr(value, "name", None)
        normalized = str(name or value)
        return {
            "10": "HTTP/1.0",
            "11": "HTTP/1.1",
            "20": "HTTP/2",
            "30": "HTTP/3",
            "V1_0": "HTTP/1.0",
            "V1_1": "HTTP/1.1",
            "V2_0": "HTTP/2",
            "V3": "HTTP/3",
        }.get(normalized, normalized)
    raw = getattr(response, "raw", None)
    version = getattr(raw, "version", None)
    return {10: "HTTP/1.0", 11: "HTTP/1.1", 20: "HTTP/2"}.get(version, "")
