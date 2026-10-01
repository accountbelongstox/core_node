#!/usr/bin/env python3
"""
ChatTTS HTTP API for pycore (OpenAI-compatible /v1/audio/speech).

Uses the official PyPI package (pip install ChatTTS) per:
  https://github.com/2noise/ChatTTS#installation

Run from the staging dir after install_chattts:
  python chattts_api_server.py

Env:
  CHATTTS_HOST / CHATTTS_PORT      - bind (default 127.0.0.1:8000)
  CHATTTS_DEVICE                   - cuda | cpu | auto (default auto); auto picks
                                     cuda only when enough VRAM is FREE (see below)
  CHATTTS_MIN_FREE_VRAM_MB         - free-VRAM floor for auto->cuda (default 4096;
                                     ChatTTS official FAQ: at least 4 GB of GPU
                                     memory is required for a 30-second clip)
  CHATTTS_MODEL_DIR                - installer-managed model directory
  CHATTTS_VOICE                    - default voice label (cosmetic)
  CHATTTS_PROMPT                   - oral tags prefix (e.g. [oral_2][laugh_0][break_6])
"""

import hashlib
import io
import os

# PyTorch official recommendation (docs.pytorch.org docs/stable/notes/cuda.html)
# against allocation fragmentation; must be set before torch initializes.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Optional

_CURRENT_DIR = Path(__file__).resolve().parent
if str(_CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(_CURRENT_DIR))

import tts_server_common

import ChatTTS
import torch
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

_network_constants = tts_server_common.load_network_constants()
_CHATTS_MIN_FREE_VRAM_MB = getattr(_network_constants, "CHATTTS_MIN_FREE_VRAM_MB", 4096)
_DEFAULT_PORT = getattr(_network_constants, "CHATTTS_HTTP_PORT", 8000)
_MODEL_DIR_ENV = "CHATTTS_MODEL_DIR"

_chat = None
_chat_lock = threading.Lock()
_inference_lock = threading.Lock()
# One fixed speaker embedding per requested voice name (seeded from the name),
# so every call - and every word of a batch fallback - uses the same voice.
_speakers = {}
_SAMPLE_RATE = 24000
_device = None
_load_error: Optional[str] = None


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _get_chat()
    yield


app = FastAPI(lifespan=_lifespan)


def _resolve_device() -> str:
    return tts_server_common.resolve_device(
        "CHATTTS_DEVICE",
        torch,
        cuda_device="cuda",
        min_free_vram_mb=tts_server_common.env_int("CHATTTS_MIN_FREE_VRAM_MB", _CHATTS_MIN_FREE_VRAM_MB),
    )


def _model_dir() -> Path:
    configured = (os.environ.get(_MODEL_DIR_ENV) or "").strip()
    return Path(configured) if configured else Path.cwd() / "weights"


def _model_ready(chat) -> bool:
    return chat is not None and hasattr(chat, "speaker")


def _load_chat_model():
    global _device, _load_error

    _device = _resolve_device()
    model_path = _model_dir()
    if not model_path.is_dir():
        _load_error = f"ChatTTS model directory is missing: {model_path}"
        raise RuntimeError(_load_error)
    if _device == "cuda":
        fraction = tts_server_common.apply_gpu_memory_fraction(torch)
        if fraction:
            print(f"[chattts] CUDA allocator capped to {fraction:.3f} of VRAM (display headroom)", flush=True)
    model = ChatTTS.Chat()
    loaded = model.load(
        compile=False,
        custom_path=str(model_path),
        device=_device,
        source="custom",
    )
    if not loaded or not _model_ready(model):
        _load_error = f"ChatTTS model validation failed: {model_path}"
        raise RuntimeError(_load_error)
    _load_error = None
    return model


def _get_chat():
    global _chat
    with _chat_lock:
        if _model_ready(_chat):
            return _chat
        _chat = None
        model = _load_chat_model()
        _chat = model
        return _chat


class SpeechRequest(BaseModel):
    model: str = "tts-1"
    input: str
    voice: Optional[str] = "alloy"
    response_format: str = "mp3"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


def health():
    ready = _model_ready(_chat)
    payload = {
        "ok": True,
        "device": _device or _resolve_device(),
        "model_loaded": ready,
        "load_error": None if ready else _load_error,
    }
    if not ready:
        payload["ok"] = False
        return JSONResponse(payload, status_code=503)
    return payload


tts_server_common.add_lifecycle_routes(app, health)


def _speaker(chat, voice: str):
    """Deterministic speaker embedding of one voice name (inference lock held)."""
    key = (voice or "").strip().lower()
    if key not in _speakers:
        seed = int.from_bytes(hashlib.sha256(key.encode("utf-8")).digest()[:4], "big")
        state = torch.random.get_rng_state()
        torch.manual_seed(seed)
        try:
            _speakers[key] = chat.sample_random_speaker()
        finally:
            torch.random.set_rng_state(state)
    return _speakers[key]


@app.post("/v1/audio/speech")
def audio_speech(req: SpeechRequest):
    text = (req.input or "").strip()
    if not text:
        return JSONResponse({"error": "empty input"}, status_code=400)
    prompt = (os.environ.get("CHATTTS_PROMPT") or "").strip()
    payload = f"{prompt}{text}" if prompt else text
    try:
        chat = _get_chat()
        speed_tag = max(1, min(10, int(round(float(req.speed) * 5))))
        with _inference_lock:
            params_infer = ChatTTS.Chat.InferCodeParams(
                prompt=f"[speed_{speed_tag}]",
                spk_emb=_speaker(chat, req.voice or ""),
            )
            wavs = chat.infer(
                [payload],
                skip_refine_text=True,
                params_infer_code=params_infer,
            )
        if not wavs:
            return JSONResponse({"error": "no audio"}, status_code=500)
        audio, media_type = tts_server_common.encode_audio(wavs[0], _SAMPLE_RATE, req.response_format)
        return StreamingResponse(io.BytesIO(audio), media_type=media_type)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    tts_server_common.run_server(app, "CHATTTS", _DEFAULT_PORT, "ChatTTS API server")


if __name__ == "__main__":
    main()
