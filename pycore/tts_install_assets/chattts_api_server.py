#!/usr/bin/env python3
"""
ChatTTS HTTP API for pycore (OpenAI-compatible /v1/audio/speech).

Uses the official PyPI package (pip install ChatTTS) per:
  https://github.com/2noise/ChatTTS#installation

Run from the staging dir after install_chattts:
  python chattts_api_server.py

Env:
  CHATTTS_HOST / CHATTTS_PORT      - bind (default 0.0.0.0:8000)
  CHATTTS_DEVICE                   - cuda | cpu | auto (default auto)
  CHATTTS_MODEL_DIR                - installer-managed model directory
  CHATTTS_VOICE                    - default voice label (cosmetic)
  CHATTTS_PROMPT                   - oral tags prefix (e.g. [oral_2][laugh_0][break_6])
"""

import io
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Optional

import ChatTTS
import numpy as np
import torch
import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydub import AudioSegment
from pydantic import BaseModel, Field

_chat = None
_chat_lock = threading.Lock()
_inference_lock = threading.Lock()
_device = None
_load_error: Optional[str] = None
_MODEL_DIR_ENV = "CHATTTS_MODEL_DIR"


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _get_chat()
    yield


app = FastAPI(lifespan=_lifespan)


def _resolve_device() -> str:
    want = (os.environ.get("CHATTTS_DEVICE") or "auto").strip().lower() or "auto"
    if want in ("cpu", "cuda"):
        return want
    return "cuda" if torch.cuda.is_available() else "cpu"


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


@app.get("/health")
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


@app.get("/")
def root():
    return health()


def _mp3_bytes(wav_samples) -> bytes:
    arr = np.asarray(wav_samples, dtype=np.float32)
    arr = np.clip(arr, -1.0, 1.0)
    pcm16 = (arr * 32767.0).astype(np.int16)
    seg = AudioSegment(
        pcm16.tobytes(),
        frame_rate=24000,
        sample_width=2,
        channels=1,
    )
    buf = io.BytesIO()
    seg.export(buf, format="mp3")
    buf.seek(0)
    return buf.read()


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
        params_infer = ChatTTS.Chat.InferCodeParams(
            prompt=f"[speed_{speed_tag}]",
            spk_emb=chat.sample_random_speaker(),
        )
        with _inference_lock:
            wavs = chat.infer(
                [payload],
                skip_refine_text=True,
                params_infer_code=params_infer,
            )
        if not wavs:
            return JSONResponse({"error": "no audio"}, status_code=500)
        audio = _mp3_bytes(wavs[0])
        return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    host = (os.environ.get("CHATTTS_HOST") or "0.0.0.0").strip()
    port = int(os.environ.get("CHATTTS_PORT") or "8000")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
