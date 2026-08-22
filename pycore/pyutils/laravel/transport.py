# -*- coding: utf-8 -*-
"""Shared Python transport for Pycore-to-Laravel HTTP traffic."""

from typing import Any, Dict, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_requests

TRANSPORT_REQUESTS = "requests"


def create_laravel_http_session() -> Tuple[Any, Dict[str, Any], str]:
    """Create one isolated Requests session for every Laravel call."""
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
