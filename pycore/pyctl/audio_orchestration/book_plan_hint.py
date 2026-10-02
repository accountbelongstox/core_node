# -*- coding: utf-8 -*-
"""The book plan this node's app currently reads (claim hint, in memory, expiring)."""

import time
from typing import Optional

from pycore.pyctl.audio_orchestration.orch_contract import PLAN_HINT_TTL_SECONDS

_hint = {"plan_id": "", "expires_at": 0.0}


def set_plan_hint(plan_id: str) -> None:
    _hint["plan_id"] = str(plan_id or "").strip()[:40]
    _hint["expires_at"] = time.monotonic() + PLAN_HINT_TTL_SECONDS


def current_plan_hint() -> Optional[str]:
    if _hint["plan_id"] and time.monotonic() < _hint["expires_at"]:
        return str(_hint["plan_id"])
    return None


__all__ = ["current_plan_hint", "set_plan_hint"]
