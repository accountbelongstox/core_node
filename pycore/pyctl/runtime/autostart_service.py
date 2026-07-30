# -*- coding: utf-8 -*-
"""Application service for desktop autostart settings."""

from typing import Any, Dict, Optional

from pycore.pylauncher.platform.autostart_target import VALID_MECHANISMS, VALID_TARGETS
from pycore.pylauncher.platform.startup_manager import get_startup_manager


def get_status() -> Dict[str, Any]:
    status = get_startup_manager().get_status()
    status.setdefault("targets", list(VALID_TARGETS))
    status.setdefault("mechanisms", list(VALID_MECHANISMS))
    return {"success": True, **status}


def set_enabled(
    enabled: bool,
    target: Optional[str] = None,
    mechanism: Optional[str] = None,
) -> Dict[str, Any]:
    manager = get_startup_manager(target=target, mechanism=mechanism)
    return manager.enable() if enabled else manager.disable()
