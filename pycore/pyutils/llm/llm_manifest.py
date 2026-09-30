# -*- coding: utf-8 -*-
"""Local LLM engine declarations: the ONE place LLM engine facts live.

Declaration order is the default engine priority.
"""

from pycore.pyutils.common.model_manifest import (
    CATEGORY_LLM,
    RUNTIME_SERVER,
    ModelEntry,
    model_manifest,
)

LLM_ENTRIES = (
    ModelEntry(
        "ollama", CATEGORY_LLM, RUNTIME_SERVER,
        note="Ollama local server (managed: auto-start via `ollama serve`)",
        managed_kind="server", concurrency="server",
    ),
    ModelEntry(
        "lmstudio", CATEGORY_LLM, RUNTIME_SERVER,
        note="LM Studio local server (external - start it in LM Studio)",
        managed_kind="server", concurrency="server", external=True,
    ),
    ModelEntry(
        "llamacpp", CATEGORY_LLM, RUNTIME_SERVER,
        note="llama.cpp server (external - start llama-server yourself)",
        managed_kind="server", concurrency="server", external=True,
    ),
)

model_manifest.register(LLM_ENTRIES)
