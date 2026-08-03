# -*- coding: utf-8 -*-
"""Register Agent History controllers on HTTP API."""

from pycore.callmodule.rpc_routes import route_names
import pycore.pyctl.agent_history.ui_service as agent_history_ui_service
from pycore.pyctl.agent_history.pipeline.worker import recover_nonterminal_operations


def register_local_agent_history_routes(server) -> None:
    """Register thin Agent History controller adapters."""
    recover_nonterminal_operations()
    routes = (
        (route_names.UI_AGENT_HISTORY_INDEX, agent_history_ui_service.index),
        (route_names.UI_AGENT_HISTORY_PROMPTS, agent_history_ui_service.prompts),
        (route_names.UI_AGENT_HISTORY_SESSION_DETAIL, agent_history_ui_service.session_detail),
        (route_names.UI_AGENT_HISTORY_SESSION_ID_PAGES, agent_history_ui_service.session_id_pages),
        (route_names.UI_AGENT_HISTORY_SESSION_PAGE, agent_history_ui_service.session_page),
        (route_names.UI_AGENT_HISTORY_PROMPT_ID_PAGES, agent_history_ui_service.prompt_id_pages),
        (route_names.UI_AGENT_HISTORY_PROMPT_PAGE, agent_history_ui_service.prompt_page),
        (route_names.UI_AGENT_HISTORY_REFRESH, agent_history_ui_service.refresh),
        (route_names.UI_AGENT_HISTORY_UPDATE_PROMPT, agent_history_ui_service.update_prompt),
        (route_names.UI_AGENT_HISTORY_STATUS, agent_history_ui_service.status),
        (route_names.UI_AGENT_HISTORY_RUNTIME_GET, agent_history_ui_service.runtime_get),
        (route_names.UI_AGENT_HISTORY_ARTICLE_CONFIG_POST, agent_history_ui_service.article_config_post),
        (route_names.UI_AGENT_HISTORY_ARTICLE_START, agent_history_ui_service.article_start),
        (route_names.UI_AGENT_HISTORY_ARTICLE_LIST, agent_history_ui_service.article_list),
        (route_names.UI_AGENT_HISTORY_ARTICLE_LOGS, agent_history_ui_service.article_logs),
        (route_names.UI_AGENT_HISTORY_ARTICLE_RECORDS, agent_history_ui_service.article_records),
        (route_names.UI_AGENT_HISTORY_ARTICLE_RECORD_ID_PAGES, agent_history_ui_service.article_record_id_pages),
        (route_names.UI_AGENT_HISTORY_ARTICLE_RECORD_PAGE, agent_history_ui_service.article_record_page),
        (route_names.UI_AGENT_HISTORY_TEST_EXTRACT, agent_history_ui_service.test_extract),
    )
    server.register_routes(routes, group="agent_history")
