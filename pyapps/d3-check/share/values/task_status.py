# -*- coding: utf-8 -*-
"""
Task status enum (shared data). Used by task thread manager and UI; thread-safe usage is in the manager (queue + snapshot), not in this module.
See PROJECT_STANDARDS.md §1.3 data area.
"""
from enum import Enum


class TaskStatus(Enum):
    """Task execution status (state only; not a thread)."""
    DISABLED = "disabled"
    ENABLED = "enabled"
    RUNNING = "running"
    ERROR = "error"
