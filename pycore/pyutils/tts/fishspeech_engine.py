"""
Fish Speech / Fish Audio engine (local HTTP server or Fish Audio Python SDK).

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10–3.12; git fishaudio/fish-speech or fish-audio-sdk (FISH_API_KEY).
  GPU: openaudio-s1 checkpoint; CPU: openaudio-s1-mini or cloud SDK.
  Local: tools/api_server.py or fishspeech_api_server.py bridge.

Local server (fish-speech tools/api_server.py):
  https://speech.fish.audio/server/
  GET  /v1/health
  POST /v1/tts  { text, reference_id? }

Cloud SDK (fish-audio-sdk >= 1.0, Python 3.13+):
  https://docs.fish.audio/developer-guide/sdk-guide/quickstart
  pip install fish-audio-sdk
  Env FISH_API_KEY

Config:
  FISHSPEECH_URL           - local server base (default http://127.0.0.1:8080)
  FISHSPEECH_UPSTREAM      - optional upstream fish-speech base (bridge mode)
  FISHSPEECH_REFERENCE_ID  - optional saved reference voice id (local clone)
  FISHSPEECH_FORMAT        - mp3 | wav (default mp3)
"""

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.tts.audio_utils import wav_to_mp3

import importlib.util


_avail_lock = threading.Lock()
_avail_cache = {"ts": 0.0, "ok": False}
_AVAIL_TTL_S = 30.0
_last_synth_error: Optional[str] = None


def base_url() -> str:
    return (os.environ.get("FISHSPEECH_URL") or "http://127.0.0.1:8080").rstrip("/")


def _reference_id() -> str:
    return (os.environ.get("FISHSPEECH_REFERENCE_ID") or "").strip()


def _fish_api_key() -> str:
    return (os.environ.get("FISH_API_KEY") or "").strip()


def _upstream_url() -> str:
    return (os.environ.get("FISHSPEECH_UPSTREAM") or "").strip().rstrip("/")


def _sdk_available() -> bool:
    if not _fish_api_key():
        return False
    try:
        return importlib.util.find_spec("fishaudio") is not None
    except Exception:
        return False


def _probe_health_json() -> Tuple[bool, Dict[str, Any]]:
    """Return (reachable, parsed_json_or_empty)."""
    requests = get_third_package_requests()
    if requests is None:
        return False, {}
    for path in ("/v1/health", "/health", "/"):
        try:
            resp = requests.get(f"{base_url()}{path}", timeout=2)
            if resp.status_code >= 500:
                continue
            body: Dict[str, Any] = {}
            try:
                parsed = resp.json()
                if isinstance(parsed, dict):
                    body = parsed
            except ValueError:
                pass
            return True, body
        except Exception:
            pass
    return False, {}


def _local_server_can_synth() -> bool:
    """True when the HTTP server can actually POST /v1/tts (not just /health)."""
    if _upstream_url():
        return True
    reachable, body = _probe_health_json()
    if not reachable:
        return False
    if "synth_ready" in body:
        return bool(body.get("synth_ready"))
    # Real fish-speech tools/api_server (no pycore bridge field) — trust health.
    return True


def synth_ready() -> bool:
    """Runtime synth prerequisites: SDK credentials or a capable local server."""
    if _sdk_available():
        return True
    if _upstream_url():
        return True
    return _local_server_can_synth()


def disabled_reason() -> Optional[str]:
    if _sdk_available():
        return None
    if _upstream_url():
        return None
    reachable, body = _probe_health_json()
    if reachable and body.get("synth_ready") is False:
        return (
            "Fish Speech bridge is up but cannot synthesize — set FISH_API_KEY, "
            "FISHSPEECH_UPSTREAM, or start fish-speech tools/api_server.py"
        )
    if reachable:
        return None
    return (
        f"Start Fish Speech server ({base_url()}) or set FISH_API_KEY with fish-audio-sdk"
    )


def available() -> bool:
    """Local fish-speech server can synth OR Fish Audio SDK + FISH_API_KEY."""
    now = time.time()
    with _avail_lock:
        if now - _avail_cache["ts"] < _AVAIL_TTL_S:
            return _avail_cache["ok"]
    ok = synth_ready()
    with _avail_lock:
        _avail_cache.update(ts=now, ok=ok)
    return ok


def last_synth_error() -> Optional[str]:
    return _last_synth_error


