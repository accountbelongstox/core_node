# -*- coding: utf-8 -*-
"""Self-restart of the running pycore on request from this machine or the private LAN (no key).

Uses the tray's restart path (THREAD_BUS.request_restart -> shutdown stack ->
os.execv), so the systemd unit / Windows service keeps its process. The restart
starts after RESTART_DELAY_SECONDS so the HTTP response reaches the caller.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyctl.runtime.version_service import PROCESS_STARTED_AT
from pycore.pyutils.common.local_rpc_guard import is_loopback_peer, is_private_lan_peer

LABEL = "SelfRestart"
RESTART_DELAY_SECONDS = 0.5
TRANSPORT_HTTP = "http"
ERROR_LAN_ONLY = "restart_lan_only"
ERROR_ALREADY_STOPPING = "restart_already_in_progress"


def _restart_after_delay(peer: str) -> None:
    time.sleep(RESTART_DELAY_SECONDS)
    THREAD_BUS.request_restart(reason=f"Self-restart requested from {peer}", execute_handlers=True)


def request_self_restart(context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Restart when the caller is a direct HTTP peer on loopback or the private LAN; others get restart_lan_only."""
    request_context = context or {}
    peer = str(request_context.get("remote_addr") or "")
    if request_context.get("transport") != TRANSPORT_HTTP or not (is_loopback_peer(peer) or is_private_lan_peer(peer)):
        ColorPrint.yellow(f"[{LABEL}] refused: caller {peer or '-'} is not on loopback or the private LAN")
        return {"success": False, "error_code": ERROR_LAN_ONLY}
    if THREAD_BUS.is_shutdown_requested():
        return {"success": False, "error_code": ERROR_ALREADY_STOPPING}
    ColorPrint.yellow(f"[{LABEL}] restart requested from {peer}; restarting in {RESTART_DELAY_SECONDS}s")
    start_bus_task(_restart_after_delay, peer, thread_name="PycoreSelfRestartThread")
    return {
        "success": True,
        "restarting": True,
        "delay_seconds": RESTART_DELAY_SECONDS,
        "process_started_at": PROCESS_STARTED_AT,
    }


__all__ = ["request_self_restart"]
