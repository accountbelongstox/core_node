#!/usr/bin/env python3
"""
MeloTTS HTTP API for pycore (subprocess in the DEDICATED isolated venv).

Runs inside the per-engine isolated venv (see pycore/pyutils/tts/isolated_venv.py,
engine "melotts"), launched by tts_service_manager.py - NEVER the main pycore
interpreter, because MeloTTS pins an OLD transformers (~4.27.x) which would
downgrade the main interpreter's shared Bucket-A pin (~4.46.x) and break
DeepSeek/Qwen2.5/NLLB. No pycore imports here - standalone script. Lifecycle spec:
development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.

Official: https://github.com/myshell-ai/MeloTTS  import: from melo.api import TTS

Env:
  MELOTTS_HOST / MELOTTS_PORT - bind (default 127.0.0.1:57212)
  MELOTTS_MODEL               - default MeloTTS language model to warm (EN/ZH/...;
                                default "en"); per-request `language` still wins
  MELOTTS_DEVICE              - cpu | cuda:0 | auto (default auto)

Endpoints:
  GET  /health       -> { ok, device, model_loaded, loaded_langs, load_error }
  GET  /             -> same as /health
  GET  /load         -> warm the default language model (visible on the console)
  POST /synthesize   -> { text, language, speaker?, speed?, format(wav|mp3) } -> audio bytes
"""

import io
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI()
_models: Dict[str, Any] = {}
_model_lock = threading.Lock()
_device: Optional[str] = None
_load_error: Optional[str] = None

# lang code -> (MeloTTS language, default speaker); mirrors melotts_engine._LANG_MAP.
_LANG_MAP: Dict[str, Tuple[str, str]] = {
    "en": ("EN", "EN-US"),
    "zh": ("ZH", "ZH"),
    "ja": ("JP", "JP"),
    "ko": ("KR", "KR"),
    "es": ("ES", "ES"),
    "fr": ("FR", "FR"),
}


def _resolve_device() -> str:
    want = (os.environ.get("MELOTTS_DEVICE") or "auto").strip().lower() or "auto"
    if want != "auto":
        return want
    try:
        import torch
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _default_lang() -> str:
    return (os.environ.get("MELOTTS_MODEL") or "en").strip() or "en"


def _melo_lang(lang: str) -> Tuple[str, str]:
    return _LANG_MAP.get((lang or "en").strip().lower(), ("EN", "EN-US"))


def _load_model(melo_lang: str):
    global _device, _load_error
    from melo.api import TTS

    _device = _resolve_device()
    print(f"[api] loading MeloTTS model: language={melo_lang} device={_device}", flush=True)
    t0 = time.time()
    try:
        model = TTS(language=melo_lang, device=_device)
        print(f"[api] model {melo_lang} loaded in {time.time() - t0:.1f}s", flush=True)
        return model
    except Exception as exc:  # noqa: BLE001
        _load_error = str(exc)
        print(f"[api] model {melo_lang} load FAILED after {time.time() - t0:.1f}s: {exc}", flush=True)
        raise


def _get_model(melo_lang: str):
    with _model_lock:
        if melo_lang in _models:
            return _models[melo_lang]
        model = _load_model(melo_lang)
        _models[melo_lang] = model
        return model


def _speaker_id(model, spk_want: str) -> int:
    spk2id = model.hps.data.spk2id
    upper = (spk_want or "").upper()
    for name, sid in spk2id.items():
        if name.upper() == upper or name.upper().startswith(upper):
            return sid
    return next(iter(spk2id.values()))


def _wav_bytes(samples, sample_rate: int) -> bytes:
    """PCM16 WAV via soundfile - no ffmpeg dependency (unlike the mp3 path)."""
    import numpy as np
    import soundfile as sf
    arr = np.asarray(samples, dtype=np.float32)
    arr = np.clip(arr, -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, arr, int(sample_rate), format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


def _mp3_bytes(samples, sample_rate: int) -> bytes:
    import numpy as np
    from pydub import AudioSegment
    arr = np.asarray(samples, dtype=np.float32)
    arr = np.clip(arr, -1.0, 1.0)
    pcm16 = (arr * 32767.0).astype(np.int16)
    seg = AudioSegment(pcm16.tobytes(), frame_rate=int(sample_rate), sample_width=2, channels=1)
    buf = io.BytesIO()
    seg.export(buf, format="mp3")
    buf.seek(0)
    return buf.read()


def _encode_audio(samples, sample_rate: int, fmt: str) -> Tuple[bytes, str]:
    if (fmt or "mp3").strip().lower() == "wav":
        return _wav_bytes(samples, sample_rate), "audio/wav"
    return _mp3_bytes(samples, sample_rate), "audio/mpeg"


class SynthRequest(BaseModel):
    text: str
    language: str = "en"
    speaker: Optional[str] = None
    speed: float = 1.0
    format: str = "mp3"


@app.get("/health")
def health():
    loaded: List[str] = list(_models.keys())
    return {
        "ok": True,
        "device": _device or _resolve_device(),
        "model_loaded": bool(loaded),
        "loaded_langs": loaded,
        "load_error": None if loaded else _load_error,
    }


@app.get("/")
def root():
    return health()


@app.get("/load")
def load():
    """Warm the default language model so the loading process is visible on the
    console before the first /synthesize call."""
    melo_lang, _ = _melo_lang(_default_lang())
    t0 = time.time()
    try:
        _get_model(melo_lang)
        return {
            "ok": True,
            "model_loaded": True,
            "device": _device or _resolve_device(),
            "language": melo_lang,
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
    melo_lang, default_spk = _melo_lang(req.language)
    print(f"[api] /synthesize lang={req.language}->{melo_lang} "
          f"speaker={req.speaker or default_spk} fmt={fmt} chars={len(text)}", flush=True)
    try:
        model = _get_model(melo_lang)
        sid = _speaker_id(model, (req.speaker or "").strip() or default_spk)
        t0 = time.time()
        with _model_lock:
            audio = model.tts_to_file(
                text, sid, output_path=None, speed=float(req.speed or 1.0),
            )
        sr = int(model.hps.data.sampling_rate)
        data, media = _encode_audio(audio, sr, fmt)
        print(f"[api] synthesized {len(data)} bytes ({fmt}) @ {sr}Hz "
              f"in {time.time() - t0:.2f}s", flush=True)
        return StreamingResponse(io.BytesIO(data), media_type=media)
    except Exception as exc:  # noqa: BLE001
        print(f"[api] /synthesize FAILED: {exc}", flush=True)
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    host = (os.environ.get("MELOTTS_HOST") or "127.0.0.1").strip()
    port = int(os.environ.get("MELOTTS_PORT") or "57212")
    print(f"[api] MeloTTS API server starting on {host}:{port} "
          f"(default_lang={_default_lang()}, device={_resolve_device()})", flush=True)
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
