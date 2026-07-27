#!/usr/bin/env python3
import torch
from qwen_tts import Qwen3TTSModel
"""
Qwen3-TTS HTTP API for pycore (subprocess in the DEDICATED isolated venv).

Runs inside the dedicated isolated venv (see pycore/pyutils/tts/qwen3tts_venv.py),
launched by tts_service_manager.py (production) or qwen3tts_service.py (tester) -
NEVER the main pycore interpreter, because qwen-tts owns transformer dependencies that
conflicts with the main interpreter's ~4.46.x pin. No pycore imports here - standalone
script. Lifecycle spec: development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.

Official: https://github.com/QwenLM/Qwen3-TTS  pip install -U qwen-tts

Env:
  QWEN3TTS_HOST / QWEN3TTS_PORT  - bind (default 127.0.0.1:57210)
  QWEN3TTS_MODEL                 - HF id or local path
  QWEN3TTS_DEVICE                - cpu | cuda:0 | auto (default auto)
  QWEN3TTS_SPEAKER               - preset speaker override
  QWEN3TTS_INSTRUCT              - optional style/emotion instruction
  QWEN3TTS_MAX_PARALLEL          - override auto GPU-tuned batch size

Endpoints:
  GET  /health              -> { ok, device, model_loaded, load_error }
  GET  /                     -> same as /health
  POST /synthesize           -> { text, language, speaker, instruct? } -> mp3 bytes
  POST /synthesize_batch     -> { text, language, variants:[{key,accent,gender}] }
                                 -> { results: [{key, ok, audio_base64, error}] }
"""

import base64
import io
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI()
_model = None
_model_lock = threading.Lock()
_device: Optional[str] = None
_load_error: Optional[str] = None


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
_VARIANT_SPEAKER_EN = {
    ("us", "female"): "Emma", ("uk", "female"): "Sophia",
    ("us", "male"): "Ryan", ("uk", "male"): "Aiden",
}
_SPEAKER_PRESETS = {
    "en": {"female": ["Emma", "Sophia"], "male": ["Ryan", "Aiden"]},
    "zh": {"female": ["Vivian", "Serena"], "male": ["Uncle_Fu", "Dylan"]},
    "ja": {"female": ["Ono_Anna", "Hina"], "male": ["Ono_Anna"]},
    "ko": {"female": ["Sohee"], "male": ["Hyunwoo"]},
}
_BATCH_VRAM_MB: Dict[str, Dict[int, int]] = {
    "0.6B": {1: 4096, 4: 6144, 8: 9216, 16: 14336, 32: 24576},
    "1.7B": {1: 8192, 4: 12288, 8: 18432, 16: 28672, 32: 49152},
}
_MAX_PARALLEL_CAP = 64
_DEFAULT_RESERVE_RATIO = 0.12


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


def _qwen_language(lang: str) -> str:
    code = (lang or "en").strip().lower()[:2]
    return _LANG_MAP.get(code, "Auto")


def _speaker(lang: str) -> str:
    explicit = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    if explicit:
        return explicit
    code = (lang or "en").strip().lower()[:2]
    return _SPEAKER_BY_LANG.get(code, "Ryan")


def _speaker_for_variant(lang: str, variant: Dict[str, Any], index: int) -> str:
    explicit = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    if explicit:
        return explicit
    code = (lang or "en").strip().lower()[:2]
    accent = (variant.get("accent") or "").strip().lower()
    gender = (variant.get("gender") or "female").strip().lower()
    if gender not in ("female", "male"):
        gender = "female"
    if code == "en" and accent in ("us", "uk"):
        mapped = _VARIANT_SPEAKER_EN.get((accent, gender))
        if mapped:
            return mapped
    presets = _SPEAKER_PRESETS.get(code) or _SPEAKER_PRESETS["en"]
    options = presets.get(gender) or presets.get("female") or ["Ryan"]
    return options[index % len(options)]


def _nvidia_smi_cmd() -> str:
    """Resolve nvidia-smi by full path (not PATH-only) so this venv subprocess still
    finds it under a sanitized PATH. Mirrors CUDADetector._nvidia_smi_cmd (standalone -
    no pycore import here). Returns '' when unavailable."""
    found = shutil.which("nvidia-smi")
    if found:
        return found
    candidates = []
    if os.name == "nt":
        sysroot = os.environ.get("SystemRoot") or r"C:\Windows"
        candidates.append(os.path.join(sysroot, "System32", "nvidia-smi.exe"))
        for pf_var in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
            pf = os.environ.get(pf_var)
            if pf:
                candidates.append(os.path.join(pf, "NVIDIA Corporation", "NVSMI", "nvidia-smi.exe"))
    else:
        candidates.extend(["/usr/bin/nvidia-smi", "/usr/local/bin/nvidia-smi", "/bin/nvidia-smi"])
    for cand in candidates:
        if cand and os.path.isfile(cand):
            return cand
    return ""


