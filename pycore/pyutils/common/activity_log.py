# -*- coding: utf-8 -*-
"""Structured component activity output through the central ColorPrint pipeline."""

from __future__ import annotations

import hashlib
import os
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


ACTIVITY_LOG_VALUE_LIMIT = 320
ACTIVITY_LOG_REDACTED = "<redacted>"

# Debug actions are per-request chatter (identity facts, request signing,
# empty reconciliation passes); a healthy process prints lifecycle events
# only. Set PYCORE_ACTIVITY_DEBUG=1 to audit them.
ACTIVITY_LOG_DEBUG_ENABLED = os.environ.get(
    "PYCORE_ACTIVITY_DEBUG", ""
).strip().lower() not in ("", "0", "false", "no")
ACTIVITY_LOG_SENSITIVE_PARTS = (
    "authorization",
    "claim_code",
    "credential",
    "private",
    "secret",
    "signature",
    "subscriber_token",
    "token",
)


class ActivityLog:
    """Emit stable action codes and bounded context through ColorPrint."""

    def __init__(self, component: str) -> None:
        self.component = str(component)

    @staticmethod
    def _safe_value(key: str, value: Any) -> str:
        normalized_key = str(key or "").lower()
        if any(part in normalized_key for part in ACTIVITY_LOG_SENSITIVE_PARTS):
            return ACTIVITY_LOG_REDACTED
        if isinstance(value, bytes):
            digest = hashlib.sha256(value).hexdigest()
            return f"bytes:{len(value)} sha256:{digest}"
        if isinstance(value, (list, tuple, set)):
            return f"items:{len(value)}"
        if isinstance(value, dict):
            return f"keys:{','.join(sorted(str(item) for item in value)[:12])}"
        text = str(value).replace("\r", "\\r").replace("\n", "\\n")
        if len(text) > ACTIVITY_LOG_VALUE_LIMIT:
            return text[:ACTIVITY_LOG_VALUE_LIMIT] + "..."
        return text

    def _line(self, action: str, context: Dict[str, Any]) -> str:
        fields = [f"action={str(action or 'unknown')}"]
        fields.extend(
            f"{key}={self._safe_value(key, context[key])}"
            for key in sorted(context)
            if context[key] is not None and context[key] != ""
        )
        return f"[{self.component}] " + " ".join(fields)

    def debug(self, action: str, **context: Any) -> None:
        if not ACTIVITY_LOG_DEBUG_ENABLED:
            return
        ColorPrint.gray(self._line(action, context))

    def info(self, action: str, **context: Any) -> None:
        ColorPrint.blue(self._line(action, context))

    def success(self, action: str, **context: Any) -> None:
        ColorPrint.green(self._line(action, context))

    def warning(self, action: str, **context: Any) -> None:
        ColorPrint.yellow(self._line(action, context))

    def error(self, action: str, **context: Any) -> None:
        ColorPrint.red(self._line(action, context))


__all__ = ["ActivityLog"]
