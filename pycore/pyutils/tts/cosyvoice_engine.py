"""
CosyVoice engine wrapper (HTTP client to a LOCALLY-RUN FunAudioLLM FastAPI server).

CosyVoice is a multi-GB Alibaba open-source TTS stack (multilingual, voice clone,
emotion control). pycore does NOT embed it; when the user runs the official
runtime FastAPI server we route synthesis to it.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10+; git FunAudioLLM/CosyVoice; modelscope iic/CosyVoice2-0.5B.
  GPU: CUDA torch recommended; CPU supported but slow.
  Server: runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B

Official server: FunAudioLLM/CosyVoice runtime/python/fastapi/server.py
  python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B
  POST /inference_sft        tts_text, spk_id
  POST /inference_zero_shot  tts_text, prompt_text, prompt_wav (file)
  POST /inference_instruct   tts_text, spk_id, instruct_text

Config:
  COSYVOICE_URL         - base url (default: http://127.0.0.1:50000)
  COSYVOICE_MODE        - sft | zero_shot | instruct (default: sft when spk set)
  COSYVOICE_SPK_ID      - speaker id for SFT/instruct (e.g. 中文女)
  COSYVOICE_REF_AUDIO   - reference wav for zero_shot / instruct2
  COSYVOICE_PROMPT_TEXT - transcript of reference clip (zero_shot)
  COSYVOICE_INSTRUCT    - instruct_text for instruct mode
"""

import wave
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.network_constants import COSYVOICE_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.tts import chunked_synthesis
from pycore.pyutils.tts.audio_utils import wav_to_mp3
from pycore.pyutils.tts.engine_policy import engine_setting
from pycore.pyutils.tts.tts_engine import HttpServerEngine, TTSSynthesisRequest

# Model family marker -> PCM rate; 300M is checked before "cosyvoice3".
_SAMPLE_RATE_BY_FAMILY = (("cosyvoice300m", 22050), ("cosyvoice3", 24000), ("cosyvoice2", 24000))
_SAMPLE_RATE_SETTING = "COSYVOICE_SAMPLE_RATE"
_VOICE_SETTINGS = "COSYVOICE_SPK_ID / COSYVOICE_REF_AUDIO (+ COSYVOICE_PROMPT_TEXT)"
_MODES = ("sft", "zero_shot", "instruct", "instruct2")
_WAV_CONTENT_TYPE = "audio/wav"


class CosyVoiceEngine(HttpServerEngine):
    default_port = COSYVOICE_HTTP_PORT
    venv_runtime = True

    def sample_rate(self) -> int:
        """PCM sample rate of the configured model's server output (0 = unknown).

        The official fastapi server streams raw PCM without a header, so the
        rate comes from model metadata: CosyVoice 1.x (300M) generates
        22050 Hz, the CosyVoice2/3 families 24 kHz. Any other model id needs
        COSYVOICE_SAMPLE_RATE, which always overrides."""
        explicit = self.setting("SAMPLE_RATE")
        if explicit.isdigit() and int(explicit) > 0:
            return int(explicit)
        normalized = str(runtime_engine_model(self.name) or "").lower().replace("-", "").replace("_", "")
        for marker, rate in _SAMPLE_RATE_BY_FAMILY:
            if marker in normalized:
                return rate
        return 0

    def mode(self) -> str:
        explicit = self.setting("MODE").lower()
        if explicit in _MODES:
            return explicit
        if self.ref_audio() is not None:
            return "zero_shot"
        if engine_setting("COSYVOICE_INSTRUCT").strip():
            return "instruct"
        return "sft"

    def speaker_id(self) -> str:
        return engine_setting("COSYVOICE_SPK_ID").strip()

    def _voice_configured(self) -> bool:
        mode = self.mode()
        if mode == "zero_shot":
            return self.ref_audio() is not None
        if mode in ("instruct", "instruct2"):
            return bool(self.speaker_id()) or self.ref_audio() is not None
        return bool(self.speaker_id())

    def disabled_reason(self) -> Optional[Any]:
        if self.sample_rate() <= 0:
            return self.setting_reason(_SAMPLE_RATE_SETTING)
        if not self._voice_configured():
            return self.setting_reason(_VOICE_SETTINGS)
        return None

    def _ref_file(self) -> Optional[Dict[str, Tuple[str, bytes, str]]]:
        ref = self.ref_audio()
        return {"prompt_wav": (ref.name, ref.read_bytes(), _WAV_CONTENT_TYPE)} if ref else None

    def _endpoint_and_form(self, text: str) -> Tuple[str, Dict[str, Any], Optional[Dict[str, Tuple[str, bytes, str]]]]:
        mode = self.mode()
        instruct = engine_setting("COSYVOICE_INSTRUCT").strip()
        if mode == "zero_shot":
            return "/inference_zero_shot", {
                "tts_text": text, "prompt_text": self.setting("PROMPT_TEXT"),
            }, self._ref_file()
        if mode == "instruct":
            return "/inference_instruct", {
                "tts_text": text, "spk_id": self.speaker_id(), "instruct_text": instruct,
            }, None
        if mode == "instruct2":
            return "/inference_instruct2", {"tts_text": text, "instruct_text": instruct}, self._ref_file()
        return "/inference_sft", {"tts_text": text, "spk_id": self.speaker_id()}, None

    def _synthesize_chunk_to_wav(self, chunk_text: str, chunk_wav: Path) -> bool:
        path, form, files = self._endpoint_and_form(chunk_text)
        reply = self.post(path, form=form, files=files or {})
        if not reply.ok:
            return self._fail(reply.error or f"cosyvoice {path} failed")
        chunk_wav.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(chunk_wav), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(self.sample_rate())
            handle.writeframes(reply.content)
        return True

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """Long text: the official frontend already splits natively; the client
        only applies the protective guard (chunked_synthesis) for over-long
        inputs and concatenates the PCM chunks before the mp3 conversion. The
        official endpoints take no speed, so speed is applied in that
        conversion."""
        self._clear_error()
        cleaned = (request.text or "").strip()
        if not cleaned or self.disabled_reason() is not None:
            return self._fail(str(self.disabled_reason() or "empty text"))
        output = Path(request.output_path)
        tmp_wav = output.with_suffix(".cosy.wav")
        try:
            ok, error, stats = chunked_synthesis.synthesize_chunked(
                self.name, cleaned, self._synthesize_chunk_to_wav, tmp_wav,
            )
            if not ok:
                return self._fail(str(error))
            if stats.get("chunked"):
                ColorPrint.blue(f"[cosyvoice] protective chunking: {stats.get('chunk_count')} chunks")
            return wav_to_mp3(tmp_wav, output, tempo=request.speed)
        finally:
            tmp_wav.unlink(missing_ok=True)


cosyvoice_engine = CosyVoiceEngine("cosyvoice")


__all__ = ["CosyVoiceEngine", "cosyvoice_engine"]
