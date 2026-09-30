# -*- coding: utf-8 -*-
"""Relay Fabric V3 frame decoding, request validation, and response framing."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_fabric_contract import (
    RELAY_FABRIC_LANE_FAST,
    relay_fabric_contract,
)
from pycore.pyutils.rpc_v2.execution import rpc_execution_kernel


FABRIC_UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
FABRIC_REQUIRED_TEXT_FIELDS = ("owner", "pair", "m", "p")
FABRIC_ERROR_HEADER = "x-relay-error"
FABRIC_ERROR_RESPONSE_TOO_LARGE = "response_too_large"
FABRIC_ERROR_PATH_INVALID = "relay_operation_path_not_canonical"
FABRIC_ERROR_QUERY_INVALID = "relay_fabric_query_invalid"
FABRIC_ERROR_HEADERS_INVALID = "relay_fabric_headers_invalid"
FABRIC_ERROR_BODY_INVALID = "relay_fabric_body_invalid"
FABRIC_ERROR_BODY_LENGTH = "relay_request_body_length_conflict"
FABRIC_ERROR_BODY_DIGEST = "relay_request_body_digest_conflict"
FABRIC_ERROR_LANE_MISMATCH = "lane_durable_required"
FABRIC_ERROR_ROUTE_DENIED = "route_denied"
FABRIC_ERROR_FRAME_TOO_LARGE = "frame_too_large"
FABRIC_STATUS_BAD_REQUEST = 400
FABRIC_STATUS_TOO_LARGE_RESPONSE = 502
FABRIC_FRAME_OVERHEAD_MARGIN = 16
FABRIC_TIMING_PLACEHOLDER_MS = 1700000000000

FabricError = Tuple[int, str]


def serialize_frame(frame: Dict[str, Any]) -> str:
    return json.dumps(frame, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def decode_request(data: str) -> Optional[Dict[str, Any]]:
    """Parse a request frame; None when it is not addressable or not v3."""
    try:
        document = json.loads(data)
    except ValueError:
        return None
    if not isinstance(document, dict):
        return None
    version = document.get("v")
    if isinstance(version, bool) or version != relay_fabric_contract.envelope_version:
        return None
    op = document.get("op")
    if not isinstance(op, str) or not FABRIC_UUID_PATTERN.match(op):
        return None
    for name in FABRIC_REQUIRED_TEXT_FIELDS:
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


def validate_request(document: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[FabricError]]:
    """Return an execution job, or the (status, code) of the error response."""
    method = str(document["m"]).upper()
    path = str(document["p"])
    try:
        canonical = relay_contract.canonical_path(path)
    except ValueError:
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_PATH_INVALID)
    if canonical != path:
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_PATH_INVALID)
    route = rpc_execution_kernel.route_path(path)
    policy = relay_contract.route_policy(route, method)
    if str(policy.get("exposure") or "denied") != "relay":
        return None, (relay_fabric_contract.error_status("route_denied"), FABRIC_ERROR_ROUTE_DENIED)
    if (
        document.get("lane") != RELAY_FABRIC_LANE_FAST
        or not relay_fabric_contract.fast_allowed(
            str(policy.get("profile") or ""),
            str(policy.get("retry") or ""),
        )
    ):
        return None, (relay_fabric_contract.error_status("lane_durable_required"), FABRIC_ERROR_LANE_MISMATCH)
    query = _mapping(document.get("q"))
    if query is None:
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_QUERY_INVALID)
    raw_headers = _mapping(document.get("h"))
    if raw_headers is None:
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_HEADERS_INVALID)
    body_meta = document.get("b")
    if not isinstance(body_meta, dict):
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_BODY_INVALID)
    encoded = body_meta.get("b64")
    declared_length = body_meta.get("len")
    if (
        (encoded is not None and not isinstance(encoded, str))
        or isinstance(declared_length, bool)
        or not isinstance(declared_length, int)
    ):
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_BODY_INVALID)
    try:
        body = base64.b64decode(encoded or "", validate=True)
    except (binascii.Error, ValueError):
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_BODY_INVALID)
    if len(body) != declared_length:
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_BODY_LENGTH)
    if hashlib.sha256(body).hexdigest() != str(body_meta.get("sha256") or "").lower():
        return None, (FABRIC_STATUS_BAD_REQUEST, FABRIC_ERROR_BODY_DIGEST)
    if len(body) > relay_contract.limit("request_body_bytes"):
        return None, (relay_fabric_contract.error_status("frame_too_large"), FABRIC_ERROR_FRAME_TOO_LARGE)
    return {
        "op": str(document["op"]),
        "owner": str(document["owner"]),
        "pair": str(document["pair"]),
        "method": method,
        "path": path,
        "query": query,
        "headers": rpc_execution_kernel.filtered_headers(raw_headers, "request"),
        "body": body,
        "deadline_ms": int(document["dl"]),
    }, None


def _response_frame(
    op: str,
    status: int,
    headers: Dict[str, str],
    body_length: int,
    body_digest: str,
    chunk: str,
    index: int,
    count: int,
    exec_ms: int,
) -> Dict[str, Any]:
    return {
        "v": relay_fabric_contract.envelope_version,
        "op": op,
        "s": int(status),
        "h": headers,
        "b": {"len": body_length, "sha256": body_digest, "b64": chunk},
        "part": {"i": index, "n": count},
        "t": {
            "dev_recv": FABRIC_TIMING_PLACEHOLDER_MS,
            "exec_ms": int(exec_ms),
            "dev_send": FABRIC_TIMING_PLACEHOLDER_MS,
        },
    }


def _too_large_frames(op: str, exec_ms: int) -> List[Dict[str, Any]]:
    return [
        _response_frame(
            op,
            FABRIC_STATUS_TOO_LARGE_RESPONSE,
            {FABRIC_ERROR_HEADER: FABRIC_ERROR_RESPONSE_TOO_LARGE},
            0,
            hashlib.sha256(b"").hexdigest(),
            "",
            0,
            1,
            exec_ms,
        )
    ]


def response_frames(
    op: str,
    status: int,
    headers: Dict[str, Any],
    body: bytes,
    exec_ms: int,
) -> List[Dict[str, Any]]:
    """Frame one response: inline, ordered parts, or a response_too_large error."""
    if len(body) > relay_fabric_contract.limit("response_total_bytes"):
        return _too_large_frames(op, exec_ms)
    encoded = base64.b64encode(body).decode("ascii")
    digest = hashlib.sha256(body).hexdigest()
    frame_headers = {str(key).lower(): str(value) for key, value in dict(headers or {}).items()}
    overhead = len(
        serialize_frame(
            _response_frame(op, status, frame_headers, len(body), digest, "", 0, 1, exec_ms)
        ).encode("utf-8")
    ) + FABRIC_FRAME_OVERHEAD_MARGIN
    slice_size = min(
        relay_fabric_contract.limit("inline_body_bytes"),
        relay_fabric_contract.limit("frame_bytes") - overhead,
    )
    if slice_size <= 0:
        return _too_large_frames(op, exec_ms)
    count = max(1, -(-len(encoded) // slice_size))
    if count > relay_fabric_contract.limit("max_parts"):
        return _too_large_frames(op, exec_ms)
    return [
        _response_frame(
            op,
            status,
            frame_headers,
            len(body),
            digest,
            encoded[index * slice_size : (index + 1) * slice_size],
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
    "decode_request",
    "error_frames",
    "response_frames",
    "serialize_frame",
    "validate_request",
]
