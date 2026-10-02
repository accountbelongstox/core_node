"""
VoxCPM2 offline TTS engine - HTTP client to the isolated-venv api server
(class C).

VoxCPM2's official support window is Python 3.10-3.12 while the main
interpreter is 3.13, so voxcpm is NEVER imported here. It runs as
pycore/tts_install_assets/voxcpm2_api_server.py inside a DEDICATED
self-contained per-engine venv (see isolated_venv.py, engine "voxcpm2");
that server is launched + lifecycle-managed as a class-C service by
tts_service_manager.py / managed_service.py. Long-text chunking lives
server-side (tts_audio_assembly); this module only POSTs to it over stdlib
HTTP (urllib), keeping the same public API the orchestrator / capabilities
probe / engine probe already call.

See docs_fix/DESIGN_TTS_AI_RUNTIME.md §8a-§9.

Config:
  VOXCPM2_HOST / VOXCPM2_PORT - server bind + client target
                                (default 127.0.0.1:57214)
  VOXCPM2_MODEL               - HuggingFace id or local path (server env)
  VOXCPM2_DEVICE              - cpu | cuda:0 | auto (server env)
  VOXCPM2_CFG / VOXCPM2_TIMESTEPS - generation defaults (server env); an engine
                                test override is sent per request instead
  VOXCPM2_PROMPT_WAV / VOXCPM2_PROMPT_TEXT - voice clone reference
                                (forwarded per request when set)
"""

import re
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.network_constants import VOXCPM2_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
import pycore.pyutils.common.hf_local_weights as hf_local_weights
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.tts.engine_policy import engine_setting
from pycore.pyutils.tts.tts_engine import IsolatedVenvServerEngine, TTSSynthesisRequest
from pycore.pyutils.tts.tts_reason_codes import TTS_REASON_WEIGHTS_MISSING, tts_reason

# Request field <- engine setting (a UI engine-test override reaches the
# running server per request, never through the process environment).
_REQUEST_SETTINGS = (
    ("cfg_value", "VOXCPM2_CFG", r"[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?", float),
    ("inference_timesteps", "VOXCPM2_TIMESTEPS", r"[-+]?\d+", int),
)


class VoxCPM2Engine(IsolatedVenvServerEngine):
    default_port = VOXCPM2_HTTP_PORT
    audio_reply = "wav_target"

    def local_model_dir(self) -> Optional[str]:
        """Explicit VOXCPM2_MODEL dir or the verified staging weights; None
        when missing (the server is never started to download them)."""
        explicit = self.setting("MODEL")
        if explicit:
            return explicit if Path(explicit).is_dir() else None
        try:
            tier = runtime_engine_model(self.name) or "openbmb/VoxCPM2"
        except Exception as exc:  # noqa: BLE001 - tier table boundary; keep the default model
            ColorPrint.gray(f"[voxcpm2] model tier lookup failed: {exc}")
            tier = "openbmb/VoxCPM2"
        resolved = hf_local_weights.resolve_model_id("VOXCPM2_DIR", self.name, tier)
        return resolved if Path(resolved).is_dir() else None

    def disabled_reason(self) -> Optional[Any]:
        reason = super().disabled_reason()
        if reason is None and self.local_model_dir() is None:
            return tts_reason(TTS_REASON_WEIGHTS_MISSING, engine=self.name, installer=self.installer_hint())
        return reason

    def _payload(self, text: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"text": text}
        for field, env_key, pattern, cast in _REQUEST_SETTINGS:
            value = engine_setting(env_key).strip()
            if not value:
                continue
            if re.fullmatch(pattern, value):
                payload[field] = cast(value)
            else:
                ColorPrint.yellow(f"[voxcpm2] ignoring invalid {env_key}={value}")
        prompt_wav = self.setting("PROMPT_WAV")
        if prompt_wav:
            payload["prompt_wav_path"] = prompt_wav
            prompt_text = self.setting("PROMPT_TEXT")
            if prompt_text:
                payload["prompt_text"] = prompt_text
        return payload

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """POST /synthesize; the server emits wav, mp3 targets are converted
        locally. VoxCPM2 has no speed or language control (the model reads the
        language from the text), so the speed is applied as ffmpeg atempo."""
        self.clear_error()
        cleaned = (request.text or "").strip()
        if not cleaned:
            return self.fail("empty text")
        return self.post_audio(
            "/synthesize", Path(request.output_path), tempo=request.speed,
            json_body=self._payload(cleaned),
        )


voxcpm2_engine = VoxCPM2Engine("voxcpm2")


__all__ = ["VoxCPM2Engine", "voxcpm2_engine"]
