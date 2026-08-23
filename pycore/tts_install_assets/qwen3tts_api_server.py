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
  QWEN3TTS_MODEL_VARIANT         - installed model size (0.6B | 1.7B), supplied
                                   by the managed launcher for local paths
  QWEN3TTS_PHYSICAL_GPU_INDEX    - physical NVIDIA index selected at launch
  QWEN3TTS_SPEED                 - default playback-speed factor for every
                                   generation (default: the shared constant
                                   QWEN3TTS_DEFAULT_SPEED = 0.75; 1.0 = natural
                                   speed). Slower speed also shrinks the
                                   character budget per chunk (duration-bound).
                                   A request-level "speed" overrides it per job.
  QWEN3TTS_SPEAKER               - explicit speaker pin. When unset, every
                                   TASK (job) gets ONE uniform-random voice
                                   from the language's native speaker pool
                                   (official model card); all sentence chunks
                                   of the task reuse that voice.
  QWEN3TTS_INSTRUCT              - optional style/emotion instruction
  QWEN3TTS_MAX_PARALLEL          - override auto GPU-tuned batch size
  The service accepts one active job. GPU capacity is used inside that job for
  native sentence-chunk batching; callers retain and retry additional work.
  QWEN3TTS_QUEUE_RESULT_TTL_S    - completed result retention (default 900)
  QWEN3TTS_QUEUE_RESULT_MAX      - maximum retained terminal jobs (default 200)
  QWEN3TTS_CHUNK_MAX_CHARS       - per-chunk character budget at speed 1.0
                                   (default 280, ~20s); sentence merging stays
                                   within ~60% of it, and slower speeds shrink
                                   the budget proportionally. Longer inputs are
                                   synthesized per sentence-sized chunk and
                                   concatenated (single-shot long text degrades
                                   into noise, QwenLM/Qwen3-TTS#258)
  QWEN3TTS_CHUNK_PAUSE_MS        - silence inserted between chunks (default 150)
  PYCORE_MANAGED_CODE_ID        - injected by pycore's managed-service layer at
                                  launch (digest of the launch script set);
                                  echoed in /health and /status as code_id so the manager
                                  can reject stale-code listeners (never adopt a
                                  server not running current scripts)

  The pipeline is single-version: every synthesis is sentence-chunked and
  concatenated (multi-sentence audio); /status reports "chunked": true so
  pycore can tag records without any version negotiation. Default voice:
  one uniform-random native speaker per task (see QWEN3TTS_SPEAKER above);
  the chosen speaker is reported in every synthesis result. Sentence chunks
  of one task are generated through the model's native batch API in
  GPU-bounded PARALLEL groups and concatenated in original order (see
  QwenSynthesis._generate_chunked).

Endpoints:
  GET  /health              -> lightweight lifecycle and code identity
  GET  /                     -> dependency-free local Web console
  GET  /status               -> runtime, GPU, synthesis, and full queue state
                                (includes "speed": default playback speed)
  POST /synthesize           -> { text, language, speaker, instruct?, speed? } -> mp3 bytes
  POST /synthesize_batch     -> { text, language, variants:[{key,accent,gender}] }
                                 -> { results: [{key, ok, audio_base64, error}] }
  POST /queue/submit         -> enqueue an idempotent FIFO job
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
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, List, Optional

import fastapi
import fastapi.encoders
import fastapi.responses
import pydantic
import qwen_tts
import torch
import transformers
import uvicorn

from qwen3tts_capabilities import DEFAULT_SPEAKERS, QwenCapabilities
from qwen3tts_gpu import build_capacity_plan, detect_model_variant, query_gpu_snapshot
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
_MANAGED_CODE_ID = os.environ.get("PYCORE_MANAGED_CODE_ID") or ""
_PYCORE_MODULE_NAME = "pycore"
_PYFOUNDATIONS_MODULE_NAME = "pycore.pyfoundations"
_PYCORE_PACKAGE_ROOT = Path(__file__).resolve().parents[1]
_PYFOUNDATIONS_PACKAGE_ROOT = _PYCORE_PACKAGE_ROOT / "pyfoundations"
_NETWORK_CONSTANTS_MODULE_NAME = "pycore.pyfoundations.network_constants"
_NETWORK_CONSTANTS_MODULE_PATH = _PYFOUNDATIONS_PACKAGE_ROOT / "network_constants.py"
_HTTP_SSE_MODULE_NAME = "pycore.pyfoundations.http_sse"
_HTTP_SSE_MODULE_PATH = _PYFOUNDATIONS_PACKAGE_ROOT / "http_sse.py"
_HTTP_EVENT_MODULE_NAME = "_qwen3tts_http_event_service"
_HTTP_EVENT_MODULE_PATH = (
    _PYCORE_PACKAGE_ROOT / "pyutils" / "rpc_v2" / "http" / "event_service.py"
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
        pycore_module.__path__ = [str(_PYCORE_PACKAGE_ROOT)]
        sys.modules[_PYCORE_MODULE_NAME] = pycore_module
    pyfoundations_module = sys.modules.get(_PYFOUNDATIONS_MODULE_NAME)
    if pyfoundations_module is None:
        pyfoundations_module = ModuleType(_PYFOUNDATIONS_MODULE_NAME)
        pyfoundations_module.__path__ = [str(_PYFOUNDATIONS_PACKAGE_ROOT)]
        sys.modules[_PYFOUNDATIONS_MODULE_NAME] = pyfoundations_module
    pycore_module.pyfoundations = pyfoundations_module


_register_pycore_namespace()
_network_constants = _load_source_module(
    _NETWORK_CONSTANTS_MODULE_NAME, _NETWORK_CONSTANTS_MODULE_PATH
)
http_sse = _load_source_module(_HTTP_SSE_MODULE_NAME, _HTTP_SSE_MODULE_PATH)
http_event = _load_source_module(_HTTP_EVENT_MODULE_NAME, _HTTP_EVENT_MODULE_PATH)
_model = None
_model_lock = threading.Lock()
_device: Optional[str] = None
_attention_backend = "uninitialized"
_load_error: Optional[str] = None
_QUEUE: Optional[QwenQueue] = None
_SYNTHESIS: Optional[QwenSynthesis] = None
_CAPACITY_PLAN: Dict[str, Any] = {
    "initialized": False,
    "source": "startup_pending",
    "batch_size": 1,
}
_GPU_SNAPSHOT_CACHE: Dict[str, Any] = {}
_GPU_SNAPSHOT_CACHED_AT = 0.0
_GPU_SNAPSHOT_CACHE_SECONDS = 1.0
_GPU_SNAPSHOT_LOCK = threading.Lock()


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    loop: Optional[asyncio.AbstractEventLoop] = None
    previous = None

    await asyncio.to_thread(_get_model)
    await _get_queue().start()
    if os.name == "nt":
        loop = asyncio.get_running_loop()
        previous = loop.get_exception_handler()

        def _handler(
            active_loop: asyncio.AbstractEventLoop,
            context: Dict[str, Any],
        ) -> None:
            exc = context.get("exception")
            handle = str(context.get("handle") or "")
            if isinstance(exc, ConnectionResetError) and "_call_connection_lost" in handle:
                return
            if previous is not None:
                previous(active_loop, context)
            else:
                active_loop.default_exception_handler(context)

        loop.set_exception_handler(_handler)
    try:
        yield
    finally:
        if _QUEUE is not None:
            await _QUEUE.stop()
        if loop is not None:
            loop.set_exception_handler(previous)


http_service = http_event.HttpEventService(
    fastapi_module=fastapi,
    title="Qwen3-TTS HTTP Service",
    version="1.0.0",
    lifespan=_lifespan,
    event_path="/queue/events",
)
app: FastAPI = http_service.app


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


def _model_variant() -> str:
    configured = (os.environ.get("QWEN3TTS_MODEL_VARIANT") or "").strip()
    return configured if configured in {"0.6B", "1.7B"} else detect_model_variant(_model_id())


def _model_ready(model) -> bool:
    return model is not None


_CAPABILITIES = QwenCapabilities(_model_id, _model_ready, _log)


def _attention_implementation(device: str, dtype) -> str:
    if (
        device.startswith("cuda")
        and dtype in (torch.float16, torch.bfloat16)
        and transformers.utils.is_flash_attn_2_available()
    ):
        return "flash_attention_2"
    return "sdpa"


def _logical_gpu_index() -> int:
    device = _device or _resolve_device()
    suffix = device.rsplit(":", 1)[-1] if ":" in device else ""
    return int(suffix) if suffix.isdigit() else 0


def _physical_gpu_index() -> int:
    configured = (os.environ.get("QWEN3TTS_PHYSICAL_GPU_INDEX") or "").strip()
    return int(configured) if configured.isdigit() else _logical_gpu_index()


def _cuda_properties() -> Dict[str, Any]:
    device = _device or _resolve_device()
    if not device.startswith("cuda") or not torch.cuda.is_available():
        return {}
    logical_index = _logical_gpu_index()
    properties = torch.cuda.get_device_properties(logical_index)
    free_bytes, total_bytes = torch.cuda.mem_get_info(logical_index)
    return {
        "logical_index": logical_index,
        "name": properties.name,
        "major": int(properties.major),
        "minor": int(properties.minor),
        "multiprocessor_count": int(properties.multi_processor_count),
        "mem_free_mb": round(int(free_bytes) / (1024 * 1024)),
        "mem_total_mb": round(int(total_bytes) / (1024 * 1024)),
    }


def _initialize_capacity_plan() -> Dict[str, Any]:
    global _CAPACITY_PLAN, _GPU_SNAPSHOT_CACHE, _GPU_SNAPSHOT_CACHED_AT
    if _CAPACITY_PLAN.get("initialized"):
        return dict(_CAPACITY_PLAN)
    gpu = query_gpu_snapshot(_physical_gpu_index())
    properties = _cuda_properties()
    _CAPACITY_PLAN = build_capacity_plan(
        _model_variant(),
        _device or _resolve_device(),
        gpu,
        properties,
    )
    _GPU_SNAPSHOT_CACHE = dict(gpu)
    _GPU_SNAPSHOT_CACHED_AT = time.monotonic()
    _log(
        "[api] startup GPU capacity plan: "
        f"physical_gpu={_CAPACITY_PLAN.get('physical_gpu_index')} "
        f"name={_CAPACITY_PLAN.get('gpu_name') or '-'} "
        f"compute={_CAPACITY_PLAN.get('compute_capability') or '-'} "
        f"sms={int(_CAPACITY_PLAN.get('multiprocessor_count') or 0)} "
        f"memory={int(_CAPACITY_PLAN.get('memory_used_at_start_mb') or 0)}/"
        f"{int(_CAPACITY_PLAN.get('memory_total_mb') or 0)}MB "
        f"native_batch={int(_CAPACITY_PLAN.get('batch_size') or 1)}"
    )
    return dict(_CAPACITY_PLAN)


def _capacity_plan_snapshot() -> Dict[str, Any]:
    return dict(_CAPACITY_PLAN)


def _runtime_gpu_snapshot() -> Dict[str, Any]:
    global _GPU_SNAPSHOT_CACHE, _GPU_SNAPSHOT_CACHED_AT
    now = time.monotonic()
    with _GPU_SNAPSHOT_LOCK:
        if now - _GPU_SNAPSHOT_CACHED_AT >= _GPU_SNAPSHOT_CACHE_SECONDS:
            _GPU_SNAPSHOT_CACHE = query_gpu_snapshot(_physical_gpu_index())
            _GPU_SNAPSHOT_CACHED_AT = now
        snapshot = dict(_GPU_SNAPSHOT_CACHE)
    snapshot["logical_device"] = _device or _resolve_device()
    snapshot["physical_index"] = int(
        _CAPACITY_PLAN.get("physical_gpu_index") or _physical_gpu_index()
    )
    snapshot["compute_capability"] = _CAPACITY_PLAN.get("compute_capability")
    snapshot["multiprocessor_count"] = int(
        _CAPACITY_PLAN.get("multiprocessor_count") or 0
    )
    if not snapshot.get("name"):
        snapshot["name"] = _CAPACITY_PLAN.get("gpu_name")
    return snapshot


def _service_runtime_snapshot() -> Dict[str, Any]:
    capacity_plan = _capacity_plan_snapshot()
    return {
        "gpu": _runtime_gpu_snapshot(),
        "capacity_plan": capacity_plan,
        "max_parallel": max(1, int(capacity_plan.get("batch_size") or 1)),
        "attention_implementation": _attention_backend,
        "synthesis_runtime": _get_synthesis().runtime(),
    }


def _health_snapshot() -> Dict[str, Any]:
    ready = _model_ready(_model)
    return {
        "ok": True,
        "code_id": _MANAGED_CODE_ID,
        "device": _device or _resolve_device(),
        "physical_gpu_index": _physical_gpu_index(),
        "model_loaded": ready,
        "capacity_plan": _capacity_plan_snapshot(),
        "load_error": None if ready else _load_error,
    }


async def _status_snapshot() -> Dict[str, Any]:
    runtime = await asyncio.to_thread(_service_runtime_snapshot)
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
    return {
        **_health_snapshot(),
        "model_id": _model_id(),
        "chunked": True,
        "speed": _default_speed(),
        "dtype": dtype,
        **runtime,
        **queue,
        "synthesized_count": total_count,
        "failed_count": int(queue.get("failed_count") or 0)
        + int(direct.get("failed_count") or 0),
        "average_elapsed_ms": (
            round(total_elapsed / total_count) if total_count else 0
        ),
    }


def _load_model():
    global _attention_backend, _device, _load_error

    _device = _resolve_device()
    model_id = _model_id()
    dtype = torch.float32 if _device == "cpu" else torch.bfloat16
    attention_implementation = _attention_implementation(_device, dtype)
    _attention_backend = attention_implementation
    _log(f"[api] loading Qwen3-TTS model: {model_id}")
    _log(f"[api] device={_device} dtype={dtype} "
         f"attention={attention_implementation} "
         f"(cuda_available={torch.cuda.is_available()})")
    t0 = time.monotonic()
    try:
        model = Qwen3TTSModel.from_pretrained(
            model_id,
            device_map=_device,
            dtype=dtype,
            attn_implementation=attention_implementation,
        )
        _log(f"[api] model loaded in {time.monotonic() - t0:.1f}s")
        _CAPABILITIES.refresh(model)
        _initialize_capacity_plan()
        return model
    except Exception as exc:  # noqa: BLE001
        _load_error = str(exc)
        _log(f"[api] model load FAILED after {time.monotonic() - t0:.1f}s: {exc}")
        raise


def _get_model():
    global _model
    with _model_lock:
        if _model is not None:
            return _model
        _model = _load_model()
        return _model


def _resolve_speaker(
    language: str,
    **options: Any,
) -> Dict[str, Any]:
    return _CAPABILITIES.resolve_speaker(_model, language, **options)


def _speaker_for_variant(
    language: str,
    variant: Dict[str, Any],
    index: int,
) -> Dict[str, Any]:
    return _CAPABILITIES.speaker_for_variant(
        _model,
        language,
        variant,
        index,
    )


def _qwen_language(language: str) -> str:
    return _CAPABILITIES.qwen_language(language)


class SynthRequest(BaseModel):
    text: str
    language: str = "en"
    speaker: Optional[str] = None
    instruct: Optional[str] = None
    format: str = "mp3"
    # Optional playback-speed factor (0.25..3.0, <1.0 slower). Omitted/None
    # -> the server-wide default (see _default_speed).
    speed: Optional[float] = None


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
    client_job_id: Optional[str] = None
    job_id: Optional[str] = None

    class Config:
        extra = "forbid"


class QueueCancelRequest(BaseModel):
    job_id: str


def _max_parallel_snapshot() -> int:
    return max(1, int(_CAPACITY_PLAN.get("batch_size") or 1))


def _default_speed() -> float:
    """Server-wide default playback speed for every generation: the
    QWEN3TTS_SPEED env, else the shared QWEN3TTS_DEFAULT_SPEED constant loaded
    from pyfoundations.network_constants (single source with the pycore side -
    both sides read the same env, and the managed launch inherits the
    environment, so they always agree)."""
    raw = (os.environ.get("QWEN3TTS_SPEED") or "").strip()
    fallback = float(getattr(_network_constants, "QWEN3TTS_DEFAULT_SPEED", 0.75))
    try:
        value = float(raw) if raw else fallback
    except ValueError:
        value = fallback
    return min(3.0, max(0.25, value))


def _get_synthesis() -> QwenSynthesis:
    global _SYNTHESIS
    if _SYNTHESIS is None:
        _SYNTHESIS = QwenSynthesis(
            get_model=_get_model,
            model_lock=_model_lock,
            resolve_speaker=_resolve_speaker,
            speaker_for_variant=_speaker_for_variant,
            qwen_language=_qwen_language,
            capacity_plan=_capacity_plan_snapshot,
            logger=_log,
            default_speed=_default_speed,
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
            batchable=_get_synthesis().queue_batchable,
            progress_snapshot=_get_synthesis().runtime,
        )
    return _QUEUE


@app.get("/health")
def health():
    return _health_snapshot()

@app.get("/capabilities")
def capabilities():
    """Return runtime speaker/language support from the loaded model."""
    caps = _CAPABILITIES.snapshot(_model)
    return {
        "ok": True,
        "model_id": caps.get("model_id"),
        "model_kind": caps.get("model_kind"),
        "languages": caps.get("languages"),
        "speakers": caps.get("speakers"),
        "default_speakers": DEFAULT_SPEAKERS,
        # Runtime-derived per-language native pools (model speakers +
        # model-card metadata preference) - the dynamic source the random
        # default actually picks from.
        "native_pools": _CAPABILITIES.native_pools(_model),
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
    return await _status_snapshot()


@app.get("/load")
def load():
    """Warm up the model without synthesizing, so the loading process is visible
    on the console before the first /synthesize call."""
    t0 = time.monotonic()
    try:
        _get_model()
        return {
            "ok": True,
            "model_loaded": True,
            "device": _device or _resolve_device(),
            "model_id": _model_id(),
            "capacity_plan": _capacity_plan_snapshot(),
            "elapsed_ms": round((time.monotonic() - t0) * 1000),
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
        result = _get_synthesis().generate_one(req.model_dump())
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
            "variants": [variant.model_dump() for variant in variants],
            "format": fmt,
        })
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/queue/submit")
async def queue_submit(req: QueueSubmitRequest):
    try:
        job = await _get_queue().submit(req.model_dump())
        runtime = await asyncio.to_thread(_service_runtime_snapshot)
        return {
            "ok": True,
            "event_instance_id": http_service.events.instance_id,
            **job,
            **runtime,
        }
    except QueueFullError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=429)
    except (TypeError, ValueError) as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=400)


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
