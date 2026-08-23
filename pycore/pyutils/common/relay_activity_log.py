# -*- coding: utf-8 -*-
"""Shared Relay V2 activity-log instance."""

from __future__ import annotations

from pycore.pyutils.common.activity_log import ActivityLog


relay_activity_log = ActivityLog("RelayV2")


__all__ = ["relay_activity_log"]
