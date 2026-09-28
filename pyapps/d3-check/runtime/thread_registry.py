# -*- coding: utf-8 -*-
"""
Re-export from lifecycle. Runtime must not reference threads; only lifecycle does.
"""

from lifecycle.thread_registry import ThreadRegistry, get_thread_registry

__all__ = ["ThreadRegistry", "get_thread_registry"]
