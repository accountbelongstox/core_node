#!/usr/bin/env python3
"""
MeloTTS HTTP API for pycore (subprocess in the DEDICATED isolated venv).

Runs inside the per-engine isolated venv (see pycore/pyutils/common/python_env/isolated_venv.py,
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
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from tts_text_chunking import ChunkPolicy, default_policy, split_text
import tts_server_common

torch = tts_server_common.engine_imports.module("torch")
# melo (g2p_en) fetches missing NLTK data at import; the installer owns it.
tts_server_common.forbid_nltk_downloads()
melo_api = tts_server_common.engine_imports.module("melo.api")

_network_constants = tts_server_common.load_network_constants()
_DEFAULT_PORT = getattr(_network_constants, "MELOTTS_HTTP_PORT", 57212)
_INSTALLER = tts_server_common.installer_step("139_install_melotts.sh", "Step55_InstallMelotts.ps1")

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
    return tts_server_common.resolve_device("MELOTTS_DEVICE", torch)


def _default_lang() -> str:
    return (os.environ.get("MELOTTS_MODEL") or "en").strip() or "en"


def _melo_lang(lang: str) -> Tuple[str, str]:
    return _LANG_MAP.get((lang or "en").strip().lower(), ("EN", "EN-US"))


def _load_model(melo_lang: str):
    global _device, _load_error

    _device = _resolve_device()
    print(f"[api] loading MeloTTS model: language={melo_lang} device={_device}", flush=True)
    t0 = time.time()
    try:
        tts_class = tts_server_common.engine_imports.require(melo_api, "melo.api").TTS
        cache_error = tts_server_common.hf_cache_error(_INSTALLER)
        if cache_error:
            raise RuntimeError(cache_error)
        model = tts_class(language=melo_lang, device=_device)
        print(f"[api] model {melo_lang} loaded in {time.time() - t0:.1f}s", flush=True)
        return model
    except Exception as exc:  # noqa: BLE001
        # Loading is offline: a cache miss means the installer did not
        # provision the HF weights or NLTK data.
        _load_error = tts_server_common.weights_missing(f"MeloTTS {melo_lang}", _INSTALLER, str(exc))
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


def _synthesize_guarded(model, sid: int, text: str, speed: float) -> Tuple[Any, int]:
    """Protective chunking for a native-owner engine.

    melo's tts_to_file already splits sentences and concatenates internally, so
    normal texts go through ONE native call (no project splitting, no extra
    pause, speed applied once natively). Only an input whose merged text would
    exceed the hard character cap (soft == hard, so the splitter acts purely as
    a guard against punctuation-free over-long runs) is pre-split here; chunks
    are synthesized natively one by one (speed applied once per chunk) and
    concatenated with the policy pause at chunk boundaries only."""
    base = default_policy("melotts")
    guard = ChunkPolicy(
        owner="native",
        soft_limit=base.hard_limit,
        hard_limit=base.hard_limit,
        max_chunks=base.max_chunks,
        pause_ms=base.pause_ms,
    )
    chunks = split_text(text, guard)
    if len(chunks) <= 1:
        return model.tts_to_file(text, sid, output_path=None, speed=speed), 1
    sr = int(model.hps.data.sampling_rate)
    pause = np.zeros(max(0, sr * base.pause_ms // 1000), dtype=np.float32)
    pieces: List[Any] = []
    for index, chunk in enumerate(chunks):
        audio = model.tts_to_file(chunk.text, sid, output_path=None, speed=speed)
        if index:
            pieces.append(pause)
        pieces.append(np.asarray(audio, dtype=np.float32).reshape(-1))
    return np.concatenate(pieces), len(chunks)


class SynthRequest(BaseModel):
    text: str
    language: str = "en"
    speaker: Optional[str] = None
    speed: float = 1.0
    format: str = "mp3"


def health():
    loaded: List[str] = list(_models.keys())
    return {
        "ok": True,
        "device": _device or _resolve_device(),
        "model_loaded": bool(loaded),
        "loaded_langs": loaded,
        "load_error": None if loaded else (_load_error or tts_server_common.hf_cache_error(_INSTALLER)),
    }


def _warm() -> Dict[str, Any]:
    """Warm the default language model so the loading process is visible on the
    console before the first /synthesize call."""
    melo_lang, _ = _melo_lang(_default_lang())
    _get_model(melo_lang)
    return {"device": _device or _resolve_device(), "language": melo_lang}


tts_server_common.add_lifecycle_routes(app, health, warm=_warm, load_error=lambda: _load_error)


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
            audio, chunk_count = _synthesize_guarded(
                model, sid, text, float(req.speed or 1.0)
            )
        sr = int(model.hps.data.sampling_rate)
        data, media = tts_server_common.encode_audio(
            audio, sr, fmt, wav_encoder=tts_server_common.encode_wav_soundfile
        )
        print(f"[api] synthesized {len(data)} bytes ({fmt}) @ {sr}Hz "
              f"chunks={chunk_count} in {time.time() - t0:.2f}s", flush=True)
        return StreamingResponse(io.BytesIO(data), media_type=media)
    except Exception as exc:  # noqa: BLE001
        print(f"[api] /synthesize FAILED: {exc}", flush=True)
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    tts_server_common.run_server(
        app,
        "MELOTTS",
        _DEFAULT_PORT,
        f"MeloTTS API server (default_lang={_default_lang()}, device={_resolve_device()})",
    )


if __name__ == "__main__":
    main()
