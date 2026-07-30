#!/usr/bin/env python3
"""
Qwen3-TTS HTTP API for pycore (subprocess in the DEDICATED isolated venv).

Runs inside the dedicated isolated venv managed by
pycore.pyutils.common.python_env.isolated_venv, launched by tts_service_manager.py
(production) or qwen.standalone_service (tester) -
NEVER the main pycore interpreter, because qwen-tts owns transformer dependencies that
conflicts with the main interpreter's ~4.46.x pin. No pycore imports here - standalone
script. Lifecycle spec: development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.

Official: https://github.com/QwenLM/Qwen3-TTS  pip install -U qwen-tts

Env:
  QWEN3TTS_HOST / QWEN3TTS_PORT  - bind (default 0.0.0.0:57210)
  QWEN3TTS_MODEL                 - HF id or local path. Managed Pycore startup
                                   always supplies the verified persistent
                                   staging/weights path when available; the HF
                                   id fallback is for standalone use only.
  QWEN3TTS_DEVICE                - cpu | cuda:0 | auto (default auto)
  QWEN3TTS_SPEAKER               - preset speaker override
  QWEN3TTS_INSTRUCT              - optional style/emotion instruction
  QWEN3TTS_MAX_PARALLEL          - override auto GPU-tuned batch size
  QWEN3TTS_QUEUE_MAX             - active queued/running jobs (default 200)
  QWEN3TTS_QUEUE_RESULT_TTL_S    - completed result retention (default 900)
  QWEN3TTS_QUEUE_RESULT_MAX      - maximum retained terminal jobs (default 200)
  QWEN3TTS_TASK_TIMEOUT_S        - queued batch timeout (default 900)

Endpoints:
  GET  /health              -> { ok, device, model_loaded, load_error }
  GET  /                     -> dependency-free local Web console
  GET  /status               -> runtime, GPU, synthesis, and queue summary
  POST /synthesize           -> { text, language, speaker, instruct? } -> mp3 bytes
  POST /synthesize_batch     -> { text, language, variants:[{key,accent,gender}] }
                                 -> { results: [{key, ok, audio_base64, error}] }
  POST /queue/submit         -> enqueue an idempotent priority job
  GET  /queue/status         -> authoritative queue snapshot
  GET  /queue/events         -> bounded event replay and long polling
  POST /queue/events/ack     -> acknowledge the processed event sequence
  POST /queue/cancel         -> cancel a pending/running job
  GET  /queue/result/{id}    -> retained audio bytes

Direct synthesize operations remain the interactive small-task fast path. The
queue is process-local and intentionally not persisted; callers recover from a
restart by timing out and resubmitting the same client_job_id.
"""

from __future__ import annotations

import asyncio
import importlib.util
import io
import json
import os
import sys
import threading
import time
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, List, Optional

import fastapi
import fastapi.encoders
import fastapi.responses
import pydantic
import qwen_tts
import torch
import uvicorn

from qwen3tts_gpu import detect_model_variant, estimate_max_parallel, query_gpu_snapshot
from qwen3tts_queue import QueueFullError, QwenQueue
from qwen3tts_synthesis import QwenSynthesis
from qwen3tts_web import (
    QWEN3TTS_WEB_CSS_PATH,
    QWEN3TTS_WEB_HTML_PATH,
    QWEN3TTS_WEB_JS_PATH,
)

BaseModel = pydantic.BaseModel
FastAPI = fastapi.FastAPI
FileResponse = fastapi.responses.FileResponse
JSONResponse = fastapi.responses.JSONResponse
Qwen3TTSModel = qwen_tts.Qwen3TTSModel
Response = fastapi.responses.Response
StreamingResponse = fastapi.responses.StreamingResponse
_DEFAULT_HOST = "0.0.0.0"
_PYCORE_MODULE_NAME = "pycore"
_PYFOUNDATIONS_MODULE_NAME = "pycore.pyfoundations"
_NETWORK_CONSTANTS_MODULE_NAME = "pycore.pyfoundations.network_constants"
_NETWORK_CONSTANTS_MODULE_PATH = (
    Path(__file__).resolve().parents[1] / "pyfoundations" / "network_constants.py"
)
_HTTP_SSE_MODULE_NAME = "pycore.pyfoundations.http_sse"
_HTTP_SSE_MODULE_PATH = (
    Path(__file__).resolve().parents[1] / "pyfoundations" / "http_sse.py"
)
_HTTP_EVENT_MODULE_NAME = "_qwen3tts_http_event_service"
_HTTP_EVENT_MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "pyutils"
    / "rpc_v2"
    / "http"
    / "event_service.py"
)


