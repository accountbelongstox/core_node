# -*- coding: utf-8 -*-
"""Extract installed local AI-agent sessions to the shared text store."""

from .agent_history_service import AgentHistoryService, get_agent_history_service

__all__ = ["AgentHistoryService", "get_agent_history_service"]
