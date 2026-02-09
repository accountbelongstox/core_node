# -*- coding: utf-8 -*-
"""
[F3] ROSBOT log timeout? (ROSBOT_FLOW_MERMAID.md F block).
Uses UI-configured timeout; not timeout -> stay F3, timeout -> F4.
Returns "f3_stay" (not timeout) or "f4" (timeout, go to F4).
"""
import time
from typing import Literal

from providor.constants.d3 import ROSBOT_LOG_TIMEOUT_SECONDS_DEFAULT
from providor.providor_index import CONFIG
from d3utils.log_monitor import get_last_log_modified_time


def run_f3_log_timeout() -> Literal["f3_stay", "f4"]:
    """[F3] ROSBOT log timeout? Not timeout -> stay F3, timeout -> F4."""
    timeout_sec = CONFIG.get("ros_settings", {}).get(
        "rosbot_log_timeout_seconds", ROSBOT_LOG_TIMEOUT_SECONDS_DEFAULT
    )
    last_ts = get_last_log_modified_time()
    if last_ts <= 0:
        return "f4"
    if (time.time() - last_ts) >= timeout_sec:
        return "f4"
    return "f3_stay"