def _load_source_module(module_name: str, module_path: Path):
    existing_module = sys.modules.get(module_name)
    if existing_module is not None:
        return existing_module
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load source module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _register_pycore_namespace() -> None:
    pycore_module = sys.modules.get(_PYCORE_MODULE_NAME)
    if pycore_module is None:
        pycore_module = ModuleType(_PYCORE_MODULE_NAME)
        pycore_module.__path__ = []
        sys.modules[_PYCORE_MODULE_NAME] = pycore_module
    pyfoundations_module = sys.modules.get(_PYFOUNDATIONS_MODULE_NAME)
    if pyfoundations_module is None:
        pyfoundations_module = ModuleType(_PYFOUNDATIONS_MODULE_NAME)
        pyfoundations_module.__path__ = []
        sys.modules[_PYFOUNDATIONS_MODULE_NAME] = pyfoundations_module
    pycore_module.pyfoundations = pyfoundations_module


_register_pycore_namespace()
_load_source_module(_NETWORK_CONSTANTS_MODULE_NAME, _NETWORK_CONSTANTS_MODULE_PATH)
http_sse = _load_source_module(_HTTP_SSE_MODULE_NAME, _HTTP_SSE_MODULE_PATH)
http_event = _load_source_module(_HTTP_EVENT_MODULE_NAME, _HTTP_EVENT_MODULE_PATH)
http_service = http_event.HttpEventService(
    fastapi_module=fastapi,
    title="Qwen3-TTS HTTP Service",
    version="1.0.0",
    event_path="/queue/events",
)
app: FastAPI = http_service.app
_model = None
_model_lock = threading.Lock()
_device: Optional[str] = None
_load_error: Optional[str] = None
_QUEUE: Optional[QwenQueue] = None
_SYNTHESIS: Optional[QwenSynthesis] = None


def _log(msg: str) -> None:
    """print() that can never raise. When this subprocess outlives its parent
    reader (orphaned server still holding the port), stdout is a broken pipe
    and a plain print() would raise BrokenPipeError BEFORE the endpoint's try
    block — surfacing to clients as an unexplained plaintext 500."""
    try:
        print(msg, flush=True)
    except Exception:  # noqa: BLE001 — BrokenPipeError / OSError / closed pipe
        pass


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request, exc):  # noqa: ANN001
    """Always return the real error as JSON so the pycore client logs the
    actual cause instead of uvicorn's plaintext 'Internal Server Error'."""
    _log(f"[api] unhandled error on {request.url.path}: {exc}")
    return JSONResponse({"error": f"unhandled: {exc}"}, status_code=500)

_LANG_MAP = {
    "en": "English", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
    "de": "German", "fr": "French", "ru": "Russian", "pt": "Portuguese",
    "es": "Spanish", "it": "Italian",
}
_SPEAKER_BY_LANG = {"en": "Ryan", "zh": "Vivian", "ja": "Ono_Anna", "ko": "Sohee"}
# Preference order only — every name must exist in the loaded model capability set.
_SPEAKER_PRESETS = {
    "en": {"female": ["Serena", "Vivian"], "male": ["Ryan", "Aiden"]},
    "zh": {"female": ["Vivian", "Serena"], "male": ["Uncle_Fu", "Dylan"]},
    "ja": {"female": ["Ono_Anna"], "male": ["Ono_Anna"]},
    "ko": {"female": ["Sohee"], "male": ["Sohee"]},
}
_CAPABILITY_CACHE: Optional[Dict[str, Any]] = None


def _resolve_device() -> str:
    want = (os.environ.get("QWEN3TTS_DEVICE") or "auto").strip().lower() or "auto"
    if want != "auto":
        return want
    try:
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _model_id() -> str:
    return (os.environ.get("QWEN3TTS_MODEL") or "").strip() or "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"


def _model_ready(model) -> bool:
    return model is not None


