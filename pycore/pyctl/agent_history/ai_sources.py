# -*- coding: utf-8 -*-
"""AI usage-log source ids recorded by agent-history features.

Single definition shared by the callers (``source=`` of every free-tier call)
and the UI dashboard (``ai_dashboard.sources`` scopes the OpenRouter request
attempts list), so no surface keeps its own string literals.
"""

AI_SOURCE_ARTICLE = "agent_history_article"
AI_SOURCE_TRANSLATE = "agent_history_translate"
AI_SOURCE_PROMPT_REWRITE = "agent_history_prompt_rewrite"
AI_SOURCE_PROMPT_DERIVE = "agent_history_prompt_derive"

# Sources listed in the agent-history "OpenRouter request attempts" panel.
OPENROUTER_ATTEMPT_SOURCES = (
    AI_SOURCE_ARTICLE,
    AI_SOURCE_TRANSLATE,
    AI_SOURCE_PROMPT_REWRITE,
)

__all__ = [
    "AI_SOURCE_ARTICLE",
    "AI_SOURCE_TRANSLATE",
    "AI_SOURCE_PROMPT_REWRITE",
    "AI_SOURCE_PROMPT_DERIVE",
    "OPENROUTER_ATTEMPT_SOURCES",
]
