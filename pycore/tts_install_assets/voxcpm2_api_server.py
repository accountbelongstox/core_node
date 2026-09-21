#!/usr/bin/env python3
"""VoxCPM2 HTTP API for pycore (subprocess in the DEDICATED isolated venv).

Runs inside the per-engine self-contained venv (engine "voxcpm2", base
interpreter Python 3.10; see pycore/pyutils/common/python_env/isolated_venv.py),
launched by tts_service_manager.py - NEVER the main pycore interpreter, whose
3.13 ABI is outside VoxCPM2's official 3.10-3.12 window. No pycore imports here;
the shared chunking helpers are staged as sibling files (tts_text_chunking.py,
tts_audio_assembly.py).

Long-text contract: VoxCPM2 has no native sentence splitting (upstream
src/voxcpm/core.py only caps generation at max_len=4096 TOKENS), so the server
owns outer text segmentation via tts_audio_assembly.generate_chunked: split ->
per-chunk native single-shot generate -> validate -> concatenate with the
policy pause. Any chunk failure fails the whole task; the per-chunk attempt
budget (policy.max_attempts) merges the native badcase retry.

Official: https://github.com/OpenBMB/VoxCPM  pip install voxcpm

Env:
  VOXCPM2_HOST / VOXCPM2_PORT - bind (default 127.0.0.1:57214)
  VOXCPM2_MODEL               - HuggingFace id or local path (default openbmb/VoxCPM2)
  VOXCPM2_DEVICE              - cpu | cuda | cuda:0 | auto (default auto)
  VOXCPM2_CFG                 - cfg_value float (default 2.0)
  VOXCPM2_TIMESTEPS           - inference_timesteps int (default 10)
  VOXCPM2_PROMPT_WAV          - optional reference wav for voice cloning
  VOXCPM2_PROMPT_TEXT         - transcript of the reference wav

Endpoints:
  GET  /health       -> { ok, device, model_loaded, load_error, sample_rate }
  GET  /             -> same as /health
  GET  /load         -> warm the model (visible on the console)
  POST /synthesize   -> { text, language?, speed?, prompt_wav_path?, prompt_text?,
                         cfg_value?, inference_timesteps? } -> PCM16 WAV bytes
"""

import io
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from tts_audio_assembly import (
    ChunkedGenerationCancelled,
    ChunkedGenerationError,
    generate_chunked,
)

app = FastAPI()
_model: Any = None
_model_lock = threading.Lock()
_device: Optional[str] = None
_load_error: Optional[str] = None
_sample_rate: int = 0


def _resolve_device() -> str:
    want = (os.environ.get("VOXCPM2_DEVICE") or "auto").strip() or "auto"
    if want != "auto":
        return want
    try:
        import torch

        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _model_id() -> str:
    return (os.environ.get("VOXCPM2_MODEL") or "openbmb/VoxCPM2").strip()


def _cfg_value() -> float:
    try:
        return float(os.environ.get("VOXCPM2_CFG", "2.0") or "2.0")
    except ValueError:
        return 2.0


def _timesteps() -> int:
    try:
        return max(1, int(os.environ.get("VOXCPM2_TIMESTEPS", "10") or "10"))
    except ValueError:
        return 10


def _prompt_wav() -> str:
    return (os.environ.get("VOXCPM2_PROMPT_WAV") or "").strip()


def _prompt_text() -> str:
    return (os.environ.get("VOXCPM2_PROMPT_TEXT") or "").strip()


def _load_model() -> Any:
    global _device, _load_error, _sample_rate

    _device = _resolve_device()
    model_id = _model_id()
    print(f"[api] loading VoxCPM2 model: {model_id} device={_device}", flush=True)
    t0 = time.time()
    try:
        from voxcpm import VoxCPM

        kwargs: Dict[str, Any] = {"load_denoiser": False}
        if _device != "auto":
            kwargs["device"] = _device
        model = VoxCPM.from_pretrained(model_id, **kwargs)
        _sample_rate = int(
            getattr(getattr(model, "tts_model", None), "sample_rate", 0) or 16000
        )
        _load_error = None
        print(
            f"[api] model loaded in {time.time() - t0:.1f}s "
            f"(sample_rate={_sample_rate})",
            flush=True,
        )
        return model
    except Exception as exc:  # noqa: BLE001
        _load_error = str(exc)
        print(
            f"[api] model load FAILED after {time.time() - t0:.1f}s: {exc}",
            flush=True,
        )
        raise