def _load_model():
    global _device, _load_error

    _device = _resolve_device()
    model_id = _model_id()
    dtype = torch.float32 if _device == "cpu" else torch.bfloat16
    _log(f"[api] loading Qwen3-TTS model: {model_id}")
    _log(f"[api] device={_device} dtype={dtype} "
         f"(cuda_available={torch.cuda.is_available()})")
    t0 = time.time()
    try:
        try:
            model = Qwen3TTSModel.from_pretrained(model_id, device_map=_device, dtype=dtype)
        except TypeError:
            model = Qwen3TTSModel.from_pretrained(model_id, device_map=_device)
        _log(f"[api] model loaded in {time.time() - t0:.1f}s")
        _refresh_capabilities(model)
        return model
    except Exception as exc:  # noqa: BLE001
        _load_error = str(exc)
        _log(f"[api] model load FAILED after {time.time() - t0:.1f}s: {exc}")
        raise


def _get_model():
    global _model
    with _model_lock:
        if _model is not None:
            return _model
        _model = _load_model()
        return _model


def _default_capability_snapshot() -> Dict[str, Any]:
    speakers = sorted({
        speaker
        for presets in _SPEAKER_PRESETS.values()
        for group in presets.values()
        for speaker in group
    } | set(_SPEAKER_BY_LANG.values()))
    return {
        "model_id": _model_id(),
        "model_kind": "custom_voice",
        "speakers": speakers,
        "languages": sorted(set(_LANG_MAP.values())),
        "speaker_map": {speaker.lower(): speaker for speaker in speakers},
        "loaded_at": None,
        "revision": "fallback",
    }


