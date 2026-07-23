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
from typing import Any, Dict, List, Optional, Tuple

_DEFAULT_PRIORITY: Tuple[str, ...] = ("ollama", "lmstudio", "llamacpp")

_ENGINES: Dict[str, Dict[str, str]] = {
    "ollama": {
        "base_url": "http://127.0.0.1:11434/v1",
        "default_model": "qwen2.5:7b",
        "note": "Ollama local server (managed: auto-start via `ollama serve`)",
    },
    "lmstudio": {
        "base_url": "http://127.0.0.1:1234/v1",
        "default_model": "local-model",
        "note": "LM Studio local server (external — start it in LM Studio)",
    },
    "llamacpp": {
        "base_url": "http://127.0.0.1:8080/v1",
        "default_model": "local-model",
        "note": "llama.cpp server (external — start llama-server yourself)",
    },
}

# Standard ollama install locations checked when the binary is not on PATH.
_OLLAMA_INSTALL_CANDIDATES = (
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe",
    Path("/usr/local/bin/ollama"),
)

DEFAULT_TIMEOUT = 120


def engine_names() -> Tuple[str, ...]:
    return _DEFAULT_PRIORITY


def engine_priority() -> Tuple[str, ...]:
    """Runtime priority: env LLM_ENGINE_PRIORITY override > default, merged over
    the known engine list so a stale/partial override never drops one."""
    raw = (os.environ.get("LLM_ENGINE_PRIORITY") or "").strip()
    if raw:
        parts = [p.strip() for p in raw.replace(",", "->").split("->") if p.strip()]
        head = [e for e in parts if e in _ENGINES]
        if head:
            return tuple(head + [e for e in _DEFAULT_PRIORITY if e not in head])
    return _DEFAULT_PRIORITY


def engine_def(name: str) -> Optional[Dict[str, str]]:
    return _ENGINES.get(name)


def base_url(name: str) -> str:
    spec = _ENGINES.get(name) or {}
    return str(spec.get("base_url") or "").rstrip("/")


def default_model(name: str) -> str:
    spec = _ENGINES.get(name) or {}
    return str(spec.get("default_model") or "")


def engine_note(name: str) -> str:
    spec = _ENGINES.get(name) or {}
    return str(spec.get("note") or "")


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


def engine_installed(name: str) -> bool:
    """True when the engine software is installed (server reachability aside).
    Only ollama is detectable; lmstudio/llamacpp are unknown -> False (they are
    usable only while their server answers the health probe)."""
    if name == "ollama":
        return ollama_binary() is not None
    return False


def engine_healthy(name: str, timeout: float = 1.8) -> bool:
    """Health probe: GET {base}/models answers with a non-5xx status (<2s)."""
    base = base_url(name)
    if not base:
        return False
    req = urllib.request.Request(f"{base}/models", method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status < 500
    except urllib.error.HTTPError as e:
        return e.code < 500
    except Exception:  # noqa: BLE001 — connection refused / timeout: server down
        return False


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
