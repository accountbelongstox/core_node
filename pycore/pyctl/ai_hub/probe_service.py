# -*- coding: utf-8 -*-
"""Category-agnostic model test: resolve one manifest entry, run the existing
test path of its category, and write exactly one hub history record.

Nothing is re-implemented here: every branch calls the test function the
category already owns. Blocked entries are refused with their boot reason (the
refusal is recorded too).
"""

import asyncio
import time
from typing import Any, Callable, Dict, Optional

from pycore.pyctl.ai.ai_chat import chat_once
import pycore.pyctl.runtime.local_engine_service as engine_tests
from pycore.pyctl.ai_hub import manifest_loader
from pycore.pyctl.ai_hub.probe_record import record_result
from pycore.pyctl.translation import manual_translation_service
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import (
    CATEGORY_AI_IMAGE,
    CATEGORY_AI_TEXT,
    CATEGORY_LLM,
    CATEGORY_OCR,
    CATEGORY_STT,
    CATEGORY_TRANSLATE,
    CATEGORY_TTS,
    ModelEntry,
)
from pycore.pyutils.llm import status_service as llm_status_service

MODE_TEXT = "text"
MODE_IMAGE = "image"
TEST_SOURCE = "hub-test"
DEFAULT_CHAT_PROMPT = "Reply with one short sentence introducing yourself."
DEFAULT_TRANSLATE_TEXT = "Hello, world."
DEFAULT_TRANSLATE_TARGET = "zh-cn"
ERROR_NOT_FOUND = "not_found"
ERROR_NOT_TESTABLE = "not_testable"
ERROR_BLOCKED = "blocked"


def _prompt(params: Dict[str, Any]) -> str:
    return str(
        params.get("text") or params.get("prompt") or params.get("message") or ""
    ).strip()


def _run_tts(entry: ModelEntry, params: Dict[str, Any]) -> Dict[str, Any]:
    return engine_tests.execute_tts({**params, "engine": entry.id})


def _run_stt(entry: ModelEntry, params: Dict[str, Any]) -> Dict[str, Any]:
    return engine_tests.execute_stt({**params, "engine": entry.id})


def _run_ocr(entry: ModelEntry, params: Dict[str, Any]) -> Dict[str, Any]:
    return engine_tests.execute_ocr({**params, "engine": entry.id})


def _run_llm(entry: ModelEntry, params: Dict[str, Any]) -> Dict[str, Any]:
    return llm_status_service.test({**params, "engine": entry.id, "text": _prompt(params)})


def _run_ai_text(entry: ModelEntry, params: Dict[str, Any]) -> Dict[str, Any]:
    messages = [{"role": "user", "content": _prompt(params) or DEFAULT_CHAT_PROMPT}]
    return chat_once(entry.id, messages, params.get("model") or None, source=TEST_SOURCE)


def _run_ai_image(entry: ModelEntry, params: Dict[str, Any]) -> Dict[str, Any]:
    return engine_tests.execute_ai_image(
        {**params, "provider": entry.id, "prompt": _prompt(params) or None}
    )


def _run_translate(entry: ModelEntry, params: Dict[str, Any]) -> Dict[str, Any]:
    request = {
        "text": _prompt(params) or DEFAULT_TRANSLATE_TEXT,
        "src": params.get("src") or "auto",
        "dest": params.get("dest") or DEFAULT_TRANSLATE_TARGET,
    }
    if entry.id == "google":
        return asyncio.run(manual_translation_service.translate_single(request, origin=TEST_SOURCE))
    return manual_translation_service.translate_ai(request)


_RUNNERS: Dict[str, Callable[[ModelEntry, Dict[str, Any]], Dict[str, Any]]] = {
    CATEGORY_TTS: _run_tts,
    CATEGORY_STT: _run_stt,
    CATEGORY_OCR: _run_ocr,
    CATEGORY_LLM: _run_llm,
    CATEGORY_AI_TEXT: _run_ai_text,
    CATEGORY_AI_IMAGE: _run_ai_image,
    CATEGORY_TRANSLATE: _run_translate,
}


def _failure(code: str, message: str, **extra: Any) -> Dict[str, Any]:
    return {"success": False, "error": {"code": code, "message": message, **extra}}


def record_category(entry: ModelEntry, params: Dict[str, Any]) -> str:
    """Record category of a run: an image-mode test of a text provider is an image test."""
    if entry.category == CATEGORY_AI_TEXT and params.get("mode") == MODE_IMAGE:
        return CATEGORY_AI_IMAGE
    return entry.category


def _runner(entry: ModelEntry, params: Dict[str, Any]) -> Optional[Callable]:
    return _RUNNERS.get(record_category(entry, params))


def supports(entry: ModelEntry) -> bool:
    """True when the hub can test and record this entry."""
    return entry.testable and entry.category in _RUNNERS


def _view(record: Dict[str, Any], result: Any, blocked: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "record_id": record["record_id"],
        "ok": bool(record["ok"]),
        "kind": record["category"],
        "elapsed_ms": record["elapsed_ms"],
        "result": result,
    }
    if record.get("error"):
        data["error"] = record["error"]
    if blocked:
        data["boot"] = blocked
    return {"success": True, "data": data}


def run(name: str, params: Optional[Dict[str, Any]] = None, category: Optional[str] = None) -> Dict[str, Any]:
    """Run one test of the named manifest entry; always records one history row."""
    request = dict(params or {})
    entry = manifest_loader.load().get(name, category or request.get("category") or None)
    if entry is None:
        return _failure(ERROR_NOT_FOUND, f"unknown model: {name}")
    runner = _runner(entry, request)
    if not entry.testable or runner is None:
        return _failure(ERROR_NOT_TESTABLE, f"{entry.key} has no test")
    kind = record_category(entry, request)
    started_at = time.time()
    boot = model_boot.record(entry.id, entry.category)
    if model_boot.is_blocked(entry.id, entry.category):
        result: Dict[str, Any] = {
            "success": False,
            "error": str(boot.get("reason") or ERROR_BLOCKED),
            "blocked": True,
        }
    else:
        result = runner(entry, request)
    elapsed_ms = round((time.time() - started_at) * 1000)
    record = record_result(kind, entry.id, request, result, elapsed_ms, started_at)
    return _view(record, result, boot if result.get("blocked") else None)


def test_llm(params: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy llm test route: same engine test, now recorded in the hub history."""
    started_at = time.time()
    result = llm_status_service.test(params)
    entry_id = str(result.get("engine") or params.get("engine") or engine_tests.AUTO_ENTRY_ID)
    record_result(
        CATEGORY_LLM,
        entry_id,
        params,
        result,
        round((time.time() - started_at) * 1000),
        started_at,
    )
    return result


__all__ = ["record_category", "run", "supports", "test_llm"]
