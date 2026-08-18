#!/usr/bin/env python3
import requests
from fishaudio import FishAudio
from fishaudio.utils import save
import tempfile
"""
Fish Speech / Fish Audio HTTP bridge for pycore.

Proxies POST /v1/tts to a running fish-speech tools/api_server.py when
FISHSPEECH_UPSTREAM is set, otherwise uses the Fish Audio Python SDK when
FISH_API_KEY is present.

Official SDK: https://docs.fish.audio/developer-guide/sdk-guide/quickstart
Local server: https://speech.fish.audio/server/

Run after install_fishspeech:
  python fishspeech_api_server.py

Env:
  FISHSPEECH_HOST / FISHSPEECH_PORT  - bind (default 0.0.0.0:8080)
  FISHSPEECH_UPSTREAM                - optional upstream base (e.g. http://127.0.0.1:8081)
  FISH_API_KEY                       - Fish Audio cloud API key
"""

import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

TMP_DIR = Path(r"D:\.tmp" if os.name == "nt" else "/var/_core_node/_tmp")
TMP_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI()
_upstream = (os.environ.get("FISHSPEECH_UPSTREAM") or "").rstrip("/")


class TtsRequest(BaseModel):
    text: str
    reference_id: str | None = None
    format: str = "mp3"


@app.get("/v1/health")
@app.get("/health")
@app.get("/")
def health():
    api_key = (os.environ.get("FISH_API_KEY") or "").strip()
    synth_ready = bool(_upstream or api_key)
    return {"status": "ok", "upstream": _upstream or None, "synth_ready": synth_ready}


@app.post("/v1/tts")
def tts(req: TtsRequest):
    text = (req.text or "").strip()
    if not text:
        return JSONResponse({"error": "empty text"}, status_code=400)
    if _upstream:
        body = {"text": text}
        if req.reference_id:
            body["reference_id"] = req.reference_id
        try:
            resp = requests.post(f"{_upstream}/v1/tts", json=body, timeout=180)
            return Response(content=resp.content, media_type=resp.headers.get("content-type", "audio/mpeg"))
        except Exception as exc:
            return JSONResponse({"error": str(exc)}, status_code=502)
    api_key = (os.environ.get("FISH_API_KEY") or "").strip()
    if not api_key:
        return JSONResponse(
            {"error": "Set FISH_API_KEY or FISHSPEECH_UPSTREAM, or start fish-speech tools/api_server.py"},
            status_code=503,
        )
    try:
        client = FishAudio(api_key=api_key)
        audio = client.tts.convert(text=text)
        if hasattr(audio, "read"):
            return Response(content=audio.read(), media_type="audio/mpeg")
        with tempfile.NamedTemporaryFile(
            suffix=".mp3",
            delete=False,
            dir=str(TMP_DIR),
        ) as tmp:
            path = tmp.name
        save(audio, path)
        data = open(path, "rb").read()
        os.unlink(path)
        return Response(content=data, media_type="audio/mpeg")
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    host = os.environ.get("FISHSPEECH_HOST", "0.0.0.0")
    port = int(os.environ.get("FISHSPEECH_PORT", "8080"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
