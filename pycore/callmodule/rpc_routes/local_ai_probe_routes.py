# -*- coding: utf-8 -*-
"""RPC Routes for ai_probe."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_PROBE_AI_CATALOG,
    UI_AI_PROBE_PROBE,
    UI_AI_PROBE_BALANCE,
    UI_AI_PROBE_RATE_LIMITS,
    UI_AI_PROBE_USAGE,
)
import pycore.pyctl.ai.probe_service as probe
from pycore.pyctl.ai.ai_probe import catalog
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyctl.ai.ai_usage_log import usage_log


def register_local_ai_probe_routes(server):
    server.route(name=UI_AI_PROBE_AI_CATALOG, handler=catalog)

    def probe_handler(params, request_id, context):
        params = params or {}
        return probe.probe(
            int(params.get("refresh") or 0),
            params.get("provider"),
        )

    server.route(name=UI_AI_PROBE_PROBE, handler=probe_handler)

    def balance_handler(params, request_id, context):
        params = params or {}
        return probe.balance(params.get("provider"))

    server.route(name=UI_AI_PROBE_BALANCE, handler=balance_handler)

    def rate_limits_handler(params, request_id, context):
        return rate_status((params or {}).get("provider"))

    def usage_handler(params, request_id, context):
        request = params or {}
        return usage_log(int(request.get("limit") or 100), request.get("kind"))

    server.route(name=UI_AI_PROBE_RATE_LIMITS, handler=rate_limits_handler)
    server.route(name=UI_AI_PROBE_USAGE, handler=usage_handler)
    ColorPrint.green("[ConfigBuilder] Registered ai_probe RPC routes")

