# -*- coding: utf-8 -*-
from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Iterator

from pycore.pyutils.common.activity_log import ActivityLog
from pycore.pyutils.common.session_dbus import DBusReply, call_session_method


FCITX5_BUS_NAME = "org.fcitx.Fcitx5"
FCITX5_CONTROLLER_PATH = "/controller"
FCITX5_CONTROLLER_INTERFACE = "org.fcitx.Fcitx.Controller1"
FCITX5_STATE_ACTIVE = 2
FCITX5_CALL_TIMEOUT_SECONDS = 1.0
# XIM forwards key events to the input method asynchronously; re-activating
# before they drain would let the engine compose the synthesized keys again.
INPUT_METHOD_SETTLE_SECONDS = 0.15
input_method_activity_log = ActivityLog("InputMethod")


def _fcitx5_call(method: str) -> DBusReply:
    return call_session_method(
        FCITX5_BUS_NAME,
        FCITX5_CONTROLLER_PATH,
        FCITX5_CONTROLLER_INTERFACE,
        method,
        timeout=FCITX5_CALL_TIMEOUT_SECONDS,
    )


@contextmanager
def input_method_bypassed() -> Iterator[None]:
    """Suspend an active fcitx5 engine on the focused window while synthesized keys are sent.

    An active engine (pinyin, wubi, ...) turns a synthesized Return or Shift
    into a raw-text commit of its preedit instead of a key press.
    """
    deactivated = (
        int(_fcitx5_call("State").value(0, 0)) == FCITX5_STATE_ACTIVE
        and _fcitx5_call("Deactivate").success
    )
    if deactivated:
        input_method_activity_log.info("fcitx5.suspended")
    try:
        yield
    finally:
        if deactivated:
            time.sleep(INPUT_METHOD_SETTLE_SECONDS)
            if not _fcitx5_call("Activate").success:
                input_method_activity_log.warning("fcitx5.restore_failed")


__all__ = ["input_method_bypassed"]
