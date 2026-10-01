# -*- coding: utf-8 -*-
"""
Local Processing Service - holds the local processing configuration
"""

from typing import Any, Dict

from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyctl.management.local_processing_models import LocalProcessingConfig


class LocalProcessingService:
    """Owns the current local processing configuration."""

    def __init__(self):
        self._config = SerializedValue(LocalProcessingConfig(), "LocalProcessingConfigStateThread")

    def update_config(self, config: LocalProcessingConfig) -> Dict[str, Any]:
        self._config.set(config)
        return {
            "success": True,
            "config": config,
        }


local_processing_service = LocalProcessingService()


__all__ = ["LocalProcessingService", "local_processing_service"]
