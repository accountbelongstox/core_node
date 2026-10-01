# -*- coding: utf-8 -*-
"""
Local LLM engine definitions: priority chain, health/installed probes, and the
OpenAI-compatible chat HTTP call.

Priority (highest first), overridable via env ``LLM_ENGINE_PRIORITY``
(e.g. ``lmstudio->ollama``):
    1. ollama   — managed server (auto-start via ``ollama serve``).
    2. lmstudio — LM Studio local server (external: start it yourself).
    3. llamacpp — llama.cpp server (external: start it yourself).

An engine is AVAILABLE when its server answers GET {base}/models (<2s). Only
ollama has a real INSTALLED probe (binary on PATH or a standard install dir);
lmstudio/llamacpp report installed=False and are usable only while running.
HTTP goes through the canonical HttpClient (loopback, no proxy).
"""

import os
import shutil
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.network_constants import HTTP_LOOPBACK_HOST
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.service_contract import value as service_contract_value
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyutils.common.engine_registry import (
    EngineAdapter,
    EngineRegistry,
    parse_engine_priority,
)
from pycore.pyutils.common.http_client import HttpClient, HttpError, redacted_http_error
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import (
    CATEGORY_LLM,
    BootVerdict,
    blocked,
    ready,
)
from pycore.pyutils.common.coded_message import CodedMessage
from pycore.pyutils.common.model_reasons import MODEL_REASON_INSTALL_REQUIRED, model_reason
import pycore.pyutils.llm.llm_manifest  # noqa: F401

# Local AI runtime facts shared with the installers (117_install_ollama.sh /
# Step66_InstallOllama.ps1): port, model store and the provisioned model.
_LOCAL_AI_CONTRACT = service_contract_value("local_ai")
OLLAMA_PORT = int(_LOCAL_AI_CONTRACT["ollama_port"])
OLLAMA_TRANSLATE_MODEL = str(_LOCAL_AI_CONTRACT["translate_model"])
OLLAMA_MODELS_SUBDIR = str(_LOCAL_AI_CONTRACT["ollama_models_subdir"])
OLLAMA_MODELS_ENV = "OLLAMA_MODELS"
OLLAMA_HOST_ENV = "OLLAMA_HOST"

# Standard ollama install locations checked when the binary is not on PATH.
_OLLAMA_INSTALL_CANDIDATES = (
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe",
    Path("/usr/local/bin/ollama"),
)

HEALTH_TIMEOUT = 1.8

_local_http = HttpClient(default_timeout=HEALTH_TIMEOUT)


class LLMEngineAdapter(EngineAdapter):
    def __init__(
        self,
        name: str,
        base_url_value: str,
        default_model_value: str,
        *,
        installed_probe: Optional[Callable[[], bool]] = None,
        start_command_factory: Optional[Callable[[], Optional[Tuple]]] = None,
    ) -> None:
        super().__init__(name, CATEGORY_LLM)
        self.base_url = str(base_url_value or "").rstrip("/")
        self.default_model = str(default_model_value or "")
        self.external = self.entry.external
        self._installed_probe = installed_probe
        self._start_command_factory = start_command_factory

    def installed(self) -> bool:
        return bool(self._installed_probe and self._installed_probe())

    def healthy(self, timeout: float = HEALTH_TIMEOUT) -> bool:
        """GET {base}/models answers with a non-5xx status."""
        if not self.base_url or self.boot_blocked():
            return False
        try:
            response = _local_http.get(f"{self.base_url}/models", timeout=timeout)
        except HttpError:
            return False
        return response.status_code < 500

    def probe(self) -> bool:
        return self.healthy()

    def install_reason(self) -> CodedMessage:
        """Coded reason naming the shell step that installs the server binary."""
        return model_reason(
            MODEL_REASON_INSTALL_REQUIRED, model=self.name, item=f"{self.name} executable",
            installer=self.entry.installer,
        )

    def start_command(self) -> Optional[Tuple]:
        if self._start_command_factory is None:
            return None
        return self._start_command_factory()


class LLMEngineRegistry(EngineRegistry[LLMEngineAdapter]):
    def priority(self) -> Tuple[str, ...]:
        """Env LLM_ENGINE_PRIORITY override merged over the known engine list,
        so a stale/partial override never drops one."""
        raw = (os.environ.get("LLM_ENGINE_PRIORITY") or "").strip()
        return self.merge_priority(parse_engine_priority(raw) if raw else None)


