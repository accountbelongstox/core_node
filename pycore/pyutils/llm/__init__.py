"""
Local LLM utility package (OpenAI-compatible local servers).

  - chat        : multi-engine orchestrator. Default priority:
                  ollama -> lmstudio -> llamacpp (override via env
                  LLM_ENGINE_PRIORITY). Auto-starts ollama when the managed
                  llm category allows; falls through to the next engine on
                  failure; success=False means "use a cloud provider".
  - llm_status  : engine-availability snapshot for the UI (same panel shape
                  as tts_status).
"""

from . import llm_orchestrator
from .llm_orchestrator import (
    best_engine,
    chat,
    engine_available,
    llm_status,
)

__all__ = [
    "best_engine",
    "chat",
    "engine_available",
    "llm_status",
    "llm_orchestrator",
]
