#!/usr/bin/env python3
import torch
from f5_tts.api import F5TTS
"""
Minimal F5-TTS HTTP wrapper for pycore (POST /process, GET /health).

Official F5-TTS has no production HTTP API; this follows the community pattern
documented in SWivid/F5-TTS issue #329. Run from the cloned F5-TTS staging dir
after `pip install -e .`.

Env:
  F5TTS_HOST / F5TTS_PORT  - bind (default 0.0.0.0:7860)
  F5TTS_DEVICE             - cuda:0 | cpu | auto (default auto)
"""

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse
import uvicorn

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


@app.post("/process")
async def process(
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(...),
    gen_text: str = Form(...),
):
    f5 = _get_f5()
    tmp_dir = Path(tempfile.mkdtemp(prefix="f5tts_"))
    ref_path = tmp_dir / (ref_audio.filename or "ref.wav")
    out_path = tmp_dir / "out.wav"
    ref_path.write_bytes(await ref_audio.read())
    try:
        f5.infer(
            ref_file=str(ref_path),
            ref_text=(ref_text or "").strip(),
            gen_text=(gen_text or "").strip(),
            file_wave=str(out_path),
            seed=-1,
        )
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)
    if not out_path.exists() or out_path.stat().st_size == 0:
        return JSONResponse({"error": "F5-TTS produced no audio"}, status_code=500)
    return FileResponse(str(out_path), media_type="audio/wav", filename="out.wav")


def main():
    host = (os.environ.get("F5TTS_HOST") or "0.0.0.0").strip()
    port = int(os.environ.get("F5TTS_PORT") or "7860")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
