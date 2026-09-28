# -*- coding: utf-8 -*-
"""Compatibility exports for the canonical primary device-sync server."""

from pycore.pyutils.launcher.device_sync.server.primary import (
    PrimaryServerHandler,
    SimplePrimaryServer,
)


__all__ = ["PrimaryServerHandler", "SimplePrimaryServer"]
