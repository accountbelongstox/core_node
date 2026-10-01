# -*- coding: utf-8 -*-
"""Microsoft Edge TTS engine over the serialized edge-tts client."""

from typing import Any, Optional

from pycore.pyutils.tts.edge.client import edge_tts_client
from pycore.pyutils.tts.edge.config import TTSConfig
from pycore.pyutils.tts.tts_engine import TTSEngine, TTSSynthesisRequest
from pycore.pyutils.tts.tts_reason_codes import TTS_REASON_EDGE_INIT_FAILED, tts_reason


class EdgeTTSEngine(TTSEngine):
    def probe(self) -> bool:
        return bool(edge_tts_client.initialize())

    def runtime_reason(self) -> Optional[Any]:
        return tts_reason(TTS_REASON_EDGE_INIT_FAILED)

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        voice = TTSConfig.resolve_voice(request.locale, request.accent, request.gender)
        return bool(voice and edge_tts_client.synthesize(
            request.text, voice, request.output_path, volume=request.volume, pitch=request.pitch,
        ))


edge_engine = EdgeTTSEngine("edge")


__all__ = ["EdgeTTSEngine", "edge_engine"]
