# -*- coding: utf-8 -*-
"""
Assist-Laravel payload helpers (pure functions) + worker-id/time helpers.

Extracted verbatim (behavior-preserving) from the former assist_worker.py
monolith. Two groups, both stateless and lock-free so the handlers
(assist_handlers) and the orchestrator (assist_worker) can share them without
any coupling to the AssistWorker singleton/lock state:

  Payload transforms (Laravel payload field <-> engine/gateway field):
    _size_to_aspect   'WxH' pixel size -> image-gateway 'W:H' aspect ratio.
    _speed_to_rate    speed factor (1.0) -> edge-style signed percentage.
    _looks_like_mp3   cheap MP3 magic-byte sniff for the TTS contract.

  Worker-id / time helpers:
    _build_claimer        stable claimer id (hostname + machine-id prefix, <=56).
    _now_iso              UTC ISO-8601 timestamp for last_cycle_at.
    _blank_cycle_result   fresh per-cycle / per-track accumulator dict.
"""

import math
import re
import socket
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from pycore.pyutils.security.machine_id import get_machine_id


# ============================================================
# Payload transforms
# ============================================================

# Gateway aspect-ratio shape (pyctl.ai.ai_gateway._ASPECT_RATIO_RE): "W:H" <=99.
_ASPECT_RE = re.compile(r"^\d{1,2}:\d{1,2}$")
_PIXEL_SIZE_RE = re.compile(r"^(\d{2,5})\s*[xX×]\s*(\d{2,5})$")
# A poster title still "looks raw" (a filename, not a clean title) when it
# carries a SxxExx / 1x02 season-episode marker - only then do we re-parse it.
_SXXEXX_LOOKS_RAW_RE = re.compile(
    r"\b(?:s\d{1,2}\s?e\d{1,3}|\d{1,2}x\d{1,3})\b", re.IGNORECASE)
# Ratios the image providers actually understand, used when an exact gcd
# reduction does not fit the gateway's 2-digit "W:H" shape.
_COMMON_RATIOS: Tuple[Tuple[int, int], ...] = (
    (1, 1), (16, 9), (9, 16), (4, 3), (3, 4), (3, 2), (2, 3), (21, 9),
)


def _size_to_aspect(size: Any) -> Optional[str]:
    """
    Map the Laravel payload's ``size`` ('WxH', e.g. '1024x1024') to the image
    gateway's aspect-ratio form ('1:1'). Already-ratio values pass through;
    unparseable values return None (provider default applies).
    """
    if not size:
        return None
    s = str(size).strip()
    if _ASPECT_RE.match(s):
        return s
    m = _PIXEL_SIZE_RE.match(s)
    if not m:
        return None
    w, h = int(m.group(1)), int(m.group(2))
    if w <= 0 or h <= 0:
        return None
    g = math.gcd(w, h)
    aw, ah = w // g, h // g
    if aw <= 99 and ah <= 99:
        return f"{aw}:{ah}"
    ratio = w / h
    best = min(_COMMON_RATIOS, key=lambda t: abs(t[0] / t[1] - ratio))
    return f"{best[0]}:{best[1]}"


def _speed_to_rate(speed: Any) -> Optional[str]:
    """
    Map the Laravel payload's ``speed`` (a factor like 1.0 / 0.8, or an
    already-formed '-20%') to the orchestrator's edge-style signed percentage.
    None/1.0/junk -> None (engine default).
    """
    if speed in (None, ""):
        return None
    if isinstance(speed, str) and speed.strip().endswith("%"):
        return speed.strip()
    try:
        factor = float(speed)
    except (TypeError, ValueError):
        return None
    if factor <= 0:
        return None
    pct = int(round((factor - 1.0) * 100))
    if pct == 0:
        return None
    return f"{pct:+d}%"


def _looks_like_mp3(data: bytes) -> bool:
    """Cheap MP3 sniff: ID3 container header or a raw MPEG frame-sync."""
    if not data or len(data) < 4:
        return False
    if data[:3] == b"ID3":
        return True
    return data[0] == 0xFF and (data[1] & 0xE0) == 0xE0


# ============================================================
# Worker-id / time helpers
# ============================================================

def _build_claimer() -> str:
    """
    Stable claimer id: 'pycore-' + hostname + machine-id prefix, sanitized and
    <= 56 chars (the Laravel contract's claimer cap). The machine id comes from
    the existing pyutils.security.machine_id helper (registry MachineGuid /
    /etc/machine-id backed), so the id survives restarts on the same box.
    """
    host = socket.gethostname() or "host"
    safe_host = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
    mid = get_machine_id()[:12]
    return f"pycore-{safe_host[:36]}-{mid}"  # 7 + <=36 + 1 + 12 <= 56


def _now_iso() -> str:
    """UTC timestamp for last_cycle_at (second precision, ISO-8601)."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _blank_cycle_result() -> Dict[str, Any]:
    """Fresh accumulator for a cycle (and for each parallel per-type track)."""
    return {"ok": True, "processed": 0, "submitted": 0, "released": 0, "errors": []}
