# -*- coding: utf-8 -*-
"""
Shared TTS worker concurrency recommendation and clamping.

Maps an engine's concurrency class from the canonical TTS adapter registry to a
hardware-derived recommended worker fan-out, and resolves the EFFECTIVE
concurrency from an optional user override:

    serial     -> always 1 (edge: process-wide synth lock, never parallel)
    cloud      -> 4 (class-A cloud APIs; own rate limits)
    in_process -> min(4, max(2, cpu_count // 2)) (class-B local models)
    server     -> 3 with CUDA, else 2 (class-C HTTP servers)

The effective value is clamp(user or recommended, 1, 8); serial is forced to 1
regardless of the user value.
"""

import os
from typing import Optional

from pycore.pyfoundations.pybasecommon.compute_caps import is_cuda_available

# Hard bounds for any effective fan-out.
_MIN_CONCURRENCY = 1
_MAX_CONCURRENCY = 8


def recommended_concurrency(engine_concurrency: str) -> int:
    """Hardware-derived recommended fan-out for one engine concurrency class."""
    kind = (engine_concurrency or "").strip().lower()
    if kind == "cloud":
        return 4
    if kind == "in_process":
        return min(4, max(2, (os.cpu_count() or 4) // 2))
    if kind == "server":
        return 3 if is_cuda_available() else 2
    # serial and unknown classes: never parallel.
    return 1


def effective_concurrency(engine_concurrency: str, user_value: Optional[int]) -> int:
    """Effective fan-out: serial forced 1, else clamp(user or recommended, 1, 8).

    ``user_value`` 0 / None / unparseable means "use the recommended value"."""
    kind = (engine_concurrency or "").strip().lower()
    if kind == "serial":
        return 1
    try:
        user = int(user_value or 0)
    except (TypeError, ValueError):
        user = 0
    value = user if user > 0 else recommended_concurrency(kind)
    return max(_MIN_CONCURRENCY, min(_MAX_CONCURRENCY, value))


__all__ = ["recommended_concurrency", "effective_concurrency"]