def _refresh_capabilities(model) -> Dict[str, Any]:
    """Read speaker/language support from the loaded model when available."""
    global _CAPABILITY_CACHE
    snapshot = _default_capability_snapshot()
    speakers_raw: List[str] = []
    languages_raw: List[str] = []
    if hasattr(model, "get_supported_speakers"):
        try:
            speakers_raw = list(model.get_supported_speakers() or [])
        except Exception as exc:  # noqa: BLE001
            _log(f"[api] get_supported_speakers failed: {exc}")
    if hasattr(model, "get_supported_languages"):
        try:
            languages_raw = list(model.get_supported_languages() or [])
        except Exception as exc:  # noqa: BLE001
            _log(f"[api] get_supported_languages failed: {exc}")
    if speakers_raw:
        snapshot["speakers"] = [str(speaker) for speaker in speakers_raw]
        snapshot["speaker_map"] = {
            str(speaker).lower(): str(speaker) for speaker in speakers_raw
        }
    if languages_raw:
        snapshot["languages"] = [str(language) for language in languages_raw]
    snapshot["loaded_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    snapshot["revision"] = f"{snapshot['model_id']}:{len(snapshot['speakers'])}"
    _CAPABILITY_CACHE = snapshot
    return snapshot


def _get_capabilities() -> Dict[str, Any]:
    global _CAPABILITY_CACHE
    if _CAPABILITY_CACHE is not None:
        return _CAPABILITY_CACHE
    if _model_ready(_model):
        return _refresh_capabilities(_model)
    return _default_capability_snapshot()


def _resolve_speaker(
    lang: str,
    *,
    requested: str = "",
    accent: str = "",
    gender: str = "female",
    index: int = 0,
) -> Dict[str, Any]:
    """Resolve a model speaker id; preferences may apply fallback within capability."""
    caps = _get_capabilities()
    speaker_map: Dict[str, str] = dict(caps.get("speaker_map") or {})
    supported = list(caps.get("speakers") or [])
    explicit_env = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    requested_speaker = (requested or explicit_env or "").strip()
    if requested_speaker:
        canonical = speaker_map.get(requested_speaker.lower())
        if not canonical:
            return {
                "ok": False,
                "code": "unknown_speaker",
                "message": f"speaker not supported: {requested_speaker}",
                "retryable": False,
                "supported_speakers": supported,
            }
        return {
            "ok": True,
            "requested_speaker": requested_speaker,
            "resolved_speaker": canonical,
            "fallback_applied": canonical != requested_speaker,
        }

    code = (lang or "en").strip().lower()[:2]
    gender_key = (gender or "female").strip().lower()
    if gender_key not in ("female", "male"):
        gender_key = "female"
    accent_key = (accent or "").strip().lower()
    presets = _SPEAKER_PRESETS.get(code) or _SPEAKER_PRESETS["en"]
    candidates = list(presets.get(gender_key) or presets.get("female") or [])
    if code == "en" and accent_key in ("us", "uk"):
        candidates = list(candidates)
    if not candidates:
        candidates = [str(caps.get("speakers") or ["Ryan"])[0]]
    preferred = candidates[index % len(candidates)]
    canonical = speaker_map.get(preferred.lower())
    if canonical:
        return {
            "ok": True,
            "requested_speaker": preferred,
            "resolved_speaker": canonical,
            "fallback_applied": False,
        }
    for candidate in candidates:
        canonical = speaker_map.get(candidate.lower())
        if canonical:
            return {
                "ok": True,
                "requested_speaker": preferred,
                "resolved_speaker": canonical,
                "fallback_applied": True,
            }
    if supported:
        fallback = supported[0]
        return {
            "ok": True,
            "requested_speaker": preferred,
            "resolved_speaker": fallback,
            "fallback_applied": True,
        }
    return {
        "ok": False,
        "code": "no_speakers",
        "message": "model reported no supported speakers",
        "retryable": False,
        "supported_speakers": [],
    }


def _qwen_language(lang: str) -> str:
    code = (lang or "en").strip().lower()[:2]
    return _LANG_MAP.get(code, "Auto")


def _speaker(lang: str) -> str:
    resolved = _resolve_speaker(lang)
    if not resolved.get("ok"):
        raise ValueError(str(resolved.get("message") or "speaker resolution failed"))
    return str(resolved["resolved_speaker"])


def _speaker_for_variant(lang: str, variant: Dict[str, Any], index: int) -> Dict[str, Any]:
    explicit = (variant.get("speaker_id") or variant.get("speaker") or "").strip()
    resolved = _resolve_speaker(
        lang,
        requested=explicit,
        accent=str(variant.get("accent") or ""),
        gender=str(variant.get("gender") or "female"),
        index=index,
    )
    return resolved


class SynthRequest(BaseModel):
    text: str
    language: str = "en"
    speaker: Optional[str] = None
    instruct: Optional[str] = None
    format: str = "mp3"


class VariantSpec(BaseModel):
    key: str = ""
    accent: Optional[str] = None
    gender: Optional[str] = "female"


class BatchSynthRequest(BaseModel):
    text: str
    language: str = "en"
    variants: List[VariantSpec]
    format: str = "mp3"


class QueueSubmitRequest(SynthRequest):
    priority: int = 0
    client_job_id: Optional[str] = None
    job_id: Optional[str] = None


class QueueCancelRequest(BaseModel):
    job_id: str


def _gpu_index() -> int:
    device = _device or _resolve_device()
    if ":" not in device:
        return 0
    suffix = device.rsplit(":", 1)[-1]
    return int(suffix) if suffix.isdigit() else 0


def _max_parallel_snapshot() -> int:
    snapshot = query_gpu_snapshot(_gpu_index())
    return estimate_max_parallel(
        detect_model_variant(_model_id()),
        snapshot.get("mem_total_mb") or 0,
        snapshot.get("mem_used_mb") or 0,
        snapshot.get("util_percent"),
    )


def _get_synthesis() -> QwenSynthesis:
    global _SYNTHESIS
    if _SYNTHESIS is None:
        _SYNTHESIS = QwenSynthesis(
            get_model=_get_model,
            model_lock=_model_lock,
            resolve_speaker=_resolve_speaker,
            speaker_for_variant=_speaker_for_variant,
            qwen_language=_qwen_language,
            query_gpu_snapshot=query_gpu_snapshot,
            estimate_max_parallel=estimate_max_parallel,
            detect_model_variant=detect_model_variant,
            model_id=_model_id,
            device=lambda: _device or _resolve_device(),
            logger=_log,
        )
    return _SYNTHESIS


def _get_queue() -> QwenQueue:
    global _QUEUE
    if _QUEUE is None:
        def publish_event(topic: str, payload: Dict[str, Any]) -> None:
            asyncio.create_task(http_service.publish_event(topic, payload))

        _QUEUE = QwenQueue(
            _get_synthesis().generate_queue_batch,
            _max_parallel_snapshot,
            _log,
            event_publisher=publish_event,
        )
    return _QUEUE


@app.get("/health")
def health():
    ready = _model_ready(_model)
    return {
        "ok": True,
        "device": _device or _resolve_device(),
        "model_loaded": ready,
        "load_error": None if ready else _load_error,
    }

@app.get("/capabilities")
def capabilities():
    """Return runtime speaker/language support from the loaded model."""
    caps = _get_capabilities()
    return {
        "ok": True,
        "model_id": caps.get("model_id"),
        "model_kind": caps.get("model_kind"),
        "languages": caps.get("languages"),
        "speakers": caps.get("speakers"),
        "default_speakers": _SPEAKER_BY_LANG,
        "loaded_at": caps.get("loaded_at"),
        "revision": caps.get("revision"),
    }


@app.get("/", include_in_schema=False)
def root():
    return FileResponse(QWEN3TTS_WEB_HTML_PATH, media_type="text/html")


@app.get("/qwen3tts_web/style.css", include_in_schema=False)
def web_css():
    return FileResponse(QWEN3TTS_WEB_CSS_PATH, media_type="text/css")


@app.get("/qwen3tts_web/app.js", include_in_schema=False)
def web_javascript():
    return FileResponse(QWEN3TTS_WEB_JS_PATH, media_type="text/javascript")


@app.get("/status")
async def status():
    gpu = await asyncio.to_thread(query_gpu_snapshot, _gpu_index())
    queue = _get_queue().status()
    direct = _get_synthesis().stats()
    queue_count = int(queue.get("synthesized_count") or 0)
    direct_count = int(direct.get("synthesized_count") or 0)
    total_count = queue_count + direct_count
    total_elapsed = (
        int(queue.get("average_elapsed_ms") or 0) * queue_count
        + int(direct.get("average_elapsed_ms") or 0) * direct_count
    )
    dtype = "float32" if (_device or _resolve_device()) == "cpu" else "bfloat16"
    max_parallel = estimate_max_parallel(
        detect_model_variant(_model_id()),
        gpu.get("mem_total_mb") or 0,
        gpu.get("mem_used_mb") or 0,
        gpu.get("util_percent"),
    )
    return {
        "ok": True,
        "model_loaded": _model_ready(_model),
        "model_id": _model_id(),
        "device": _device or _resolve_device(),
        "dtype": dtype,
        "load_error": _load_error,
        "gpu": gpu,
        "max_parallel": max_parallel,
        "synthesized_count": total_count,
        "failed_count": int(queue.get("failed_count") or 0) + int(direct.get("failed_count") or 0),
        "average_elapsed_ms": round(total_elapsed / total_count) if total_count else 0,
        "queue": queue.get("counts"),
    }


@app.get("/load")
def load():
    """Warm up the model without synthesizing, so the loading process is visible
    on the console before the first /synthesize call."""
    t0 = time.time()
    try:
        _get_model()
        return {
            "ok": True,
            "model_loaded": True,
            "device": _device or _resolve_device(),
            "model_id": _model_id(),
            "elapsed_ms": round((time.time() - t0) * 1000),
        }
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "model_loaded": False, "error": _load_error or str(exc)},
            status_code=500,
        )


