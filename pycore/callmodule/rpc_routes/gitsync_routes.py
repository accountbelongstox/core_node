# -*- coding: utf-8 -*-
"""HTTP routes of the automatic gitsync pipeline: UI state (revision-gated), pause, intervals,
run now, run history, and the LAN peer turn claim/release."""
from pycore.callmodule.rpc_routes.route_names import (
    PEER_GITSYNC_CLAIM,
    PEER_GITSYNC_RELEASE,
    UI_GITSYNC_CONTROL,
    UI_GITSYNC_HISTORY,
    UI_GITSYNC_STATE,
)
from pycore.pyctl.gitsync.gitsync_watch_service import gitsync_watch_service
from pycore.pyctl.terminal.terminal_rpc import bool_param, integer_param


def _optional_bool(params, key: str):
    return None if params.get(key) in (None, "") else bool_param(params, key)


def _optional_int(params, key: str):
    return None if params.get(key) in (None, "") else integer_param(params, key)


def _peer_identity(params):
    return str(params.get("machine") or ""), str(params.get("hostname") or "")


def register_gitsync_routes(server) -> None:
    def state_handler(params, _request_id, _context):
        return gitsync_watch_service.state(known_revision=_optional_int(params, "known_revision"))

    def control_handler(params, _request_id, _context):
        return gitsync_watch_service.control(
            paused=_optional_bool(params, "paused"),
            interval_minutes=_optional_int(params, "interval_minutes"),
            reminder_seconds=_optional_int(params, "reminder_seconds"),
            run_now=bool_param(params, "run_now"),
        )

    def history_handler(params, _request_id, _context):
        return gitsync_watch_service.history(
            offset=integer_param(params, "offset"),
            limit=integer_param(params, "limit"),
        )

    def peer_claim_handler(params, _request_id, _context):
        machine, hostname = _peer_identity(params)
        if not machine:
            return {"success": False, "granted": False, "error_code": "machine_required"}
        return gitsync_watch_service.peer_claim(machine, hostname, float(params.get("ticket") or 0))

    def peer_release_handler(params, _request_id, _context):
        machine, hostname = _peer_identity(params)
        summary = params.get("summary")
        if not machine:
            return {"success": False, "error_code": "machine_required"}
        return gitsync_watch_service.peer_release(machine, hostname, summary if isinstance(summary, dict) else {})

    server.post(path=UI_GITSYNC_STATE, handler=state_handler)
    server.post(path=UI_GITSYNC_HISTORY, handler=history_handler)
    server.post(path=UI_GITSYNC_CONTROL, handler=control_handler)
    server.post(path=PEER_GITSYNC_CLAIM, handler=peer_claim_handler)
    server.post(path=PEER_GITSYNC_RELEASE, handler=peer_release_handler)