def _query_gpu_snapshot(device_index: int = 0) -> Dict[str, Any]:
    exe = _nvidia_smi_cmd()
    base = {"available": False, "util_percent": None, "mem_used_mb": 0, "mem_total_mb": 0}
    if not exe:
        return base
    try:
        out = subprocess.run(
            [exe, "--query-gpu=index,name,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
        )
    except Exception:  # noqa: BLE001
        return base
    if out.returncode != 0:
        return base
    rows: List[Dict[str, Any]] = []
    for line in (out.stdout or "").splitlines():
        parts = [p.strip() for p in line.strip().split(",") if p.strip()]
        if len(parts) < 5:
            continue

        def _num(tok, cast):
            try:
                return cast(tok)
            except (ValueError, TypeError):
                return None
        rows.append({
            "index": _num(parts[0], int) or 0,
            "util_percent": _num(parts[2], float),
            "mem_used_mb": _num(parts[3], int) or 0,
            "mem_total_mb": _num(parts[4], int) or 0,
        })
    if not rows:
        return base
    picked = rows[device_index] if device_index < len(rows) else rows[0]
    picked["available"] = True
    return picked


def _load_factor(gpu_util_percent: Optional[float]) -> float:
    if gpu_util_percent is None:
        return 1.0
    util = float(gpu_util_percent)
    if util >= 85.0:
        return 0.25
    if util >= 65.0:
        return 0.5
    if util >= 45.0:
        return 0.75
    return 1.0


def _detect_model_variant(model_id: str) -> str:
    return "0.6B" if "0.6b" in (model_id or "").lower() else "1.7B"


def _estimate_max_parallel(model_variant: str, gpu_total_mb: int, gpu_used_mb: int,
                            gpu_util_percent: Optional[float] = None) -> int:
    curve = _BATCH_VRAM_MB.get(model_variant) or _BATCH_VRAM_MB["1.7B"]
    total_mb = max(int(gpu_total_mb or 0), 0)
    used_mb = max(int(gpu_used_mb or 0), 0)
    budget = int(total_mb * (1.0 - _DEFAULT_RESERVE_RATIO)) if total_mb > 0 else 0
    max_by_vram = 1
    for batch_size, need_mb in sorted(curve.items()):
        if need_mb <= budget:
            max_by_vram = batch_size
    free_mb = max(0, total_mb - used_mb)
    max_by_free = 1
    base_mb = curve[1]
    if free_mb > 0 and 8 in curve:
        per_item = max(256, int((curve[8] - base_mb) / 7))
        extra = max(0, int((free_mb - max(0, base_mb - used_mb)) / per_item))
        max_by_free = max(1, 1 + extra)
    raw = max(1, min(max_by_vram, max_by_free, _MAX_PARALLEL_CAP))
    adjusted = max(1, min(_MAX_PARALLEL_CAP, int(raw * _load_factor(gpu_util_percent))))
    env_cap = (os.environ.get("QWEN3TTS_MAX_PARALLEL") or "").strip()
    if env_cap.isdigit():
        adjusted = max(1, min(int(env_cap), _MAX_PARALLEL_CAP))
    return adjusted


def _mp3_bytes(wav_samples, sample_rate: int) -> bytes:
    import numpy as np
    from pydub import AudioSegment
    arr = np.asarray(wav_samples, dtype=np.float32)
    arr = np.clip(arr, -1.0, 1.0)
    pcm16 = (arr * 32767.0).astype(np.int16)
    seg = AudioSegment(pcm16.tobytes(), frame_rate=int(sample_rate), sample_width=2, channels=1)
    buf = io.BytesIO()
    seg.export(buf, format="mp3")
    buf.seek(0)
    return buf.read()


def _wav_bytes(wav_samples, sample_rate: int) -> bytes:
    """PCM16 WAV via soundfile - no ffmpeg dependency (unlike the mp3 path)."""
    import numpy as np
    import soundfile as sf
    arr = np.asarray(wav_samples, dtype=np.float32)
    arr = np.clip(arr, -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, arr, int(sample_rate), format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


def _encode_audio(wav_samples, sample_rate: int, fmt: str) -> "tuple[bytes, str]":
    if (fmt or "mp3").strip().lower() == "wav":
        return _wav_bytes(wav_samples, sample_rate), "audio/wav"
    return _mp3_bytes(wav_samples, sample_rate), "audio/mpeg"


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
    """Return supported languages and speakers."""
    return {
        "ok": True,
        "languages": _LANG_MAP,
        "speakers": _SPEAKER_PRESETS,
        "default_speakers": _SPEAKER_BY_LANG,
    }


@app.get("/")
def root():
    return health()


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
        model = _get_model()
        qwen_lang = _qwen_language(req.language)
        speaker = (req.speaker or "").strip() or _speaker(req.language)
        gen_kwargs: Dict[str, Any] = {"text": text, "language": qwen_lang, "speaker": speaker}
        instruct = (req.instruct or os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()
        if instruct:
            gen_kwargs["instruct"] = instruct
        t0 = time.time()
        with _model_lock:
            wavs, sr = model.generate_custom_voice(**gen_kwargs)
        audio, media = _encode_audio(wavs[0], sr, fmt)
        _log(f"[api] synthesized {len(audio)} bytes ({fmt}) @ {int(sr)}Hz "
             f"in {time.time() - t0:.2f}s")
        return StreamingResponse(io.BytesIO(audio), media_type=media)
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
        model = _get_model()
        qwen_lang = _qwen_language(req.language)
        speakers = [
            _speaker_for_variant(req.language, v.dict(), i) for i, v in enumerate(variants)
        ]
        gpu_idx = 0
        dev = _device or _resolve_device()
        if ":" in dev:
            suffix = dev.rsplit(":", 1)[-1]
            if suffix.isdigit():
                gpu_idx = int(suffix)
        snap = _query_gpu_snapshot(gpu_idx)
        n = len(variants)
        max_parallel = _estimate_max_parallel(
            _detect_model_variant(_model_id()),
            snap.get("mem_total_mb") or 0, snap.get("mem_used_mb") or 0,
            snap.get("util_percent"),
        )
        max_parallel = max(1, min(max_parallel, n))
        results: List[Dict[str, Any]] = [None] * n  # type: ignore[list-item]
        with _model_lock:
            for start in range(0, n, max_parallel):
                chunk_speakers = speakers[start:start + max_parallel]
                chunk_n = len(chunk_speakers)
                try:
                    wavs, sr = model.generate_custom_voice(
                        text=[text] * chunk_n, language=[qwen_lang] * chunk_n,
                        speaker=chunk_speakers, non_streaming_mode=True,
                    )
                    for offset, wav in enumerate(wavs):
                        idx = start + offset
                        try:
                            audio_bytes, _ = _encode_audio(wav, sr, fmt)
                            audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                            results[idx] = {
                                "key": variants[idx].key, "ok": True,
                                "audio_base64": audio_b64, "error": None,
                            }
                        except Exception as e:
                            results[idx] = {
                                "key": variants[idx].key, "ok": False,
                                "audio_base64": None, "error": f"encode failed: {e}",
                            }
                except Exception as chunk_exc:
                    _log(f"[api] chunk failed, falling back to item-by-item: {chunk_exc}")
                    # Fallback to item-by-item for this chunk
                    for offset in range(chunk_n):
                        idx = start + offset
                        try:
                            wavs, sr = model.generate_custom_voice(
                                text=[text], language=[qwen_lang],
                                speaker=[chunk_speakers[offset]], non_streaming_mode=True,
                            )
                            audio_bytes, _ = _encode_audio(wavs[0], sr, fmt)
                            audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                            results[idx] = {
                                "key": variants[idx].key, "ok": True,
                                "audio_base64": audio_b64, "error": None,
                            }
                        except Exception as item_exc:
                            results[idx] = {
                                "key": variants[idx].key, "ok": False,
                                "audio_base64": None, "error": str(item_exc),
                            }
        return {"results": results}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    host = (os.environ.get("QWEN3TTS_HOST") or "127.0.0.1").strip()
    port = int(os.environ.get("QWEN3TTS_PORT") or "57210")
    _log(f"[api] Qwen3-TTS API server starting on {host}:{port} "
         f"(model={_model_id()}, device={_resolve_device()})")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
