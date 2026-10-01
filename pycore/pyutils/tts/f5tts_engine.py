"""
F5-TTS engine wrapper (HTTP client to a LOCALLY-RUN clone/voice server).

F5-TTS (SWivid) is a flow-matching non-autoregressive TTS system with fast
voice cloning. The upstream repo ships a Python API and socket server, not a
production HTTP API; community FastAPI wrappers expose POST /process with
ref_audio + ref_text + gen_text. pycore targets that contract when configured.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10+; pip install -e SWivid/F5-TTS; GPU recommended for real-time clone.
  HTTP: f5tts_api_server.py; F5TTS_REF_AUDIO + F5TTS_REF_TEXT required.

Official library: https://github.com/SWivid/F5-TTS (src/f5_tts/api.py)
Community HTTP pattern (issue #329): POST /process multipart ref_audio, ref_text, gen_text

Config:
  F5TTS_URL       - base url (default: http://127.0.0.1:7860)
  F5TTS_REF_AUDIO - path to a short reference clip (REQUIRED)
  F5TTS_REF_TEXT  - transcript of the reference clip (REQUIRED)
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.network_constants import F5TTS_HTTP_PORT
from pycore.pyutils.tts.tts_engine import HttpServerEngine, TTSSynthesisRequest

_REF_AUDIO_SETTING = "F5TTS_REF_AUDIO"
_REF_TEXT_SETTING = "F5TTS_REF_TEXT"
_WAV_CONTENT_TYPE = "audio/wav"


class F5TTSEngine(HttpServerEngine):
    default_port = F5TTS_HTTP_PORT
    config_gate = True

    def ref_text(self) -> str:
        return self.setting("REF_TEXT")

    def disabled_reason(self) -> Optional[Any]:
        if self.ref_audio() is None:
            return self.setting_reason(_REF_AUDIO_SETTING)
        if not self.ref_text():
            return self.setting_reason(_REF_TEXT_SETTING)
        return None

    def health_ready(self, body: Dict[str, Any]) -> bool:
        return body.get("ok") is True or body.get("status") == "ok"

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """POST /process (multipart ref_audio + ref_text + gen_text)."""
        self._clear_error()
        ref = self.ref_audio()
        cleaned = (request.text or "").strip()
        if ref is None or not self.ref_text() or not cleaned:
            return self._fail(str(self.disabled_reason() or "empty text"))
        return self.post_audio(
            "/process", request.output_path,
            form={"ref_text": self.ref_text(), "gen_text": cleaned},
            files={"ref_audio": (ref.name, ref.read_bytes(), _WAV_CONTENT_TYPE)},
        )


f5tts_engine = F5TTSEngine("f5tts")


__all__ = ["F5TTSEngine", "f5tts_engine"]
