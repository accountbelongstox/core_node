# -*- coding: utf-8 -*-
import base64
import hashlib
import hmac
import os
import secrets
import threading
import time
from typing import Any, Dict
from urllib.parse import urlsplit

from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.machine_id import get_machine_id
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR

PYCORE_CLIENT_HEADER = "X-Core-Node-Client"
PYCORE_CLIENT_ID = "pycore"
CORE_NODE_PROTOCOL_HEADER = "X-Core-Node-Protocol"
CORE_NODE_PROTOCOL_VERSION = "1"
CORE_NODE_MACHINE_HEADER = "X-Core-Node-Machine-ID"
CORE_NODE_TIMESTAMP_HEADER = "X-Core-Node-Timestamp"
CORE_NODE_NONCE_HEADER = "X-Core-Node-Nonce"
CORE_NODE_CONTENT_SHA256_HEADER = "X-Core-Node-Content-SHA256"
CORE_NODE_SIGNATURE_HEADER = "X-Core-Node-Signature"
CORE_NODE_ENROLLMENT_SECRET_HEADER = "X-Core-Node-Enrollment-Secret"
LARAVEL_SERVICE_HEADER = "X-Core-Node-Service"
LARAVEL_SERVICE_ID = "laravel_main"
LARAVEL_HEALTH_SERVICE = "Laravel API"
PYCORE_MACHINE_ID_PREFIX = "pycore-"
DEVICE_IDENTITY_FILE_NAME = "laravel_device_identity.json"
DEVICE_SECRET_BYTES = 48
DEVICE_IDENTITY_STORE = AtomicJsonStore(
    APP_CONFIG_DIR / DEVICE_IDENTITY_FILE_NAME,
    lambda: {},
)
DEVICE_IDENTITY_LOCK = threading.Lock()
# Laravel server identity (W7 contract): ``/api/health`` answers a stable
# ``server_id``; an API response may carry it in LARAVEL_SERVER_ID_HEADER.
# Delivery state is namespaced per server id; an endpoint whose server id is
# unknown (legacy server) is namespaced by URL.
LARAVEL_SERVER_ID_FIELD = "server_id"
LARAVEL_SERVER_ID_HEADER = "X-Core-Node-Server-Id"
SERVER_NAMESPACE_PREFIX = "server:"
URL_NAMESPACE_PREFIX = "url:"


def get_pycore_machine_id() -> str:
    return PYCORE_MACHINE_ID_PREFIX + get_machine_id()[:12]


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _device_secret() -> str:
    with DEVICE_IDENTITY_LOCK:
        document = DEVICE_IDENTITY_STORE.read()
        secret = str(document.get("secret") or "")
        if secret:
            return secret
        secret = _encode(secrets.token_bytes(DEVICE_SECRET_BYTES))
        DEVICE_IDENTITY_STORE.write({"secret": secret})
        if os.name != "nt":
            os.chmod(DEVICE_IDENTITY_STORE.path, 0o600)
        return secret


def _request_path(service_url: str) -> str:
    parsed = urlsplit(str(service_url or ""))
    return parsed.path or "/"


def build_pycore_identity_headers(
    service_url: str = "",
    method: str = "GET",
    body: bytes = b"",
) -> Dict[str, str]:
    machine_id = get_pycore_machine_id()
    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(24)
    content_sha256 = hashlib.sha256(body).hexdigest()
    secret = _device_secret()
    canonical = "\n".join([
        str(method or "GET").upper(),
        _request_path(service_url),
        machine_id,
        timestamp,
        nonce,
        content_sha256,
    ])
    signature = _encode(hmac.new(
        base64.urlsafe_b64decode(secret + "=" * (-len(secret) % 4)),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).digest())
    headers = {
        PYCORE_CLIENT_HEADER: PYCORE_CLIENT_ID,
        CORE_NODE_PROTOCOL_HEADER: CORE_NODE_PROTOCOL_VERSION,
        CORE_NODE_MACHINE_HEADER: machine_id,
        CORE_NODE_TIMESTAMP_HEADER: timestamp,
        CORE_NODE_NONCE_HEADER: nonce,
        CORE_NODE_CONTENT_SHA256_HEADER: content_sha256,
        CORE_NODE_SIGNATURE_HEADER: signature,
    }
    if _request_path(service_url) == "/api/relay/machine/register":
        headers[CORE_NODE_ENROLLMENT_SECRET_HEADER] = secret
    return headers


def laravel_server_namespace(server_id: str, base_url: str) -> str:
    """Delivery namespace of one Laravel server: its stable id when known,
    otherwise the endpoint URL (legacy servers without an id)."""
    server_id = str(server_id or "").strip()
    if server_id:
        return SERVER_NAMESPACE_PREFIX + server_id
    return URL_NAMESPACE_PREFIX + str(base_url or "").strip().rstrip("/")


def parse_laravel_server_identity(body: Any) -> Dict[str, str]:
    """``{server_id}`` from a health body ('' for a legacy server)."""
    body = body if isinstance(body, dict) else {}
    return {"server_id": str(body.get(LARAVEL_SERVER_ID_FIELD) or "").strip()}


__all__ = [
    "LARAVEL_SERVER_ID_HEADER",
    "SERVER_NAMESPACE_PREFIX",
    "URL_NAMESPACE_PREFIX",
    "build_pycore_identity_headers",
    "get_pycore_machine_id",
    "laravel_server_namespace",
    "parse_laravel_server_identity",
]
