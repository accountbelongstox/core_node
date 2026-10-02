# -*- coding: utf-8 -*-
"""HTTP routes of the automatic gitsync watch (state, pause, intervals, run now)."""
from pycore.callmodule.rpc_routes.route_names import UI_GITSYNC_CONTROL, UI_GITSYNC_STATE
from pycore.pyctl.gitsync.gitsync_watch_service import gitsync_watch_service
from pycore.pyctl.terminal.terminal_rpc import bool_param, integer_param


def _optional_bool(params, key: str):
    return None if params.get(key) in (None, "") else bool_param(params, key)


def _optional_int(params, key: str):
    return None if params.get(key) in (None, "") else integer_param(params, key)


def register_gitsync_routes(server) -> None:
    def state_handler(_params, _request_id, _context):
        return gitsync_watch_service.state()

    def control_handler(params, _request_id, _context):
        return gitsync_watch_service.control(
            paused=_optional_bool(params, "paused"),
            interval_minutes=_optional_int(params, "interval_minutes"),
            reminder_seconds=_optional_int(params, "reminder_seconds"),
            run_now=bool_param(params, "run_now"),
        )

    server.post(path=UI_GITSYNC_STATE, handler=state_handler)
    server.post(path=UI_GITSYNC_CONTROL, handler=control_handler)
