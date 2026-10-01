# -*- coding: utf-8 -*-
"""Compute task handlers (ocr_recognize, tts_synthesize): Laravel queues the
work, ``laravel_compute_worker`` pulls it and runs the shared pycore service
entries. Handler contract (``LaravelHandlerWorker``): ``handler(payload, task)
-> result``; a raised error reports the task failed."""

from typing import Any, Dict

from pycore.pyctl.runtime.local_engine_service import recognize_ocr
from pycore.pyctl.tts.speech_synthesis_service import synthesize_speech
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_TYPES_BY_KEY

OCR_RECOGNIZE_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["ocr_recognize"]["key"]
TTS_SYNTHESIZE_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["tts_synthesize"]["key"]
_OCR_IMAGE_MAX_BYTES = int(
    (GLOBAL_TASK_TYPES_BY_KEY["ocr_recognize"].get("payload_limits") or {}).get("image_max_bytes") or 0
)
# Laravel's TtsSynthesizeTaskProcessor downgrades a completed result whose
# audio is shorter than this to failed.
TTS_MIN_AUDIO_BYTES = 100


def _require_success(result: Dict[str, Any], fallback_error: str) -> Dict[str, Any]:
    if not result.get("success"):
        error = str(result.get("error") or fallback_error)
        code = str(result.get("error_code") or "")
        raise RuntimeError(f"{code}: {error}" if code else error)
    return result


def ocr_recognize(payload: Dict[str, Any], task: Dict[str, Any]) -> Dict[str, Any]:
    image_data = str(payload.get("image_data") or "")
    if _OCR_IMAGE_MAX_BYTES and len(image_data) * 3 // 4 > _OCR_IMAGE_MAX_BYTES:
        raise ValueError(f"image exceeds {_OCR_IMAGE_MAX_BYTES} bytes")
    return _require_success(recognize_ocr({
        "image_data": image_data,
        "engine": payload.get("engine"),
        "lang": payload.get("lang"),
        "model_type": payload.get("model_type"),
        "languages": payload.get("languages"),
    }), "ocr failed")


def tts_synthesize(payload: Dict[str, Any], task: Dict[str, Any]) -> Dict[str, Any]:
    result = _require_success(synthesize_speech({
        "text": payload.get("text"),
        "language": payload.get("language"),
        "voice": payload.get("voice"),
        "rate": payload.get("rate"),
        "provider": payload.get("provider"),
        "volume": payload.get("volume"),
        "pitch": payload.get("pitch"),
        "return_base64": True,
    }), "tts failed")
    if int(result.get("bytes") or 0) < TTS_MIN_AUDIO_BYTES:
        raise RuntimeError(f"synthesized audio shorter than {TTS_MIN_AUDIO_BYTES} bytes")
    return result


COMPUTE_HANDLERS = {
    OCR_RECOGNIZE_TASK_TYPE: ocr_recognize,
    TTS_SYNTHESIZE_TASK_TYPE: tts_synthesize,
}


__all__ = ["COMPUTE_HANDLERS", "OCR_RECOGNIZE_TASK_TYPE", "TTS_MIN_AUDIO_BYTES", "TTS_SYNTHESIZE_TASK_TYPE"]
