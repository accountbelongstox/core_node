#!/usr/bin/env python3
"""
Minimal F5-TTS HTTP wrapper for pycore (POST /process, GET /health).

Official F5-TTS has no production HTTP API; this follows the community pattern
documented in SWivid/F5-TTS issue #329. Run from the cloned F5-TTS staging dir
after `pip install -e .`.

Env:
  F5TTS_HOST / F5TTS_PORT  - bind (default 127.0.0.1:7860)
  F5TTS_DEVICE             - cuda:0 | cpu | auto (default auto)
"""

import re
import shutil
import sys
import tempfile
from pathlib import Path

_CURRENT_DIR = Path(__file__).resolve().parent
if str(_CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(_CURRENT_DIR))

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

import tts_server_common

torch = tts_server_common.engine_imports.module("torch")
f5_api = tts_server_common.engine_imports.module("f5_tts.api")
TMP_DIR = tts_server_common.TMP_DIR
_REF_AUDIO_STEM = "ref"
_REF_AUDIO_DEFAULT_SUFFIX = ".wav"
_REF_AUDIO_SUFFIX_PATTERN = re.compile(r"^\.[a-z0-9]{1,5}$")
_network_constants = tts_server_common.load_network_constants()
_DEFAULT_PORT = getattr(_network_constants, "F5TTS_HTTP_PORT", 7860)

app = FastAPI()
_f5 = None
_device = None
_load_error = None
_INSTALLER = tts_server_common.installer_step("135_install_f5tts.sh", "Model_F5Tts.ps1")


def _resolve_device():
    return tts_server_common.resolve_device("F5TTS_DEVICE", torch, lowercase=False)


def _get_f5():
    global _f5, _device, _load_error
    if _f5 is not None:
        return _f5
    _device = _resolve_device()
    f5_class = tts_server_common.engine_imports.require(f5_api, "f5_tts.api").F5TTS
    cache_error = tts_server_common.hf_cache_error(_INSTALLER)
    if cache_error:
        _load_error = cache_error
        raise RuntimeError(cache_error)
    try:
        _f5 = f5_class(device=_device)
    except Exception as exc:  # noqa: BLE001 - engine load errors are arbitrary
        # Loading is offline: a cache miss means the installer did not
        # provision the checkpoint / vocoder weights.
        _load_error = tts_server_common.weights_missing("F5-TTS", _INSTALLER, str(exc))
        raise RuntimeError(_load_error) from exc
    _load_error = None
    return _f5


def health():
    payload = {"ok": True, "device": _device or _resolve_device()}
    load_error = _load_error or (None if _f5 is not None else tts_server_common.hf_cache_error(_INSTALLER))
    if load_error:
        payload["model_loaded"] = False
        payload["load_error"] = load_error
    return payload


tts_server_common.add_lifecycle_routes(app, health)


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
    try:
        f5 = _get_f5()
    except Exception as exc:  # noqa: BLE001 - engine import/load errors are arbitrary
        return JSONResponse({"error": str(exc)}, status_code=500)
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
    tts_server_common.run_server(app, "F5TTS", _DEFAULT_PORT, "F5-TTS API server")


if __name__ == "__main__":
    main()
