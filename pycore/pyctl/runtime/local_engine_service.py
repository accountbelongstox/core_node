# -*- coding: utf-8 -*-
"""Local engine test and status orchestration."""

import time
from typing import Any, Callable, Dict

import pycore.pyctl.ai.speech_history as speech_history
from pycore.pyctl.ai.ai_gateway import generate_image
from pycore.pyctl.ai_hub.probe_record import record_result
from pycore.pyutils.common.model_manifest import (
    CATEGORY_AI_IMAGE,
    CATEGORY_OCR,
    CATEGORY_STT,
    CATEGORY_TTS,
)
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import ocr_recognize, ocr_test
from pycore.pyctl.stt.probe_service import test as stt_test
from pycore.pyutils.tts.tts_orchestrator import tts_test

AUTO_ENTRY_ID = "auto"


def execute_tts(params: Dict[str, Any]) -> Dict[str, Any]:
    result = tts_test(
        engine=params.get("engine"),
        text=params.get("text"),
        language=params.get("language") or "en",
        rate=params.get("rate"),
        accent=params.get("accent"),
        gender=params.get("gender"),
        speaker=params.get("speaker"),
        instruct=params.get("instruct"),
        voice=params.get("voice"),
        description=params.get("description"),
        cfg_value=params.get("cfg_value"),
        timesteps=params.get("timesteps"),
        speaker_id=params.get("speaker_id"),
        prompt_text=params.get("prompt_text"),
        prompt_lang=params.get("prompt_lang"),
        speed=params.get("speed"),
    )
    entry = speech_history.record_test_result("tts", result, source="tts-test")
    if entry:
        result["record_id"] = entry["id"]
    return result

def execute_stt(params: Dict[str, Any]) -> Dict[str, Any]:
    result = stt_test(
        engine=params.get("engine"),
        language=params.get("language") or "en",
        text=params.get("text"),
        model=params.get("model"),
    )
    entry = speech_history.record_test_result("stt", result, source="stt-test")
    if entry:
        result["record_id"] = entry["id"]
    return result

def _ocr_params(params: Dict[str, Any]) -> Dict[str, Any]:
    languages = params.get("languages")
    if isinstance(languages, list):
        languages = [str(language) for language in languages]
    return {
        "engine": params.get("engine"),
        "image_path": params.get("image_path"),
        "image_data": params.get("image_data"),
        "lang": params.get("lang"),
        "model_type": params.get("model_type"),
        "languages": languages,
    }

def execute_ocr(params: Dict[str, Any]) -> Dict[str, Any]:
    return ocr_test(**_ocr_params(params))

def recognize_ocr(params: Dict[str, Any]) -> Dict[str, Any]:
    """Production OCR: same engine selection as the test, no probe-history record."""
    return ocr_recognize(**_ocr_params(params))

def execute_ai_image(params: Dict[str, Any]) -> Dict[str, Any]:
    return generate_image(
        provider=params.get("provider"),
        prompt=params.get("prompt") or "A minimalist test image.",
        size=params.get("size"),
        model=params.get("model"),
        source="test-popup",
    )

def _recorded(
    category: str,
    executor: Callable[[Dict[str, Any]], Dict[str, Any]],
    params: Dict[str, Any],
    entry_field: str,
    result_field: str,
) -> Dict[str, Any]:
    started_at = time.time()
    result = executor(params)
    entry_id = str(result.get(result_field) or params.get(entry_field) or AUTO_ENTRY_ID)
    record_result(
        category,
        entry_id,
        params,
        result,
        round((time.time() - started_at) * 1000),
        started_at,
    )
    return result

def test_tts(params: Dict[str, Any]) -> Dict[str, Any]:
    return _recorded(CATEGORY_TTS, execute_tts, params, "engine", "engine")

def test_stt(params: Dict[str, Any]) -> Dict[str, Any]:
    return _recorded(CATEGORY_STT, execute_stt, params, "engine", "engine")

def test_ocr(params: Dict[str, Any]) -> Dict[str, Any]:
    return _recorded(CATEGORY_OCR, execute_ocr, params, "engine", "engine")

def test_ai_image(params: Dict[str, Any]) -> Dict[str, Any]:
    return _recorded(CATEGORY_AI_IMAGE, execute_ai_image, params, "provider", "provider")

__all__ = [
    "execute_ai_image",
    "execute_ocr",
    "execute_stt",
    "execute_tts",
    "recognize_ocr",
    "test_ai_image",
    "test_ocr",
    "test_stt",
    "test_tts",
]
