# -*- coding: utf-8 -*-
"""
BN-only flow: only state owned by this flow (tick-level steps + last BN result).
BN block state (B1..B16) lives in flow_bn_block_state; Flow-master never imports this module.
"""
from enum import Enum
from typing import Optional


class BnOnlyTickStep(str, Enum):
    """Steps within one BN-only tick: REFRESH_NOTIFY -> RE_READ_ABORT -> RUN_BN_TICK -> HANDLE_BN_RESULT."""
    REFRESH_NOTIFY = "refresh_notify"
    RE_READ_ABORT = "re_read_abort"
    RUN_BN_TICK = "run_bn_tick"
    HANDLE_BN_RESULT = "handle_bn_result"


class BnOnlyBlockResult(str, Enum):
    """Result of tick_battlenet_ready_flow (for BN-only flow use)."""
    CONFIRMED = "confirmed"
    EXIT = "exit"
    WAIT = "wait"
    UNKNOWN = "unknown"


_last_bn_done: bool = False
_last_bn_result: Optional[str] = None


def get_last_bn_result() -> tuple[bool, Optional[str]]:
    return _last_bn_done, _last_bn_result


def set_last_bn_result(done: bool, result: Optional[str]) -> None:
    global _last_bn_done, _last_bn_result
    _last_bn_done = done
    _last_bn_result = result


def reset_bn_only_flow_state() -> None:
    """Reset only BN-only flow state (last BN result). Block state is in flow_bn_block_state."""
    global _last_bn_done, _last_bn_result
    _last_bn_done = False
    _last_bn_result = None
