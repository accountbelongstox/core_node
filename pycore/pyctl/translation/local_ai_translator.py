# -*- coding: utf-8 -*-
"""Local AI translation: the provisioned translation model (service contract
local_ai.translate_model, TranslateGemma) on the local Ollama server, GPU or CPU.

The translation gateway of local-models-only nodes (Colab/Kaggle) and an
offline provider everywhere else. Runs through the LLM orchestrator, so the
managed Ollama server is started on demand and shares the lifecycle rules.
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.text_parsing import (
    LANGUAGE_NAME_TO_CODE,
    guess_language,
    normalize_language_code,
)
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import CATEGORY_LLM
from pycore.pyfoundations.serialized_worker import map_bus_tasks
from pycore.pyutils.llm.llm_engines import OLLAMA_TRANSLATE_MODEL, ollama_binary, ollama_num_parallel
from pycore.pyutils.llm.llm_orchestrator import chat as local_llm_chat

LOCAL_AI_TRANSLATE_PROVIDER = "local_ai"
LOCAL_AI_TRANSLATE_ENGINE = "ollama"
AUTO_LANGUAGE = "auto"
UNDETERMINED_LANGUAGE = "und"
_TEMPERATURE = 0.0
# TranslateGemma prompt codes that differ from the bare ISO code.
_MODEL_LANGUAGE_CODES = {"zh": "zh-Hans"}
# Model-facing English names (prompt content, never shown to users).
_LANGUAGE_NAMES = {
    code: name.title()
    for name, code in LANGUAGE_NAME_TO_CODE.items()
    if len(name) > 2
}
# TranslateGemma's published template: two blank lines precede the text.
_PROMPT_TEMPLATE = (
    "You are a professional {source_name} ({source_code}) to {target_name} ({target_code}) "
    "translator. Your goal is to accurately convey the meaning and nuances of the original "
    "{source_name} text while adhering to {target_name} grammar, vocabulary, and cultural "
    "sensitivities.\n"
    "Produce only the {target_name} translation, without any additional explanations or "
    "commentary. Please translate the following {source_name} text into {target_name}:\n"
    "\n\n{text}"
)


def unavailable_reason() -> Optional[str]:
    """Why local AI translation cannot run here, else None."""
    reason = model_boot.reason(LOCAL_AI_TRANSLATE_ENGINE, CATEGORY_LLM)
    if reason:
        return reason
    if ollama_binary() is None:
        return f"{LOCAL_AI_TRANSLATE_ENGINE} is not installed"
    return None


def _language(code: str) -> Dict[str, str]:
    bare = normalize_language_code(code)
    return {
        "code": _MODEL_LANGUAGE_CODES.get(bare, bare),
        "name": _LANGUAGE_NAMES.get(bare, bare),
    }


def _source_code(text: str, source_language: str) -> str:
    value = str(source_language or "").strip().lower()
    if value and value != AUTO_LANGUAGE:
        return value
    guessed = guess_language(text)
    return guessed if guessed != UNDETERMINED_LANGUAGE else AUTO_LANGUAGE


def translate(text: str, target_language: str, source_language: str = AUTO_LANGUAGE) -> Dict[str, Any]:
    """One translation: ``{success, provider, model, text, src, dest, error}``."""
    source = _language(_source_code(text, source_language))
    target = _language(target_language)
    result: Dict[str, Any] = {
        "success": False,
        "provider": LOCAL_AI_TRANSLATE_PROVIDER,
        "model": OLLAMA_TRANSLATE_MODEL,
        "text": "",
        "src": source["code"],
        "dest": target["code"],
        "error": None,
    }
    if not str(text or "").strip():
        result["error"] = "text is required"
        return result
    reason = unavailable_reason()
    if reason:
        result["error"] = reason
        return result
    prompt = _PROMPT_TEMPLATE.format(
        source_name=source["name"], source_code=source["code"],
        target_name=target["name"], target_code=target["code"],
        text=text,
    )
    reply = local_llm_chat(
        [{"role": "user", "content": prompt}],
        engine=LOCAL_AI_TRANSLATE_ENGINE,
        model=OLLAMA_TRANSLATE_MODEL,
        temperature=_TEMPERATURE,
    )
    result["success"] = bool(reply.get("success"))
    result["text"] = str(reply.get("text") or "").strip()
    result["error"] = reply.get("error")
    return result


def translate_many(texts: List[str], target_language: str, source_language: str = AUTO_LANGUAGE) -> List[str]:
    """Translations aligned with ``texts`` ('' where one failed). One
    single-line request per text, ``ollama_num_parallel()`` at a time, so a
    GPU-backed Ollama serves the batch concurrently."""
    if unavailable_reason():
        return [""] * len(texts)

    def one(text: str) -> str:
        return translate(text, target_language, source_language).get("text") or ""

    workers = min(ollama_num_parallel(), len(texts))
    if workers <= 1:
        return [one(text) for text in texts]
    return [str(item or "") for item in map_bus_tasks(one, list(texts), workers, thread_prefix="LocalAiTranslate")]


__all__ = [
    "LOCAL_AI_TRANSLATE_PROVIDER",
    "OLLAMA_TRANSLATE_MODEL",
    "unavailable_reason",
    "translate",
    "translate_many",
]
