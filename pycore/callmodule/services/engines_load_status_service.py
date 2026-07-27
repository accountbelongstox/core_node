# -*- coding: utf-8 -*-
"""Engine model-load progress snapshot."""

from typing import Any, Dict

from pycore.pyutils.common import model_load_status
from pycore.pyutils.common.managed_service import managed_services


def get_load_status() -> Dict[str, Any]:
    engines = model_load_status.snapshot()
    for name, entry in engines.items():
        if entry.get("state") == "loading":
            tail = managed_services.read_log_tail(name)
            if tail:
                entry["log_tail"] = tail
    return {"success": True, "engines": engines}
