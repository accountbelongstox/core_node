"""
MeloTTS engine - HTTP client to the isolated-venv api server (class C).

MeloTTS pins an OLD transformers (~4.27.x), which cannot coexist with the main
interpreter's shared Bucket-A pin (~4.46.x for DeepSeek/Qwen2.5/NLLB/bark).
Therefore melo is NEVER imported in this (main) interpreter. Instead it runs as
pycore/tts_install_assets/melotts_api_server.py inside a DEDICATED per-engine venv
(see isolated_venv.py, engine "melotts"); that server is launched + lifecycle-
managed as a class-C service by tts_service_manager.py / managed_service.py. This
module only POSTs to it over stdlib HTTP (urllib), keeping the same public API the
orchestrator / capabilities probe / engine probe already call.

See docs_fix/DESIGN_TTS_AI_RUNTIME.md §8a-§9.

Config:
  MELOTTS_HOST / MELOTTS_PORT - server bind + client target (default 127.0.0.1:57212)
  MELOTTS_MODEL               - default MeloTTS language model (applied in server env)
  MELOTTS_DEVICE              - cpu | cuda:0 | auto (applied in the server env)
"""

from pathlib import Path
from typing import Any, Dict

from pycore.pyfoundations.network_constants import MELOTTS_HTTP_PORT
from pycore.pyutils.tts.tts_engine import IsolatedVenvServerEngine, TTSSynthesisRequest


class MeloTTSEngine(IsolatedVenvServerEngine):
    default_port = MELOTTS_HTTP_PORT
    audio_reply = "raw"

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """POST /synthesize; the wire format follows the output suffix."""
        self.clear_error()
        cleaned = (request.text or "").strip()
        if not cleaned:
            return self.fail("empty text")
        output = Path(request.output_path)
        payload: Dict[str, Any] = {
            "text": cleaned,
            "language": request.language or "en",
            "speed": float(request.speed),
            "format": "wav" if output.suffix.lower() == ".wav" else "mp3",
        }
        speaker = (request.speaker or "").strip()
        if speaker:
            payload["speaker"] = speaker
        return self.post_audio("/synthesize", output, json_body=payload)


melotts_engine = MeloTTSEngine("melotts")


__all__ = ["MeloTTSEngine", "melotts_engine"]
