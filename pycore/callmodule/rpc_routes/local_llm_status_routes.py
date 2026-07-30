# -*- coding: utf-8 -*-
"""HTTP Routes for llm_status."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_LLM_STATUS_GET_SETTINGS,
    UI_LLM_STATUS_POST_SERVER_ACTION,
    UI_LLM_STATUS_POST_SETTINGS,
    UI_LLM_STATUS_STATUS,
    UI_LLM_STATUS_TEST,
)
import pycore.pyutils.llm.status_service as llm


def register_local_llm_status_routes(server):
    server.post(name=UI_LLM_STATUS_STATUS, handler=llm.status)
    server.post(name=UI_LLM_STATUS_TEST, handler=llm.test)
    server.post(name=UI_LLM_STATUS_GET_SETTINGS, handler=llm.get_settings)
    server.post(name=UI_LLM_STATUS_POST_SETTINGS, handler=llm.post_settings)
    server.post(name=UI_LLM_STATUS_POST_SERVER_ACTION, handler=llm.post_server_action)