@app.post("/synthesize")
def synthesize(req: SynthRequest):
    text = (req.text or "").strip()
    if not text:
        return JSONResponse({"error": "empty text"}, status_code=400)
    fmt = (req.format or "mp3").strip().lower()
    _log(f"[api] /synthesize lang={req.language} speaker={req.speaker or 'auto'} "
         f"fmt={fmt} chars={len(text)}")
    try:
        result = _get_synthesis().generate_one(req.dict())
        _log(
            f"[api] synthesized {len(result['audio'])} bytes ({fmt}) "
            f"@ {result['sample_rate']}Hz in {result['elapsed_ms'] / 1000:.2f}s"
        )
        return StreamingResponse(
            io.BytesIO(result["audio"]), media_type=result["media_type"]
        )
    except Exception as exc:  # noqa: BLE001
        _log(f"[api] /synthesize FAILED: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/synthesize_batch")
def synthesize_batch(req: BatchSynthRequest):
    text = (req.text or "").strip()
    variants = req.variants or []
    if not text or not variants:
        return JSONResponse({"error": "empty text or no variants"}, status_code=400)
    fmt = (req.format or "mp3").strip().lower()
    _log(f"[api] /synthesize_batch lang={req.language} variants={len(variants)} "
         f"fmt={fmt} chars={len(text)}")
    try:
        return _get_synthesis().generate_variants({
            "text": text,
            "language": req.language,
            "variants": [variant.dict() for variant in variants],
            "format": fmt,
        })
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/queue/submit")
async def queue_submit(req: QueueSubmitRequest):
    try:
        job = await _get_queue().submit(req.dict())
        return {
            "ok": True,
            "event_instance_id": http_service.events.instance_id,
            **job,
        }
    except QueueFullError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=429)
    except (TypeError, ValueError) as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=400)


