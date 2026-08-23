# -*- coding: utf-8 -*-
"""Transport-neutral exact-byte RPC response value."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class RpcExecutionResponse:
    status_code: int
    headers: Dict[str, str]
    body: bytes
    has_body: bool = True


__all__ = ["RpcExecutionResponse"]
