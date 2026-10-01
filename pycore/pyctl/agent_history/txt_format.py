# -*- coding: utf-8 -*-
"""Agent-history txt format: ``key=value`` header lines and ``@marker`` blocks
with optional multiline ``<<<TEXT`` ... ``TEXT>>>`` bodies."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

TEXT_END = "TEXT>>>"
TEXT_START = "<<<TEXT"
BLOCK_MARKERS = ("@session", "@prompt", "@turn", "@meta")


def to_int(value: Any) -> int:
    text = str(value if value is not None else "").strip()
    digits = text[1:] if text[:1] == "-" else text
    return int(text) if digits.isdigit() else 0


def to_bool(value: Any) -> bool:
    return str(value if value is not None else "").lower() == "true"


def csv_list(value: Any) -> List[str]:
    return [item for item in str(value or "").split(",") if item]


def escape_value(val: str) -> str:
    return (val or "").replace("\r\n", "\n").replace("\n", "\\n")


def unescape_value(val: str) -> str:
    return (val or "").replace("\\n", "\n")


def format_kv_lines(data: Dict[str, Any]) -> str:
    lines = ["# agent-history kv"]
    for k, v in data.items():
        if isinstance(v, bool):
            lines.append(f"{k}={'true' if v else 'false'}")
        elif isinstance(v, (list, dict)):
            lines.append(f"{k}={json.dumps(v, ensure_ascii=False)}")
        else:
            lines.append(f"{k}={escape_value(str(v))}")
    return "\n".join(lines) + "\n"


def parse_kv_lines(text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for line in (text or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        val = unescape_value(val)
        if val in ("true", "false"):
            out[key] = val == "true"
        else:
            out[key] = val
    return out


def format_block(marker: str, fields: Dict[str, Any], body_key: Optional[str] = None) -> str:
    lines = [marker]
    body = ""
    for k, v in fields.items():
        if body_key and k == body_key:
            body = str(v or "")
            continue
        if isinstance(v, bool):
            lines.append(f"{k}={'true' if v else 'false'}")
        elif isinstance(v, list):
            lines.append(f"{k}={','.join(str(x) for x in v)}")
        else:
            lines.append(f"{k}={escape_value(str(v))}")
    if body_key:
        lines.append(TEXT_START)
        lines.append(body)
        lines.append(TEXT_END)
    return "\n".join(lines) + "\n\n"


def parse_blocks(text: str) -> List[Tuple[str, Dict[str, Any]]]:
    """Return list of (marker, fields) including multiline TEXT bodies."""
    blocks: List[Tuple[str, Dict[str, Any]]] = []
    if not text:
        return blocks

    current_marker = ""
    fields: Dict[str, Any] = {}
    body_key: Optional[str] = None
    body_lines: List[str] = []
    in_body = False

    def flush() -> None:
        nonlocal fields, body_key, body_lines, in_body
        if current_marker:
            if body_key and body_lines:
                fields[body_key] = "\n".join(body_lines)
            blocks.append((current_marker, dict(fields)))
        fields = {}
        body_key = None
        body_lines = []
        in_body = False

    for line in text.splitlines():
        if line in BLOCK_MARKERS:
            flush()
            current_marker = line
            continue
        if line == TEXT_START:
            in_body = True
            body_key = "text"
            body_lines = []
            continue
        if line == TEXT_END:
            in_body = False
            continue
        if in_body:
            body_lines.append(line)
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            fields[k] = unescape_value(v)

    flush()
    return blocks


__all__ = [
    "csv_list",
    "escape_value",
    "format_block",
    "format_kv_lines",
    "parse_blocks",
    "parse_kv_lines",
    "to_bool",
    "to_int",
    "unescape_value",
]
