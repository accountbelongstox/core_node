# -*- coding: utf-8 -*-
"""Keyset-cursor lists: the one paging primitive of pycore list routes.

A cursor is opaque to clients: base64url of ``[sort_key, row_id]`` of the last
row served. Lists run newest first by ``(sort_key, row_id)``; a page holds the
rows strictly after the cursor. The request ``{cursor, limit}`` and response
``{items, next_cursor, has_more}`` come from the RPC contract ``keyset_page``.
The same response shape serves in-memory/JSON-index rows (``keyset_page``) and
SQLite (``keyset_where`` + ``keyset_result`` over ``limit + 1`` fetched rows).
"""

import base64
import binascii
import json
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.rpc_route_contract import rpc_route_contract

KeysetKey = Tuple[Any, Any]
KeyFunction = Callable[[Dict[str, Any]], KeysetKey]
KEYSET_PAGE = rpc_route_contract.keyset_page
KEYSET_LIMIT_DEFAULT = int(KEYSET_PAGE["limit_default"])
KEYSET_LIMIT_MAX = int(KEYSET_PAGE["limit_max"])


def encode_cursor(key: KeysetKey) -> str:
    raw = json.dumps([key[0], key[1]], separators=(",", ":"), ensure_ascii=True).encode("ascii")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: Optional[str]) -> Optional[KeysetKey]:
    """The ``(sort_key, row_id)`` of a client cursor; None for the first page
    or an unreadable cursor (reported, then served as the first page)."""
    text = str(cursor or "").strip()
    if not text:
        return None
    try:
        value = json.loads(base64.urlsafe_b64decode(text + "=" * (-len(text) % 4)))
    except (binascii.Error, ValueError) as exc:
        ColorPrint.yellow(f"[keyset] unreadable cursor {text[:32]!r}: {exc}")
        return None
    if not isinstance(value, list) or len(value) != 2:
        ColorPrint.yellow(f"[keyset] malformed cursor {text[:32]!r}")
        return None
    return value[0], value[1]


def keyset_request(params: Mapping[str, Any]) -> Tuple[Optional[KeysetKey], int]:
    """``(after_key, limit)`` of one list request (contract-clamped limit)."""
    limit = int(params.get("limit") or KEYSET_LIMIT_DEFAULT)
    return decode_cursor(params.get("cursor")), max(1, min(limit, KEYSET_LIMIT_MAX))


def keyset_result(rows: Sequence[Dict[str, Any]], limit: int, key: KeyFunction) -> Dict[str, Any]:
    """Response of ``limit + 1`` rows already ordered and filtered after the cursor."""
    items = list(rows[:limit])
    has_more = len(rows) > limit
    return {
        "items": items,
        "next_cursor": encode_cursor(key(items[-1])) if has_more and items else None,
        "has_more": has_more,
    }


def keyset_page(rows: Sequence[Dict[str, Any]], after: Optional[KeysetKey], limit: int, key: KeyFunction) -> Dict[str, Any]:
    """One newest-first page of in-memory or JSON-index rows."""
    ordered = sorted(rows, key=key, reverse=True)
    if after is not None:
        ordered = [row for row in ordered if key(row) < tuple(after)]
    return keyset_result(ordered[:limit + 1], limit, key)


def keyset_where(after: Optional[KeysetKey], sort_column: str, id_column: str) -> Tuple[str, List[Any]]:
    """SQLite ``WHERE`` fragment (empty for the first page) and its params for
    a newest-first keyset; pair it with ``ORDER BY sort DESC, id DESC LIMIT limit + 1``."""
    if after is None:
        return "", []
    return f"({sort_column} < ? OR ({sort_column} = ? AND {id_column} < ?))", [after[0], after[0], after[1]]


__all__ = [
    "KEYSET_LIMIT_DEFAULT",
    "KEYSET_LIMIT_MAX",
    "decode_cursor",
    "encode_cursor",
    "keyset_page",
    "keyset_request",
    "keyset_result",
    "keyset_where",
]