def _get_model() -> Any:
    global _model
    with _model_lock:
        if _model is None:
            _model = _load_model()
        return _model


def _generate_once(
    text: str,
    prompt_wav_path: str,
    prompt_text: str,
    cfg_value: float,
    timesteps: int,
) -> Tuple[Any, int]:
    """Native single-shot generation for one chunk."""
    model = _get_model()
    kwargs: Dict[str, Any] = {
        "text": text,
        "cfg_value": cfg_value,
        "inference_timesteps": timesteps,
    }
    if prompt_wav_path:
        kwargs["prompt_wav_path"] = prompt_wav_path
        if prompt_text:
            kwargs["prompt_text"] = prompt_text
    with _model_lock:
        wav = model.generate(**kwargs)
    import numpy as np

    rate = _sample_rate or int(
        getattr(getattr(model, "tts_model", None), "sample_rate", 0) or 16000
    )
    return np.asarray(wav, dtype=np.float32).reshape(-1), rate


def _wav_bytes(samples: Any, sample_rate: int) -> bytes:
    """PCM16 WAV via soundfile (present in the engine venv) - no ffmpeg here;
    the main process owns mp3 conversion."""
    import numpy as np
    import soundfile as sf

    arr = np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, arr, int(sample_rate), format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


class SynthRequest(BaseModel):
    text: str
    language: str = "en"
    speed: float = 1.0
    prompt_wav_path: Optional[str] = None
    prompt_text: Optional[str] = None
    cfg_value: Optional[float] = None
    inference_timesteps: Optional[int] = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "device": _device or _resolve_device(),
        "model": _model_id(),
        "model_loaded": _model is not None,
        "sample_rate": _sample_rate or None,
        "load_error": None if _model is not None else _load_error,
    }


@app.get("/")
def root():
    return health()


@app.get("/load")
def load():
    """Warm the model so the loading process is visible on the console before
    the first /synthesize call."""
    t0 = time.time()
    try:
        _get_model()
        return {
            "ok": True,
            "model_loaded": True,
            "device": _device or _resolve_device(),
            "sample_rate": _sample_rate,
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
    cfg_value = float(req.cfg_value) if req.cfg_value else _cfg_value()
    timesteps = int(req.inference_timesteps) if req.inference_timesteps else _timesteps()
    prompt_wav_path = (req.prompt_wav_path or "").strip() or _prompt_wav()
    prompt_text = (req.prompt_text or "").strip() or _prompt_text()
    print(f"[api] /synthesize chars={len(text)} cfg={cfg_value} "
          f"timesteps={timesteps} clone={bool(prompt_wav_path)}", flush=True)
    try:
        t0 = time.time()
        result = generate_chunked(
            text,
            lambda chunk: _generate_once(
                chunk, prompt_wav_path, prompt_text, cfg_value, timesteps
            ),
            engine="voxcpm2",
        )
        data = _wav_bytes(result.wav, result.sample_rate)
        print(f"[api] synthesized {len(data)} bytes (wav) @ {result.sample_rate}Hz "
              f"chunks={result.chunk_count} in {time.time() - t0:.2f}s", flush=True)
        return StreamingResponse(io.BytesIO(data), media_type="audio/wav")
    except ChunkedGenerationCancelled as exc:
        return JSONResponse({"error": str(exc), "cancelled": True}, status_code=499)
    except ChunkedGenerationError as exc:
        print(f"[api] /synthesize FAILED: {exc}", flush=True)
        return JSONResponse({"error": str(exc)}, status_code=500)
    except Exception as exc:  # noqa: BLE001
        print(f"[api] /synthesize FAILED: {exc}", flush=True)
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    host = (os.environ.get("VOXCPM2_HOST") or "127.0.0.1").strip()
    port = int(os.environ.get("VOXCPM2_PORT") or "57214")
    print(f"[api] VoxCPM2 API server starting on {host}:{port} "
          f"(model={_model_id()}, device={_resolve_device()})", flush=True)
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
