# -*- coding: utf-8 -*-
"""Shared transport selection for Pycore-to-Laravel HTTP traffic."""

from typing import Any, Dict, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_curl_cffi_requests,
    get_third_package_requests,
)

HTTP3_VERSION = "v3"
TRANSPORT_CURL_CFFI = "curl_cffi"
TRANSPORT_REQUESTS = "requests"


def create_laravel_http_session(url: str, stream: bool = False) -> Tuple[Any, Dict[str, Any], str]:
    """Create an isolated session and request options for one Laravel call.

    HTTPS transactional calls prefer HTTP/3 with protocol fallback handled by
    libcurl. Streaming SSE keeps requests' stable iter_lines lifecycle.
    """
    if url.startswith("https://") and not stream:
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
        return str(name or value)
    raw = getattr(response, "raw", None)
    version = getattr(raw, "version", None)
    return {10: "HTTP/1.0", 11: "HTTP/1.1", 20: "HTTP/2"}.get(version, "")
