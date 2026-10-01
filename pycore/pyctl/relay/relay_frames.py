# -*- coding: utf-8 -*-
"""Relay frame decoding, request validation, and response framing."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyutils.common.relay_contract import (
    RELAY_FRAME_KIND_ACK,
    RELAY_FRAME_KIND_RESULT,
    relay_contract,
)
from pycore.pyutils.rpc.execution import rpc_execution_kernel


RELAY_UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
RELAY_REQUIRED_TEXT_FIELDS = ("owner", "pair", "m", "p")
RELAY_ERROR_PATH_INVALID = "relay_operation_path_not_canonical"
RELAY_ERROR_QUERY_INVALID = "relay_frame_query_invalid"
RELAY_ERROR_HEADERS_INVALID = "relay_frame_headers_invalid"
RELAY_ERROR_BODY_INVALID = "relay_frame_body_invalid"
RELAY_ERROR_BODY_LENGTH = "relay_request_body_length_conflict"
RELAY_ERROR_BODY_DIGEST = "relay_request_body_digest_conflict"
RELAY_ERROR_ROUTE_DENIED = "route_denied"
RELAY_ERROR_FRAME_TOO_LARGE = "frame_too_large"
RELAY_STATUS_BAD_REQUEST = 400
RELAY_STATUS_ACCEPTED = 202
RELAY_FRAME_OVERHEAD_MARGIN = 16
RELAY_TIMING_PLACEHOLDER_MS = 1700000000000

RelayError = Tuple[int, str]


def serialize_frame(frame: Dict[str, Any]) -> str:
    return json.dumps(frame, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def decode_request(data: str) -> Optional[Dict[str, Any]]:
    """Parse a request frame; None when it is not addressable or not of this protocol."""
    try:
        document = json.loads(data)
    except ValueError:
        return None
    if not isinstance(document, dict):
        return None
    version = document.get("v")
    if isinstance(version, bool) or version != relay_contract.frame_version:
        return None
    op = document.get("op")
    if not isinstance(op, str) or not RELAY_UUID_PATTERN.match(op):
        return None
    for name in RELAY_REQUIRED_TEXT_FIELDS:
        if not isinstance(document.get(name), str) or not document[name]:
            return None
    deadline = document.get("dl")
    if isinstance(deadline, bool) or not isinstance(deadline, (int, float)):
        return None
    return document


def _mapping(value: Any) -> Optional[Dict[str, Any]]:
    # PHP encodes an empty associative array as [].
    if value is None or (isinstance(value, list) and not value):
        return {}
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    return None


def validate_request(document: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[RelayError]]:
    """Return an execution job, or the (status, code) of the error response."""
    method = str(document["m"]).upper()
    path = str(document["p"])
    try:
        canonical = relay_contract.canonical_path(path)
    except ValueError:
        return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_PATH_INVALID)
    if canonical != path:
        return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_PATH_INVALID)
    route = rpc_execution_kernel.route_path(path)
    policy = relay_contract.route_policy(route, method)
    if str(policy.get("exposure") or "denied") != "relay":
        return None, (relay_contract.error_status("route_denied"), RELAY_ERROR_ROUTE_DENIED)
    query = _mapping(document.get("q"))
    if query is None:
        return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_QUERY_INVALID)
    raw_headers = _mapping(document.get("h"))
    if raw_headers is None:
        return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_HEADERS_INVALID)
    body_meta = document.get("b")
    if not isinstance(body_meta, dict):
        return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_BODY_INVALID)
    encoded = body_meta.get("b64")
    reference = body_meta.get("ref")
    declared_length = body_meta.get("len")
    if (
        (encoded is not None and not isinstance(encoded, str))
        or (reference is not None and not (isinstance(reference, str) and RELAY_UUID_PATTERN.match(reference)))
        or (encoded and reference)
        or isinstance(declared_length, bool)
        or not isinstance(declared_length, int)
        or declared_length > relay_contract.limit("request_body_bytes")
    ):
        return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_BODY_INVALID)
    body = b""
    if not reference:
        try:
            body = base64.b64decode(encoded or "", validate=True)
        except (binascii.Error, ValueError):
            return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_BODY_INVALID)
        if len(body) != declared_length:
            return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_BODY_LENGTH)
        if hashlib.sha256(body).hexdigest() != str(body_meta.get("sha256") or "").lower():
            return None, (RELAY_STATUS_BAD_REQUEST, RELAY_ERROR_BODY_DIGEST)
    return {
        "op": str(document["op"]),
        "owner": str(document["owner"]),
        "pair": str(document["pair"]),
        "method": method,
        "path": path,
        "route": route,
        "query": query,
        "headers": rpc_execution_kernel.filtered_headers(raw_headers, "request"),
        "body": body,
        "body_ref": str(reference or ""),
        "body_length": declared_length,
        "body_sha256": str(body_meta.get("sha256") or "").lower(),
        "body_present": bool(encoded) or bool(reference),
        "deadline_ms": int(document["dl"]),
        "delivery": str(policy["delivery"]),
        "ack": bool(policy.get("ack")),
    }, None


def _frame(
    op: str,
    kind: str,
    status: int,
    headers: Dict[str, str],
    body_length: int,
    body_digest: str,
    chunk: str,
    reference: Optional[str],
    index: int,
    count: int,
    exec_ms: int,
) -> Dict[str, Any]:
    return {
        "v": relay_contract.frame_version,
        "op": op,
        "k": kind,
        "s": int(status),
        "h": headers,
        "b": {"len": body_length, "sha256": body_digest, "b64": chunk, "ref": reference},
        "part": {"i": index, "n": count},
        "t": {
            "dev_recv": RELAY_TIMING_PLACEHOLDER_MS,
            "exec_ms": int(exec_ms),
            "dev_send": RELAY_TIMING_PLACEHOLDER_MS,
        },
    }


def ack_frames(op: str) -> List[Dict[str, Any]]:
    return [
        _frame(op, RELAY_FRAME_KIND_ACK, RELAY_STATUS_ACCEPTED, {}, 0, hashlib.sha256(b"").hexdigest(), "", None, 0, 1, 0)
    ]


def fits_inline(body: bytes) -> bool:
    return len(body) <= relay_contract.limit("response_inline_bytes")


def blob_frames(
    op: str,
    status: int,
    headers: Dict[str, Any],
    body_length: int,
    body_digest: str,
    reference: str,
    exec_ms: int,
) -> List[Dict[str, Any]]:
    """One result frame pointing at an uploaded response blob."""
    frame_headers = {str(key).lower(): str(value) for key, value in dict(headers or {}).items()}
    return [
        _frame(op, RELAY_FRAME_KIND_RESULT, status, frame_headers, body_length, body_digest, "", reference, 0, 1, exec_ms)
    ]


def response_frames(
    op: str,
    status: int,
    headers: Dict[str, Any],
    body: bytes,
    exec_ms: int,
) -> List[Dict[str, Any]]:
    """Frame one inline response as ordered result parts; the body must fit inline."""
    encoded = base64.b64encode(body).decode("ascii")
    digest = hashlib.sha256(body).hexdigest()
    frame_headers = {str(key).lower(): str(value) for key, value in dict(headers or {}).items()}
    overhead = len(
        serialize_frame(
            _frame(op, RELAY_FRAME_KIND_RESULT, status, frame_headers, len(body), digest, "", None, 0, 1, exec_ms)
        ).encode("utf-8")
    ) + RELAY_FRAME_OVERHEAD_MARGIN
    slice_size = min(
        relay_contract.limit("inline_body_bytes"),
        relay_contract.limit("frame_bytes") - overhead,
    )
    count = max(1, -(-len(encoded) // slice_size))
    return [
        _frame(
            op,
            RELAY_FRAME_KIND_RESULT,
            status,
            frame_headers,
            len(body),
            digest,
            encoded[index * slice_size : (index + 1) * slice_size],
            None,
            index,
            count,
            exec_ms,
        )
        for index in range(count)
    ]


def error_frames(op: str, status: int, code: str) -> List[Dict[str, Any]]:
    response = rpc_execution_kernel.error_response(code, status, op)
    return response_frames(
        op,
        response.status_code,
        rpc_execution_kernel.filtered_headers(response.headers, "response"),
        response.body,
        0,
    )


__all__ = [
    "ack_frames",
    "blob_frames",
    "decode_request",
    "error_frames",
    "fits_inline",
    "response_frames",
    "serialize_frame",
    "validate_request",
]
