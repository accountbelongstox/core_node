#!/usr/bin/env python3
import torch
from f5_tts.api import F5TTS
"""
Minimal F5-TTS HTTP wrapper for pycore (POST /process, GET /health).

Official F5-TTS has no production HTTP API; this follows the community pattern
documented in SWivid/F5-TTS issue #329. Run from the cloned F5-TTS staging dir
after `pip install -e .`.

Env:
  F5TTS_HOST / F5TTS_PORT  - bind (default 127.0.0.1:7860)
  F5TTS_DEVICE             - cuda:0 | cpu | auto (default auto)
"""

import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

_CURRENT_DIR = Path(__file__).resolve().parent
if str(_CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(_CURRENT_DIR))

import tts_server_common

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
import uvicorn

TMP_DIR = tts_server_common.TMP_DIR
_DEFAULT_HOST = "127.0.0.1"
_REF_AUDIO_STEM = "ref"
_REF_AUDIO_DEFAULT_SUFFIX = ".wav"
_REF_AUDIO_SUFFIX_PATTERN = re.compile(r"^\.[a-z0-9]{1,5}$")
_network_constants = tts_server_common.load_network_constants()
_DEFAULT_PORT = getattr(_network_constants, "F5TTS_HTTP_PORT", 7860)

app = FastAPI()
_f5 = None
_device = None


def _resolve_device():
    want = (os.environ.get("F5TTS_DEVICE") or "auto").strip() or "auto"
    if want != "auto":
        return want
    try:
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _get_f5():
    global _f5, _device
    if _f5 is not None:
        return _f5
    _device = _resolve_device()
    _f5 = F5TTS(device=_device)
    return _f5


@app.get("/health")
def health():
    return {"ok": True, "device": _device or _resolve_device()}


@app.get("/")
def root():
    return health()


def _ref_audio_suffix(filename: str) -> str:
    """Only the extension of the client file name is kept (never its path)."""
    suffix = Path(str(filename or "")).suffix.lower()
    return suffix if _REF_AUDIO_SUFFIX_PATTERN.fullmatch(suffix) else _REF_AUDIO_DEFAULT_SUFFIX


@app.post("/process")
def process(
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(...),
    gen_text: str = Form(...),
):
    f5 = _get_f5()
    tmp_dir = Path(tempfile.mkdtemp(prefix="f5tts_", dir=str(TMP_DIR)))
    cleanup = BackgroundTask(shutil.rmtree, str(tmp_dir), ignore_errors=True)
    ref_path = tmp_dir / (_REF_AUDIO_STEM + _ref_audio_suffix(ref_audio.filename))
    out_path = tmp_dir / "out.wav"
    ref_path.write_bytes(ref_audio.file.read())
    try:
        f5.infer(
            ref_file=str(ref_path),
            ref_text=(ref_text or "").strip(),
            gen_text=(gen_text or "").strip(),
            file_wave=str(out_path),
            seed=-1,
        )
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500, background=cleanup)
    if not out_path.exists() or out_path.stat().st_size == 0:
        return JSONResponse({"error": "F5-TTS produced no audio"}, status_code=500, background=cleanup)
    return FileResponse(str(out_path), media_type="audio/wav", filename="out.wav", background=cleanup)


def main():
    host = (os.environ.get("F5TTS_HOST") or _DEFAULT_HOST).strip()
    port = int(os.environ.get("F5TTS_PORT") or _DEFAULT_PORT)
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
