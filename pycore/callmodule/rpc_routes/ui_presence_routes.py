# -*- coding: utf-8 -*-
"""Register the generic UI presence lease controller on HTTP API.

Clients without an open event socket (SSE fallback, Relay) hold a named
presence lease here; socket clients hold the same lease over the socket.
"""

from pycore.callmodule.rpc_routes.route_names import UI_PRESENCE_LEASE
from pycore.pyfoundations.network_constants import (
    UI_PRESENCE_LEASE_SECONDS,
    UI_PRESENCE_RENEW_SECONDS,
    WS_NAME_MAX_CHARS,
)
from pycore.pyutils.rpc_v2.ui_presence import ui_presence

UI_PRESENCE_ERROR_NAME_REQUIRED = "presence_name_required"


def register_ui_presence_routes(server):
    """Register ui/presence/lease: renew (held=true) or end (held=false)."""

    def presence_lease(params, _request_id, _context):
        name = str(params.get("name") or "").strip()[:WS_NAME_MAX_CHARS]
        if not name:
            return {"success": False, "error": UI_PRESENCE_ERROR_NAME_REQUIRED}
        held = params.get("held") is not False
        if held:
            ui_presence.renew(name, UI_PRESENCE_LEASE_SECONDS)
        else:
            ui_presence.expire(name)
        return {
            "success": True,
            "data": {
                "name": name,
                "held": held,
                "present": ui_presence.is_present(name),
                "renew_after": UI_PRESENCE_RENEW_SECONDS,
            },
        }

    server.post(
        path=UI_PRESENCE_LEASE,
        handler=presence_lease,
        description="Renew or end a named UI presence lease",
    )
