# -*- coding: utf-8 -*-
"""Shared Relay activity-log instance."""

from __future__ import annotations

from pycore.pyutils.common.activity_log import ActivityLog


relay_activity_log = ActivityLog("Relay")


__all__ = ["relay_activity_log"]
