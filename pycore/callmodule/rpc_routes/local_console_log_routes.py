# -*- coding: utf-8 -*-
"""HTTP Routes for the console log journal (relay-exposed via the /history suffix policy)."""


from pycore.callmodule.rpc_routes.route_names import UI_CONSOLE_LOG_HISTORY
from pycore.pyfoundations.console_log_journal import console_log_journal


def register_local_console_log_routes(server):
    def history_handler(params, request_id, context):
        return console_log_journal.history(
            int(params.get("since_seq") or 0),
            int(params.get("limit") or 0),
        )

    server.post(path=UI_CONSOLE_LOG_HISTORY, handler=history_handler)
