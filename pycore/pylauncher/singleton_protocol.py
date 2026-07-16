#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Singleton Protocol & Data Layer

Pure, dependency-light definitions shared by the singleton detector and the
PRIMARY-side TCP server. This module has no runtime singleton state of its
own and imports nothing from pylauncher, so it sits at the bottom of the
dependency graph and is safe to import from either sibling.

Contents:
- ProtocolVersion   - protocol version identifier
- MessageType       - message-type enum for cross-process singleton comms
- DetectionResult   - dataclass result of singleton detection
- _process_start_time() - this process's creation time (instance-ordering key)
"""

import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from pycore.pyfoundations.third_party import get_third_package_psutil


# Fallback "process start" stamp when psutil is unavailable: module import time
# (later than the true process start, but preserves ordering between instances
# whose load times are similar).
_IMPORT_TIME = time.time()


def _process_start_time() -> float:
    """This process's creation time (epoch seconds), used for instance ordering."""
    try:
        psutil = get_third_package_psutil()
        return float(psutil.Process().create_time())
    except Exception:
        return _IMPORT_TIME


# ============================================================
# Protocol Definition
# ============================================================

class ProtocolVersion:
    """Protocol version identifier"""
    CURRENT = "PYCORE_SINGLETON_V1"


class MessageType(Enum):
    """Message types for singleton communication"""
    CHECK = "CHECK"              # Check if instance exists
    ALIVE = "ALIVE"              # Instance alive response
    SHUTDOWN = "SHUTDOWN"        # Request shutdown
    SHUTDOWN_ACK = "SHUTDOWN_ACK"  # Shutdown acknowledged
    STATUS = "STATUS"            # Request status
    STATUS_RESPONSE = "STATUS_RESPONSE"  # Status response
    PING = "PING"                # Keep-alive ping
    PONG = "PONG"                # Ping response


# ============================================================
# Detection Result
# ============================================================

@dataclass
class DetectionResult:
    """Result of singleton detection"""
    is_primary: bool              # True if this is PRIMARY instance
    port: int                     # Bound port number
    existing_instance: bool       # True if found existing instance
    existing_port: Optional[int]  # Port of existing instance (if found)
    message: str                  # Human-readable message
    # True when this (older) process deliberately yielded to a PRIMARY that was
    # started MORE RECENTLY than itself (takeover ordering: newest instance wins).
    yielded_to_newer: bool = False


__all__ = [
    'ProtocolVersion',
    'MessageType',
    'DetectionResult',
    '_process_start_time',
]