def _synth_via_sdk(text: str, output_mp3: Path) -> bool:
    global _last_synth_error
    try:
        pass
    except ImportError:
        _last_synth_error = "fish-audio-sdk not installed"
        return False
    try:
        client = FishAudio(api_key=_fish_api_key())
        audio = client.tts.convert(text=text)
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        fmt = (os.environ.get("FISHSPEECH_FORMAT") or "mp3").strip().lower()
        if fmt == "mp3" and hasattr(audio, "read"):
            output_mp3.write_bytes(audio.read())
            ok = output_mp3.stat().st_size > 0
            if not ok:
                _last_synth_error = "Fish Audio SDK returned empty audio"
            return ok
        tmp = output_mp3.with_suffix(".fish.tmp")
        try:
            save(audio, str(tmp.with_suffix(".mp3" if fmt == "mp3" else ".wav")))
            out = tmp.with_suffix(".mp3" if fmt == "mp3" else ".wav")
            if out.suffix.lower() == ".mp3":
                out.replace(output_mp3)
            else:
                ok = wav_to_mp3(out, output_mp3)
                if not ok:
                    _last_synth_error = "Fish Audio SDK wav->mp3 conversion failed"
                return ok
            ok = output_mp3.exists() and output_mp3.stat().st_size > 0
            if not ok:
                _last_synth_error = "Fish Audio SDK produced empty mp3"
            return ok
        finally:
            for p in tmp.parent.glob("fish.tmp*"):
                try:
                    p.unlink()
                except OSError:
                    pass
    except Exception as e:
        _last_synth_error = str(e)
        ColorPrint.red(f"[fishspeech] SDK synth failed: {e}")
        return False


def _parse_http_error(resp) -> str:
    ctype = (resp.headers.get("content-type") or "").lower()
    if "json" in ctype:
        try:
            body = resp.json()
            if isinstance(body, dict):
                return str(body.get("error") or body.get("detail") or resp.text[:160])
        except (ValueError, json.JSONDecodeError):
            pass
    text = (resp.text or "").strip()
    return text[:160] if text else f"HTTP {resp.status_code}"


def _synth_via_http(text: str, output_mp3: Path) -> bool:
    global _last_synth_error
    requests = get_third_package_requests()
    if requests is None:
        _last_synth_error = "requests package unavailable"
        return False
    body = {"text": text}
    ref = _reference_id()
    if ref:
        body["reference_id"] = ref
    try:
        resp = requests.post(f"{base_url()}/v1/tts", json=body, timeout=180)
        if resp.status_code != 200 or not resp.content:
            err = _parse_http_error(resp)
            _last_synth_error = err
            ColorPrint.red(f"[fishspeech] /v1/tts HTTP {resp.status_code}: {err}")
            return False
        ctype = (resp.headers.get("content-type") or "").lower()
        if "json" in ctype:
            err = _parse_http_error(resp)
            _last_synth_error = err or "server returned JSON instead of audio"
            ColorPrint.red(f"[fishspeech] /v1/tts returned JSON: {err}")
            return False
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        if "mpeg" in ctype or "mp3" in ctype:
            output_mp3.write_bytes(resp.content)
            ok = output_mp3.stat().st_size > 0
            if not ok:
                _last_synth_error = "HTTP response was empty mp3"
            return ok
        tmp_wav = output_mp3.with_suffix(".fish.wav")
        tmp_wav.write_bytes(resp.content)
        try:
            ok = wav_to_mp3(tmp_wav, output_mp3)
            if not ok:
                _last_synth_error = "HTTP wav->mp3 conversion failed"
            return ok
        finally:
            try:
                tmp_wav.unlink()
            except OSError:
                pass
    except Exception as e:
        _last_synth_error = str(e)
        ColorPrint.red(f"[fishspeech] HTTP synth failed: {e}")
        return False


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    del lang, speed
    global _last_synth_error
    _last_synth_error = None
    cleaned = (text or "").strip()
    if not cleaned:
        _last_synth_error = "empty text"
        return False
    if not synth_ready():
        _last_synth_error = disabled_reason() or "fishspeech not ready"
        return False
    if _local_server_can_synth():
        if _synth_via_http(cleaned, output_mp3):
            return True
        if _sdk_available():
            return _synth_via_sdk(cleaned, output_mp3)
        if _last_synth_error:
            return False
    if _sdk_available():
        return _synth_via_sdk(cleaned, output_mp3)
    _last_synth_error = disabled_reason() or "fishspeech produced no audio"
    return False


__all__ = [
    "available",
    "synth_ready",
    "disabled_reason",
    "last_synth_error",
    "synthesize",
    "base_url",
]
