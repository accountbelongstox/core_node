"""
Fish Speech / Fish Audio engine (local HTTP server or Fish Audio Python SDK).

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10–3.12; git fishaudio/fish-speech or fish-audio-sdk (FISH_API_KEY).
  Default checkpoint: fishaudio/s1-mini (public; openaudio-s1-mini redirects
  to it, fishaudio/openaudio-s1 does not exist). FISHSPEECH_CHECKPOINT overrides.
  Cloud: fish-audio-sdk (FISH_API_KEY).
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

import os
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.network_constants import FISHSPEECH_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_fishaudio,
    get_third_package_fishaudio_utils,
)
from pycore.pyutils.common.model_boot import third_party_block_reason
from pycore.pyutils.common.model_checks import module_present
import pycore.pyutils.common.python_env.isolated_venv as isolated_venv
from pycore.pyutils.tts.tts_engine import HttpServerEngine, TTSSynthesisRequest
from pycore.pyutils.tts.tts_reason_codes import (
    TTS_REASON_FISHSPEECH_BRIDGE_NOT_READY,
    TTS_REASON_FISHSPEECH_SOURCE_REQUIRED,
    tts_reason,
)

FISH_API_KEY_ENV = "FISH_API_KEY"
FISH_CLOUD_SERVICE = "fishaudio"
# fish-audio-sdk failures surface as library exceptions of several types.
_SDK_ERRORS = (OSError, RuntimeError, ValueError, TypeError, AttributeError)


class FishSpeechEngine(HttpServerEngine):
    default_port = FISHSPEECH_HTTP_PORT
    config_gate = True
    venv_runtime = True

    def fish_api_key(self) -> str:
        """Fish Audio cloud key; empty on local-models-only nodes (notebook_policy)."""
        if third_party_block_reason(FISH_CLOUD_SERVICE):
            return ""
        return (os.environ.get(FISH_API_KEY_ENV) or "").strip()

    def upstream_url(self) -> str:
        return self.setting("UPSTREAM").rstrip("/")

    def sdk_available(self) -> bool:
        return bool(self.fish_api_key()) and module_present("fishaudio")

    def ready_without_process(self) -> bool:
        return self.sdk_available()

    def local_server_can_synth(self) -> bool:
        """True when the HTTP server can actually POST /v1/tts (not just /health)."""
        if self.upstream_url():
            return True
        reachable, body = self.health_state()
        return reachable and bool(body) and body.get("synth_ready") is not False

    def config_ready(self) -> bool:
        """Runtime synth prerequisites: SDK credentials or a capable local server."""
        return self.sdk_available() or self.local_server_can_synth()

    def synth_ready(self) -> bool:
        return self.config_ready()

    def disabled_reason(self) -> Optional[Any]:
        if self.sdk_available() or self.upstream_url():
            return None
        reachable, body = self.health_state()
        if reachable and body.get("synth_ready") is False:
            return tts_reason(TTS_REASON_FISHSPEECH_BRIDGE_NOT_READY)
        if reachable:
            return None
        return tts_reason(TTS_REASON_FISHSPEECH_SOURCE_REQUIRED, url=self.base_url())

    def unavailable_reason(self) -> Optional[Any]:
        if self.fish_api_key() and (module_present("fishaudio") or isolated_venv.venv_ready(self.name)):
            return None
        return super().unavailable_reason()

    def runtime_reason(self) -> Optional[Any]:
        if not self.setting("URL") and not self.upstream_url():
            reason = self.self_contained_reason()
            if reason is not None:
                return reason
        return tts_reason(TTS_REASON_FISHSPEECH_SOURCE_REQUIRED, url=self.base_url())

    def _synth_via_sdk(self, text: str, output: Path) -> bool:
        fishaudio = get_third_package_fishaudio()
        utils = get_third_package_fishaudio_utils()
        if fishaudio is None or utils is None:
            return self._fail("fish-audio-sdk not installed")
        try:
            audio = fishaudio.FishAudio(api_key=self.fish_api_key()).tts.convert(text=text)
            output.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(audio, (bytes, bytearray)):
                output.write_bytes(bytes(audio))
            elif hasattr(audio, "read"):
                output.write_bytes(audio.read())
            else:
                utils.save(audio, str(output))
        except _SDK_ERRORS as exc:
            ColorPrint.red(f"[fishspeech] SDK synth failed for {output.name}: {exc}")
            return self._fail(str(exc))
        if not output.is_file() or output.stat().st_size <= 0:
            return self._fail("Fish Audio SDK returned empty audio")
        return True

    def _synth_via_http(self, text: str, output: Path) -> bool:
        body: Dict[str, Any] = {"text": text}
        reference_id = self.setting("REFERENCE_ID")
        if reference_id:
            body["reference_id"] = reference_id
        return self.post_audio("/v1/tts", output, json_body=body)

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        self._clear_error()
        cleaned = (request.text or "").strip()
        output = Path(request.output_path)
        if not cleaned:
            return self._fail("empty text")
        if not self.config_ready():
            return self._fail(str(self.disabled_reason() or "fishspeech not ready"))
        if self.local_server_can_synth():
            if self._synth_via_http(cleaned, output):
                return True
            if not self.sdk_available():
                return False
        if self.sdk_available():
            return self._synth_via_sdk(cleaned, output)
        return self._fail(str(self.disabled_reason() or "fishspeech produced no audio"))


fishspeech_engine = FishSpeechEngine("fishspeech")


__all__ = ["FISH_API_KEY_ENV", "FishSpeechEngine", "fishspeech_engine"]
