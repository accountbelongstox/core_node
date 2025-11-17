#!/usr/bin/env python3
"""
Example app database models
Demonstrates app-specific table implementations
"""

from pycore.database.models.app_example.user_model import ExampleUserModel
from pycore.database.models.app_example.task_model import ExampleTaskModel

__all__ = [
    'ExampleUserModel',
    'ExampleTaskModel',
]
