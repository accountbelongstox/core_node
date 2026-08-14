# -*- coding: utf-8 -*-
"""
Local LLM engine definitions: priority chain, health/installed probes, and the
raw OpenAI-compatible chat HTTP call (stdlib urllib only — no dependencies).

Priority (highest first), overridable via env ``LLM_ENGINE_PRIORITY``
(e.g. ``lmstudio->ollama``):
    1. ollama   — managed server (auto-start via ``ollama serve``).
    2. lmstudio — LM Studio local server (external: start it yourself).
    3. llamacpp — llama.cpp server (external: start it yourself).

An engine is AVAILABLE when its server answers GET {base}/models (<2s). Only
ollama has a real INSTALLED probe (binary on PATH or a standard install dir);
lmstudio/llamacpp report installed=False and are usable only while running.
"""

import json
import os
import shutil
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyutils.common.engine_registry import (
    EngineAdapter,
    EngineRegistry,
    parse_engine_priority,
)

# Standard ollama install locations checked when the binary is not on PATH.
_OLLAMA_INSTALL_CANDIDATES = (
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe",
    Path("/usr/local/bin/ollama"),
)

DEFAULT_TIMEOUT = 120


class LLMEngineAdapter(EngineAdapter):
    def __init__(
        self,
        name: str,
        base_url_value: str,
        default_model_value: str,
        note: str,
        *,
        installed_probe: Optional[Callable[[], bool]] = None,
        start_command_factory: Optional[Callable[[], Optional[Tuple]]] = None,
        external: bool = False,
    ) -> None:
        super().__init__(name, managed_kind="server")
        self.base_url = str(base_url_value or "").rstrip("/")
        self.default_model = str(default_model_value or "")
        self.note = str(note or "")
        self.external = bool(external)
        self._installed_probe = installed_probe
        self._start_command_factory = start_command_factory

    def installed(self) -> bool:
        return bool(self._installed_probe and self._installed_probe())

    def healthy(self, timeout: float = 1.8) -> bool:
        if not self.base_url:
            return False
        request = urllib.request.Request(f"{self.base_url}/models", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status < 500
        except urllib.error.HTTPError as error:
            return error.code < 500
        except Exception:  # noqa: BLE001
            return False

    def start_command(self) -> Optional[Tuple]:
        if self._start_command_factory is None:
            return None
        return self._start_command_factory()

    def definition(self) -> Dict[str, str]:
        return {
            "base_url": self.base_url,
            "default_model": self.default_model,
            "note": self.note,
        }


class LLMEngineRegistry(EngineRegistry[LLMEngineAdapter]):
    pass


_ENGINE_ADAPTERS = (
    LLMEngineAdapter(
        "ollama",
        "http://127.0.0.1:11434/v1",
        "qwen2.5:7b",
        "Ollama local server (managed: auto-start via `ollama serve`)",
        installed_probe=lambda: ollama_binary() is not None,
        start_command_factory=lambda: ollama_start_command(),
    ),
    LLMEngineAdapter(
        "lmstudio",
        "http://127.0.0.1:1234/v1",
        "local-model",
        "LM Studio local server (external — start it in LM Studio)",
        external=True,
    ),
    LLMEngineAdapter(
        "llamacpp",
        "http://127.0.0.1:8080/v1",
        "local-model",
        "llama.cpp server (external — start llama-server yourself)",
        external=True,
    ),
)
llm_engine_registry = LLMEngineRegistry(_ENGINE_ADAPTERS)


def engine_names() -> Tuple[str, ...]:
    return llm_engine_registry.names()


def engine_priority() -> Tuple[str, ...]:
    """Runtime priority: env LLM_ENGINE_PRIORITY override > default, merged over
    the known engine list so a stale/partial override never drops one."""
    raw = (os.environ.get("LLM_ENGINE_PRIORITY") or "").strip()
    requested = parse_engine_priority(raw) if raw else None
    return llm_engine_registry.merge_priority(requested)


def engine_def(name: str) -> Optional[Dict[str, str]]:
    adapter = llm_engine_registry.get(name)
    return adapter.definition() if adapter else None


def base_url(name: str) -> str:
    adapter = llm_engine_registry.get(name)
    return adapter.base_url if adapter else ""


def default_model(name: str) -> str:
    adapter = llm_engine_registry.get(name)
    return adapter.default_model if adapter else ""


def engine_note(name: str) -> str:
    adapter = llm_engine_registry.get(name)
    return adapter.note if adapter else ""


def ollama_binary() -> Optional[str]:
    """Path to the ollama executable: PATH first, then standard install dirs."""
    found = shutil.which("ollama")
    if found:
        return found
    for candidate in _OLLAMA_INSTALL_CANDIDATES:
        try:
            if candidate.is_file():
                return str(candidate)
        except OSError:
            continue
    return None


def ollama_start_command() -> Optional[Tuple]:
    binary = ollama_binary()
    if not binary:
        return None
    return Path(binary).parent, [binary, "serve"]


def engine_installed(name: str) -> bool:
    """True when the engine software is installed (server reachability aside).
    Only ollama is detectable; lmstudio/llamacpp are unknown -> False (they are
    usable only while their server answers the health probe)."""
    adapter = llm_engine_registry.get(name)
    return bool(adapter and adapter.installed())


def engine_healthy(name: str, timeout: float = 1.8) -> bool:
    """Health probe: GET {base}/models answers with a non-5xx status (<2s)."""
    adapter = llm_engine_registry.get(name)
    return bool(adapter and adapter.healthy(timeout))


def chat_completion_raw(
    messages: List[Dict[str, Any]],
    *,
    base: str,
    model: str,
    temperature: float = 0.2,
    timeout: int = DEFAULT_TIMEOUT,
) -> Dict[str, Any]:
    """One chat completion against a local OpenAI-compatible server.

    Never raises: failures return {"success": False, "error": ...} so callers
    can fall through to the next engine / a cloud provider."""
    use_base = str(base or "").strip().rstrip("/")
    use_model = str(model or "").strip()
    if not use_base or not use_model:
        return {"success": False, "provider": "local", "model": use_model,
                "text": "", "error": "missing base url or model"}
    url = f"{use_base}/chat/completions"
    payload = {
        "model": use_model,
        "messages": messages,
        "temperature": temperature,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace")[:200]
        except Exception:  # noqa: BLE001
            pass
        return {"success": False, "provider": "local", "model": use_model,
                "text": "", "error": f"HTTP {e.code}: {detail}"}
    except Exception as e:  # noqa: BLE001
        return {"success": False, "provider": "local", "model": use_model,
                "text": "", "error": str(e)}
    try:
        text = str(body["choices"][0]["message"]["content"] or "")
    except (KeyError, IndexError, TypeError):
        return {"success": False, "provider": "local", "model": use_model,
                "text": "", "error": "unexpected response shape"}
    return {"success": True, "provider": "local", "model": use_model, "text": text}


__all__ = [
    "LLMEngineAdapter",
    "LLMEngineRegistry",
    "base_url",
    "chat_completion_raw",
    "default_model",
    "engine_def",
    "engine_healthy",
    "engine_installed",
    "engine_names",
    "engine_note",
    "engine_priority",
    "llm_engine_registry",
    "ollama_binary",
    "ollama_start_command",
]
