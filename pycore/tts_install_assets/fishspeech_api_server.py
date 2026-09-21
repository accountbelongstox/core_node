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

Upstream mode owns outer text segmentation (tts_text_chunking, staged as a
sibling file): long texts are split into bounded chunks, each chunk is
synthesized upstream with format=wav, and the PCM chunks are concatenated in
order with the policy pause. The cloud SDK path stays single-shot.

Official SDK: https://docs.fish.audio/developer-guide/sdk-guide/quickstart
Local server: https://speech.fish.audio/server/

Run after install_fishspeech:
  python fishspeech_api_server.py

Env:
  FISHSPEECH_HOST / FISHSPEECH_PORT  - bind (default 0.0.0.0:8080)
  FISHSPEECH_UPSTREAM                - optional upstream base (e.g. http://127.0.0.1:8081)
  FISH_API_KEY                       - Fish Audio cloud API key
"""

import io
import os
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from tts_text_chunking import default_policy, split_text
import tts_server_common

TMP_DIR = tts_server_common.TMP_DIR
_network_constants = tts_server_common.load_network_constants()
_DEFAULT_PORT = getattr(_network_constants, "FISHSPEECH_HTTP_PORT", 8080)

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


def _read_wav_bytes(data: bytes):
    """(frames, (channels, sampwidth, framerate)) from uncompressed PCM wav."""
    with wave.open(io.BytesIO(data), "rb") as handle:
        params = (handle.getnchannels(), handle.getsampwidth(), handle.getframerate())
        if handle.getcomptype() != "NONE":
            raise ValueError(f"compressed wav ({handle.getcomptype()}) not supported")
        if params[0] <= 0 or params[1] <= 0 or params[2] <= 0:
            raise ValueError(f"invalid wav params {params}")
        return handle.readframes(handle.getnframes()), params


def _concat_wav_chunks(chunk_data, pause_ms: int) -> bytes:
    """Order-preserving PCM concat of upstream wav chunks with the policy
    pause; fails loudly on mixed stream parameters (never transcodes)."""
    parts = []
    params = None
    for index, data in enumerate(chunk_data):
        frames, chunk_params = _read_wav_bytes(data)
        if params is None:
            params = chunk_params
        elif chunk_params != params:
            raise ValueError(
                f"chunk {index + 1} wav params {chunk_params} != {params}"
            )
        if index:
            pause_frames = params[2] * max(0, pause_ms) // 1000
            parts.append(b"\x00" * pause_frames * params[0] * params[1])
        parts.append(frames)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as handle:
        handle.setnchannels(params[0])
        handle.setsampwidth(params[1])
        handle.setframerate(params[2])
        handle.writeframes(b"".join(parts))
    return buf.getvalue()


def _synthesize_upstream_chunked(text: str, reference_id):
    """Server-side chunked generation against the upstream fish-speech server.

    The upstream request chunk_length is a TOKEN budget (default 200), not a
    character cap, so the bridge owns outer text segmentation
    (tts_text_chunking, owner=project): one upstream POST per chunk with
    format=wav, then an order-preserving PCM concatenation. The cloud SDK path
    is untouched (the hosted API handles long text itself)."""
    policy = default_policy("fishspeech")
    chunks = split_text(text, policy)
    if len(chunks) <= 1:
        body = {"text": text}
        if reference_id:
            body["reference_id"] = reference_id
        resp = requests.post(f"{_upstream}/v1/tts", json=body, timeout=180)
        return Response(
            content=resp.content,
            media_type=resp.headers.get("content-type", "audio/mpeg"),
        )
    chunk_data = []
    for index, chunk in enumerate(chunks):
        body = {"text": chunk.text, "format": "wav"}
        if reference_id:
            body["reference_id"] = reference_id
        resp = requests.post(f"{_upstream}/v1/tts", json=body, timeout=180)
        if resp.status_code != 200 or not resp.content:
            detail = resp.text[:160] if hasattr(resp, "text") else "empty response"
            return JSONResponse(
                {"error": f"chunk {index + 1}/{len(chunks)} failed: HTTP "
                          f"{resp.status_code}: {detail}"},
                status_code=502,
            )
        chunk_data.append(resp.content)
    try:
        combined = _concat_wav_chunks(chunk_data, policy.pause_ms)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)
    print(f"[api] chunked upstream synth: {len(chunks)} chunks "
          f"({len(text)} chars)", flush=True)
    return Response(content=combined, media_type="audio/wav")


@app.post("/v1/tts")
def tts(req: TtsRequest):
    text = (req.text or "").strip()
    if not text:
        return JSONResponse({"error": "empty text"}, status_code=400)
    if _upstream:
        try:
            return _synthesize_upstream_chunked(text, req.reference_id)
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
    port = int(os.environ.get("FISHSPEECH_PORT") or _DEFAULT_PORT)
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
