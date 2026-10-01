# -*- coding: utf-8 -*-
"""Signed HTTP calls between Code Sync peers."""

import json
from typing import Any, Dict, Optional

from pycore.pyfoundations.network_constants import HTTP_JSON_CONTENT_TYPE, PYCORE_HTTP_PORT
from pycore.pyutils.common.client_key_auth import client_key_headers
from pycore.pyutils.common.http_client import HttpClient, HttpResponse, build_http_base_url

peer_http = HttpClient()


def peer_url(host: str, port: int, path: str) -> str:
    return build_http_base_url(str(host), int(port or PYCORE_HTTP_PORT)).rstrip("/") + path


def signed_peer_request(
    method: str,
    url: str,
    payload: Any = None,
    timeout: Optional[float] = None,
) -> HttpResponse:
    """One peer call: the JSON body is encoded once and those exact bytes are
    signed (K3), so the peer's K7 gate admits the request."""
    body = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if payload is not None
        else None
    )
    headers: Dict[str, str] = {"Content-Type": HTTP_JSON_CONTENT_TYPE} if body is not None else {}
    headers.update(client_key_headers(method, url, body or b"", headers.get("Content-Type", "")))
    return peer_http.request(method, url, timeout=timeout, headers=headers, body=body)


__all__ = ["peer_http", "peer_url", "signed_peer_request"]
