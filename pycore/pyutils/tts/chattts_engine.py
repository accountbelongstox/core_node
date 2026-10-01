"""
ChatTTS engine wrapper (HTTP client to a LOCALLY-RUN OpenAI-compatible API).

ChatTTS is NOT a lightweight pip-only engine for production synth — it is a
dialogue-focused neural TTS model (laughs, sighs, oral tags). pycore talks to
its official FastAPI example server (examples/api/openai_api.py) when the user
has it running. When the server is unreachable this engine reports unavailable
and the orchestrator falls through.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Category 2 — Python 3.13 OK with current ChatTTS pip wheel; avoid legacy one-click
  bundles that pin old numba/slicer deps. pip install ChatTTS; GPU ~4GB VRAM.

Official docs: https://github.com/2noise/ChatTTS/blob/main/examples/api/README.md
  fastapi dev examples/api/openai_api.py --host 0.0.0.0 --port 8000
  POST /v1/audio/speech  { model, input, voice, response_format, speed }
  GET  /health

Config:
  CHATTTS_URL   - base url (default: http://127.0.0.1:8000)
  CHATTTS_VOICE - voice name (default: alloy)
  CHATTTS_PROMPT - oral tags prefix (optional; e.g. [oral_2][laugh_0][break_6])
"""

from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.network_constants import CHATTTS_HTTP_PORT
import pycore.pyutils.common.hf_local_weights as hf_local_weights
from pycore.pyutils.tts.engine_policy import engine_setting
from pycore.pyutils.tts.tts_engine import HttpServerEngine, TTSSynthesisRequest
from pycore.pyutils.tts.tts_reason_codes import (
    TTS_INSTALL_HINT_GENERIC,
    TTS_REASON_SERVER_MODEL_NOT_READY,
    TTS_REASON_WEIGHTS_MISSING,
    tts_reason,
)

_MODEL_FILE_MANIFEST = (
    Path(__file__).resolve().parents[2] / "tts_install_assets" / "chattts_model_files.txt"
)
_REQUIRED_MODEL_FILES = hf_local_weights.load_required_file_manifest(_MODEL_FILE_MANIFEST)


class ChatTTSEngine(HttpServerEngine):
    default_port = CHATTTS_HTTP_PORT
    config_gate = True
    request_timeout = 120.0

    def voice(self) -> str:
        return (engine_setting("CHATTTS_VOICE") or "alloy").strip() or "alloy"

    def prompt_prefix(self) -> str:
        return self.setting("PROMPT")

    def model_path(self) -> Path:
        return hf_local_weights.configured_weights_dir(
            "CHATTTS_MODEL_DIR", hf_local_weights.staging_dir("CHATTTS_DIR", "chattts"),
        )

    def weights_ready(self) -> bool:
        return hf_local_weights.installed_model_files_ready(
            hf_local_weights.staging_dir("CHATTTS_DIR", "chattts"),
            self.model_path(),
            _REQUIRED_MODEL_FILES,
        )

    def config_ready(self) -> bool:
        return not self.boot_blocked() and self.weights_ready()

    def disabled_reason(self) -> Optional[Any]:
        if self.weights_ready():
            return None
        return tts_reason(TTS_REASON_WEIGHTS_MISSING, engine=self.name, installer=TTS_INSTALL_HINT_GENERIC)

    def health_ready(self, body: Dict[str, Any]) -> bool:
        return bool(body.get("model_loaded"))

    def runtime_reason(self) -> Optional[Any]:
        reachable, body = self.health_state()
        if reachable and not self.health_ready(body):
            return tts_reason(TTS_REASON_SERVER_MODEL_NOT_READY, engine=self.name)
        return super().runtime_reason()

    def speech_payload(self, text: str, speed: float) -> Dict[str, Any]:
        """OpenAI-compatible /v1/audio/speech body (single and merged batch)."""
        prompt = self.prompt_prefix()
        return {
            "model": "tts-1",
            "input": f"{prompt}{text}" if prompt else text,
            "voice": self.voice(),
            "response_format": "mp3",
            "speed": max(0.5, min(2.0, float(speed))),
        }

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        self._clear_error()
        cleaned = (request.text or "").strip()
        if not cleaned:
            return self._fail("empty text")
        return self.post_audio(
            "/v1/audio/speech", request.output_path,
            json_body=self.speech_payload(cleaned, request.speed),
        )


chattts_engine = ChatTTSEngine("chattts")


__all__ = ["ChatTTSEngine", "chattts_engine"]
