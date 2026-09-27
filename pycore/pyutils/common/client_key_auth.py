# -*- coding: utf-8 -*-
"""Shared client key signer and verifier (service_contract ``client_key_auth``)."""

import base64
import hashlib
import hmac
import re
import secrets
import time
from typing import Any, Dict, List, Mapping, Optional
from urllib.parse import parse_qsl, urlsplit

from pycore.pyfoundations.machine_id import get_machine_id
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyfoundations.serialized_worker import (
    SerializedValue,
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.service_contract import value as service_contract_value
from pycore.pyutils.common.relay_contract import relay_contract

CLIENT_KEY_CONTRACT: Dict[str, Any] = service_contract_value("client_key_auth")
CLIENT_KEY_PROTOCOL = str(CLIENT_KEY_CONTRACT["protocol_version"])
CLIENT_KEY_CANONICAL_VERSION = str(CLIENT_KEY_CONTRACT["canonical_version"])
CLIENT_KEY_SECRET_BASE = str(CLIENT_KEY_CONTRACT["secret_key_base"])
CLIENT_KEY_SIGN_NAME = str(CLIENT_KEY_CONTRACT["secret_key_sign_name"])
CLIENT_KEY_MAX_INDEX = int(CLIENT_KEY_CONTRACT["secret_key_max_index"])
CLIENT_KEY_MIN_BYTES = int(CLIENT_KEY_CONTRACT["key_min_bytes"])
CLIENT_KEY_ID_LENGTH_PATTERN = re.compile(r"first-(\d+)-chars")
CLIENT_KEY_ID_LENGTH = int(CLIENT_KEY_ID_LENGTH_PATTERN.search(str(CLIENT_KEY_CONTRACT["key_id"])).group(1))
CLIENT_KEY_FIELDS = tuple(str(field) for field in CLIENT_KEY_CONTRACT["canonical_fields"])
CLIENT_KEY_JOINER = str(CLIENT_KEY_CONTRACT["canonical_joiner"])
CLIENT_KEY_UNSIGNED_PAYLOAD = str(CLIENT_KEY_CONTRACT["unsigned_payload"])
CLIENT_KEY_UNSIGNED_CONTENT_TYPES = frozenset(
    str(item).lower() for item in CLIENT_KEY_CONTRACT["unsigned_payload_content_types"]
)
CLIENT_KEY_CLOCK_SKEW_SECONDS = int(CLIENT_KEY_CONTRACT["clock_skew_seconds"])
CLIENT_KEY_NONCE_TTL_SECONDS = int(CLIENT_KEY_CONTRACT["nonce_ttl_seconds"])
CLIENT_KEY_NONCE_PATTERN = re.compile(str(CLIENT_KEY_CONTRACT["nonce_pattern"]))
CLIENT_KEY_MACHINE_ID_PATTERN = re.compile(str(CLIENT_KEY_CONTRACT["machine_id_pattern"]))
CLIENT_KEY_CLIENTS = frozenset(str(item) for item in CLIENT_KEY_CONTRACT["clients"])
CLIENT_KEY_ERROR_CODES = frozenset(str(item) for item in CLIENT_KEY_CONTRACT["error_codes"])
CLIENT_KEY_HEADERS: Dict[str, str] = {
    str(name): str(header) for name, header in CLIENT_KEY_CONTRACT["headers"].items()
}
CLIENT_KEY_NONCE_BYTES = 24
CLIENT_KEY_DD_STEP = "dd.sh / dd.cmd step [SECRETS] ensure_secret_keys_ready"
PYCORE_CLIENT_ID = "pycore"
PYCORE_MACHINE_ID_PREFIX = "pycore-"
PYCORE_MACHINE_ID_HASH_CHARS = 12
_MISSING_KEY_REPORTED = SerializedValue(False, "ClientKeyMissingReportThread")


def _error_code(reason: str) -> str:
    """The contract error code for one failure reason (matched by suffix)."""
    matches = [code for code in CLIENT_KEY_ERROR_CODES if code.endswith(f"_{reason}")]
    if len(matches) != 1:
        raise ValueError(f"client_key_auth error codes do not define '{reason}'")
    return matches[0]


ERROR_MISSING = _error_code("missing")
ERROR_UNKNOWN = _error_code("unknown")
ERROR_PROTOCOL = _error_code("protocol_invalid")
ERROR_TIMESTAMP = _error_code("timestamp_invalid")
ERROR_NONCE = _error_code("nonce_invalid")
ERROR_REPLAYED = _error_code("nonce_replayed")
ERROR_BODY_DIGEST = _error_code("body_digest_invalid")
ERROR_SIGNATURE = _error_code("signature_invalid")
if PYCORE_CLIENT_ID not in CLIENT_KEY_CLIENTS:
    raise ValueError("client_key_auth clients do not include pycore")


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode_key(raw: str) -> bytes:
    text = str(raw or "").strip()
    if not text or len(text) % 4 == 1 or not re.fullmatch(r"[A-Za-z0-9_-]+", text):
        return b""
    decoded = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    return decoded if len(decoded) >= CLIENT_KEY_MIN_BYTES else b""


def client_key_id(key: bytes) -> str:
    return hashlib.sha256(key).hexdigest()[:CLIENT_KEY_ID_LENGTH]


def get_pycore_machine_id() -> str:
    return PYCORE_MACHINE_ID_PREFIX + get_machine_id()[:PYCORE_MACHINE_ID_HASH_CHARS]


def _report_missing_key(secret_name: str) -> None:
    if _MISSING_KEY_REPORTED.compare_and_set(False, True):
        ColorPrint.red(
            f"[client_key] {ERROR_MISSING}: secret {secret_name} is missing or shorter than "
            f"{CLIENT_KEY_MIN_BYTES} bytes; run {CLIENT_KEY_DD_STEP} to decrypt it. "
            "Machine calls stay unsigned and are refused until then."
        )


def _signing_key() -> bytes:
    key = _decode_key(get_secret_key(CLIENT_KEY_SIGN_NAME))
    if not key:
        _report_missing_key(CLIENT_KEY_SIGN_NAME)
    return key


def _verification_keys() -> Dict[str, bytes]:
    keys: Dict[str, bytes] = {}
    for index in range(1, CLIENT_KEY_MAX_INDEX + 1):
        key = _decode_key(get_secret_key(f"{CLIENT_KEY_SECRET_BASE}_{index}"))
        if key:
            keys.setdefault(client_key_id(key), key)
    return keys


def client_key_available() -> bool:
    return bool(_decode_key(get_secret_key(CLIENT_KEY_SIGN_NAME)))


def canonical_query_from_raw(raw_query: str) -> str:
    pairs: Dict[str, List[str]] = {}
    for key, item in parse_qsl(str(raw_query or ""), keep_blank_values=True):
        pairs.setdefault(key, []).append(item)
    return relay_contract.canonical_query(pairs)


def payload_is_unsigned(content_type: str) -> bool:
    media_type = str(content_type or "").split(";", 1)[0].strip().lower()
    return media_type in CLIENT_KEY_UNSIGNED_CONTENT_TYPES


def content_sha256(body: Optional[bytes], content_type: str = "") -> str:
    if payload_is_unsigned(content_type):
        return CLIENT_KEY_UNSIGNED_PAYLOAD
    return hashlib.sha256(bytes(body or b"")).hexdigest()


def canonical_string(fields: Mapping[str, str]) -> str:
    return CLIENT_KEY_JOINER.join(str(fields[name]) for name in CLIENT_KEY_FIELDS)


def _signature(key: bytes, fields: Mapping[str, str]) -> str:
    return _encode(hmac.new(key, canonical_string(fields).encode("utf-8"), hashlib.sha256).digest())


def client_key_headers(
    method: str,
    url: str,
    body: Optional[bytes] = b"",
    content_type: str = "",
    client: str = PYCORE_CLIENT_ID,
    machine_id: str = "",
) -> Dict[str, str]:
    """K3 headers for one request, or ``{}`` when the signing key is missing.

    ``url`` carries the exact path and query that are sent; ``body`` is the
    exact transmitted bytes (ignored for the unsigned multipart types).
    """
    key = _signing_key()
    if not key:
        return {}
    parts = urlsplit(str(url or ""))
    fields = {
        "canonical_version": CLIENT_KEY_CANONICAL_VERSION,
        "protocol": CLIENT_KEY_PROTOCOL,
        "method": str(method or "GET").upper(),
        "path": relay_contract.canonical_path(parts.path or "/"),
        "query": canonical_query_from_raw(parts.query),
        "client": str(client),
        "machine_id": str(machine_id or get_pycore_machine_id()),
        "key_id": client_key_id(key),
        "timestamp": str(int(time.time())),
        "nonce": secrets.token_urlsafe(CLIENT_KEY_NONCE_BYTES),
        "content_sha256": content_sha256(body, content_type),
    }
    return {
        CLIENT_KEY_HEADERS["client"]: fields["client"],
        CLIENT_KEY_HEADERS["protocol"]: fields["protocol"],
        CLIENT_KEY_HEADERS["machine_id"]: fields["machine_id"],
        CLIENT_KEY_HEADERS["key_id"]: fields["key_id"],
        CLIENT_KEY_HEADERS["timestamp"]: fields["timestamp"],
        CLIENT_KEY_HEADERS["nonce"]: fields["nonce"],
        CLIENT_KEY_HEADERS["content_sha256"]: fields["content_sha256"],
        CLIENT_KEY_HEADERS["signature"]: _signature(key, fields),
    }


class ClientKeyNonceLedger:
    """Nonces accepted within the contract TTL, owned by one state thread."""

    def __init__(self) -> None:
        self._seen: Dict[str, float] = {}
        init_serialized_owner(self, "pyutils.client_key.nonces", "ClientKeyNonceLedgerThread")

    @serialized_method
    def accept(self, identity: str, now: float) -> bool:
        expired = [name for name, expires_at in self._seen.items() if expires_at <= now]
        for name in expired:
            self._seen.pop(name)
        if identity in self._seen:
            return False
        self._seen[identity] = now + CLIENT_KEY_NONCE_TTL_SECONDS
        return True


client_key_nonce_ledger = ClientKeyNonceLedger()


def client_key_present(headers: Mapping[str, Any]) -> bool:
    """True when a request carries K3 signature headers (checked before any
    body is read)."""
    lowered = {str(name).lower() for name, item in dict(headers or {}).items() if str(item).strip()}
    return any(CLIENT_KEY_HEADERS[name].lower() in lowered for name in ("signature", "key_id"))


def _failure(code: str) -> Dict[str, Any]:
    return {"ok": False, "error_code": code, "client": "", "machine_id": ""}


def client_key_verify(
    method: str,
    raw_path: str,
    raw_query: str,
    headers: Mapping[str, Any],
    body: Optional[bytes],
    content_type: str = "",
) -> Dict[str, Any]:
    """Verify one inbound K3 request; ``{ok, error_code, client, machine_id}``."""
    lowered = {str(name).lower(): str(item) for name, item in dict(headers or {}).items()}
    received = {
        name: lowered.get(header.lower(), "").strip()
        for name, header in CLIENT_KEY_HEADERS.items()
    }
    if not received["signature"] and not received["key_id"]:
        return _failure(ERROR_MISSING)
    if (
        received["protocol"] != CLIENT_KEY_PROTOCOL
        or received["client"] not in CLIENT_KEY_CLIENTS
        or not CLIENT_KEY_MACHINE_ID_PATTERN.fullmatch(received["machine_id"])
    ):
        return _failure(ERROR_PROTOCOL)
    keys = _verification_keys()
    if not keys:
        _report_missing_key(f"{CLIENT_KEY_SECRET_BASE}_1..{CLIENT_KEY_MAX_INDEX}")
        return _failure(ERROR_MISSING)
    key = keys.get(received["key_id"])
    if key is None:
        return _failure(ERROR_UNKNOWN)
    now = time.time()
    if not received["timestamp"].isdigit() or abs(now - int(received["timestamp"])) > CLIENT_KEY_CLOCK_SKEW_SECONDS:
        return _failure(ERROR_TIMESTAMP)
    if not CLIENT_KEY_NONCE_PATTERN.fullmatch(received["nonce"]):
        return _failure(ERROR_NONCE)
    if received["content_sha256"] != content_sha256(body, content_type):
        return _failure(ERROR_BODY_DIGEST)
    try:
        canonical_path = relay_contract.canonical_path(raw_path or "/")
    except ValueError:
        # A path the canonicalizer refuses (e.g. %2F, //x) can never carry a
        # valid signature; same answer as the ncore and Laravel verifiers.
        return _failure(ERROR_SIGNATURE)
    fields = {
        "canonical_version": CLIENT_KEY_CANONICAL_VERSION,
        "protocol": received["protocol"],
        "method": str(method or "GET").upper(),
        "path": canonical_path,
        "query": canonical_query_from_raw(raw_query),
        "client": received["client"],
        "machine_id": received["machine_id"],
        "key_id": received["key_id"],
        "timestamp": received["timestamp"],
        "nonce": received["nonce"],
        "content_sha256": received["content_sha256"],
    }
    if not hmac.compare_digest(_signature(key, fields), received["signature"]):
        return _failure(ERROR_SIGNATURE)
    nonce_identity = f"{received['key_id']}:{received['nonce']}"
    if not client_key_nonce_ledger.accept(nonce_identity, now):
        return _failure(ERROR_REPLAYED)
    return {
        "ok": True,
        "error_code": "",
        "client": received["client"],
        "machine_id": received["machine_id"],
    }


__all__ = [
    "CLIENT_KEY_HEADERS",
    "PYCORE_CLIENT_ID",
    "canonical_query_from_raw",
    "canonical_string",
    "client_key_available",
    "client_key_headers",
    "client_key_id",
    "client_key_nonce_ledger",
    "client_key_present",
    "client_key_verify",
    "content_sha256",
    "get_pycore_machine_id",
    "payload_is_unsigned",
]
