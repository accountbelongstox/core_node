# -*- coding: utf-8 -*-
"""
System Service - holds the system configuration
"""

from typing import Any, Dict

from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyctl.management.system_models import SystemConfig


class SystemService:
    """Owns the current system configuration."""

    def __init__(self):
        self._config = SerializedValue(None, "SystemConfigStateThread")

    def update_system_config(self, config: SystemConfig) -> Dict[str, Any]:
        self._config.set(config)
        return {
            "success": True,
            "config": config,
        }


system_service = SystemService()


__all__ = ["SystemService", "system_service"]