def ollama_binary() -> Optional[str]:
    """Path to the ollama executable: PATH first, then standard install dirs."""
    found = shutil.which("ollama")
    if found:
        return found
    for candidate in _OLLAMA_INSTALL_CANDIDATES:
        if candidate.is_file():
            return str(candidate)
    return None


def ollama_models_dir() -> Path:
    """Model store of the managed server: OLLAMA_MODELS, else the shared cache
    (the installers pull into the same directory)."""
    configured = os.environ.get(OLLAMA_MODELS_ENV, "").strip()
    if configured:
        return Path(configured)
    return get_shared_download_cache_dir() / OLLAMA_MODELS_SUBDIR


def ollama_start_command() -> Optional[Tuple]:
    binary = ollama_binary()
    if not binary:
        return None
    env = dict(os.environ)
    env[OLLAMA_MODELS_ENV] = str(ollama_models_dir())
    env[OLLAMA_HOST_ENV] = f"{HTTP_LOOPBACK_HOST}:{OLLAMA_PORT}"
    return Path(binary).parent, [binary, "serve"], env


llm_engine_registry = LLMEngineRegistry((
    LLMEngineAdapter(
        "ollama",
        f"http://{HTTP_LOOPBACK_HOST}:{OLLAMA_PORT}/v1",
        OLLAMA_TRANSLATE_MODEL,
        installed_probe=lambda: ollama_binary() is not None,
        start_command_factory=ollama_start_command,
    ),
    LLMEngineAdapter(
        "lmstudio",
        "http://127.0.0.1:1234/v1",
        "local-model",
    ),
    LLMEngineAdapter(
        "llamacpp",
        "http://127.0.0.1:8080/v1",
        "local-model",
    ),
))


def _ollama_boot_check() -> BootVerdict:
    if ollama_binary() is None:
        return blocked(llm_engine_registry.get("ollama").install_reason())
    return ready()


model_boot.register_checks(CATEGORY_LLM, (("ollama", _ollama_boot_check),))


def _chat_failure(model: str, error: str) -> Dict[str, Any]:
    return {"success": False, "provider": "local", "model": model, "text": "", "error": error}


def chat_completion_raw(
    messages: List[Dict[str, Any]],
    *,
    base: str,
    model: str,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    """One chat completion against a local OpenAI-compatible server.

    Failures return {"success": False, "error": ...} so callers can fall
    through to the next engine / a cloud provider. The POST carries a body, so
    http_client times it progress-driven (bounded connect and write stall, no
    total deadline) instead of the former 120 s urllib timeout."""
    use_base = str(base or "").strip().rstrip("/")
    use_model = str(model or "").strip()
    if not use_base or not use_model:
        return _chat_failure(use_model, "missing base url or model")
    url = f"{use_base}/chat/completions"
    try:
        response = _local_http.post(
            url,
            json={"model": use_model, "messages": messages, "temperature": temperature},
        )
    except HttpError as exc:
        ColorPrint.yellow(f"[llm] chat {url} model={use_model} failed: {redacted_http_error(exc)}")
        return _chat_failure(use_model, redacted_http_error(exc))
    if not response.ok:
        return _chat_failure(use_model, f"HTTP {response.status_code}: {response.text[:200]}")
    try:
        body = response.json()
    except ValueError as exc:
        ColorPrint.yellow(f"[llm] chat {url} model={use_model} returned invalid JSON: {exc}")
        return _chat_failure(use_model, "invalid JSON response")
    choices = body.get("choices") if isinstance(body, dict) else None
    message = choices[0].get("message") if isinstance(choices, list) and choices and isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        return _chat_failure(use_model, "unexpected response shape")
    return {
        "success": True,
        "provider": "local",
        "model": use_model,
        "text": str(message.get("content") or ""),
    }


__all__ = [
    "LLMEngineAdapter",
    "LLMEngineRegistry",
    "OLLAMA_TRANSLATE_MODEL",
    "chat_completion_raw",
    "llm_engine_registry",
    "ollama_binary",
    "ollama_start_command",
]
