# -*- coding: utf-8 -*-
"""Shared Terminal activity-log instance."""

from pycore.pyutils.common.activity_log import ActivityLog


terminal_activity_log = ActivityLog("Terminal")


__all__ = ["terminal_activity_log"]
