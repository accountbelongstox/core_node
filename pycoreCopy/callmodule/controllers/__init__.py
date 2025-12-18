# -*- coding: utf-8 -*-
"""
Controllers - Handle request/response logic
"""

# Management controllers (NEW)
from .management import (
    SystemController,
    LocalProcessingController,
    LogsController,
)

# Legacy controllers
from .module_call_controller import ModuleCallController

__all__ = [
    # Management controllers
    'SystemController',
    'LocalProcessingController',
    'LogsController',
    # Legacy controllers
    'ModuleCallController',
]
