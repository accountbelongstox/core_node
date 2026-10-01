# -*- coding: utf-8 -*-
import time
from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso(z_suffix: bool = False) -> str:
    stamp = utc_now().isoformat()
    if z_suffix:
        return stamp.replace("+00:00", "Z")
    return stamp


def utc_now_ms() -> int:
    return int(time.time() * 1000)


__all__ = ["utc_now", "utc_now_iso", "utc_now_ms"]
