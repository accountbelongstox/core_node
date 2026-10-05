# -*- coding: utf-8 -*-
"""phrase_extract task handler: Laravel queues the extraction prompt when its own
OpenRouter call is rate limited or unconfigured; ``laravel_compute_worker`` pulls
it and this handler answers it on pycore's own OpenRouter free key. The result is
the raw model answer (``{text, model}``); Laravel parses and stores it.

Handler contract (``LaravelHandlerWorker``): a dict result completes the task, a
``TaskRelease`` hands it back to Laravel (rate limit or missing key: another node
or a later pull runs it), a raised error reports it failed with a stable
``AI_*`` error code.
"""

import time
from typing import Any, Dict, Union

from pycore.pyctl.ai.ai_free_text import FREE_TEXT_PROVIDER, free_text_chat, resolve_free_text_model
from pycore.pyctl.ai.ai_keys import is_configured, mark_text_key_cooldown
from pycore.pyctl.audio_orchestration.orch_contract import ORCH_CONTRACT
from pycore.pyctl.laravel.worker.handler_worker import TaskRelease
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyutils.common.ai_request_failures import AiRequestError
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_CAPABILITIES,
    GLOBAL_TASK_EXECUTION_TYPES,
    GLOBAL_TASK_TYPES_BY_KEY,
)

PHRASE_EXTRACT_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["phrase_extract"]["key"]
PHRASE_EXTRACT_EXECUTION_TYPE = str(GLOBAL_TASK_TYPES_BY_KEY[PHRASE_EXTRACT_TASK_TYPE]["execution_type"])
PHRASE_EXTRACT_CAPABILITY = GLOBAL_TASK_TYPES_BY_KEY[PHRASE_EXTRACT_TASK_TYPE].get("capability")
_EXTRACTION = ORCH_CONTRACT["phrase_pipeline"]["extraction"]
EXTRACTION_MODEL = str(_EXTRACTION["model"])
EXTRACTION_TEMPERATURE = float(_EXTRACTION["temperature"])
EXTRACTION_MAX_TOKENS = int(_EXTRACTION["max_output_tokens"])

SOURCE_LABEL = PHRASE_EXTRACT_TASK_TYPE
KEY_PROBE_TTL_SECONDS = 30.0
RELEASE_PAUSE_MIN_SECONDS = 30.0
RELEASE_PAUSE_MAX_SECONDS = 900.0
ERROR_PROMPT_MISSING = "PHRASE_EXTRACT_PROMPT_MISSING"
ERROR_NOT_CONFIGURED = "AI_PROVIDER_NOT_CONFIGURED"
ERROR_PREFIX = "AI_"
FAILURE_EMPTY_CODES = ("", "none")
FAILURE_EMPTY_NAME = "empty_response"
RELEASE_CODES = frozenset({"local_rate_limit", "rate_limit", "quota"})
KEY_COOLDOWN_CODES = frozenset({"rate_limit", "quota"})
CONTRACT_DECLARED = (
    PHRASE_EXTRACT_EXECUTION_TYPE in GLOBAL_TASK_EXECUTION_TYPES
    and (not PHRASE_EXTRACT_CAPABILITY or PHRASE_EXTRACT_CAPABILITY in GLOBAL_TASK_CAPABILITIES)
)
if not CONTRACT_DECLARED:
    ColorPrint.yellow(
        f"[PhraseExtract] {PHRASE_EXTRACT_TASK_TYPE} is not declared in the queue center contract vocabulary "
        f"(execution_types / capability_claimants); the lane stays off until it is"
    )


class OpenRouterKeyProbe:
    """Whether this node can serve phrase_extract: an OpenRouter key is
    configured. Cached briefly because the worker asks on every pull and diff."""

    def __init__(self) -> None:
        self._state = SerializedValue((None, False), name="PhraseExtractKeyProbe")

    def configured(self) -> bool:
        if not CONTRACT_DECLARED:
            return False
        checked_at, available = self._state.get()
        now = time.monotonic()
        if checked_at is not None and now - checked_at < KEY_PROBE_TTL_SECONDS:
            return available
        available = bool(is_configured(FREE_TEXT_PROVIDER))
        self._state.set((now, available))
        return available


phrase_extract_key_probe = OpenRouterKeyProbe()


def _coded(code: str) -> str:
    name = FAILURE_EMPTY_NAME if code in FAILURE_EMPTY_CODES else code
    return name if name.startswith(ERROR_PREFIX) else f"{ERROR_PREFIX}{name.upper()}"


def _max_tokens(payload: Dict[str, Any]) -> int:
    requested = int(payload.get("max_tokens") or 0)
    return min(requested, EXTRACTION_MAX_TOKENS) if requested > 0 else EXTRACTION_MAX_TOKENS


def _release_or_fail(code: str, message: str, retry_after_s: Any) -> TaskRelease:
    if code in KEY_COOLDOWN_CODES:
        mark_text_key_cooldown(FREE_TEXT_PROVIDER, error=message)
    if code not in RELEASE_CODES:
        raise RuntimeError(f"{_coded(code)}: {message}")
    pause = min(max(float(retry_after_s or 0.0), RELEASE_PAUSE_MIN_SECONDS), RELEASE_PAUSE_MAX_SECONDS)
    return TaskRelease(_coded(code), pause)


def phrase_extract(payload: Dict[str, Any], task: Dict[str, Any]) -> Union[Dict[str, Any], TaskRelease]:
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        raise ValueError(f"{ERROR_PROMPT_MISSING}: payload has no prompt")
    if not is_configured(FREE_TEXT_PROVIDER):
        return TaskRelease(ERROR_NOT_CONFIGURED, RELEASE_PAUSE_MAX_SECONDS)
    model = resolve_free_text_model(payload.get("model") or EXTRACTION_MODEL)
    options = {"temperature": EXTRACTION_TEMPERATURE, "max_tokens": _max_tokens(payload)}
    try:
        res = free_text_chat(
            [{"role": "user", "content": prompt}], model=model, source=SOURCE_LABEL, options=options,
        )
    except AiRequestError as exc:
        return _release_or_fail(exc.code, str(exc), exc.retry_after_s)
    text = str(res.get("text") or "").strip()
    if not res.get("success") or not text:
        return _release_or_fail(
            str(res.get("error_code") or ""), str(res.get("error") or ""), res.get("retry_after_s"),
        )
    used_model = str(res.get("model") or model)
    ColorPrint.blue(
        f"[PhraseExtract] task {str(task.get('task_id') or '')[:8]} answered by {used_model}: "
        f"{len(payload.get('sentences') or [])} sentence(s), {len(text)} chars"
    )
    return {"text": text, "model": used_model}


__all__ = [
    "PHRASE_EXTRACT_EXECUTION_TYPE",
    "PHRASE_EXTRACT_TASK_TYPE",
    "OpenRouterKeyProbe",
    "phrase_extract",
    "phrase_extract_key_probe",
]