@app.get("/queue/status")
async def queue_status():
    return {"ok": True, **_get_queue().status()}


@app.post("/queue/cancel")
async def queue_cancel(req: QueueCancelRequest):
    cancelled = await _get_queue().cancel(req.job_id)
    return {"ok": True, "job_id": req.job_id, "cancelled": cancelled}


@app.get("/queue/result/{job_id}")
async def queue_result(job_id: str):
    job = _get_queue().get_job(job_id)
    if job is None:
        return JSONResponse({"ok": False, "error": "job not found or expired"}, status_code=404)
    if job.get("status") != "done" or not job.get("_audio"):
        return JSONResponse(
            {"ok": False, "status": job.get("status"), "error": job.get("error")},
            status_code=409,
        )
    fmt = str(job.get("format") or "mp3")
    return Response(
        content=job["_audio"],
        media_type=str(job.get("_media_type") or "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="qwen3tts-{job_id}.{fmt}"'},
    )


@app.on_event("startup")
async def _suppress_windows_pipe_reset_noise() -> None:
    """On Windows, pydub's ffmpeg subprocess pipe teardown makes the proactor
    loop log 'Exception in callback _ProactorBasePipeTransport._call_connection_lost'
    (ConnectionResetError 10054) after every mp3 encode. It is harmless noise —
    swallow just that callback, keep every other loop exception visible."""
    await _get_queue().start()
    if os.name != "nt":
        return
    loop = asyncio.get_running_loop()
    previous = loop.get_exception_handler()

    def _handler(_loop: asyncio.AbstractEventLoop, context: Dict[str, Any]) -> None:
        exc = context.get("exception")
        handle = str(context.get("handle") or "")
        if isinstance(exc, ConnectionResetError) and "_call_connection_lost" in handle:
            return
        if previous is not None:
            previous(_loop, context)
        else:
            _loop.default_exception_handler(context)

    loop.set_exception_handler(_handler)


@app.on_event("shutdown")
async def _stop_queue() -> None:
    if _QUEUE is not None:
        await _QUEUE.stop()


class _ReadyServer(uvicorn.Server):
    """Print readiness only after uvicorn has successfully bound the socket."""

    async def startup(self, sockets=None) -> None:  # noqa: ANN001
        await super().startup(sockets=sockets)
        if self.should_exit:
            return
        host = str(self.config.host)
        port = int(self.config.port)
        ready_host = "127.0.0.1" if host in {"0.0.0.0", "::"} else host
        _log(f"[api] QWEN3TTS_READY http://{ready_host}:{port} (Web console: /)")


def main():
    host = (os.environ.get("QWEN3TTS_HOST") or _DEFAULT_HOST).strip() or _DEFAULT_HOST
    raw_port = (os.environ.get("QWEN3TTS_PORT") or "").strip()
    port_source = "QWEN3TTS_PORT" if raw_port else "default"
    try:
        port = int(raw_port) if raw_port else 57210
    except ValueError:
        port = 57210
        port_source = "default (invalid QWEN3TTS_PORT ignored)"
    _log(f"[api] Qwen3-TTS API server starting on {host}:{port} "
         f"(port_source={port_source}, model={_model_id()}, device={_resolve_device()})")
    config = uvicorn.Config(app, host=host, port=port)
    _ReadyServer(config).run()


if __name__ == "__main__":
    main()
