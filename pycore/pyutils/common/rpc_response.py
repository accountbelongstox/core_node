# -*- coding: utf-8 -*-
"""Transport-neutral exact-byte RPC response value."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class RpcExecutionResponse:
    status_code: int
    headers: Dict[str, str]
    body: bytes
    has_body: bool = True


def rpc_response_digest(response: RpcExecutionResponse) -> str:
    """Digest status, normalized headers, body presence, and exact body bytes."""
    metadata = json.dumps(
        {
            "status": int(response.status_code),
            "headers": {
                str(key).lower(): str(value)
                for key, value in sorted(
                    response.headers.items(),
                    key=lambda item: str(item[0]).lower(),
                )
            },
            "body_present": bool(response.has_body),
            "body_sha256": hashlib.sha256(response.body).hexdigest(),
            "body_length": len(response.body),
        },
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(metadata).hexdigest()


__all__ = ["RpcExecutionResponse", "rpc_response_digest"]
