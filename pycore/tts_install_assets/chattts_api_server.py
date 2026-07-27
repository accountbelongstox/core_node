#!/usr/bin/env python3
import torch
import ChatTTS
import numpy as np
from pydub import AudioSegment
"""
ChatTTS HTTP API for pycore (OpenAI-compatible /v1/audio/speech).

Uses the official PyPI package (pip install ChatTTS) per:
  https://github.com/2noise/ChatTTS#installation

Run from the staging dir after install_chattts:
  python chattts_api_server.py

Env:
  CHATTTS_HOST / CHATTTS_PORT      - bind (default 0.0.0.0:8000)
  CHATTTS_DEVICE                   - cuda | cpu | auto (default auto)
  CHATTTS_MODEL_SOURCE             - local | huggingface | auto (default auto)
  CHATTTS_VOICE                    - default voice label (cosmetic)
  CHATTTS_PROMPT                   - oral tags prefix (e.g. [oral_2][laugh_0][break_6])
"""

import io
import os
import threading
from typing import List, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI()
_chat = None
_chat_lock = threading.Lock()
_device = None
_load_error: Optional[str] = None


def _resolve_device() -> str:
    want = (os.environ.get("CHATTTS_DEVICE") or "auto").strip().lower() or "auto"
    if want in ("cpu", "cuda"):
        return want
    try:
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _model_sources() -> List[str]:
    want = (os.environ.get("CHATTTS_MODEL_SOURCE") or "auto").strip().lower() or "auto"
    if want == "local":
        return ["local"]
    if want == "huggingface":
        return ["huggingface"]
    return ["local", "huggingface"]


def _model_ready(chat) -> bool:
    return chat is not None and hasattr(chat, "speaker")


def _load_chat_model():
    global _device, _load_error

    _device = _resolve_device()
    model = ChatTTS.Chat()
    errors: List[str] = []
    for source in _model_sources():
        try:
            ok = model.load(compile=False, device=_device, source=source)
        except Exception as exc:
            errors.append(f"{source}: {exc}")
            continue
        if ok and _model_ready(model):
            _load_error = None
            return model
        errors.append(f"{source}: load returned False (models missing in cwd?)")
    _load_error = "; ".join(errors) or "ChatTTS model load failed"
    raise RuntimeError(_load_error)


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
    return {
        "ok": True,
        "device": _device or _resolve_device(),
        "model_loaded": ready,
        "load_error": None if ready else _load_error,
    }


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
