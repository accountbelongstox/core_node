#!/usr/bin/env python3
"""
Common database models
Shared across all apps and utilities
"""

from pycore.database.models.common.config_model import CommonConfigModel
from pycore.database.models.common.log_model import CommonLogModel

__all__ = [
    'CommonConfigModel',
    'CommonLogModel',
]
