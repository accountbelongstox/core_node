"""
GPT-SoVITS TTS engine wrapper (HTTP client to a LOCALLY-RUN api server).

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.9–3.11; git RVC-Boss/GPT-SoVITS; lj1995/GPT-SoVITS HF models.
  GPU: CUDA torch + GPTSOVITS_HF_ALLOW=* (all pretrained); CPU: v2 set (~1.2GB).
  Server: api_v2.py :9880; GPTSOVITS_REF_AUDIO required.

GPT-SoVITS is NOT a pip package — it's a cloned repo + conda env + multi-GB
models + GPU. We therefore do NOT install it; instead, if the user has it running
(its `api_v2.py` FastAPI server, default 127.0.0.1:9880), we route synthesis to
it for voice-cloned, emotion-rich output. When the server is unreachable this
engine simply reports unavailable and the orchestrator falls through.

Long text: api_v2 already splits natively (text_split_method); the client only
applies the protective guard (chunked_synthesis) for over-long inputs and
concatenates the wav chunks in order before the mp3 conversion.

Config:
  GPTSOVITS_URL          - base url (default: http://127.0.0.1:9880)
  GPTSOVITS_REF_AUDIO    - path to a short reference clip (REQUIRED for synth;
                           defines the cloned timbre)
  GPTSOVITS_PROMPT_TEXT  - transcript of the reference clip
  GPTSOVITS_PROMPT_LANG  - language of the reference clip (default: same as text)
"""

from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.network_constants import GPTSOVITS_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.tts import chunked_synthesis
from pycore.pyutils.tts.audio_utils import wav_to_mp3
from pycore.pyutils.tts.engine_policy import engine_setting
from pycore.pyutils.tts.tts_engine import HttpServerEngine, TTSSynthesisRequest

_LANG_MAP = {"en": "en", "zh": "zh", "ja": "ja", "ko": "ko", "yue": "yue"}
_REF_AUDIO_SETTING = "GPTSOVITS_REF_AUDIO"


class GptSovitsEngine(HttpServerEngine):
    default_port = GPTSOVITS_HTTP_PORT
    config_gate = True
    request_timeout = 120.0
    venv_runtime = True

    def text_lang(self, lang: str) -> str:
        return _LANG_MAP.get((lang or "en").lower(), "en")

    def config_ready(self) -> bool:
        return not self.boot_blocked() and self.ref_audio() is not None

    def disabled_reason(self) -> Optional[Any]:
        if self.ref_audio() is None:
            return self.setting_reason(_REF_AUDIO_SETTING)
        return None

    def tts_payload(self, text: str, text_lang: str, speed: float) -> Dict[str, Any]:
        """api_v2 /tts body (single and merged batch); requires ref_audio()."""
        return {
            "text": text,
            "text_lang": text_lang,
            "ref_audio_path": str(self.ref_audio()),
            "prompt_text": engine_setting("GPTSOVITS_PROMPT_TEXT"),
            "prompt_lang": (engine_setting("GPTSOVITS_PROMPT_LANG") or text_lang).strip(),
            "speed_factor": float(speed),
            "media_type": "wav",
            "streaming_mode": False,
        }

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """api_v2 /tts; over-long text goes through the protective chunker."""
        self._clear_error()
        if self.ref_audio() is None:
            return self._fail(str(self.disabled_reason()))
        text_lang = self.text_lang(request.language)
        output = Path(request.output_path)
        tmp_wav = output.with_suffix(".gsv.wav")
        try:
            ok, error, stats = chunked_synthesis.synthesize_chunked(
                self.name,
                request.text,
                lambda chunk_text, chunk_wav: self.post_audio(
                    "/tts", chunk_wav, json_body=self.tts_payload(chunk_text, text_lang, request.speed),
                ),
                tmp_wav,
            )
            if not ok:
                return self._fail(str(error))
            if stats.get("chunked"):
                ColorPrint.blue(f"[gptsovits] protective chunking: {stats.get('chunk_count')} chunks")
            return wav_to_mp3(tmp_wav, output)
        finally:
            tmp_wav.unlink(missing_ok=True)


gptsovits_engine = GptSovitsEngine("gptsovits")


__all__ = ["GptSovitsEngine", "gptsovits_engine"]
