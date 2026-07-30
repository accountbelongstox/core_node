# -*- coding: utf-8 -*-
"""RPC Routes for llm_status."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_LLM_STATUS_GET_SETTINGS,
    UI_LLM_STATUS_POST_SERVER_ACTION,
    UI_LLM_STATUS_POST_SETTINGS,
    UI_LLM_STATUS_STATUS,
    UI_LLM_STATUS_TEST,
)
import pycore.pyutils.llm.status_service as llm


def register_local_llm_status_routes(server):
    server.route(name=UI_LLM_STATUS_STATUS, handler=llm.status)
    server.route(name=UI_LLM_STATUS_TEST, handler=llm.test)
    server.route(name=UI_LLM_STATUS_GET_SETTINGS, handler=llm.get_settings)
    server.route(name=UI_LLM_STATUS_POST_SETTINGS, handler=llm.post_settings)
    server.route(name=UI_LLM_STATUS_POST_SERVER_ACTION, handler=llm.post_server_action)
    ColorPrint.green("[ConfigBuilder] Registered llm_status RPC routes")

