# -*- coding: utf-8 -*-
"""Local engine test and status orchestration."""

from typing import Any, Dict

import pycore.pyctl.ai.speech_history as speech_history
from pycore.pyctl.ai.ai_gateway import generate_image
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import ocr_test
from pycore.pyctl.stt.test_service import test as stt_test
from pycore.pyutils.tts.tts_orchestrator import tts_test


def test_tts(params: Dict[str, Any]) -> Dict[str, Any]:
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

def test_stt(params: Dict[str, Any]) -> Dict[str, Any]:
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

def test_ocr(params: Dict[str, Any]) -> Dict[str, Any]:
    languages = params.get("languages")
    if isinstance(languages, list):
        languages = [str(language) for language in languages]
    return ocr_test(
        engine=params.get("engine"),
        image_path=params.get("image_path"),
        image_data=params.get("image_data"),
        lang=params.get("lang"),
        model_type=params.get("model_type"),
        languages=languages,
    )

def test_ai_image(params: Dict[str, Any]) -> Dict[str, Any]:
    return generate_image(
        provider=params.get("provider"),
        prompt=params.get("prompt") or "A minimalist test image.",
        size=params.get("size"),
        model=params.get("model"),
        source="test-popup",
    )

__all__ = ["test_tts", "test_stt", "test_ocr", "test_ai_image"]
