# -*- coding: utf-8 -*-
from typing import Dict
from urllib.parse import urlsplit

PYCORE_CLIENT_HEADER = "X-Core-Node-Client"
PYCORE_CLIENT_ID = "pycore"
CORE_NODE_PROTOCOL_HEADER = "X-Core-Node-Protocol"
CORE_NODE_PROTOCOL_VERSION = "1"
CORE_NODE_SERVICE_ORIGIN_HEADER = "X-Core-Node-Service-Origin"
LARAVEL_SERVICE_HEADER = "X-Core-Node-Service"
LARAVEL_SERVICE_ID = "laravel_main"
LARAVEL_HEALTH_SERVICE = "Laravel API"


def _service_origin(service_url: str) -> str:
    parsed = urlsplit(str(service_url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return ""
    host = f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
    port = f":{parsed.port}" if parsed.port is not None else ""
    return f"{parsed.scheme}://{host}{port}"


def build_pycore_identity_headers(service_url: str = "") -> Dict[str, str]:
    headers = {
        PYCORE_CLIENT_HEADER: PYCORE_CLIENT_ID,
        CORE_NODE_PROTOCOL_HEADER: CORE_NODE_PROTOCOL_VERSION,
    }
    origin = _service_origin(service_url)
    if origin:
        headers[CORE_NODE_SERVICE_ORIGIN_HEADER] = origin
    return headers
