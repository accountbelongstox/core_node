# -*- coding: utf-8 -*-
"""Canonical Queue Center control-intent store.

Legal names come from config/queue_center_contract.json through
queue_center_contract.py. Effective worker configuration remains in the single
Assist settings document; this service stores only user intent/audit metadata.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_CONTROL_NAMES

_CONTROL_SECTION = "queue_center_controls"
_CONTROL_ALIASES = {
    "assist": "assist_translation",
    "translation": "assist_translation",
}


def normalize_control_name(name: str) -> str:
    canonical = _CONTROL_ALIASES.get(str(name), str(name))
    if canonical not in QUEUE_CENTER_CONTROL_NAMES:
        raise ValueError(f"Unknown Queue Center control: {name}")
    return canonical


def get_control_intent(name: str) -> Dict[str, Any]:
    canonical = normalize_control_name(name)
    document = user_data_store.get_section(_CONTROL_SECTION) or {}
    value = document.get(canonical) if isinstance(document, dict) else None
    return dict(value) if isinstance(value, dict) else {}


def record_control_intent(
    name: str,
    enabled: bool,
    requested_by: str = "user",
    reason: Optional[str] = None,
    graceful_stop: bool = False,
) -> Dict[str, Any]:
    canonical = normalize_control_name(name)
    store = user_data_store
    document = store.get_section(_CONTROL_SECTION) or {}
    document = dict(document) if isinstance(document, dict) else {}
    payload = {
        "requested_by": requested_by or "user",
        "requested": bool(enabled),
        "reason": reason,
        "graceful_stop": bool(graceful_stop),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    document[canonical] = payload
    store.set_section(_CONTROL_SECTION, document)
    return {"control": canonical, **payload}


__all__ = [
    "get_control_intent",
    "normalize_control_name",
    "record_control_intent",
]
