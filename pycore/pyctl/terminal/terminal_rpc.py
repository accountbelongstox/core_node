# -*- coding: utf-8 -*-
"""Terminal RPC parameter binding and action logging shared by the routes."""

import re
from typing import Any, Callable, Dict

from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log

UNSIGNED_INTEGER_PATTERN = re.compile(r"^\d+$")
NORMALIZED_RATIO_PATTERN = re.compile(r"^(?:0(?:\.\d+)?|1(?:\.0+)?)$")
TRUE_PARAM_VALUES = frozenset({"1", "true", "yes", "on"})


def integer_param(params, key: str) -> int:
    value = str(params.get(key) or "")
    return int(value) if UNSIGNED_INTEGER_PATTERN.fullmatch(value) else 0


def bool_param(params, key: str) -> bool:
    return str(params.get(key) or "").strip().lower() in TRUE_PARAM_VALUES


def ratio_param(params, key: str) -> float:
    value = str(params.get(key) or "")
    return float(value) if NORMALIZED_RATIO_PATTERN.fullmatch(value) else -1.0


def string_list_param(params, key: str):
    value = params.get(key)
    if not isinstance(value, (list, tuple, set)):
        return []
    return sorted({str(item) for item in value if str(item)})


def run_terminal_action(
    action: str,
    request_id: str,
    callback: Callable[[], Any],
    log_result: bool = True,
    quiet: bool = False,
) -> Any:
    (terminal_activity_log.debug if quiet else terminal_activity_log.info)(
        "rpc.started",
        terminal_action=action,
        request_id=request_id,
    )
    try:
        result = callback()
    except Exception as error:
        terminal_activity_log.error(
            "rpc.failed",
            terminal_action=action,
            request_id=request_id,
            error_type=type(error).__name__,
            error=error,
        )
        raise
    success = not isinstance(result, dict) or bool(result.get("success", True))
    success_method = (
        terminal_activity_log.debug if quiet else terminal_activity_log.success
    )
    log_method = success_method if success else terminal_activity_log.warning
    payload: Dict[str, Any] = {
        "terminal_action": action,
        "request_id": request_id,
        "success": success,
    }
    if log_result:
        payload["result"] = result
    elif not success:
        payload["error_code"] = result.get("error_code")
    log_method("rpc.completed", **payload)
    return result


__all__ = ["bool_param", "integer_param", "ratio_param", "run_terminal_action", "string_list_param"]
